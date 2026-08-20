import {
  CapabilityNotFoundError,
  UnsupportedCapabilityOperationError,
  ProviderOperationNotSupportedError,
} from '../errors.js';

/**
 * Resolucao Tool -> Capability -> Provider (spec Fase 4, secoes 131-134).
 * Nao executa nada: devolve a peca resolvida ou lanca erro tipado, um por
 * degrau da matriz (secao 154). A partir da Fase 4 o CapabilityRegistry e
 * gate obrigatorio (secao 58, INV-421): capability desconhecida bloqueia
 * — inclusive o fallback de tool legada (secao 59).
 */
export class CapabilityResolver {
  #capabilityRegistry;
  #providerRegistry;

  constructor({ capabilityRegistry, providerRegistry }) {
    this.#capabilityRegistry = capabilityRegistry;
    this.#providerRegistry = providerRegistry;
  }

  /** Gate de capability + operation (secoes 16-17). */
  resolveCapability(tool, operation) {
    const capabilityId = tool.capability ?? tool.id;
    if (!this.#capabilityRegistry.has(capabilityId)) {
      throw new CapabilityNotFoundError(capabilityId);
    }
    const capability = this.#capabilityRegistry.resolve(capabilityId);
    if (!capability.operations.includes(operation)) {
      throw new UnsupportedCapabilityOperationError(capabilityId, operation);
    }
    return capability;
  }

  /** Gate de provider + operation do provider (secoes 18-19). */
  resolveProvider(capabilityId, operation) {
    const provider = this.#providerRegistry.resolve(capabilityId);
    if (!provider.operations.includes(operation)) {
      throw new ProviderOperationNotSupportedError(provider.providerId, operation);
    }
    return provider;
  }
}
