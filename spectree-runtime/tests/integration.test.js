import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ScriptedAgent, recordedRuntime, makeAgent, okTool, boomTool, sleep } from './helpers.js';
import { loadSquadAgentDefinition } from '../adapters/squad-agent.js';

test('lifecycle completo: a sequencia exata da spec secao 29', async () => {
  const runtime = recordedRuntime();
  runtime.toolRuntime.register(okTool);
  const agent = makeAgent('lifecycle', async (context) => {
    const result = await context.runtime.requestTool('ok', { value: 'proof' });
    return result.output;
  });
  const session = runtime.createSession({ agentId: agent.id, mission: 'prove the runtime exists' });
  const result = await runtime.loop.run(agent, session);
  assert.deepEqual(result, { status: 'completed', output: 'ok:proof' });
  assert.deepEqual(runtime.types(), [
    'session.created',
    'session.started',
    'agent.started',
    'tool.requested',
    'tool.started',
    'tool.completed',
    'agent.completed',
    'session.completed',
  ]);
  // todo evento de execucao carrega a session (spec secao 18)
  for (const event of runtime.events) assert.equal(event.sessionId, session.id);
});

test('falha: cascata da spec secao 30, e nenhum completed depois dela', async () => {
  const runtime = recordedRuntime();
  runtime.toolRuntime.register(boomTool);
  const agent = makeAgent('failing', async (context) => {
    await context.runtime.requestTool('boom');
  });
  const session = runtime.createSession({ agentId: agent.id, mission: 'm' });
  const result = await runtime.loop.run(agent, session);
  assert.equal(result.status, 'failed');
  assert.deepEqual(runtime.types(), [
    'session.created',
    'session.started',
    'agent.started',
    'tool.requested',
    'tool.started',
    'tool.failed',
    'agent.failed',
    'session.failed',
  ]);
  for (const type of runtime.types()) assert.ok(!type.endsWith('.completed'));
});

test('isolamento: duas sessions simultaneas nao trocam estado nem eventos', async () => {
  const runtime = recordedRuntime();
  runtime.toolRuntime.register({
    id: 'slow',
    name: 'Slow',
    description: 'responde devagar para forcar interleaving',
    execute: async ({ label }) => {
      await sleep(label === 'A' ? 30 : 5);
      return label;
    },
  });
  const agentA = makeAgent('agent-a', async (context) => {
    const r = await context.runtime.requestTool('slow', { label: 'A' });
    return 'A:' + r.output;
  });
  const agentB = makeAgent('agent-b', async (context) => {
    const r = await context.runtime.requestTool('slow', { label: 'B' });
    return 'B:' + r.output;
  });
  const sessionA = runtime.createSession({ agentId: agentA.id, mission: 'mission A' });
  const sessionB = runtime.createSession({ agentId: agentB.id, mission: 'mission B' });
  const [resultA, resultB] = await Promise.all([
    runtime.loop.run(agentA, sessionA),
    runtime.loop.run(agentB, sessionB),
  ]);
  assert.deepEqual(resultA, { status: 'completed', output: 'A:A' });
  assert.deepEqual(resultB, { status: 'completed', output: 'B:B' });
  assert.notEqual(sessionA.id, sessionB.id);

  const forSession = (id) => runtime.events.filter((e) => e.sessionId === id).map((e) => e.type);
  const expected = [
    'session.created', 'session.started', 'agent.started', 'tool.requested',
    'tool.started', 'tool.completed', 'agent.completed', 'session.completed',
  ];
  assert.deepEqual(forSession(sessionA.id), expected);
  assert.deepEqual(forSession(sessionB.id), expected);
  // nenhum evento sem dona, nenhum vazamento entre as duas
  assert.equal(runtime.events.length, expected.length * 2);
  for (const event of runtime.events) {
    assert.ok([sessionA.id, sessionB.id].includes(event.sessionId));
    assert.ok([agentA.id, agentB.id].includes(event.agentId));
  }
});

test('criterio de arquitetura (spec secao 40): dois agents, tools diferentes, zero mudanca no nucleo', async () => {
  const runtime = recordedRuntime();
  runtime.toolRuntime.register({ id: 'tool.a', name: 'A', description: 'a', execute: async () => 'from A' });
  runtime.toolRuntime.register({ id: 'tool.b', name: 'B', description: 'b', execute: async () => 'from B' });
  const agentA = makeAgent('uses-a', async (c) => (await c.runtime.requestTool('tool.a')).output);
  const agentB = makeAgent('uses-b', async (c) => (await c.runtime.requestTool('tool.b')).output);
  const ra = await runtime.loop.run(agentA, runtime.createSession({ agentId: agentA.id, mission: 'a' }));
  const rb = await runtime.loop.run(agentB, runtime.createSession({ agentId: agentB.id, mission: 'b' }));
  assert.equal(ra.output, 'from A');
  assert.equal(rb.output, 'from B');
});

test('prova de integracao (spec secao 39): um agente real do Squad vira AgentDefinition e executa', async () => {
  const markdownPath = fileURLToPath(new URL('../../agents/lina.md', import.meta.url));
  const definition = loadSquadAgentDefinition(markdownPath);
  assert.equal(definition.id, 'lina');           // dado do arquivo, nao conhecimento do runtime
  assert.ok(definition.instructions.length > 0); // o corpo do markdown vira a instrucao
  assert.ok(definition.metadata.description);

  const runtime = recordedRuntime();
  runtime.toolRuntime.register(okTool);
  const agent = new ScriptedAgent(definition, async (context) => {
    const r = await context.runtime.requestTool('ok', { value: 'PRD.md' });
    return r.output;
  });
  const session = runtime.createSession({ agentId: agent.id, mission: 'draft the PRD' });
  const result = await runtime.loop.run(agent, session);
  assert.deepEqual(result, { status: 'completed', output: 'ok:PRD.md' });
});
