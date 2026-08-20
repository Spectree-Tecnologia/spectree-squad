import { SandboxConfigurationError, SandboxDeniedError } from '../errors.js';
import { SANDBOX_MODES, mostRestrictiveMode, modeRank } from './execution-boundary.js';
import { createSandboxPolicy } from './sandbox-policy.js';

/**
 * SandboxProfileResolver (spec Fase 5, secoes 24, 136-137): decide QUAL
 * SandboxPolicy vale para uma execucao, a partir de
 *
 *   Runtime configuration  >  Capability profile  >  Tool requested
 *
 * A camada mais restritiva vence (secao 137). Uma Tool pode PEDIR, nunca
 * ampliar (secoes 133-135, INV-508): o pedido dela e limitado pelo teto
 * do Runtime, e um pedido mais permissivo que o teto e simplesmente
 * ignorado — nao e erro do agente, e teto do sistema.
 *
 * O perfil e DADO declarativo (secao 56), nunca hardcode dentro dos
 * Providers.
 *
 * @typedef {object} SandboxProfileDocument
 * @property {string} runtimeMaxMode          teto absoluto do Runtime
 * @property {boolean} [allowPartialEnforcement]
 * @property {string} [workspaceRoot]
 * @property {object} capabilities            por capability -> operations
 */

/**
 * Cada operacao declara o modo MINIMO que precisa para acontecer
 * (secoes 25 e 132). Operacao nao classificada nao executa: e
 * SandboxConfigurationError, para que Tool mutante nova nao apareca sem
 * perfil (secao 132, "configuration-required").
 */
function requiredModeFor(document, capabilityId, operation) {
  const capability = document.capabilities?.[capabilityId];
  const declared = capability?.operations?.[operation];
  if (!declared || !declared.requires) {
    throw new SandboxConfigurationError(
      "no sandbox profile declared for '" + capabilityId + '.' + operation +
      "' — classify the operation before it can execute",
    );
  }
  if (!SANDBOX_MODES.includes(declared.requires)) {
    throw new SandboxConfigurationError(
      "sandbox profile for '" + capabilityId + '.' + operation +
      "' declares unknown mode: " + String(declared.requires),
    );
  }
  return declared.requires;
}

export function normalizeSandboxProfileDocument(document) {
  if (!document || typeof document !== 'object') {
    throw new SandboxConfigurationError('sandbox profile document must be an object');
  }
  const runtimeMaxMode = document.runtimeMaxMode ?? 'workspace-write';
  if (!SANDBOX_MODES.includes(runtimeMaxMode)) {
    throw new SandboxConfigurationError('unknown runtimeMaxMode: ' + String(runtimeMaxMode));
  }
  if (!document.capabilities || typeof document.capabilities !== 'object') {
    throw new SandboxConfigurationError('sandbox profile document must declare capabilities');
  }
  return Object.freeze({ ...document, runtimeMaxMode });
}

export class SandboxProfileResolver {
  #document;
  #workspaceRoot;

  constructor({ document, workspaceRoot = null }) {
    this.#document = normalizeSandboxProfileDocument(document);
    // sem autoridade ambiental (secao 129): a raiz e injetada, nunca
    // lida de cwd ou de variavel de ambiente
    this.#workspaceRoot = workspaceRoot ?? document.workspaceRoot ?? null;
  }

  get runtimeMaxMode() {
    return this.#document.runtimeMaxMode;
  }

  /**
   * Resolve a SandboxPolicy efetiva de uma execucao.
   * @returns {{policy: object, requiredMode: string, requestedMode: string}}
   * @throws {SandboxDeniedError} quando o teto e mais restritivo do que a
   *   operacao exige — autorizada em principio, impossivel neste ambiente
   *   (secoes 31, 58).
   */
  resolve({ tool, capabilityId, operation, effects = null }) {
    // Fase 8 (secoes 28-31): com um EffectSet autorizado, o modo
    // necessario e derivado do CONJUNTO — cada efeito exige o seu, e o
    // mais exigente vence. Efeito de kind/operation nao classificado
    // continua sendo SandboxConfigurationError (secao 132 F5): o
    // conjunto nunca AMPLIA o que o perfil declarou.
    const requiredMode = Array.isArray(effects) && effects.length > 0
      ? effects
          .map((effect) => requiredModeFor(this.#document, effect.kind, effect.operation))
          .reduce((a, b) => (modeRank(a) >= modeRank(b) ? a : b))
      : requiredModeFor(this.#document, capabilityId, operation);
    const capabilityCeiling = this.#document.capabilities?.[capabilityId]?.maxMode
      ?? this.#document.runtimeMaxMode;

    // pedido da Tool: so pode restringir (secoes 133-135)
    const toolRequested = tool?.sandbox?.mode ?? null;
    if (toolRequested && !SANDBOX_MODES.includes(toolRequested)) {
      throw new SandboxConfigurationError(
        "tool '" + (tool?.id ?? '?') + "' requests unknown sandbox mode: " + String(toolRequested),
      );
    }

    // teto efetivo = a camada mais restritiva de todas (secao 134/137)
    let ceiling = mostRestrictiveMode(this.#document.runtimeMaxMode, capabilityCeiling);
    if (toolRequested) ceiling = mostRestrictiveMode(ceiling, toolRequested);

    // a operacao precisa caber no teto; se nao cabe, e negacao FISICA,
    // nao de autoridade — erro distinto de PolicyDeniedError (secao 31)
    if (modeRank(ceiling) < modeRank(requiredMode)) {
      throw new SandboxDeniedError(
        "operation '" + capabilityId + '.' + operation + "' requires sandbox mode '" + requiredMode +
        "' but the effective boundary is '" + ceiling + "'",
        {
          boundary: ceiling,
          requiredMode,
          capabilityId,
          operation,
        },
      );
    }

    // o modo efetivo e o MINIMO suficiente, nunca o teto inteiro: pedir
    // mais privilegio do que a operacao precisa e ampliacao silenciosa
    const mode = requiredMode;
    const policy = createSandboxPolicy({
      mode,
      workspaceRoot: this.#workspaceRoot,
      allowPartialEnforcement: this.#document.allowPartialEnforcement === true,
      requiredEnforcement: this.#document.requiredEnforcement,
    });
    return { policy, requiredMode, requestedMode: toolRequested ?? mode, ceiling };
  }
}
