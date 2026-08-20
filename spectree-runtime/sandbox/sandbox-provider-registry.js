import { SandboxConfigurationError, SandboxUnavailableError } from '../errors.js';
import { SANDBOX_MODES, ENFORCEMENT_LEVELS } from './execution-boundary.js';

/**
 * Contrato de SandboxProvider (spec Fase 5, secao 13):
 * @typedef {object} SandboxProvider
 * @property {string} providerId
 * @property {string} version
 * @property {string[]} platforms      'linux' | 'win32' | 'darwin' | '*'
 * @property {string[]} capabilities   ex.: 'filesystem-write-boundary'
 * @property {(query: object) => boolean} supports
 * @property {(policy: object, context: object) => Promise<object>} apply
 * @property {(policy: object) => object} describe
 *
 * O SandboxProvider RESTRINGE; o CapabilityProvider EXECUTA (secao 14).
 * Nunca o mesmo objeto: um diz onde se pode pisar, o outro pisa.
 */

const KNOWN_CAPABILITIES = Object.freeze([
  'filesystem-read-boundary',
  'filesystem-write-boundary',
  'network-boundary',
  'process-boundary',
  'environment-boundary',
]);

const KNOWN_PLATFORMS = Object.freeze(['*', 'linux', 'win32', 'darwin']);

/**
 * Registro explicito de backends de Sandbox (secao 16). Rejeita
 * duplicata, plataforma desconhecida e capability invalida — declaracao
 * errada morre no registro, nunca em producao.
 */
export class SandboxProviderRegistry {
  #byId = new Map();

  register(provider) {
    for (const field of ['providerId', 'version']) {
      if (typeof provider?.[field] !== 'string' || provider[field].length === 0) {
        throw new SandboxConfigurationError('sandbox provider is missing required field: ' + field);
      }
    }
    for (const method of ['apply', 'describe', 'supports']) {
      if (typeof provider[method] !== 'function') {
        throw new SandboxConfigurationError(
          'sandbox provider ' + provider.providerId + ': ' + method + ' must be a function',
        );
      }
    }
    if (this.#byId.has(provider.providerId)) {
      throw new SandboxConfigurationError('sandbox provider already registered: ' + provider.providerId);
    }
    if (!Array.isArray(provider.platforms) || provider.platforms.length === 0) {
      throw new SandboxConfigurationError(
        'sandbox provider ' + provider.providerId + ' must declare its platforms',
      );
    }
    for (const platform of provider.platforms) {
      if (!KNOWN_PLATFORMS.includes(platform)) {
        throw new SandboxConfigurationError(
          'sandbox provider ' + provider.providerId + " declares unknown platform '" + platform + "'",
        );
      }
    }
    if (!Array.isArray(provider.capabilities) || provider.capabilities.length === 0) {
      throw new SandboxConfigurationError(
        'sandbox provider ' + provider.providerId + ' must declare its capabilities',
      );
    }
    for (const capability of provider.capabilities) {
      if (!KNOWN_CAPABILITIES.includes(capability)) {
        throw new SandboxConfigurationError(
          'sandbox provider ' + provider.providerId + " declares unknown capability '" + capability + "'",
        );
      }
    }
    if (provider.enforcement && !ENFORCEMENT_LEVELS.includes(provider.enforcement)) {
      throw new SandboxConfigurationError(
        'sandbox provider ' + provider.providerId + ' declares unknown enforcement: ' + provider.enforcement,
      );
    }
    if (Array.isArray(provider.modes)) {
      for (const mode of provider.modes) {
        if (!SANDBOX_MODES.includes(mode)) {
          throw new SandboxConfigurationError(
            'sandbox provider ' + provider.providerId + " declares unknown mode '" + mode + "'",
          );
        }
      }
    }
    Object.freeze(provider.platforms);
    Object.freeze(provider.capabilities);
    this.#byId.set(provider.providerId, provider);
    return provider;
  }

  has(providerId) {
    return this.#byId.has(providerId);
  }

  get(providerId) {
    const provider = this.#byId.get(providerId);
    if (!provider) throw new SandboxUnavailableError('unknown sandbox provider: ' + providerId);
    return provider;
  }

  /** Ordem de registro; a selecao fina e do SandboxResolver (secao 78). */
  candidates() {
    return [...this.#byId.values()];
  }

  list() {
    return this.candidates().map((provider) =>
      Object.freeze({
        providerId: provider.providerId,
        version: provider.version,
        platforms: provider.platforms,
        capabilities: provider.capabilities,
        enforcement: provider.enforcement ?? 'none',
      }),
    );
  }
}
