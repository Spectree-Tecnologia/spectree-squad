import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PolicyDeniedError, PolicyApprovalRequiredError, CapabilityNotFoundError } from '../errors.js';
import { recordedRuntime, makeAgent } from './helpers.js';

function migrateTool() {
  const tool = {
    id: 'database.migrate',
    name: 'Database Migrate',
    description: 'migra o banco alvo',
    capability: 'database',
    operation: 'migration',
    resource: (input) => ({ type: 'database', id: input.target }),
    calls: [],
    execute: async (input) => {
      tool.calls.push(input.target);
      return 'migrated ' + input.target;
    },
  };
  return tool;
}

function installDatabaseCapability(runtime) {
  runtime.capabilityRegistry.register({
    id: 'database',
    name: 'Database',
    description: 'test capability',
    operations: ['query', 'migration', 'execute'],
  });
}

function devOnlyPolicies(runtime) {
  runtime.policyRegistry.registerMany([
    {
      id: 'oracle-development-only',
      effect: 'allow',
      principal: 'oracle',
      capability: 'database',
      resource: 'development',
    },
    {
      id: 'production-approval',
      effect: 'approval-required',
      capability: 'database',
      resource: 'production',
    },
  ]);
}

test('R9: request.resource forjado e ignorado - a Policy decide sobre o recurso efetivo', async () => {
  const runtime = recordedRuntime();
  const tool = migrateTool();
  installDatabaseCapability(runtime);
  runtime.toolRuntime.register(tool);
  devOnlyPolicies(runtime);

  // chamador forja request.resource = development, mas o input executa production
  await assert.rejects(
    runtime.toolRuntime.execute(
      {
        toolId: 'database.migrate',
        input: { target: 'production' },
        resource: { type: 'database', id: 'development' }, // spoof
      },
      { agentId: 'oracle' },
    ),
    PolicyApprovalRequiredError,
  );
  assert.deepEqual(tool.calls, []); // nunca executou
  const evaluated = runtime.events.find((e) => e.type === 'policy.evaluated');
  assert.equal(evaluated.payload.resource, 'database/production'); // a Policy viu o recurso REAL
});

test('R9: o Agent nao consegue transformar production em development', async () => {
  const runtime = recordedRuntime();
  const tool = migrateTool();
  installDatabaseCapability(runtime);
  runtime.toolRuntime.register(tool);
  devOnlyPolicies(runtime);

  // o unico canal do Agent e requestTool(toolId, input) - e o input que
  // autoriza e o mesmo que executa, entao nao ha o que falsificar
  const agent = makeAgent('oracle', async (context) => {
    const dev = await context.runtime.requestTool('database.migrate', { target: 'development' });
    let blocked = null;
    try {
      await context.runtime.requestTool('database.migrate', { target: 'production' });
    } catch (error) {
      blocked = error;
    }
    return { dev: dev.output, blocked: blocked?.constructor.name };
  });
  const session = runtime.createSession({ agentId: 'oracle', mission: 'migrate' });
  const result = await runtime.loop.run(agent, session);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.output, { dev: 'migrated development', blocked: 'PolicyApprovalRequiredError' });
  assert.deepEqual(tool.calls, ['development']); // production nunca executou
});

test('R10: projecao default nao publica input nem output - segredo nao alcanca o bus', async () => {
  const runtime = recordedRuntime(); // sem projectEventPayload customizado
  const tool = {
    id: 'vault.write',
    name: 'Vault Write',
    description: 'grava um segredo',
    execute: async () => 'stored: token-xyz789',
  };
  runtime.capabilityRegistry.register({ id: 'vault.write', name: 'v', description: 'test', operations: ['execute'] });
  runtime.toolRuntime.register(tool);
  runtime.policyRegistry.register({ id: 'allow-vault', effect: 'allow', tools: ['vault.write'] });
  await runtime.toolRuntime.execute(
    { toolId: 'vault.write', input: { apiKey: 'super-secret-key' } },
    { agentId: 'oracle' },
  );
  const toolEvents = runtime.events.filter((e) => e.type.startsWith('tool.'));
  assert.equal(toolEvents.length, 3);
  for (const event of toolEvents) {
    assert.deepEqual(Object.keys(event.payload), ['toolId']); // so o id, nada mais
  }
  const everything = JSON.stringify(runtime.events);
  assert.ok(!everything.includes('super-secret-key'));
  assert.ok(!everything.includes('token-xyz789'));
});

test('R10: tool.failed default publica toolId e mensagem de erro, nada de input', async () => {
  const runtime = recordedRuntime();
  runtime.toolRuntime.register({
    id: 'boom2',
    name: 'Boom2',
    description: 'falha',
    execute: async () => {
      throw new Error('exploded');
    },
  });
  runtime.capabilityRegistry.register({ id: 'boom2', name: 'b', description: 'test', operations: ['execute'] });
  runtime.policyRegistry.register({ id: 'allow-boom2', effect: 'allow', tools: ['boom2'] });
  await assert.rejects(
    runtime.toolRuntime.execute({ toolId: 'boom2', input: { secret: 'hush' } }, {}),
    /exploded/,
  );
  const failed = runtime.events.find((e) => e.type === 'tool.failed');
  assert.deepEqual(Object.keys(failed.payload).sort(), ['error', 'toolId']);
  assert.ok(!JSON.stringify(failed.payload).includes('hush'));
});

test('R10: o seam customizado continua valendo - quem monta o runtime pode optar por publicar mais', async () => {
  const runtime = recordedRuntime({
    projectEventPayload: ({ phase, toolId, input }) =>
      phase === 'requested' ? { toolId, inputKeys: Object.keys(input ?? {}) } : { toolId },
  });
  runtime.toolRuntime.register({
    id: 'custom',
    name: 'Custom',
    description: 'projecao customizada',
    execute: async () => 'ok',
  });
  runtime.capabilityRegistry.register({ id: 'custom', name: 'c', description: 'test', operations: ['execute'] });
  runtime.policyRegistry.register({ id: 'allow-custom', effect: 'allow', tools: ['custom'] });
  await runtime.toolRuntime.execute({ toolId: 'custom', input: { a: 1, b: 2 } }, {});
  const requested = runtime.events.find((e) => e.type === 'tool.requested');
  assert.deepEqual(requested.payload, { toolId: 'custom', inputKeys: ['a', 'b'] });
});

test('R11 -> Fase 4: o catalogo virou gate - capability nao registrada bloqueia (secao 58)', async () => {
  const runtime = recordedRuntime();
  assert.equal(runtime.capabilityRegistry.has('database'), false);
  const tool = migrateTool();
  runtime.toolRuntime.register(tool);
  devOnlyPolicies(runtime);
  // a semantica da Fase 2 (catalogo informativo) terminou: o requisito
  // registrado no R11 nasceu aqui, exatamente como previsto
  await assert.rejects(
    runtime.toolRuntime.execute(
      { toolId: 'database.migrate', input: { target: 'development' } },
      { agentId: 'oracle' },
    ),
    CapabilityNotFoundError,
  );
  assert.deepEqual(tool.calls, []);
  // registrada, executa
  installDatabaseCapability(runtime);
  const result = await runtime.toolRuntime.execute(
    { toolId: 'database.migrate', input: { target: 'development' } },
    { agentId: 'oracle' },
  );
  assert.equal(result.output, 'migrated development');
});
