/**
 * Exemplo minimo executavel (spec secao 43E):
 *   node spectree-runtime/example.js
 * FakeAgent -> AgentLoop -> FakeTool -> Session -> EventBus.
 */
import { createRuntime, Agent } from './index.js';

class EchoAgent extends Agent {
  async run(context) {
    // THINK -> ACT (requestTool) -> OBSERVE (result) -> conclui.
    const result = await context.runtime.requestTool('echo', { text: context.mission });
    return 'echoed: ' + result.output;
  }
}

const runtime = createRuntime();
// Default deny: sem esta policy o proprio exemplo seria bloqueado.
runtime.policyRegistry.register({ id: 'allow-echo', effect: 'allow', tools: ['echo'] });
runtime.eventBus.subscribe('*', (event) =>
  console.log(event.type.padEnd(20) + ' ' + (event.sessionId ?? '')),
);

runtime.toolRuntime.register({
  id: 'echo',
  name: 'Echo',
  description: 'Devolve o texto recebido',
  inputSchema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } },
  execute: async ({ text }) => text,
});

const agent = new EchoAgent({
  id: 'echo-agent',
  name: 'Echo Agent',
  instructions: 'Ecoe a missao atraves da tool echo.',
});
const session = runtime.createSession({ agentId: agent.id, mission: 'hello, runtime' });
const result = await runtime.loop.run(agent, session);
console.log('result:', result);
