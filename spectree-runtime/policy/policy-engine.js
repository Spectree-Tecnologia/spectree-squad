/**
 * Contexto da decisao (spec Fase 2, secao 7) — snapshot imutavel:
 * @typedef {object} AuthorizationContext
 * @property {{type: string, id: string|null}} principal
 * @property {{id: string|null}} session
 * @property {{id: string, capability: string}} tool
 * @property {string} operation
 * @property {object} input     minimo necessario; nunca replicado em evento
 * @property {{type: string|null, id: string|null}|null} resource
 */

/**
 * Decisao explicita do runtime (secao 12):
 * @typedef {object} PolicyDecision
 * @property {'allow'|'deny'|'approval-required'} effect
 * @property {string} policyId  'default-deny' quando nenhuma regra correspondeu
 * @property {string} reason    deterministico, nunca gerado por LLM
 */

const escapeRegex = (part) =>
  part.replace(/[.*+?^${}()|[\]\\]/g, (ch) => '\\' + ch);

/** Glob simples: '*' e o unico curinga (secao 37). */
function matchesPattern(pattern, value) {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return pattern === value;
  const regex = new RegExp('^' + pattern.split('*').map(escapeRegex).join('.*') + '$');
  return regex.test(value ?? '');
}

const matchesAny = (patterns, value) => patterns.some((p) => matchesPattern(p, value));

/** Campos omitidos na policy sao wildcard (secao 38). */
function policyMatches(policy, context) {
  if (policy.principals && !matchesAny(policy.principals, context.principal?.id)) return false;
  if (policy.tools && !matchesAny(policy.tools, context.tool?.id)) return false;
  if (policy.capabilities && !matchesAny(policy.capabilities, context.tool?.capability)) return false;
  if (policy.operations && !matchesAny(policy.operations, context.operation)) return false;
  if (policy.resources) {
    const resource = context.resource;
    if (!resource) return false;
    const full = (resource.type ?? '') + '/' + (resource.id ?? '');
    if (!policy.resources.some((p) => matchesPattern(p, full) || matchesPattern(p, resource.id))) {
      return false;
    }
  }
  return true;
}

function describeContext(context) {
  const resource = context.resource
    ? ", resource '" + (context.resource.type ?? '?') + '/' + (context.resource.id ?? '?') + "'"
    : '';
  return (
    "principal '" + (context.principal?.id ?? 'unknown') + "' -> tool '" +
    (context.tool?.id ?? 'unknown') + "' (operation '" + context.operation + "'" + resource + ')'
  );
}

const VERBS = {
  allow: 'explicitly allows',
  deny: 'explicitly denies',
  'approval-required': 'requires approval for',
};

/**
 * Responde "pode?" e nada alem disso (P-003): recebe contexto, devolve
 * decisao, zero efeito colateral. Deterministico por construcao (secao
 * 36): sem LLM, sem relogio, sem rede, sem aleatoriedade. Precedencia
 * fixa: explicit deny > approval-required > explicit allow > default
 * deny (secao 13). priority desempata a selecao dentro do mesmo efeito
 * e NUNCA inverte a precedencia (secao 14).
 */
export class PolicyEngine {
  #registry;

  constructor({ registry }) {
    this.#registry = registry;
  }

  /** @returns {PolicyDecision} */
  decide(context) {
    const matched = this.#registry.list().filter((policy) => policyMatches(policy, context));
    for (const effect of ['deny', 'approval-required', 'allow']) {
      const winner = matched
        .filter((policy) => policy.effect === effect)
        .sort((a, b) => b.priority - a.priority)[0];
      if (winner) {
        return {
          effect,
          policyId: winner.id,
          reason: "policy '" + winner.id + "' " + VERBS[effect] + ' ' + describeContext(context),
        };
      }
    }
    // Default Deny (P-001): ausencia de regra nunca concede acesso.
    return {
      effect: 'deny',
      policyId: 'default-deny',
      reason: 'no policy grants ' + describeContext(context),
    };
  }
}
