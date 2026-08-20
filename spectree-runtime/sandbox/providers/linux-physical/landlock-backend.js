import { existsSync, accessSync, realpathSync, constants } from 'node:fs';
import { SandboxConfigurationError } from '../../../errors.js';

/**
 * LandlockBackend (spec Fase 7, secoes 7-8, 17, 36-37, 54-57): o
 * fallback do chain quando bubblewrap nao esta disponivel.
 *
 * Landlock exige um launcher NATIVO pequeno e isolado (secao 54) que
 * aplica as regras via API do kernel e faz exec do argv original —
 * fail-closed em qualquer erro. Este backend e o SEAM formal para esse
 * launcher: identidade, localizacao controlada, construcao de argv e
 * participacao no probe chain ja existem e estao travadas por teste.
 *
 * O launcher em si NAO acompanha esta fase (secao 121: "existir ou
 * estar formalmente suportado pelo seam"). Sem o helper instalado, o
 * locate() devolve unusable com a razao — nunca um fallback silencioso
 * (secao 60) e nunca um `full` de configuracao (secao 14).
 *
 * Quando o helper existir: a ABI do kernel decide o enforcement
 * (secao 37) — ABI incompleta = `partial`, e um profile exigindo `full`
 * rejeita o backend em vez de degradar (secao 38, INV-711).
 */
export class LandlockBackend {
  backendId = 'landlock';
  /** Ajustado no locate() a partir do report do helper (secao 37). */
  enforcement = 'partial';

  #helperPath;
  #helperEnforcement;
  #located = null;
  #fsImpl;

  /**
   * @param {object} options
   * @param {string|null} options.helperPath caminho CONTROLADO do
   *   launcher nativo (secao 56: nunca descoberto casualmente no PATH —
   *   vem do pacote/instalacao do Runtime)
   * @param {'full'|'partial'} [options.helperEnforcement] o que o helper
   *   reporta para a ABI local; sem report confiavel, 'partial'
   */
  constructor({ helperPath = null, helperEnforcement = 'partial', fsImpl = null } = {}) {
    this.#helperPath = helperPath;
    this.#helperEnforcement = helperEnforcement === 'full' ? 'full' : 'partial';
    this.#fsImpl = fsImpl ?? { existsSync, accessSync, realpathSync };
  }

  async locate() {
    if (!this.#helperPath) {
      return Object.freeze({
        ok: false,
        reason: 'landlock helper not installed (native launcher required — see ADR-07)',
      });
    }
    if (!this.#fsImpl.existsSync(this.#helperPath)) {
      return Object.freeze({ ok: false, reason: 'landlock helper missing: configured path does not exist' });
    }
    try {
      this.#fsImpl.accessSync(this.#helperPath, constants.X_OK);
    } catch {
      return Object.freeze({ ok: false, reason: 'landlock helper is not executable' });
    }
    this.#located = this.#fsImpl.realpathSync(this.#helperPath);
    this.enforcement = this.#helperEnforcement;
    return Object.freeze({ ok: true, path: this.#located, enforcement: this.enforcement });
  }

  /**
   * Forma da invocacao (secoes 24-26): launcher + policy explicita +
   * `--` + argv original intacto. O helper e quem traduz isso em regras
   * Landlock e faz exec — fail-closed (secao 54).
   */
  buildConfinedArgv({ argv, cwd, mode, workspaceRoot, sessionTemp = null }) {
    if (!this.#located) {
      throw new SandboxConfigurationError('landlock backend not located — probe first');
    }
    if (!Array.isArray(argv) || argv.length === 0 || argv.some((a) => typeof a !== 'string')) {
      throw new SandboxConfigurationError('confined argv must be a non-empty array of strings');
    }
    if (mode !== 'read-only' && mode !== 'workspace-write') {
      throw new SandboxConfigurationError('landlock backend does not confine mode: ' + String(mode));
    }
    const args = [this.#located, '--mode', mode, '--workspace', workspaceRoot];
    if (sessionTemp && mode === 'workspace-write') args.push('--temp', sessionTemp);
    if (cwd) args.push('--chdir', cwd);
    args.push('--');
    args.push(...argv);
    return Object.freeze(args);
  }
}
