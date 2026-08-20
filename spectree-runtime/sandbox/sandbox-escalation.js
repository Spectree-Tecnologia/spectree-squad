import { randomUUID } from 'node:crypto';

/**
 * SandboxEscalationRequest (spec Fase 5, secoes 30, 74-76, 139-140).
 *
 * NESTA FASE ISTO E APENAS O SEAM. O objeto representa o pedido; nada o
 * executa automaticamente (INV-529). Nao existe retry automatico
 * (secao 77) e uma eventual escalada futura sera de UMA invocacao, nunca
 * permissao permanente (secao 76, INV-530).
 *
 * Quando uma fase futura ligar isto ao Founder Gate, ela deve COMPOR com
 * o ApprovalManager que ja existe (secao 75) — nunca duplicar Approval.
 */
export function createSandboxEscalationRequest({
  currentPolicy,
  requestedMode,
  reason,
  sessionId = null,
  agentId = null,
  capabilityId = null,
  operation = null,
  resource = null,
}) {
  return Object.freeze({
    id: 'sbx_' + randomUUID(),
    currentMode: currentPolicy?.mode ?? null,
    requestedMode,
    reason,
    sessionId,
    agentId,
    capabilityId,
    operation,
    // resource canonico, como a Policy o viu — nunca o path fisico
    resource: resource ? (resource.type ?? '?') + '/' + (resource.id ?? '?') : null,
    // one-shot por contrato, mesmo antes de existir implementacao
    scope: 'single-invocation',
    status: 'not-implemented',
  });
}
