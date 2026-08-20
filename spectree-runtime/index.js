import { EventBus } from './events/event-bus.js';
import { ToolRuntime } from './tools/tool-runtime.js';
import { AgentLoop } from './loop/agent-loop.js';
import { Session } from './session/session.js';

export { Agent } from './agent/agent.js';
export { AgentLoop } from './loop/agent-loop.js';
export { ToolRuntime } from './tools/tool-runtime.js';
export { Session, SESSION_STATES } from './session/session.js';
export { EventBus, WILDCARD } from './events/event-bus.js';
export * from './errors.js';

/**
 * Conveniencia: monta as cinco primitivas sobre um EventBus
 * compartilhado. Nada aqui é singleton — multiplos runtimes e multiplas
 * Sessions coexistem (spec secao 32).
 */
export function createRuntime(options = {}) {
  const eventBus = options.eventBus ?? new EventBus(options);
  const toolRuntime = new ToolRuntime({ eventBus });
  const loop = new AgentLoop({ toolRuntime, eventBus });
  return {
    eventBus,
    toolRuntime,
    loop,
    createSession: ({ agentId, mission }) => new Session({ agentId, mission, eventBus }),
  };
}
