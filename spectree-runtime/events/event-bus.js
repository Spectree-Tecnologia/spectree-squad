import { randomUUID } from 'node:crypto';

/**
 * Envelope de evento do runtime (spec §18).
 * @typedef {object} RuntimeEvent
 * @property {string} id         único, gerado pelo runtime
 * @property {string} type       ex.: "session.started"
 * @property {string} timestamp  ISO-8601, gerado pelo runtime
 * @property {string} [sessionId]
 * @property {string} [agentId]
 * @property {object} payload
 */

/** Tipo especial: recebe todo evento publicado. */
export const WILDCARD = '*';

/**
 * Mecanismo de comunicação observável do runtime (spec §17).
 * In-process por decisão de fase (spec §21); o contrato
 * publish/subscribe/unsubscribe é o que uma implementação persistente ou
 * distribuída precisa manter. Não contém lógica de negócio (INV-005).
 */
export class EventBus {
  #handlers = new Map();
  #onSubscriberError;

  /**
   * @param {object} [options]
   * @param {(error: Error, event: RuntimeEvent) => void} [options.onSubscriberError]
   *   chamado quando um subscriber lança; a falha nunca alcança o runtime
   *   nem os demais subscribers (spec §20).
   */
  constructor({ onSubscriberError } = {}) {
    this.#onSubscriberError = onSubscriberError;
  }

  /**
   * Monta o envelope e entrega, sincronamente e em ordem de inscrição,
   * aos subscribers do tipo e do WILDCARD.
   * @returns {RuntimeEvent} o evento publicado
   */
  publish(type, { sessionId, agentId, payload } = {}) {
    const event = {
      id: `evt_${randomUUID()}`,
      type,
      timestamp: new Date().toISOString(),
      ...(sessionId ? { sessionId } : {}),
      ...(agentId ? { agentId } : {}),
      payload: payload ?? {},
    };
    for (const key of [type, WILDCARD]) {
      for (const handler of this.#handlers.get(key) ?? []) {
        try {
          handler(event);
        } catch (error) {
          // Falha de observer é isolada do runtime (spec §20).
          this.#onSubscriberError?.(error, event);
        }
      }
    }
    return event;
  }

  /** @returns {() => void} função de unsubscribe */
  subscribe(type, handler) {
    if (!this.#handlers.has(type)) this.#handlers.set(type, new Set());
    this.#handlers.get(type).add(handler);
    return () => this.unsubscribe(type, handler);
  }

  unsubscribe(type, handler) {
    this.#handlers.get(type)?.delete(handler);
  }
}
