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
  #resourceBindings;

  constructor({ document, workspaceRoot = null, resourceBindings = null }) {
    this.#document = normalizeSandboxProfileDocument(document);
    // sem autoridade ambiental (secao 129): a raiz e injetada, nunca
    // lida de cwd ou de variavel de ambiente
    this.#workspaceRoot = workspaceRoot ?? document.workspaceRoot ?? null;
    // F9 (E1): mapa resourceId canonico -> physicalPath, vindo da
    // CONFIGURACAO do host (resultado de calibracao aprovada). Um
    // binding sozinho nao monta nada: so materializa quando um efeito
    // AUTORIZADO o referencia.
    this.#resourceBindings = resourceBindings ? Object.freeze({ ...resourceBindings }) : null;
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

    // F9 (E1, secoes 57-58): efeitos autorizados x bindings declarados =
    // declaredResources. Efeito de credencial SEM binding fisico e
    // fail-closed — recurso autorizado que nao pode ser materializado
    // nao vira execucao sem o recurso, vira recusa explicita.
    const declaredResources = [];
    for (const effect of effects ?? []) {
      if (effect.operation !== 'read') continue;
      const resourceId = effect.resource.type + '/' + effect.resource.id;
      const physicalPath = this.#resourceBindings?.[resourceId];
      if (physicalPath) {
        declaredResources.push({ resourceId, physicalPath, mode: 'read' });
      } else if (effect.resource.type === 'credential') {
        throw new SandboxConfigurationError(
          "credential resource '" + resourceId + "' is authorized but has no physical binding — " +
          'run credential calibration and declare the approved binding (F9 secao 22)',
        );
      }
    }

    const policy = createSandboxPolicy({
      mode,
      workspaceRoot: this.#workspaceRoot,
      declaredResources,
      allowPartialEnforcement: this.#document.allowPartialEnforcement === true,
      requiredEnforcement: this.#document.requiredEnforcement,
    });
    return { policy, requiredMode, requestedMode: toolRequested ?? mode, ceiling };
  }
}
