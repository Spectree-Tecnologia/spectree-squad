import { randomUUID } from 'node:crypto';
import {
  ApprovalError,
  ApprovalExpiredError,
  ApprovalNotFoundError,
  ApprovalStateError,
  PolicyRevalidationError,
} from '../errors.js';

/**
 * ApprovalRequest (secao 6) — snapshot imutavel do que esta sendo
 * aprovado; ApprovalDecision (secao 10) — quem decidiu, o que e quando.
 * Ambos vivem como objetos planos dentro do record do ApprovalStore; a
 * visao publica nunca carrega o input (secoes 36-37, 77).
 *
 * @typedef {object} ApprovalView
 * @property {string} approvalId
 * @property {string} sessionId
 * @property {string} agentId
 * @property {string} toolId
 * @property {string} capabilityId
 * @property {string} operation
 * @property {string|null} resource   "type/id"
 * @property {string|null} policyId
 * @property {string} reason
 * @property {string} requestedAt
 * @property {string|null} expiresAt
 * @property {string} status
 */

/**
 * O componente central da Fase 3 (secao 13): cria pedidos, valida o
 * lifecycle, recebe a decisao humana e retoma a execucao suspensa.
 * Nunca executa Tool diretamente — quem executa e o caminho autorizado
 * do ToolRuntime, e SEMPRE depois de revalidar a Policy (INV-303/305/318).
 *
 * A decisao humana nao e uma segunda autoridade (secao 97): ela satisfaz
 * exatamente a exigencia de aprovacao da policy que a criou. No resume, a
 * revalidacao aceita `allow`, ou `approval-required` vindo do MESMO
 * policyId aprovado; qualquer outra decisao — deny, ou policy nova
 * exigindo aprovacao — bloqueia com PolicyRevalidationError (secao 21).
 */
export class ApprovalManager {
  #store;
  #bus;
  #gate;
  #clock;
  #authorize = null;
  #executeAuthorized = null;
  #cancelledSessions = new Set();

  constructor({ store, eventBus, founderGate = null, clock = () => Date.now(), defaultTtlMs = null }) {
    this.#store = store;
    this.#bus = eventBus;
    this.#gate = founderGate;
    this.#clock = clock;
    this.defaultTtlMs = defaultTtlMs;
    // Cancelamento de Session cancela as approvals pending dela (secao 23)
    // e barra o resume das ja aprovadas (secao 48): a Session tem
    // autoridade final sobre execucao. A cascata e sincrona de proposito:
    // nao existe janela entre session.cancelled e approval.cancelled para
    // um approve() escapar. Efeito observavel (secao 34): no stream de
    // eventos, approval.cancelled aparece ANTES de session.cancelled,
    // porque e publicado durante a entrega reentrante do primeiro.
    eventBus.subscribe('session.cancelled', (event) => this.#onSessionCancelled(event.sessionId));
  }

  /** Liga o manager ao caminho autorizado do ToolRuntime. Uma unica vez. */
  bindRuntime({ authorize, executeAuthorized }) {
    if (this.#authorize || this.#executeAuthorized) {
      throw new ApprovalError('approval manager runtime already bound');
    }
    this.#authorize = authorize;
    this.#executeAuthorized = executeAuthorized;
  }

  #now() {
    return new Date(this.#clock()).toISOString();
  }

  #view(record) {
    return Object.freeze({
      approvalId: record.id,
      sessionId: record.sessionId,
      agentId: record.agentId,
      toolId: record.toolId,
      capabilityId: record.capabilityId,
      operation: record.operation,
      resource: record.resource,
      policyId: record.policyId,
      reason: record.reason,
      requestedAt: record.requestedAt,
      expiresAt: record.expiresAt,
      status: record.status,
      decidedBy: record.decidedBy ?? null,
      decidedAt: record.decidedAt ?? null,
      decisionReason: record.decisionReason ?? null,
    });
  }

  #meta(record) {
    return { sessionId: record.sessionId, agentId: record.agentId };
  }

  /** Carrega e aplica expiracao preguicosa (secao 22): sem worker. */
  #load(approvalId) {
    let record = this.#store.get(approvalId);
    if (!record) throw new ApprovalNotFoundError(approvalId);
    if (record.status === 'pending' && record.expiresAt && this.#clock() > Date.parse(record.expiresAt)) {
      record = this.#store.transition(approvalId, 'pending', 'expired', { expiredAt: this.#now() });
      this.#bus.publish('approval.expired', {
        ...this.#meta(record),
        payload: { approvalId, toolId: record.toolId },
      });
    }
    return record;
  }

  /**
   * Cria a ApprovalRequest a partir de uma invocation bloqueada pela
   * Policy (secao 39). Snapshot congelado; o input fica no estado privado
   * do store, nunca no evento (secoes 28, 35-37).
   */
  request(invocation, decisionContext = {}) {
    const id = 'apr_' + randomUUID();
    const requestedAt = this.#now();
    const ttl = decisionContext.ttlMs ?? this.defaultTtlMs;
    const expiresAt = ttl ? new Date(this.#clock() + ttl).toISOString() : null;
    const record = this.#store.create({
      id,
      sessionId: invocation.sessionId ?? null,
      agentId: invocation.agentId ?? null,
      toolId: invocation.toolId,
      capabilityId: invocation.capability ?? null,
      operation: invocation.operation,
      resource: invocation.resource ?? null,
      policyId: decisionContext.policyId ?? null,
      reason: decisionContext.reason ?? '',
      requestedAt,
      expiresAt,
      status: 'pending',
      // estado privado: o necessario para retomar exatamente esta
      // operacao (PendingToolInvocation, secao 19)
      invocation: {
        toolId: invocation.toolId,
        input: structuredClone(invocation.input ?? {}),
        sessionId: invocation.sessionId ?? null,
        agentId: invocation.agentId ?? null,
      },
    });
    const view = this.#view(record);
    this.#bus.publish('approval.requested', {
      ...this.#meta(record),
      payload: {
        approvalId: id,
        toolId: record.toolId,
        capabilityId: record.capabilityId,
        operation: record.operation,
        resource: record.resource,
        policyId: record.policyId,
        reason: record.reason,
        expiresAt: record.expiresAt,
      },
    });
    this.#gate?.requestApproval(view);
    return view;
  }

  /**
   * Registra a decisao humana. Nunca executa a Tool (INV-303): a retomada
   * e um ato separado e explicito — resume() (secao 40).
   * Idempotencia segura (secao 46): approve sobre approved devolve o
   * estado existente sem novo evento; qualquer conflito real falha.
   */
  approve(approvalId, actor, reason) {
    return this.#decide(approvalId, 'approved', 'approval.approved', actor, reason);
  }

  deny(approvalId, actor, reason) {
    return this.#decide(approvalId, 'denied', 'approval.denied', actor, reason);
  }

  #decide(approvalId, nextState, eventType, actor, reason) {
    const record = this.#load(approvalId);
    if (record.status === nextState) return this.#view(record); // idempotente (secao 46)
    if (record.status === 'expired') throw new ApprovalExpiredError(approvalId);
    if (record.status !== 'pending') {
      throw new ApprovalStateError(record.status, nextState, approvalId);
    }
    const decidedAt = this.#now();
    const updated = this.#store.transition(approvalId, 'pending', nextState, {
      decidedBy: actor ?? { type: 'founder', id: 'founder' },
      decidedAt,
      decisionReason: reason ?? null,
    });
    this.#bus.publish(eventType, {
      ...this.#meta(updated),
      payload: {
        approvalId,
        decidedBy: updated.decidedBy,
        decidedAt,
        reason: updated.decisionReason,
      },
    });
    return this.#view(updated);
  }

  cancel(approvalId, reason) {
    const record = this.#load(approvalId);
    if (record.status === 'cancelled') return this.#view(record);
    const updated = this.#store.transition(approvalId, 'pending', 'cancelled', {
      cancelledAt: this.#now(),
      decisionReason: reason ?? null,
    });
    this.#bus.publish('approval.cancelled', {
      ...this.#meta(updated),
      payload: { approvalId, reason: reason ?? null },
    });
    return this.#view(updated);
  }

  expire(approvalId) {
    const record = this.#load(approvalId);
    if (record.status === 'expired') return this.#view(record);
    const updated = this.#store.transition(approvalId, 'pending', 'expired', {
      expiredAt: this.#now(),
    });
    this.#bus.publish('approval.expired', {
      ...this.#meta(updated),
      payload: { approvalId, toolId: updated.toolId },
    });
    return this.#view(updated);
  }

  get(approvalId) {
    return this.#view(this.#load(approvalId));
  }

  /**
   * Retoma a execucao suspensa (secao 42). Ordem obrigatoria:
   * verificar approved -> verificar Session -> REVALIDAR Policy com o
   * input ORIGINAL (INV-305/307/308) -> consumir approved->resumed
   * atomicamente (execucao unica, INV-317) -> approval.resumed ->
   * executar. Falha de revalidacao deixa a approval em `approved`:
   * o operador pode tentar de novo; nada e automatico (secao 21).
   */
  async resume(approvalId) {
    if (!this.#authorize || !this.#executeAuthorized) {
      throw new ApprovalError('approval manager is not bound to a runtime');
    }
    const record = this.#load(approvalId);
    if (record.status === 'expired') throw new ApprovalExpiredError(approvalId);
    if (record.status !== 'approved') {
      throw new ApprovalStateError(record.status, 'resumed', approvalId);
    }
    if (this.#cancelledSessions.has(record.sessionId)) {
      // Session cancellation tem autoridade final (secao 48, INV-306).
      throw new ApprovalStateError('session-cancelled', 'resumed', approvalId);
    }
    const { invocation } = record;
    // Revalidacao silenciosa: mesma Tool, mesmo input, resource
    // recalculado pela regra R9 (secao 54). Nada de input novo do
    // Founder (secao 55, INV-309).
    const { decision } = this.#authorize(
      { toolId: invocation.toolId, input: invocation.input },
      { agentId: invocation.agentId, session: { id: invocation.sessionId } },
    );
    const satisfied =
      decision.effect === 'allow' ||
      (decision.effect === 'approval-required' && decision.policyId === record.policyId);
    if (!satisfied) {
      throw new PolicyRevalidationError(decision, approvalId);
    }
    const resumedAt = this.#now();
    this.#store.transition(approvalId, 'approved', 'resumed', { resumedAt });
    this.#bus.publish('approval.resumed', {
      ...this.#meta(record),
      payload: { approvalId, toolId: invocation.toolId, resumedAt },
    });
    return this.#executeAuthorized({
      toolId: invocation.toolId,
      input: invocation.input,
      sessionId: invocation.sessionId,
      agentId: invocation.agentId,
    });
  }

  #onSessionCancelled(sessionId) {
    if (!sessionId) return;
    this.#cancelledSessions.add(sessionId);
    for (const record of this.#store.listBySession(sessionId, 'pending')) {
      const updated = this.#store.transition(record.id, 'pending', 'cancelled', {
        cancelledAt: this.#now(),
        decisionReason: 'session cancelled',
      });
      this.#bus.publish('approval.cancelled', {
        ...this.#meta(updated),
        payload: { approvalId: record.id, reason: 'session cancelled' },
      });
    }
  }
}
