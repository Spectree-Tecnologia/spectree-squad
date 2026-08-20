import { CapabilityError } from '../errors.js';

/**
 * Capability descreve o que o runtime SABE executar — nunca quem pode
 * (P-006, INV-212). Uma Capability e uma familia ("database"); uma Tool
 * e uma operacao executavel concreta ("database.migrate") — secao 20.
 * @typedef {object} Capability
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string[]} operations
 */

/**
 * Catalogo de capabilities. Providers futuros se registram aqui sem
 * conhecer Agent, PolicyEngine ou Session (secao 67).
 */
export class CapabilityRegistry {
  #capabilities = new Map();

  register(capability) {
    for (const field of ['id', 'name', 'description']) {
      if (typeof capability?.[field] !== 'string' || capability[field].length === 0) {
        throw new CapabilityError('capability is missing required field: ' + field);
      }
    }
    if (!Array.isArray(capability.operations) || capability.operations.length === 0 ||
        capability.operations.some((op) => typeof op !== 'string' || op.length === 0)) {
      throw new CapabilityError(
        "capability '" + capability.id + "' requires a non-empty operations array",
      );
    }
    if (this.#capabilities.has(capability.id)) {
      throw new CapabilityError('capability already registered: ' + capability.id);
    }
    const frozen = Object.freeze({ ...capability, operations: Object.freeze([...capability.operations]) });
    this.#capabilities.set(frozen.id, frozen);
    return frozen;
  }

  resolve(id) {
    const capability = this.#capabilities.get(id);
    if (!capability) throw new CapabilityError('capability not found: ' + id);
    return capability;
  }

  has(id) {
    return this.#capabilities.has(id);
  }

  list() {
    return [...this.#capabilities.values()];
  }
}
