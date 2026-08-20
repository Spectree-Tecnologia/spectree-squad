import { EventBus } from './events/event-bus.js';
import { ToolRuntime } from './tools/tool-runtime.js';
import { AgentLoop } from './loop/agent-loop.js';
import { Session } from './session/session.js';
import { PolicyRegistry } from './policy/policy-registry.js';
import { PolicyEngine } from './policy/policy-engine.js';
import { CapabilityRegistry } from './capabilities/capability-registry.js';
import { InMemoryApprovalStore } from './approval/approval-store.js';
import { ApprovalManager } from './approval/approval-manager.js';
import { InMemoryFounderGate } from './approval/founder-gate.js';
import { acquireAuthorizedExecutor } from './tools/tool-runtime.js';

export { Agent } from './agent/agent.js';
export { AgentLoop } from './loop/agent-loop.js';
export { ToolRuntime } from './tools/tool-runtime.js';
export { Session, SESSION_STATES } from './session/session.js';
export { EventBus, WILDCARD } from './events/event-bus.js';
export { PolicyRegistry } from './policy/policy-registry.js';
export { PolicyEngine } from './policy/policy-engine.js';
export { CapabilityRegistry } from './capabilities/capability-registry.js';
export { InMemoryApprovalStore, APPROVAL_STATES } from './approval/approval-store.js';
export { ApprovalManager } from './approval/approval-manager.js';
export { InMemoryFounderGate } from './approval/founder-gate.js';
export * from './errors.js';

/**
 * Conveniencia: monta as cinco primitivas sobre um EventBus
 * compartilhado. Nada aqui é singleton — multiplos runtimes e multiplas
 * Sessions coexistem (spec secao 32).
 */
export function createRuntime(options = {}) {
  const eventBus = options.eventBus ?? new EventBus(options);
  // Default deny por construcao (secao 55): registry vazio nega tudo;
  // teste que precisa executar registra policy explicita.
  const policyRegistry = options.policyRegistry ?? new PolicyRegistry();
  const policyEngine = options.policyEngine ?? new PolicyEngine({ registry: policyRegistry });
  const capabilityRegistry = options.capabilityRegistry ?? new CapabilityRegistry();
  const approvalStore = options.approvalStore ?? new InMemoryApprovalStore();
  const founderGate = options.founderGate ?? new InMemoryFounderGate();
  const approvalManager = new ApprovalManager({
    store: approvalStore,
    eventBus,
    founderGate,
    clock: options.clock,
    defaultTtlMs: options.approvalTtlMs ?? null,
  });
  const toolRuntime = new ToolRuntime({
    eventBus,
    policyEngine,
    projectEventPayload: options.projectEventPayload,
    onApprovalRequired: (invocation, decisionContext) =>
      approvalManager.request(invocation, decisionContext),
  });
  // O executor autorizado e adquirido UMA vez, aqui, e entregue ao
  // manager — cujo resume() sempre revalida a Policy antes de usar.
  approvalManager.bindRuntime({
    authorize: (request, context) => toolRuntime.authorize(request, context),
    executeAuthorized: acquireAuthorizedExecutor(toolRuntime),
  });
  founderGate.bind?.(approvalManager);
  const loop = new AgentLoop({ toolRuntime, eventBus });
  return {
    eventBus,
    toolRuntime,
    loop,
    policyRegistry,
    policyEngine,
    capabilityRegistry,
    approvalStore,
    approvalManager,
    founderGate,
    createSession: ({ agentId, mission }) => new Session({ agentId, mission, eventBus }),
  };
}
