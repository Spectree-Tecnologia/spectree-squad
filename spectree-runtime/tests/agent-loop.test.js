import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionError, SessionStateError } from '../errors.js';
import { recordedRuntime, makeAgent, okTool, boomTool, allowTools } from './helpers.js';

test('execucao simples, sem ferramentas', async () => {
  const runtime = recordedRuntime();
  const agent = makeAgent('simple', async () => 'done');
  const session = runtime.createSession({ agentId: agent.id, mission: 'm' });
  const result = await runtime.loop.run(agent, session);
  assert.deepEqual(result, { status: 'completed', output: 'done' });
  assert.deepEqual(runtime.types(), [
    'session.created',
    'session.started',
    'agent.started',
    'agent.completed',
    'session.completed',
  ]);
});

test('multiplas iteracoes THINK/ACT/OBSERVE: cada resultado alimenta o proximo passo', async () => {
  const runtime = recordedRuntime();
  runtime.toolRuntime.register(okTool);
  allowTools(runtime, ['ok']);
  const agent = makeAgent('iterator', async (context) => {
    let value = 'seed';
    for (let i = 0; i < 3; i += 1) {
      const result = await context.runtime.requestTool('ok', { value }); // ACT
      value = result.output;                                            // OBSERVE
    }
    return value;
  });
  const session = runtime.createSession({ agentId: agent.id, mission: 'm' });
  const result = await runtime.loop.run(agent, session);
  assert.equal(result.output, 'ok:ok:ok:seed');
  assert.equal(runtime.types().filter((t) => t === 'tool.completed').length, 3);
});

test('falha de tool cascateia: tool.failed -> agent.failed -> session.failed', async () => {
  const runtime = recordedRuntime();
  runtime.toolRuntime.register(boomTool);
  allowTools(runtime, ['boom']);
  const agent = makeAgent('doomed', async (context) => {
    await context.runtime.requestTool('boom');
    return 'unreachable';
  });
  const session = runtime.createSession({ agentId: agent.id, mission: 'm' });
  const result = await runtime.loop.run(agent, session);
  assert.equal(result.status, 'failed');
  assert.equal(session.state, 'failed');
  const types = runtime.types();
  assert.ok(types.includes('tool.failed'));
  assert.ok(types.indexOf('tool.failed') < types.indexOf('agent.failed'));
  assert.ok(types.indexOf('agent.failed') < types.indexOf('session.failed'));
});

test('cancelamento: nenhuma nova tool inicia, estado final cancelled, nada de completed', async () => {
  const runtime = recordedRuntime();
  runtime.toolRuntime.register(okTool);
  allowTools(runtime, ['ok']);
  const agent = makeAgent('interrupted', async (context) => {
    await context.runtime.requestTool('ok', { value: 'first' });
    context.session.cancel('founder pressed stop');       // sinal externo simulado
    await context.runtime.requestTool('ok', { value: 'second' }); // deve ser barrada
    return 'unreachable';
  });
  const session = runtime.createSession({ agentId: agent.id, mission: 'm' });
  const result = await runtime.loop.run(agent, session);
  assert.deepEqual(result, { status: 'cancelled' });
  assert.equal(session.state, 'cancelled');
  const types = runtime.types();
  assert.equal(types.filter((t) => t === 'tool.requested').length, 1); // segunda nunca chegou ao ToolRuntime
  assert.ok(!types.includes('agent.completed'));
  assert.ok(!types.includes('agent.failed'));
  assert.ok(!types.includes('session.completed'));
  assert.ok(types.includes('session.cancelled'));
});

test('requestTool apos cancel lanca SessionError para o agente que tratar', async () => {
  const runtime = recordedRuntime();
  runtime.toolRuntime.register(okTool);
  allowTools(runtime, ['ok']);
  let caught;
  const agent = makeAgent('graceful', async (context) => {
    context.session.cancel();
    try {
      await context.runtime.requestTool('ok', { value: 'x' });
    } catch (error) {
      caught = error;
    }
    return 'wrapped up';
  });
  const session = runtime.createSession({ agentId: agent.id, mission: 'm' });
  const result = await runtime.loop.run(agent, session);
  assert.ok(caught instanceof SessionError);
  assert.deepEqual(result, { status: 'cancelled' }); // cancelado vence mesmo com run() resolvendo
});

test('loop exige session utilizavel: sessao ja finalizada e recusada', async () => {
  const runtime = recordedRuntime();
  const agent = makeAgent('late', async () => 'x');
  const session = runtime.createSession({ agentId: agent.id, mission: 'm' });
  session.start();
  session.complete('early');
  await assert.rejects(runtime.loop.run(agent, session), SessionStateError);
});
