import { EventBus } from './events/event-bus.js';
import { ToolRuntime } from './tools/tool-runtime.js';
import { AgentLoop } from './loop/agent-loop.js';
import { Session } from './session/session.js';
import { PolicyRegistry } from './policy/policy-registry.js';
import { PolicyEngine } from './policy/policy-engine.js';
import { CapabilityRegistry } from './capabilities/capability-registry.js';

export { Agent } from './agent/agent.js';
export { AgentLoop } from './loop/agent-loop.js';
export { ToolRuntime } from './tools/tool-runtime.js';
export { Session, SESSION_STATES } from './session/session.js';
export { EventBus, WILDCARD } from './events/event-bus.js';
export { PolicyRegistry } from './policy/policy-registry.js';
export { PolicyEngine } from './policy/policy-engine.js';
export { CapabilityRegistry } from './capabilities/capability-registry.js';
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
  const toolRuntime = new ToolRuntime({
    eventBus,
    policyEngine,
    projectEventPayload: options.projectEventPayload,
  });
  const loop = new AgentLoop({ toolRuntime, eventBus });
  return {
    eventBus,
    toolRuntime,
    loop,
    policyRegistry,
    policyEngine,
    capabilityRegistry,
    createSession: ({ agentId, mission }) => new Session({ agentId, mission, eventBus }),
  };
}
