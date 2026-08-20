import { ApprovalError } from '../errors.js';

/**
 * FounderGate (secao 12): o contrato entre o ApprovalManager e o
 * mecanismo externo de decisao humana. NAO e uma UI — Invoker CLI, TUI,
 * Web, Slack ou WhatsApp futuros falam todos com o mesmo ApprovalManager
 * atraves deste seam (secao 49). Contrato minimo:
 *
 *   requestApproval(approvalView)          <- manager notifica o gate
 *   submitDecision(approvalId, decision)   <- decisao humana volta
 *
 * Seam futuro registrado (secao 87): authorizeDecision(actor, approval) —
 * autenticacao/autorizacao do decisor pertence a fase de identidade.
 * Nesta fase, decidedBy e metadata para audit, nao regra de seguranca
 * (secao 51).
 */
export class InMemoryFounderGate {
  #manager = null;
  #pending = new Map();

  /** Ligado ao manager pelo wiring, uma unica vez. */
  bind(manager) {
    if (this.#manager) throw new ApprovalError('founder gate already bound');
    this.#manager = manager;
  }

  /** Chamado pelo ApprovalManager ao criar um pedido. */
  requestApproval(approvalView) {
    this.#pending.set(approvalView.approvalId, approvalView);
  }

  /** O que uma UI futura listaria: contexto seguro, sem input (secao 86). */
  pending() {
    return [...this.#pending.values()];
  }

  /** Decisao deterministica para testes (secao 50) — nunca uma "pessoa" via LLM. */
  submitDecision(approvalId, decision, actor = { type: 'founder', id: 'founder' }, reason) {
    if (!this.#manager) throw new ApprovalError('founder gate is not bound to a manager');
    const result =
      decision === 'approve'
        ? this.#manager.approve(approvalId, actor, reason)
        : this.#manager.deny(approvalId, actor, reason);
    this.#pending.delete(approvalId);
    return result;
  }

  approve(approvalId, actor, reason) {
    return this.submitDecision(approvalId, 'approve', actor, reason);
  }

  deny(approvalId, actor, reason) {
    return this.submitDecision(approvalId, 'deny', actor, reason);
  }
}
