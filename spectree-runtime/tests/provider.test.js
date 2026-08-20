import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CapabilityError,
  CapabilityNotFoundError,
  CapabilityProviderError,
  CapabilityProviderNotFoundError,
  PolicyDeniedError,
  ProviderExecutionError,
  ProviderOperationNotSupportedError,
  UnsupportedCapabilityOperationError,
} from '../errors.js';
import { CapabilityRegistry } from '../capabilities/capability-registry.js';
import { CapabilityProviderRegistry } from '../capabilities/capability-provider-registry.js';
import { recordedRuntime, makeAgent, allowTools } from './helpers.js';

/** Capability + provider fake com contador, para provar (nao-)execucao. */
function installFakeProvider(runtime, { operations = ['ping'], providerOps } = {}) {
  runtime.capabilityRegistry.register({
    id: 'net',
    name: 'Net',
    description: 'fake capability',
    operations,
  });
  const provider = {
    providerId: 'fake-net',
    capabilityId: 'net',
    version: '1.0.0',
    operations: providerOps ?? operations,
    calls: [],
    execute: async (request, context) => {
      provider.calls.push({ request, context });
      return { output: 'pong:' + (request.input.host ?? '?'), metadata: { latency: 1 } };
    },
  };
  runtime.providerRegistry.register(provider);
  return provider;
}

/** Tool provider-backed: sem execute proprio (caminho canonico da Fase 4). */
const pingTool = {
  id: 'net.ping',
  name: 'Ping',
  description: 'ping via provider',
  capability: 'net',
  operation: 'ping',
  resource: (input) => ({ type: 'net', id: input.host }),
};

test('ProviderRegistry: validacoes de registro (secao 56)', () => {
  const capabilityRegistry = new CapabilityRegistry();
  capabilityRegistry.register({ id: 'net', name: 'n', description: 'd', operations: ['ping'] });
  const registry = new CapabilityProviderRegistry({ capabilityRegistry });
  const good = { providerId: 'p1', capabilityId: 'net', version: '1.0.0', operations: ['ping'], execute: async () => ({}) };
  registry.register(good);
  assert.ok(registry.has('net'));
  assert.deepEqual(registry.list()[0].operations, ['ping']);
  assert.ok(Object.isFrozen(registry.list()[0]));
  // duplicado
  assert.throws(() => registry.register({ ...good }), CapabilityProviderError);
  // capability inexistente
  assert.throws(
    () => registry.register({ ...good, providerId: 'p2', capabilityId: 'ghost' }),
    CapabilityError,
  );
  // operations fora da capability
  assert.throws(
    () => registry.register({ ...good, providerId: 'p3', operations: ['ping', 'flood'] }),
    CapabilityProviderError,
  );
  // provider sem execute
  assert.throws(
    () => registry.register({ providerId: 'p4', capabilityId: 'net', version: '1', operations: ['ping'] }),
    CapabilityProviderError,
  );
  // resolve de capability sem provider
  assert.throws(() => registry.resolve('ghost'), CapabilityProviderNotFoundError);
});

test('matriz secao 154: cada degrau bloqueia com o erro certo, Provider.execute = 0', async () => {
  // capability inexistente
  {
    const runtime = recordedRuntime();
    runtime.toolRuntime.register(pingTool);
    allowTools(runtime, ['net.ping']);
    await assert.rejects(
      runtime.toolRuntime.execute({ toolId: 'net.ping', input: { host: 'a' } }, {}),
      CapabilityNotFoundError,
    );
  }
  // operation nao suportada pela capability
  {
    const runtime = recordedRuntime();
    runtime.capabilityRegistry.register({ id: 'net', name: 'n', description: 'd', operations: ['trace'] });
    runtime.toolRuntime.register(pingTool);
    allowTools(runtime, ['net.ping']);
    await assert.rejects(
      runtime.toolRuntime.execute({ toolId: 'net.ping', input: { host: 'a' } }, {}),
      UnsupportedCapabilityOperationError,
    );
  }
  // provider inexistente
  {
    const runtime = recordedRuntime();
    runtime.capabilityRegistry.register({ id: 'net', name: 'n', description: 'd', operations: ['ping'] });
    runtime.toolRuntime.register(pingTool);
    allowTools(runtime, ['net.ping']);
    await assert.rejects(
      runtime.toolRuntime.execute({ toolId: 'net.ping', input: { host: 'a' } }, {}),
      CapabilityProviderNotFoundError,
    );
  }
  // provider nao suporta a operation
  {
    const runtime = recordedRuntime();
    runtime.capabilityRegistry.register({ id: 'net', name: 'n', description: 'd', operations: ['ping', 'trace'] });
    runtime.providerRegistry.register({
      providerId: 'trace-only', capabilityId: 'net', version: '1', operations: ['trace'],
      execute: async () => ({ output: null }),
    });
    runtime.toolRuntime.register(pingTool);
    allowTools(runtime, ['net.ping']);
    await assert.rejects(
      runtime.toolRuntime.execute({ toolId: 'net.ping', input: { host: 'a' } }, {}),
      ProviderOperationNotSupportedError,
    );
  }
});

test('execucao permitida: Provider.execute exatamente uma vez, sequencia congelada (secao 34)', async () => {
  const runtime = recordedRuntime();
  const provider = installFakeProvider(runtime);
  runtime.toolRuntime.register(pingTool);
  allowTools(runtime, ['net.ping']);
  const result = await runtime.toolRuntime.execute(
    { toolId: 'net.ping', input: { host: 'alpha' } },
    { agentId: 'oracle' },
  );
  assert.deepEqual(result, { ok: true, toolId: 'net.ping', output: 'pong:alpha' });
  assert.equal(provider.calls.length, 1);
  assert.deepEqual(runtime.types(), [
    'tool.requested',
    'policy.evaluated',
    'tool.started',
    'provider.started',
    'provider.completed',
    'tool.completed',
  ]);
});

test('Policy deny: Provider.execute = 0 (secao 108)', async () => {
  const runtime = recordedRuntime();
  const provider = installFakeProvider(runtime);
  runtime.toolRuntime.register(pingTool);
  await assert.rejects(
    runtime.toolRuntime.execute({ toolId: 'net.ping', input: { host: 'a' } }, { agentId: 'x' }),
    PolicyDeniedError,
  );
  assert.equal(provider.calls.length, 0);
  assert.ok(!runtime.types().includes('provider.started'));
});

test('provider falha: sequencia da secao 70, erro normalizado com causa (secao 71)', async () => {
  const runtime = recordedRuntime();
  runtime.capabilityRegistry.register({ id: 'net', name: 'n', description: 'd', operations: ['ping'] });
  runtime.providerRegistry.register({
    providerId: 'broken', capabilityId: 'net', version: '1', operations: ['ping'],
    execute: async () => {
      throw new Error('wire cut');
    },
  });
  runtime.toolRuntime.register(pingTool);
  allowTools(runtime, ['net.ping']);
  await assert.rejects(
    runtime.toolRuntime.execute({ toolId: 'net.ping', input: { host: 'a' } }, {}),
    (error) => error instanceof ProviderExecutionError && /wire cut/.test(error.message) &&
      error.cause instanceof Error,
  );
  assert.deepEqual(runtime.types(), [
    'tool.requested',
    'policy.evaluated',
    'tool.started',
    'provider.started',
    'provider.failed',
    'tool.failed',
  ]);
  // recovery (secao 118): nova invocacao funciona com provider saudavel
  const runtime2 = recordedRuntime();
  installFakeProvider(runtime2);
  runtime2.toolRuntime.register(pingTool);
  allowTools(runtime2, ['net.ping']);
  const result = await runtime2.toolRuntime.execute({ toolId: 'net.ping', input: { host: 'b' } }, {});
  assert.equal(result.output, 'pong:b');
});

test('ProviderExecutionContext: superficie exata e congelada (secoes 22-23, R8)', async () => {
  const runtime = recordedRuntime();
  const provider = installFakeProvider(runtime);
  runtime.toolRuntime.register(pingTool);
  allowTools(runtime, ['net.ping']);
  await runtime.toolRuntime.execute(
    { toolId: 'net.ping', input: { host: 'alpha' } },
    { agentId: 'oracle', session: { id: 'sess_p4' } },
  );
  const { request, context } = provider.calls[0];
  assert.deepEqual(Object.keys(context), [
    'sessionId', 'agentId', 'capabilityId', 'operation', 'resource', 'metadata',
  ]);
  assert.ok(Object.isFrozen(context));
  assert.ok(Object.isFrozen(request));
  assert.equal(context.sessionId, 'sess_p4');
  assert.equal(context.agentId, 'oracle');
  // nada de autoridade no contexto (INV-413/414)
  for (const forbidden of ['policyEngine', 'toolRuntime', 'eventBus', 'approvalManager', 'policy']) {
    assert.equal(context[forbidden], undefined);
  }
});

test('resource invariance: Policy resource === Provider resource (secoes 26-27, INV-415)', async () => {
  const runtime = recordedRuntime();
  const provider = installFakeProvider(runtime);
  runtime.toolRuntime.register(pingTool);
  allowTools(runtime, ['net.ping']);
  await runtime.toolRuntime.execute(
    { toolId: 'net.ping', input: { host: 'alpha' }, resource: { type: 'net', id: 'forged' } },
    { agentId: 'oracle' },
  );
  const evaluated = runtime.events.find((e) => e.type === 'policy.evaluated');
  const { context } = provider.calls[0];
  assert.equal(evaluated.payload.resource, 'net/alpha');       // o que a Policy viu
  assert.deepEqual(context.resource, { type: 'net', id: 'alpha' }); // o que o Provider recebeu
});

test('provider.completed nao vaza output (secoes 35-36, 73, 114, INV-419)', async () => {
  const runtime = recordedRuntime();
  runtime.capabilityRegistry.register({ id: 'net', name: 'n', description: 'd', operations: ['ping'] });
  runtime.providerRegistry.register({
    providerId: 'secretive-net', capabilityId: 'net', version: '1', operations: ['ping'],
    execute: async () => ({ output: 'secret-output-token' }),
  });
  runtime.toolRuntime.register(pingTool);
  allowTools(runtime, ['net.ping']);
  const result = await runtime.toolRuntime.execute({ toolId: 'net.ping', input: { host: 'a' } }, {});
  assert.equal(result.output, 'secret-output-token'); // o ToolResult carrega
  const completed = runtime.events.find((e) => e.type === 'provider.completed');
  assert.deepEqual(
    Object.keys(completed.payload).sort(),
    ['capabilityId', 'durationMs', 'operation', 'providerId', 'resource'],
  );
  assert.ok(!JSON.stringify(runtime.events).includes('secret-output-token'));
});

test('bypass (secao 120): o Agent nao alcanca provider nem registries', async () => {
  const runtime = recordedRuntime();
  installFakeProvider(runtime);
  runtime.toolRuntime.register(pingTool);
  allowTools(runtime, ['net.ping']);
  let seen;
  const agent = makeAgent('probe', async (context) => {
    seen = context;
    const r = await context.runtime.requestTool('net.ping', { host: 'x' });
    return r.output;
  });
  const session = runtime.createSession({ agentId: 'probe', mission: 'm' });
  const result = await runtime.loop.run(agent, session);
  assert.equal(result.status, 'completed');
  assert.deepEqual(Object.keys(seen).sort(), ['mission', 'runtime', 'session']);
  assert.deepEqual(Object.keys(seen.runtime), ['requestTool']);
  for (const forbidden of ['provider', 'providerRegistry', 'capabilityRegistry', 'capabilityResolver']) {
    assert.equal(seen[forbidden], undefined);
    assert.equal(seen.runtime[forbidden], undefined);
    assert.equal(seen.session[forbidden], undefined);
  }
});
