import { CapabilityError, CapabilityProviderError, CapabilityProviderNotFoundError } from '../errors.js';

/**
 * Contrato de Provider (spec Fase 4, secao 10):
 * @typedef {object} CapabilityProvider
 * @property {string} providerId    ex.: "local-filesystem"
 * @property {string} capabilityId  exatamente UMA capability (secao 13)
 * @property {string} version
 * @property {string[]} operations  subconjunto das operations da capability
 * @property {(request: object, context: object) => Promise<{output: *, metadata?: object}>} execute
 *
 * Provider e o braco do runtime no mundo real, nunca o dono da autoridade
 * (secao 157): ele nao autoriza a propria execucao (INV-405) e assume que
 * o runtime ja decidiu — mas valida as proprias invariantes fisicas
 * (secao 47) e a operacao recebida (secao 137, defense in depth).
 */

/**
 * Registro explicito de Providers (secao 12). Valida no registro (secao
 * 56): capability existe no CapabilityRegistry, operations sao
 * subconjunto das da capability, providerId unico. Metadata congelada
 * (secao 122). Um Provider default por capability nesta fase; o contrato
 * permite multiplos no futuro (secao 53).
 */
export class CapabilityProviderRegistry {
  #capabilityRegistry;
  #byId = new Map();
  #byCapability = new Map();

  constructor({ capabilityRegistry }) {
    this.#capabilityRegistry = capabilityRegistry;
  }

  register(provider) {
    for (const field of ['providerId', 'capabilityId', 'version']) {
      if (typeof provider?.[field] !== 'string' || provider[field].length === 0) {
        throw new CapabilityProviderError('provider is missing required field: ' + field);
      }
    }
    if (typeof provider.execute !== 'function') {
      throw new CapabilityProviderError(
        'provider ' + provider.providerId + ': execute must be a function',
      );
    }
    if (this.#byId.has(provider.providerId)) {
      throw new CapabilityProviderError('provider already registered: ' + provider.providerId);
    }
    if (!this.#capabilityRegistry.has(provider.capabilityId)) {
      throw new CapabilityError(
        'provider ' + provider.providerId + ' declares unknown capability: ' + provider.capabilityId,
      );
    }
    const capability = this.#capabilityRegistry.resolve(provider.capabilityId);
    if (!Array.isArray(provider.operations) || provider.operations.length === 0) {
      throw new CapabilityProviderError(
        'provider ' + provider.providerId + ' must declare its operations',
      );
    }
    for (const operation of provider.operations) {
      if (!capability.operations.includes(operation)) {
        throw new CapabilityProviderError(
          'provider ' + provider.providerId + " declares operation '" + operation +
          "' not present in capability '" + capability.id + "'",
        );
      }
    }
    // metadata congelada (secao 122); a instancia segue viva para executar
    Object.freeze(provider.operations);
    this.#byId.set(provider.providerId, provider);
    if (!this.#byCapability.has(provider.capabilityId)) {
      this.#byCapability.set(provider.capabilityId, []);
    }
    this.#byCapability.get(provider.capabilityId).push(provider);
    return provider;
  }

  /** Provider default da capability (o primeiro registrado, secao 53). */
  resolve(capabilityId) {
    const providers = this.#byCapability.get(capabilityId);
    if (!providers || providers.length === 0) {
      throw new CapabilityProviderNotFoundError(capabilityId);
    }
    return providers[0];
  }

  has(capabilityId) {
    return this.#byCapability.has(capabilityId);
  }

  list() {
    return [...this.#byId.values()].map((p) =>
      Object.freeze({
        providerId: p.providerId,
        capabilityId: p.capabilityId,
        version: p.version,
        operations: p.operations,
      }),
    );
  }
}
