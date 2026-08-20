import { existsSync, lstatSync, readlinkSync, realpathSync, accessSync, constants } from 'node:fs';
import path from 'node:path';
import { SandboxConfigurationError } from '../../../errors.js';

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

export class BubblewrapBackend {
  backendId = 'bubblewrap';
  /** O que este backend ENTREGA para o profile da fase (secao 38). */
  enforcement = 'full';

  #explicitPath;
  #located = null;
  #fsImpl;

  constructor({ bwrapPath = null, fsImpl = null } = {}) {
    this.#explicitPath = bwrapPath;
    this.#fsImpl = fsImpl ?? { existsSync, lstatSync, readlinkSync, realpathSync, accessSync };
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

  #coveredBySystemRoots(dir) {
    return [...SYSTEM_RO_ROOTS, ...MERGED_USR_LINKS].some(
      (root) => dir === root || dir.startsWith(root + '/'),
    );
  }

  #safeRealpath(target) {
    try { return this.#fsImpl.realpathSync(target); } catch { return path.resolve(target); }
  }
}
