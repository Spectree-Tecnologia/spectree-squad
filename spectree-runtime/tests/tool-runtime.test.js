import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../events/event-bus.js';
import { PolicyRegistry } from '../policy/policy-registry.js';
import { PolicyEngine } from '../policy/policy-engine.js';
import { ToolRuntime } from '../tools/tool-runtime.js';
import { ToolError, ToolNotFoundError, ToolValidationError } from '../errors.js';
import { okTool, boomTool } from './helpers.js';

function makeRuntime() {
  const bus = new EventBus();
  const types = [];
  bus.subscribe('*', (e) => types.push(e.type));
  const registry = new PolicyRegistry();
  registry.register({ id: 'allow-under-test', effect: 'allow', tools: ['ok', 'boom', 'spy'] });
  const policyEngine = new PolicyEngine({ registry });
  return { tools: new ToolRuntime({ eventBus: bus, policyEngine }), types };
}

test('registro: campos obrigatorios, lookup e id duplicado', () => {
  const { tools } = makeRuntime();
  tools.register(okTool);
  assert.ok(tools.has('ok'));
  assert.deepEqual(tools.list(), ['ok']);
  assert.throws(() => tools.register(okTool), ToolError);              // duplicado
  assert.throws(() => tools.register({ id: 'x', name: 'X' }), ToolError); // sem execute
});

test('execucao com input valido: resultado + sequencia requested/started/completed', async () => {
  const { tools, types } = makeRuntime();
  tools.register(okTool);
  const result = await tools.execute({ toolId: 'ok', input: { value: 'v' } }, { agentId: 'a1' });
  assert.deepEqual(result, { ok: true, toolId: 'ok', output: 'ok:v' });
  assert.deepEqual(types, ['tool.requested', 'policy.evaluated', 'tool.started', 'tool.completed']);
});

test('input invalido: ToolValidationError, sem tool.started', async () => {
  const { tools, types } = makeRuntime();
  tools.register(okTool);
  await assert.rejects(
    tools.execute({ toolId: 'ok', input: {} }),                 // faltou required
    ToolValidationError,
  );
  await assert.rejects(
    tools.execute({ toolId: 'ok', input: { value: 42 } }),      // tipo errado
    ToolValidationError,
  );
  assert.ok(!types.includes('tool.started'));
  assert.ok(!types.includes('policy.evaluated')); // validacao precede a Policy (secao 24)
  assert.equal(types.filter((t) => t === 'tool.failed').length, 2);
});

test('tool inexistente: ToolNotFoundError + tool.failed', async () => {
  const { tools, types } = makeRuntime();
  await assert.rejects(tools.execute({ toolId: 'ghost' }), ToolNotFoundError);
  assert.deepEqual(types, ['tool.requested', 'tool.failed']);
});

test('erro de execucao: erro original relancado + tool.failed, sem tool.completed', async () => {
  const { tools, types } = makeRuntime();
  tools.register(boomTool);
  await assert.rejects(tools.execute({ toolId: 'boom' }), /boom/);
  assert.deepEqual(types, ['tool.requested', 'policy.evaluated', 'tool.started', 'tool.failed']);
});

test('a tool recebe apenas o contexto necessario (INV-002)', async () => {
  const { tools } = makeRuntime();
  let seenContext;
  tools.register({
    id: 'spy',
    name: 'Spy',
    description: 'captura o contexto recebido',
    execute: async (_input, context) => {
      seenContext = context;
      return null;
    },
  });
  const fakeSession = { id: 'sess_fake', secret: 'should not leak' };
  await tools.execute({ toolId: 'spy' }, { session: fakeSession, agentId: 'a1' });
  assert.deepEqual(seenContext, { sessionId: 'sess_fake', agentId: 'a1' });
});
