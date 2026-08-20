import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PolicyDeniedError, PolicyApprovalRequiredError, ToolNotFoundError, CapabilityError } from '../errors.js';
import { CapabilityRegistry } from '../capabilities/capability-registry.js';
import { recordedRuntime, makeAgent } from './helpers.js';

/** Tool espia com contador: prova se execute() foi chamado ou nao. */
function countingTool(id, extra = {}) {
  const tool = {
    id,
    name: id,
    description: 'conta execucoes',
    calls: 0,
    execute: async () => {
      tool.calls += 1;
      return 'ran:' + id;
    },
    ...extra,
  };
  return tool;
}

test('DENY: Tool.execute() nunca e chamado; lifecycle exato da secao 31', async () => {
  const runtime = recordedRuntime();
  const tool = countingTool('database.migrate', { capability: 'database', operation: 'migration' });
  runtime.toolRuntime.register(tool);
  // nenhuma policy para jakiro: default deny
  await assert.rejects(
    runtime.toolRuntime.execute({ toolId: 'database.migrate' }, { agentId: 'jakiro' }),
    PolicyDeniedError,
  );
  assert.equal(tool.calls, 0);
  assert.deepEqual(runtime.types(), ['tool.requested', 'policy.evaluated', 'policy.denied']);
});

test('APPROVAL: Tool.execute() nunca e chamado; erro tipado para o Founder Gate futuro', async () => {
  const runtime = recordedRuntime();
  const tool = countingTool('database.migrate', {
    capability: 'database',
    operation: 'migration',
    resource: { type: 'database', id: 'production' },
  });
  runtime.toolRuntime.register(tool);
  runtime.policyRegistry.register({
    id: 'production-migration',
    effect: 'approval-required',
    capability: 'database',
    operations: ['migration'],
    resource: 'production',
  });
  await assert.rejects(
    runtime.toolRuntime.execute({ toolId: 'database.migrate' }, { agentId: 'oracle' }),
    (error) => error instanceof PolicyApprovalRequiredError &&
      error.decision.policyId === 'production-migration',
  );
  assert.equal(tool.calls, 0);
  assert.deepEqual(runtime.types(), ['tool.requested', 'policy.evaluated', 'policy.approval-required']);
});

test('ALLOW: Tool.execute() e chamado exatamente uma vez; lifecycle exato', async () => {
  const runtime = recordedRuntime();
  const tool = countingTool('database.migrate', {
    capability: 'database',
    operation: 'migration',
    resource: { type: 'database', id: 'development' },
  });
  runtime.toolRuntime.register(tool);
  runtime.policyRegistry.register({
    id: 'oracle-database-development',
    effect: 'allow',
    principal: 'oracle',
    capability: 'database',
    operations: ['query', 'migration'],
    resource: 'development',
  });
  const result = await runtime.toolRuntime.execute(
    { toolId: 'database.migrate' },
    { agentId: 'oracle' },
  );
  assert.equal(result.output, 'ran:database.migrate');
  assert.equal(tool.calls, 1);
  assert.deepEqual(runtime.types(), [
    'tool.requested',
    'policy.evaluated',
    'tool.started',
    'tool.completed',
  ]);
});

test('deny explicito vence allow explicito no enforcement', async () => {
  const runtime = recordedRuntime();
  const tool = countingTool('database.migrate', {
    capability: 'database',
    resource: { type: 'database', id: 'production' },
  });
  runtime.toolRuntime.register(tool);
  runtime.policyRegistry.registerMany([
    { id: 'allow-oracle-database', effect: 'allow', principal: 'oracle', capability: 'database' },
    { id: 'deny-oracle-production', effect: 'deny', principal: 'oracle', resource: 'production' },
  ]);
  await assert.rejects(
    runtime.toolRuntime.execute({ toolId: 'database.migrate' }, { agentId: 'oracle' }),
    (error) => error instanceof PolicyDeniedError &&
      error.decision.policyId === 'deny-oracle-production',
  );
  assert.equal(tool.calls, 0);
});

test('composicao (secao 51): mesma capability, operation coberta executa, nao coberta nao', async () => {
  const runtime = recordedRuntime();
  const query = countingTool('database.query', { capability: 'database', operation: 'query' });
  const migrate = countingTool('database.migrate', { capability: 'database', operation: 'migration' });
  runtime.toolRuntime.register(query);
  runtime.toolRuntime.register(migrate);
  runtime.policyRegistry.register({
    id: 'jakiro-database-query',
    effect: 'allow',
    principal: 'jakiro',
    capability: 'database',
    operations: ['query'],
  });
  await runtime.toolRuntime.execute({ toolId: 'database.query' }, { agentId: 'jakiro' });
  await assert.rejects(
    runtime.toolRuntime.execute({ toolId: 'database.migrate' }, { agentId: 'jakiro' }),
    PolicyDeniedError,
  );
  assert.equal(query.calls, 1);
  assert.equal(migrate.calls, 0);
});

test('tool legada sem capability: fallback capability = tool.id, e so executa com policy explicita', async () => {
  const runtime = recordedRuntime();
  const legacy = countingTool('legacy-tool');
  runtime.toolRuntime.register(legacy);
  // sem policy: default deny (secao 53 - capability ausente nunca vira allow)
  await assert.rejects(
    runtime.toolRuntime.execute({ toolId: 'legacy-tool' }, { agentId: 'anyone' }),
    PolicyDeniedError,
  );
  assert.equal(legacy.calls, 0);
  // policy casando pelo fallback capability = tool.id
  runtime.policyRegistry.register({ id: 'allow-legacy', effect: 'allow', capability: 'legacy-tool' });
  await runtime.toolRuntime.execute({ toolId: 'legacy-tool' }, { agentId: 'anyone' });
  assert.equal(legacy.calls, 1);
});

test('resource resolver como funcao de input: mesma tool, resources diferentes, decisoes diferentes', async () => {
  const runtime = recordedRuntime();
  const tool = countingTool('database.migrate', {
    capability: 'database',
    operation: 'migration',
    resource: (input) => ({ type: 'database', id: input.target }),
  });
  runtime.toolRuntime.register(tool);
  runtime.policyRegistry.register({
    id: 'oracle-development-only',
    effect: 'allow',
    principal: 'oracle',
    capability: 'database',
    resource: 'development',
  });
  await runtime.toolRuntime.execute(
    { toolId: 'database.migrate', input: { target: 'development' } },
    { agentId: 'oracle' },
  );
  await assert.rejects(
    runtime.toolRuntime.execute(
      { toolId: 'database.migrate', input: { target: 'production' } },
      { agentId: 'oracle' },
    ),
    PolicyDeniedError,
  );
  assert.equal(tool.calls, 1);
});

test('isolamento (secao 50): sessions paralelas com policies diferentes nao vazam', async () => {
  const runtime = recordedRuntime();
  const tool = countingTool('database.query', { capability: 'database', operation: 'query' });
  runtime.toolRuntime.register(tool);
  runtime.policyRegistry.register({
    id: 'oracle-database',
    effect: 'allow',
    principal: 'oracle',
    capability: 'database',
  });
  const oracle = makeAgent('oracle', async (context) =>
    (await context.runtime.requestTool('database.query')).output,
  );
  const jakiro = makeAgent('jakiro', async (context) =>
    (await context.runtime.requestTool('database.query')).output,
  );
  const sessionA = runtime.createSession({ agentId: 'oracle', mission: 'query things' });
  const sessionB = runtime.createSession({ agentId: 'jakiro', mission: 'query things' });
  const [resultA, resultB] = await Promise.all([
    runtime.loop.run(oracle, sessionA),
    runtime.loop.run(jakiro, sessionB),
  ]);
  assert.equal(resultA.status, 'completed');
  assert.equal(resultB.status, 'failed');
  assert.ok(resultB.error instanceof PolicyDeniedError);
  assert.equal(tool.calls, 1);

  const typesFor = (id) => runtime.events.filter((e) => e.sessionId === id).map((e) => e.type);
  assert.ok(typesFor(sessionA.id).includes('tool.completed'));
  assert.ok(!typesFor(sessionA.id).includes('policy.denied'));
  assert.ok(typesFor(sessionB.id).includes('policy.denied'));
  assert.ok(!typesFor(sessionB.id).includes('tool.started'));
});

test('payload de policy (secao 26): campos exatos, nunca input nem output', async () => {
  const runtime = recordedRuntime();
  const tool = countingTool('database.query', { capability: 'database', operation: 'query' });
  runtime.toolRuntime.register(tool);
  runtime.policyRegistry.register({ id: 'allow-q', effect: 'allow', capability: 'database' });
  await runtime.toolRuntime.execute(
    { toolId: 'database.query', input: { query: 'SELECT secret FROM vault' } },
    { agentId: 'oracle', session: { id: 'sess_p' } },
  );
  const evaluated = runtime.events.find((e) => e.type === 'policy.evaluated');
  assert.deepEqual(
    Object.keys(evaluated.payload).sort(),
    ['effect', 'operation', 'policyId', 'reason', 'resource', 'toolId'],
  );
  assert.ok(!JSON.stringify(evaluated.payload).includes('SELECT secret'));
  assert.equal(evaluated.sessionId, 'sess_p');
  assert.equal(evaluated.agentId, 'oracle');
});

test('matriz (secao 71): tool inexistente e input invalido precedem a Policy', async () => {
  const runtime = recordedRuntime();
  await assert.rejects(
    runtime.toolRuntime.execute({ toolId: 'ghost' }, { agentId: 'x' }),
    ToolNotFoundError,
  );
  assert.ok(!runtime.types().includes('policy.evaluated'));
});

test('superficie de autoridade (secoes 48/49): contexto do Agent inalterado, sem rota para policy', async () => {
  const runtime = recordedRuntime();
  const tool = countingTool('ok2');
  runtime.toolRuntime.register(tool);
  runtime.policyRegistry.register({ id: 'allow-ok2', effect: 'allow', tools: ['ok2'] });
  let seen;
  const agent = makeAgent('probe', async (context) => {
    seen = context;
    await context.runtime.requestTool('ok2');
    return 'done';
  });
  const session = runtime.createSession({ agentId: 'probe', mission: 'm' });
  const result = await runtime.loop.run(agent, session);
  assert.equal(result.status, 'completed');
  assert.deepEqual(Object.keys(seen).sort(), ['mission', 'runtime', 'session']);
  assert.deepEqual(Object.keys(seen.runtime), ['requestTool']);
  for (const forbidden of ['policyEngine', 'policyRegistry', 'capabilityRegistry', 'eventBus', 'toolRuntime']) {
    assert.equal(seen[forbidden], undefined);
    assert.equal(seen.runtime[forbidden], undefined);
    assert.equal(seen.session[forbidden], undefined);
  }
});

test('CapabilityRegistry (secao 52): register, resolve, has, list, duplicado, invalido', () => {
  const registry = new CapabilityRegistry();
  const database = registry.register({
    id: 'database',
    name: 'Database',
    description: 'familia de operacoes de banco',
    operations: ['query', 'migration'],
  });
  assert.ok(Object.isFrozen(database));
  assert.ok(registry.has('database'));
  assert.equal(registry.resolve('database').name, 'Database');
  assert.deepEqual(registry.list().map((c) => c.id), ['database']);
  assert.throws(() => registry.register(database), CapabilityError);            // duplicado
  assert.throws(() => registry.resolve('ghost'), CapabilityError);              // inexistente
  assert.throws(
    () => registry.register({ id: 'x', name: 'X', description: 'x', operations: [] }),
    CapabilityError,                                                            // sem operations
  );
});
