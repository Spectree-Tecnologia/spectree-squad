import { randomUUID } from 'node:crypto';
import { SessionError, SessionStateError } from '../errors.js';

/** Estados de lifecycle da Session (spec §14). */
export const SESSION_STATES = Object.freeze([
  'created',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

const TRANSITIONS = {
  created: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

/**
 * Uma execução concreta do runtime (spec §13). Estado de runtime, nunca
 * estado de projeto: docs/ continua sendo o SSOT do Squad (spec §16).
 * Toda instância é independente — nada de estado global (spec §32).
 */
export class Session {
  #state = 'created';
  #bus;

  constructor({ agentId, mission, eventBus }) {
    if (typeof agentId !== 'string' || agentId.length === 0) {
      throw new SessionError('session requires an agentId');
    }
    if (typeof mission !== 'string' || mission.length === 0) {
      throw new SessionError('session requires a mission');
    }
    this.id = `sess_${randomUUID()}`;
    this.agentId = agentId;
    this.mission = mission;
    this.createdAt = new Date().toISOString();
    this.startedAt = null;
    this.finishedAt = null;
    this.#bus = eventBus;
    this.#bus.publish('session.created', {
      sessionId: this.id,
      agentId,
      payload: { mission },
    });
  }

  get state() {
    return this.#state;
  }

  get isCancelled() {
    return this.#state === 'cancelled';
  }

  get isFinished() {
    return this.#state === 'completed' || this.#state === 'failed' || this.#state === 'cancelled';
  }

  #transition(to) {
    if (!TRANSITIONS[this.#state].includes(to)) {
      throw new SessionStateError(this.#state, to);
    }
    this.#state = to;
  }

  start() {
    this.#transition('running');
    this.startedAt = new Date().toISOString();
    this.#bus.publish('session.started', { sessionId: this.id, agentId: this.agentId });
  }

  complete(output) {
    this.#transition('completed');
    this.finishedAt = new Date().toISOString();
    this.#bus.publish('session.completed', {
      sessionId: this.id,
      agentId: this.agentId,
      payload: { output },
    });
  }

  fail(error) {
    this.#transition('failed');
    this.finishedAt = new Date().toISOString();
    this.#bus.publish('session.failed', {
      sessionId: this.id,
      agentId: this.agentId,
      payload: { error: String(error?.message ?? error) },
    });
  }

  /** Sinaliza o AgentLoop: após isto, nenhuma nova Tool inicia (spec §36). */
  cancel(reason) {
    this.#transition('cancelled');
    this.finishedAt = new Date().toISOString();
    this.#bus.publish('session.cancelled', {
      sessionId: this.id,
      agentId: this.agentId,
      payload: { reason: reason ?? null },
    });
  }
}
