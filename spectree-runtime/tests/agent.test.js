import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from '../agent/agent.js';
import { AgentError } from '../errors.js';
import { recordedRuntime, makeAgent, okTool, allowTools, installTool } from './helpers.js';

test('criacao: definition valida congela, campos faltando lancam AgentError', () => {
  const agent = new Agent({ id: 'a1', name: 'A1', instructions: 'do things' });
  assert.equal(agent.id, 'a1');
  assert.throws(() => { agent.definition.id = 'other'; }, TypeError); // frozen
  assert.throws(() => new Agent({ name: 'x', instructions: 'y' }), AgentError);
  assert.throws(() => new Agent({ id: 'x', instructions: 'y' }), AgentError);
  assert.throws(() => new Agent({ id: 'x', name: 'y', instructions: '' }), AgentError);
});

test('Agent base sem run() implementado falha com AgentError', async () => {
  const runtime = recordedRuntime();
  const agent = new Agent({ id: 'bare', name: 'Bare', instructions: 'none' });
  const session = runtime.createSession({ agentId: agent.id, mission: 'm' });
  const result = await runtime.loop.run(agent, session);
  assert.equal(result.status, 'failed');
  assert.ok(result.error instanceof AgentError);
});

test('execucao com sucesso produz AgentResult completed', async () => {
  const runtime = recordedRuntime();
  installTool(runtime, okTool);
  allowTools(runtime, ['ok']);
  const agent = makeAgent('worker', async (context) => {
    const r = await context.runtime.requestTool('ok', { value: context.mission });
    return r.output;
  });
  const session = runtime.createSession({ agentId: agent.id, mission: 'go' });
  const result = await runtime.loop.run(agent, session);
  assert.deepEqual(result, { status: 'completed', output: 'ok:go' });
});

test('falha do agente produz AgentResult failed com o erro original', async () => {
  const runtime = recordedRuntime();
  const agent = makeAgent('bad', async () => {
    throw new Error('own logic broke');
  });
  const session = runtime.createSession({ agentId: agent.id, mission: 'm' });
  const result = await runtime.loop.run(agent, session);
  assert.equal(result.status, 'failed');
  assert.match(result.error.message, /own logic broke/);
});

test('cancelamento durante a execucao produz AgentResult cancelled', async () => {
  const runtime = recordedRuntime();
  const agent = makeAgent('cancelme', async (context) => {
    context.session.cancel('external signal');
    return 'ignored';
  });
  const session = runtime.createSession({ agentId: agent.id, mission: 'm' });
  const result = await runtime.loop.run(agent, session);
  assert.deepEqual(result, { status: 'cancelled' });
  assert.equal(session.state, 'cancelled');
});
