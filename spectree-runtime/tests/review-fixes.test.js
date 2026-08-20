import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../events/event-bus.js';
import { ToolRuntime } from '../tools/tool-runtime.js';
import { SessionError } from '../errors.js';
import { recordedRuntime, makeAgent, okTool, sleep } from './helpers.js';

test('R3/R4: session de um agente nao executa outro agente', async () => {
  const runtime = recordedRuntime();
  const agent = makeAgent('agent-real', async () => 'x');
  const session = runtime.createSession({ agentId: 'someone-else', mission: 'm' });
  await assert.rejects(
    runtime.loop.run(agent, session),
    (error) => error instanceof SessionError && /belongs to agent someone-else/.test(error.message),
  );
  // a sessao nao foi tocada: segue created, sem eventos de agent
  assert.equal(session.state, 'created');
  assert.ok(!runtime.types().includes('agent.started'));
});

test('R5/R6: tool em voo durante o cancel termina e emite; nada novo inicia; nenhum completed de agent/session', async () => {
  const runtime = recordedRuntime();
  runtime.toolRuntime.register({
    id: 'slow',
    name: 'Slow',
    description: 'demora o bastante para o cancel chegar no meio',
    execute: async () => {
      await sleep(30);
      return 'finished anyway';
    },
  });
  runtime.toolRuntime.register(okTool);
  const agent = makeAgent('in-flight', async (context) => {
    const result = await context.runtime.requestTool('slow'); // cancel chega no meio desta
    await context.runtime.requestTool('ok', { value: result.output }); // barrada
    return 'unreachable';
  });
  const session = runtime.createSession({ agentId: agent.id, mission: 'm' });
  const running = runtime.loop.run(agent, session);
  await sleep(10);
  session.cancel('mid-flight');
  const result = await running;

  assert.deepEqual(result, { status: 'cancelled' });
  const types = runtime.types();
  // a tool em voo terminou e emitiu depois do cancel (contrato cooperativo)
  assert.ok(types.indexOf('session.cancelled') < types.indexOf('tool.completed'));
  // nenhuma nova tool: um unico tool.requested na execucao inteira
  assert.equal(types.filter((t) => t === 'tool.requested').length, 1);
  assert.ok(!types.includes('agent.completed'));
  assert.ok(!types.includes('session.completed'));
  assert.ok(!types.includes('agent.failed'));
});

test('R7: projectEventPayload separa o que a tool ve do que o bus publica', async () => {
  const bus = new EventBus();
  const published = [];
  bus.subscribe('*', (e) => published.push(e));
  const tools = new ToolRuntime({
    eventBus: bus,
    projectEventPayload: ({ phase, toolId }) => ({ toolId, phase, redacted: true }),
  });
  let toolSawInput;
  tools.register({
    id: 'secretive',
    name: 'Secretive',
    description: 'recebe segredo que nao pode vazar no bus',
    execute: async (input) => {
      toolSawInput = input;
      return 'token-abc123';
    },
  });
  await tools.execute({ toolId: 'secretive', input: { apiKey: 'super-secret' } });
  // a tool recebeu o input integro
  assert.deepEqual(toolSawInput, { apiKey: 'super-secret' });
  // o bus nunca viu input nem output
  for (const event of published) {
    assert.deepEqual(Object.keys(event.payload).sort(), ['phase', 'redacted', 'toolId']);
    assert.ok(!JSON.stringify(event.payload).includes('super-secret'));
    assert.ok(!JSON.stringify(event.payload).includes('token-abc123'));
  }
  assert.equal(published.length, 3); // requested, started, completed
});

test('R8: o EventBus nao e alcancavel pelo Agent - o contexto expoe apenas requestTool', async () => {
  const runtime = recordedRuntime();
  runtime.toolRuntime.register(okTool);
  let seen;
  const agent = makeAgent('probe', async (context) => {
    seen = context;
    return 'ok';
  });
  const session = runtime.createSession({ agentId: agent.id, mission: 'm' });
  await runtime.loop.run(agent, session);

  assert.deepEqual(Object.keys(seen).sort(), ['mission', 'runtime', 'session']);
  assert.deepEqual(Object.keys(seen.runtime), ['requestTool']);
  assert.ok(!('emit' in seen.runtime));
  assert.equal(seen.eventBus, undefined);
  // a Session nao vaza o bus: campo privado, nenhum metodo de publicacao
  assert.equal(seen.session.eventBus, undefined);
  assert.equal(seen.session.publish, undefined);
  assert.ok(!Object.keys(seen.session).some((k) => k.toLowerCase().includes('bus')));
});
