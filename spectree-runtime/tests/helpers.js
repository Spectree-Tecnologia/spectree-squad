import { createRuntime, Agent } from '../index.js';

/** Runtime com gravador de eventos: todo teste observa pelo wildcard. */
export function recordedRuntime(options = {}) {
  const runtime = createRuntime(options);
  const events = [];
  runtime.eventBus.subscribe('*', (event) => events.push(event));
  return { ...runtime, events, types: () => events.map((e) => e.type) };
}

/** FakeAgent: o corpo de run() vem por parametro (spec secao 27). */
export class ScriptedAgent extends Agent {
  #script;
  constructor(definition, script) {
    super(definition);
    this.#script = script;
  }
  async run(context) {
    return this.#script(context);
  }
}

export function makeAgent(id, script) {
  return new ScriptedAgent(
    { id, name: id, instructions: 'fake agent for tests' },
    script,
  );
}

/** FakeTool que sempre responde. */
export const okTool = {
  id: 'ok',
  name: 'Ok',
  description: 'sempre responde',
  inputSchema: { type: 'object', required: ['value'], properties: { value: { type: 'string' } } },
  execute: async ({ value }) => 'ok:' + value,
};

/** FakeTool que sempre falha. */
export const boomTool = {
  id: 'boom',
  name: 'Boom',
  description: 'sempre falha',
  execute: async () => {
    throw new Error('boom');
  },
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Concede allow explicito por tool (spec Fase 2, secao 55) - nunca um
 * allow-all global: cada teste declara exatamente o que pode executar.
 */
/**
 * Registra a capability da tool (gate da Fase 4) e a propria tool.
 * Capability id segue o fallback: tool.capability ?? tool.id.
 */
export function installTool(runtime, tool, { operations } = {}) {
  const capabilityId = tool.capability ?? tool.id;
  if (!runtime.capabilityRegistry.has(capabilityId)) {
    runtime.capabilityRegistry.register({
      id: capabilityId,
      name: capabilityId,
      description: 'test capability',
      operations: operations ?? [tool.operation ?? 'execute'],
    });
  }
  runtime.toolRuntime.register(tool);
  return tool;
}

export function allowTools(runtime, toolIds) {
  runtime.policyRegistry.register({
    id: 'allow-' + toolIds.join('+'),
    effect: 'allow',
    tools: toolIds,
  });
}
