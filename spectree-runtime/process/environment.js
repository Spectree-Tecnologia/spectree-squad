import { ProcessConfigurationError } from '../errors.js';

/**
 * ProcessEnvironment (spec Fase 6, secoes 19-25, 102-103).
 *
 * O ambiente do filho NUNCA e o ambiente do host por inteiro (INV-610):
 * segredo nao entra num processo so por estar no ambiente de quem o
 * criou. A composicao e em quatro passos, nesta ordem:
 *
 *   1. base minima segura, derivada do host por ALLOWLIST;
 *   2. scrub do namespace SPECTREE_* herdado (secao 23) — fatos do
 *      Runtime nao sao confiaveis quando vem do host;
 *   3. overrides explicitos do spec (secao 103: explicito e permitido);
 *   4. variaveis gerenciadas SPECTREE_*, escritas por ultimo pelo
 *      Runtime — a unica fonte legitima do namespace (INV-611).
 */

/** Minimo para um processo funcionar; nada de credencial (secao 25). */
const MINIMAL_SAFE_KEYS = Object.freeze(
  process.platform === 'win32'
    ? ['PATH', 'PATHEXT', 'SYSTEMROOT', 'SYSTEMDRIVE', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'NUMBER_OF_PROCESSORS', 'OS']
    : ['PATH', 'HOME', 'TMPDIR', 'LANG', 'TZ'],
);

const isSpectreeKey = (key) => key.toUpperCase().startsWith('SPECTREE_');

/**
 * @param {object} options
 * @param {object} options.hostEnv        injetado, nunca lido de ambiente global pelo Provider
 * @param {string[]} [options.allowedEnvironmentKeys]  allowlist adicional (secao 25)
 * @param {object} [options.overrides]    valores explicitos do spec
 * @param {object} [options.managed]      fatos SPECTREE_* do Runtime
 */
export function buildProcessEnvironment({ hostEnv, allowedEnvironmentKeys = [], overrides = {}, managed = {} }) {
  if (!hostEnv || typeof hostEnv !== 'object') {
    throw new ProcessConfigurationError('hostEnv must be injected');
  }
  const env = {};
  // 1. base minima por allowlist — case-insensitive no Windows
  const allowed = new Set([...MINIMAL_SAFE_KEYS, ...allowedEnvironmentKeys].map((k) => k.toUpperCase()));
  for (const [key, value] of Object.entries(hostEnv)) {
    if (value === undefined) continue;
    if (!allowed.has(key.toUpperCase())) continue;
    // 2. scrub: SPECTREE_* herdado do host NUNCA passa (secao 23),
    // nem que esteja na allowlist
    if (isSpectreeKey(key)) continue;
    env[key] = value;
  }
  // 3. overrides explicitos — mas o namespace do Runtime nao e
  // sobrescrevivel por spec (INV-611)
  for (const [key, value] of Object.entries(overrides)) {
    if (isSpectreeKey(key)) {
      throw new ProcessConfigurationError(
        'SPECTREE_* is a runtime-managed namespace: ' + key + ' cannot be set via spec overrides',
      );
    }
    if (typeof value !== 'string') {
      throw new ProcessConfigurationError('env override ' + key + ' must be a string');
    }
    env[key] = value;
  }
  // 4. fatos gerenciados, por ultimo: a palavra final e do Runtime
  for (const [key, value] of Object.entries(managed)) {
    if (!isSpectreeKey(key)) {
      throw new ProcessConfigurationError('managed environment keys must live under SPECTREE_*: ' + key);
    }
    if (value !== undefined && value !== null) env[key] = String(value);
  }
  return env;
}

export { MINIMAL_SAFE_KEYS };
