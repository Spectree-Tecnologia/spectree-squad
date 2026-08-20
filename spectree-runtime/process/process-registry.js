import { ProcessOwnershipError } from '../errors.js';

/**
 * ProcessRegistry (spec Fase 6, secoes 85-92).
 *
 * O Runtime e o dono (secao 88) — nao o Agent, nao um Provider
 * individual. Todo handle carrega sessionId, agentId, invocationId e
 * executionWorldId (secoes 85, 127), e uma Session jamais alcanca
 * processo de outra (secao 86, INV-617). Processos encerrados saem do
 * registry (secao 89): handle morto nao mora aqui para sempre.
 */
export class ProcessRegistry {
  #entries = new Map();

  register({ handle, sessionId, agentId, invocationId, executionWorldId }) {
    const entry = Object.freeze({
      handle,
      sessionId: sessionId ?? null,
      agentId: agentId ?? null,
      invocationId,
      executionWorldId: executionWorldId ?? null,
      registeredAt: new Date().toISOString(),
    });
    this.#entries.set(invocationId, entry);
    // saida do processo remove a entrada, aconteca o que acontecer
    handle.done.then(
      () => this.#entries.delete(invocationId),
      () => this.#entries.delete(invocationId),
    );
    return entry;
  }

  get(invocationId, { sessionId } = {}) {
    const entry = this.#entries.get(invocationId);
    if (!entry) return null;
    // INV-617: pedir com a Session errada e violacao de posse, nao "nao
    // encontrado" — o erro certo diagnostica a tentativa
    if (sessionId !== undefined && entry.sessionId !== sessionId) {
      throw new ProcessOwnershipError(
        'process belongs to another session: ' + String(entry.sessionId),
      );
    }
    return entry;
  }

  remove(invocationId) {
    this.#entries.delete(invocationId);
  }

  listBySession(sessionId) {
    return [...this.#entries.values()].filter((entry) => entry.sessionId === sessionId);
  }

  list() {
    return [...this.#entries.values()];
  }

  /**
   * Cancelamento de Session (secoes 68-69, 90): todo processo vivo da
   * Session e terminado e aguardado. INV-618.
   */
  async terminateSession(sessionId) {
    const entries = this.listBySession(sessionId);
    await Promise.allSettled(entries.map(async (entry) => {
      await entry.handle.terminate();
      await entry.handle.done;
    }));
  }

  /** Shutdown do Runtime (secao 91): nada sobrevive observavel. */
  async shutdown() {
    const entries = this.list();
    await Promise.allSettled(entries.map(async (entry) => {
      await entry.handle.terminate();
      await entry.handle.done;
    }));
    this.#entries.clear();
  }
}
