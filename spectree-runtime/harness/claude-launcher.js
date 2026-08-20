import { ProcessConfigurationError } from '../errors.js';

/**
 * ClaudeModelHarnessLauncher (spec F9, INV-903): o PRIMEIRO adapter
 * concreto do contrato ModelHarnessLauncher.
 *
 * Este arquivo e o UNICO lugar do runtime onde os literais do CLI —
 * 'claude', '-p', '--output-format' — podem existir (secoes 3, 82, 112;
 * travado por teste estrutural). O launcher conhece argv, flags e
 * convencao de output; NAO conhece Policy, Sandbox, Approval ou
 * Provider (INV-902).
 */
export class ClaudeModelHarnessLauncher {
  launcherId = 'claude-model-harness';
  /** Identidade do adapter para provenance de calibracao (secao 73). */
  version = '1';
  /** O contrato de saida que o parse valida (secoes 34, 67). */
  outputContract = 'json';

  #cliPath;
  #maxOutputBytes;
  #maxLifetimeMs;
  #allowedEnvironmentKeys;

  /**
   * @param {object} options
   * @param {string} [options.cliPath] caminho/nome do CLI — resolvido
   *   depois pelo PATH CONTROLADO do ambiente composto (F6 secao 75)
   * @param {number} [options.maxOutputBytes] orcamento EXPLICITO acima
   *   do default de 1 MiB (secao 33) — o adapter nao eleva por conta
   * @param {number} [options.maxLifetimeMs] pedido de lifetime — o teto
   *   continua sendo do Runtime (secao 39, E2)
   * @param {string[]} [options.allowedEnvironmentKeys] variaveis
   *   adicionais EXPLICITAS (secoes 29-30); nada e copiado do host
   */
  constructor({ cliPath = 'claude', maxOutputBytes = null, maxLifetimeMs = null, allowedEnvironmentKeys = [] } = {}) {
    if (typeof cliPath !== 'string' || cliPath.length === 0) {
      throw new ProcessConfigurationError('cliPath must be a non-empty string');
    }
    this.#cliPath = cliPath;
    this.#maxOutputBytes = maxOutputBytes;
    this.#maxLifetimeMs = maxLifetimeMs;
    this.#allowedEnvironmentKeys = Object.freeze([...allowedEnvironmentKeys]);
  }

  /**
   * Intencao -> ProcessSpawnSpec input (INV-902): argv explicito, nunca
   * shell string (secao 77); stdio explicito por stream (secao 7).
   */
  launch({ mission, cwd = '.' } = {}) {
    if (typeof mission !== 'string' || mission.length === 0) {
      throw new ProcessConfigurationError('a harness mission must be a non-empty string');
    }
    const collect = this.#maxOutputBytes
      ? { mode: 'collect', maxBytes: this.#maxOutputBytes }
      : { mode: 'collect' };
    return Object.freeze({
      argv: Object.freeze([this.#cliPath, '-p', mission, '--output-format', 'json']),
      cwd,
      stdin: Object.freeze({ mode: 'ignore' }),
      stdout: Object.freeze(collect),
      stderr: Object.freeze({ mode: 'collect' }),
      allowedEnvironmentKeys: this.#allowedEnvironmentKeys,
      ...(this.#maxLifetimeMs !== null ? { maxLifetimeMs: this.#maxLifetimeMs } : {}),
    });
  }
}

/**
 * Classificacao do probe de autenticacao (secoes 18-20, 80): o veredito
 * so pode ser auth-ok, auth-insufficient ou runner-failure — nada de
 * UNKNOWN silencioso, e sem classificacao segura o resultado e
 * RUNNER-FAILURE, nunca auth-insufficient.
 *
 * A heuristica e EMPIRICA por natureza (secao 20: a spec nao assume que
 * o CLI tem operacao sem quota) — este classificador e o seam que a
 * calibracao real refina.
 */
export function classifyClaudeAuthProbe({ outcome, stdoutText = '', stderrText = '' } = {}) {
  if (!outcome || outcome.timedOut) {
    return Object.freeze({ verdict: 'runner-failure', reason: 'probe timed out or produced no outcome' });
  }
  const text = String(stdoutText ?? '');
  let document = null;
  try { document = JSON.parse(text); } catch { document = null; }
  if (outcome.exitCode === 0 && document && typeof document === 'object') {
    return Object.freeze({ verdict: 'auth-ok', reason: 'structured response with exit 0' });
  }
  const diagnostic = (text + '\n' + String(stderrText ?? '')).toLowerCase();
  if (/(log ?in|logged out|authenticat|credential|api key|unauthorized|401)/.test(diagnostic)) {
    // execucao valida do CLI, credencial insuficiente para o candidato
    return Object.freeze({ verdict: 'auth-insufficient', reason: 'CLI reported missing authentication' });
  }
  return Object.freeze({
    verdict: 'runner-failure',
    reason: 'exit ' + outcome.exitCode + ' without a classifiable authentication signal',
  });
}
