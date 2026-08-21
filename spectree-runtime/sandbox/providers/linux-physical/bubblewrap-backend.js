import { existsSync, lstatSync, readlinkSync, realpathSync, statSync, accessSync, constants } from 'node:fs';
import path from 'node:path';
import { SandboxConfigurationError } from '../../../errors.js';
import { assertBindablePhysicalPath, safeHomedir } from '../../sandbox-policy.js';

/**
 * BubblewrapBackend (spec Fase 7, secoes 7, 9, 26, 35): o runner
 * preferencial. Bubblewrap cria um mount namespace novo e monta
 * EXPLICITAMENTE o que o processo pode ver — o resto do filesystem
 * simplesmente nao existe dentro da sandbox.
 *
 * O Spectree nao reimplementa namespaces (secao 10): ele constroi a
 * invocacao do bwrap a partir da policy e observa o resultado. O argv
 * original entra intacto depois de `--` (secao 26) — launcher prefixado,
 * nunca alteracao semantica.
 *
 * Enforcement: `full` para o profile de filesystem desta fase — mas o
 * veredito so vale depois do functional probe (secao 14): full e fato,
 * nao configuracao.
 */

/** Caminhos controlados (secoes 51-52, 56): nunca o PATH ambiente. */
const WELL_KNOWN_BWRAP_PATHS = Object.freeze([
  '/usr/bin/bwrap',
  '/usr/local/bin/bwrap',
  '/bin/bwrap',
]);

/** Roots de sistema visiveis read-only: pre-requisitos de execucao. */
const SYSTEM_RO_ROOTS = Object.freeze(['/usr', '/etc', '/opt']);

/** Entradas merged-usr que precisam virar symlink dentro do namespace. */
const MERGED_USR_LINKS = Object.freeze(['/bin', '/sbin', '/lib', '/lib32', '/lib64', '/libx32']);

/**
 * Symlinks de sistema cujo ALVO vive fora das roots bindadas (patch F7,
 * descoberto na calibracao da F9). Enumerado de proposito e curto: varrer
 * /etc atras de todo symlink pendurado seria enumerar por varredura, com
 * um mount plan imprevisivel puxando qualquer coisa. O ALVO, esse sim, e
 * derivado do disco.
 */
const SYSTEM_LINKS = Object.freeze(['/etc/resolv.conf']);

export class BubblewrapBackend {
  backendId = 'bubblewrap';
  /** O que este backend ENTREGA para o profile da fase (secao 38). */
  enforcement = 'full';

  #explicitPath;
  #located = null;
  #fsImpl;

  constructor({ bwrapPath = null, fsImpl = null } = {}) {
    this.#explicitPath = bwrapPath;
    this.#fsImpl = fsImpl ?? { existsSync, lstatSync, readlinkSync, realpathSync, statSync, accessSync };
  }

  /**
   * Localiza e valida o executavel (secoes 51-52): existe, e executavel,
   * e vem de caminho controlado — nunca de um PATH arbitrario.
   */
  async locate() {
    const candidates = this.#explicitPath ? [this.#explicitPath] : WELL_KNOWN_BWRAP_PATHS;
    for (const candidate of candidates) {
      if (!this.#fsImpl.existsSync(candidate)) continue;
      try {
        this.#fsImpl.accessSync(candidate, constants.X_OK);
      } catch {
        continue;
      }
      this.#located = this.#fsImpl.realpathSync(candidate);
      return Object.freeze({ ok: true, path: this.#located, enforcement: this.enforcement });
    }
    return Object.freeze({
      ok: false,
      reason: 'bwrap not found in controlled locations (' + candidates.join(', ') + ')',
    });
  }

  /**
   * Constroi a invocacao confinada (secoes 24-26, 30-31, 35):
   *
   *   [bwrap, mounts..., --chdir cwd, --, argv original intacto]
   *
   * read-only: workspace ro-bind, NENHUMA root gravavel (nem tmpfs).
   * workspace-write: workspace bind rw + sessionTemp rw quando presente.
   * O resto do filesystem: apenas as roots de sistema, read-only —
   * outside nao e "negado", outside NAO EXISTE no namespace.
   */
  buildConfinedArgv({ argv, cwd, mode, workspaceRoot, sessionTemp = null, declaredResources = null }) {
    if (!this.#located) {
      throw new SandboxConfigurationError('bubblewrap backend not located — probe first');
    }
    if (!Array.isArray(argv) || argv.length === 0 || argv.some((a) => typeof a !== 'string')) {
      throw new SandboxConfigurationError('confined argv must be a non-empty array of strings');
    }
    if (mode !== 'read-only' && mode !== 'workspace-write') {
      throw new SandboxConfigurationError('bubblewrap backend does not confine mode: ' + String(mode));
    }
    if (typeof workspaceRoot !== 'string' || workspaceRoot.length === 0) {
      throw new SandboxConfigurationError('confined execution requires a workspaceRoot');
    }

    const args = [this.#located, '--die-with-parent'];
    for (const root of SYSTEM_RO_ROOTS) {
      if (this.#fsImpl.existsSync(root)) args.push('--ro-bind', root, root);
    }
    for (const link of MERGED_USR_LINKS) {
      let stat = null;
      try { stat = this.#fsImpl.lstatSync(link); } catch { continue; }
      if (stat.isSymbolicLink()) {
        // merged-usr (Ubuntu/Debian): /bin -> usr/bin precisa ser
        // recriado como symlink, bind de symlink quebra o exec
        args.push('--symlink', this.#fsImpl.readlinkSync(link), link);
      } else if (stat.isDirectory()) {
        args.push('--ro-bind', link, link);
      }
    }
    // Fidelidade do mount plan (patch F7): `--ro-bind /etc /etc` binda o
    // DIRETORIO, nunca o que os symlinks dele alcancam. Symlink de
    // sistema que ficaria PENDURADO dentro do namespace tem o alvo
    // bindado, pontualmente — ver mountFidelity().
    for (const link of this.mountFidelity()) {
      if (link.status === 'bindable') args.push('--ro-bind', link.target, link.target);
    }
    args.push('--proc', '/proc', '--dev', '/dev');

    // o executavel precisa ser visivel mesmo fora das roots de sistema
    // (node via nvm em /home, por exemplo) — ro-bind do diretorio real
    const executableDir = path.dirname(this.#safeRealpath(argv[0]));
    if (!this.#coveredBySystemRoots(executableDir) && this.#fsImpl.existsSync(executableDir)) {
      args.push('--ro-bind', executableDir, executableDir);
    }

    const physicalWorkspace = this.#safeRealpath(workspaceRoot);
    args.push(mode === 'read-only' ? '--ro-bind' : '--bind', physicalWorkspace, physicalWorkspace);
    if (sessionTemp && mode === 'workspace-write') {
      args.push('--bind', sessionTemp, sessionTemp);
    }
    // F9 (E1): narrowing por recurso — cada recurso JA AUTORIZADO pelo
    // EffectSet vira um ro-bind PONTUAL. Nunca uma root ampla, nunca
    // HOME, nunca algo que o EffectSet nao declarou.
    for (const resource of declaredResources ?? []) {
      args.push('--ro-bind', resource.physicalPath, resource.physicalPath);
    }
    args.push('--chdir', cwd ?? physicalWorkspace);
    args.push('--');
    // secao 26: o argv original permanece sem alteracao semantica
    args.push(...argv);
    return Object.freeze(args);
  }

  /**
   * Fidelidade do mount plan para os symlinks de sistema (patch F7).
   *
   * O defeito que isto corrige: bindar `/etc` promete `/etc` e nao
   * cumpre. Em WSL, `/etc/resolv.conf` aponta para `/mnt/wsl/...`; em
   * qualquer distro com systemd-resolved — Ubuntu 18.04+, Fedora, boa
   * parte do Debian, e o `ubuntu-latest` do nosso CI — aponta para
   * `/run/systemd/resolve/...`. Nem `/mnt` nem `/run` estao nas roots,
   * entao o namespace recebe um symlink pendurado e o DNS morre. O
   * sintoma e TIMEOUT, nao erro: o pior formato de falha possivel,
   * porque nao se parece com uma.
   *
   * Deriva do disco (LESSONS 2026-08-20): o alvo vem do realpath, o tipo
   * vem do statSync, e o alvo passa pelo MESMO piso dos
   * declaredResources (INV-906). Nada aqui amplia a postura de
   * seguranca: a rede ja e deliberadamente disponivel nesta fase
   * (ADR-07 decisao 10, sem `--unshare-net`) e o material exposto e
   * configuracao de DNS, nunca credencial.
   *
   * Observabilidade e metade da correcao: o status viaja em
   * `diagnostics()`, para que a proxima quebra seja lida em vez de
   * depurada.
   *
   * @returns {ReadonlyArray<{path: string, status: string, target: string|null}>}
   *   status: 'absent' | 'not-a-symlink' | 'covered' | 'bindable'
   *   | 'broken-on-host' | 'not-a-file' | 'refused-by-floor'
   */
  mountFidelity() {
    return Object.freeze(SYSTEM_LINKS.map((linkPath) => {
      const verdict = (status, target = null) => Object.freeze({ path: linkPath, status, target });
      let stat = null;
      try { stat = this.#fsImpl.lstatSync(linkPath); } catch { return verdict('absent'); }
      // arquivo real: o ro-bind de /etc ja o cobre, nada a fazer
      if (!stat.isSymbolicLink()) return verdict('not-a-symlink');
      let target = null;
      try { target = this.#fsImpl.realpathSync(linkPath); } catch { return verdict('broken-on-host'); }
      if (this.#coveredBySystemRoots(target)) return verdict('covered', target);
      let targetStat = null;
      try { targetStat = this.#fsImpl.statSync(target); } catch { return verdict('broken-on-host', target); }
      // derivado do disco: so arquivo vira bind — alvo que virou
      // diretorio e sintoma, nao caso de uso
      if (!targetStat.isFile()) return verdict('not-a-file', target);
      try {
        assertBindablePhysicalPath(target, { homePath: safeHomedir(), label: linkPath + ' target' });
      } catch {
        // o piso vence: nao monta. Mas nao some — o status diz por que
        return verdict('refused-by-floor', target);
      }
      return verdict('bindable', target);
    }));
  }

  #coveredBySystemRoots(dir) {
    return [...SYSTEM_RO_ROOTS, ...MERGED_USR_LINKS].some(
      (root) => dir === root || dir.startsWith(root + '/'),
    );
  }

  #safeRealpath(target) {
    try { return this.#fsImpl.realpathSync(target); } catch { return path.resolve(target); }
  }
}
