import { PolicyConfigurationError } from '../errors.js';

/**
 * Uma Policy e uma regra declarativa (spec Fase 2, secao 11):
 * @typedef {object} Policy
 * @property {string} id
 * @property {'allow'|'deny'|'approval-required'} effect
 * @property {string|string[]|{id:string}} [principal]    aceita singular ou plural
 * @property {string|string[]|{id:string}} [tool]         glob simples permitido
 * @property {string|string[]|{id:string}} [capability]
 * @property {string|string[]} [operation]
 * @property {string|string[]|{type:string,id:string}} [resource]  "id" ou "type/id"
 * @property {number} [priority]  desempata a selecao; NUNCA transforma deny em allow
 *
 * Campo omitido significa wildcard (secao 38). A policy nao executa
 * codigo de Tool (P-003) e, registrada, e imutavel (secao 59): mudar de
 * ideia e replace, nunca mutacao silenciosa.
 */

const EFFECTS = ['allow', 'deny', 'approval-required'];

const toArray = (value) =>
  value === undefined || value === null ? undefined : Array.isArray(value) ? value : [value];

const idOf = (entry) => (typeof entry === 'string' ? entry : entry?.id);

const resourcePattern = (entry) => {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    if (entry.type && entry.id) return entry.type + '/' + entry.id;
    return entry.id ?? (entry.type ? entry.type + '/*' : undefined);
  }
  return undefined;
};

/** Normaliza e congela; entrada invalida lanca PolicyConfigurationError. */
function normalizePolicy(policy) {
  if (!policy || typeof policy.id !== 'string' || policy.id.length === 0) {
    throw new PolicyConfigurationError('policy requires a non-empty string id');
  }
  if (!EFFECTS.includes(policy.effect)) {
    throw new PolicyConfigurationError(
      "policy '" + policy.id + "' has invalid effect: " + String(policy.effect),
    );
  }
  const normalized = {
    id: policy.id,
    effect: policy.effect,
    priority: Number.isFinite(policy.priority) ? policy.priority : 0,
    principals: toArray(policy.principals ?? policy.principal)?.map(idOf),
    tools: toArray(policy.tools ?? policy.tool)?.map(idOf),
    capabilities: toArray(policy.capabilities ?? policy.capability)?.map(idOf),
    operations: toArray(policy.operations ?? policy.operation)?.map(idOf),
    resources: toArray(policy.resources ?? policy.resource)?.map(resourcePattern),
  };
  for (const key of ['principals', 'tools', 'capabilities', 'operations', 'resources']) {
    const values = normalized[key];
    if (values === undefined) continue;
    if (values.length === 0 || values.some((v) => typeof v !== 'string' || v.length === 0)) {
      throw new PolicyConfigurationError(
        "policy '" + policy.id + "' has an invalid matcher in '" + key + "'",
      );
    }
    Object.freeze(values);
  }
  return Object.freeze(normalized);
}

/**
 * Guarda as policies, separado da avaliacao (secao 17): storage e
 * configuracao de um lado, logica de autorizacao do outro. No futuro
 * pode ser alimentado por arquivo, banco ou provider remoto sem alterar
 * o PolicyEngine — register() ja aceita objetos JSON puros.
 */
export class PolicyRegistry {
  #policies = new Map();

  register(policy) {
    const normalized = normalizePolicy(policy);
    if (this.#policies.has(normalized.id)) {
      throw new PolicyConfigurationError('policy already registered: ' + normalized.id);
    }
    this.#policies.set(normalized.id, normalized);
    return normalized;
  }

  registerMany(policies) {
    for (const policy of policies) this.register(policy);
  }

  remove(id) {
    this.#policies.delete(id);
  }

  replace(policy) {
    this.remove(policy?.id);
    return this.register(policy);
  }

  get(id) {
    return this.#policies.get(id);
  }

  /** Ordem de insercao estavel — parte do determinismo do engine. */
  list() {
    return [...this.#policies.values()];
  }
}
