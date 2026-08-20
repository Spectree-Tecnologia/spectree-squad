import { ApprovalError, ApprovalNotFoundError, ApprovalStateError } from '../errors.js';

/** Estados de lifecycle de uma ApprovalRequest (spec Fase 3, secao 8). */
export const APPROVAL_STATES = Object.freeze([
  'pending',
  'approved',
  'denied',
  'expired',
  'cancelled',
  'resumed',
]);

const TRANSITIONS = {
  pending: ['approved', 'denied', 'expired', 'cancelled'],
  approved: ['resumed'],
  denied: [],
  expired: [],
  cancelled: [],
  resumed: [],
};

/**
 * Contrato de persistencia de approvals (secao 76). `transition()` e um
 * compare-and-set: valida o estado esperado E a maquina de estados, entao
 * duas decisoes concorrentes produzem exatamente uma vencedora — a
 * perdedora recebe ApprovalStateError (secoes 24, 45). Implementacoes
 * futuras (Postgres, Redis, Supabase) mantem este contrato sem alterar o
 * ApprovalManager (secao 14).
 *
 * O record guardado aqui e o estado PRIVADO (secao 77): contem a
 * invocation com o input original. A projecao publica — sem input — e
 * responsabilidade do ApprovalManager.
 */
export class InMemoryApprovalStore {
  #records = new Map();

  create(record) {
    if (this.#records.has(record.id)) {
      throw new ApprovalError('approval already exists: ' + record.id);
    }
    this.#records.set(record.id, { ...record });
    return this.get(record.id);
  }

  /** @returns {object|undefined} copia congelada do record */
  get(id) {
    const record = this.#records.get(id);
    return record ? Object.freeze({ ...record }) : undefined;
  }

  /**
   * Compare-and-set atomico: falha se o estado atual nao for o esperado
   * ou se a maquina de estados nao permitir o destino.
   */
  transition(id, expectedState, nextState, metadata = {}) {
    const record = this.#records.get(id);
    if (!record) throw new ApprovalNotFoundError(id);
    if (record.status !== expectedState) {
      throw new ApprovalStateError(record.status, nextState, id);
    }
    if (!TRANSITIONS[expectedState].includes(nextState)) {
      throw new ApprovalStateError(expectedState, nextState, id);
    }
    Object.assign(record, metadata, { status: nextState });
    return this.get(id);
  }

  /** Usado pela varredura de cancelamento de Session (secao 23). */
  listBySession(sessionId, status) {
    return [...this.#records.values()]
      .filter((r) => r.sessionId === sessionId && (status === undefined || r.status === status))
      .map((r) => Object.freeze({ ...r }));
  }
}
