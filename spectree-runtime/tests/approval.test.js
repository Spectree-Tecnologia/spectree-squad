import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApprovalNotFoundError,
  ApprovalStateError,
  ApprovalExpiredError,
  PolicyApprovalRequiredError,
  PolicyRevalidationError,
} from '../errors.js';
import { createRuntime } from '../index.js';
import { recordedRuntime, makeAgent } from './helpers.js';

/** Runtime com tool de migration sob approval-required em production. */
function approvalRuntime(options = {}) {
  const runtime = createRuntime(options);
  const events = [];
  runtime.eventBus.subscribe('*', (e) => events.push(e));
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
  runtime.capabilityRegistry.register({
    id: 'database',
    name: 'Database',
    description: 'test capability',
    operations: ['query', 'migration'],
  });
  runtime.toolRuntime.register(tool);
  runtime.policyRegistry.registerMany([
    {
      id: 'oracle-development',
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
  return { ...runtime, events, types: () => events.map((e) => e.type), tool };
}

async function suspend(runtime, input = { target: 'production' }) {
  try {
    await runtime.toolRuntime.execute(
      { toolId: 'database.migrate', input },
      { agentId: 'oracle', session: { id: 'sess_apr' } },
    );
    throw new Error('expected suspension');
  } catch (error) {
    assert.ok(error instanceof PolicyApprovalRequiredError);
    assert.ok(typeof error.approvalId === 'string' && error.approvalId.startsWith('apr_'));
    return error.approvalId;
  }
}

test('secao 58: sequencia completa approve -> resume, igualdade estrita', async () => {
  const runtime = approvalRuntime();
  const approvalId = await suspend(runtime);
  assert.deepEqual(runtime.tool.calls, []);
  runtime.approvalManager.approve(approvalId, { type: 'founder', id: 'founder' });
  const result = await runtime.approvalManager.resume(approvalId);
  assert.equal(result.output, 'migrated production');
  assert.deepEqual(runtime.tool.calls, ['production']);
  assert.deepEqual(runtime.types(), [
    'tool.requested',
    'policy.evaluated',
    'policy.approval-required',
    'approval.requested',
    'approval.approved',
    'approval.resumed',
    'tool.started',
    'tool.completed',
  ]);
});

test('secao 59: deny - Tool.execute() === 0, sequencia exata', async () => {
  const runtime = approvalRuntime();
  const approvalId = await suspend(runtime);
  runtime.approvalManager.deny(approvalId, { type: 'founder', id: 'founder' }, 'not today');
  await assert.rejects(runtime.approvalManager.resume(approvalId), ApprovalStateError);
  assert.deepEqual(runtime.tool.calls, []);
  assert.deepEqual(runtime.types(), [
    'tool.requested',
    'policy.evaluated',
    'policy.approval-required',
    'approval.requested',
    'approval.denied',
  ]);
});

test('secao 60/74: expiracao preguicosa - approve e resume falham, Tool.execute() === 0', async () => {
  let now = 1_000_000;
  const runtime = approvalRuntime({ clock: () => now, approvalTtlMs: 5_000 });
  const approvalId = await suspend(runtime);
  now += 10_000; // passa do expiresAt
  assert.throws(
    () => runtime.approvalManager.approve(approvalId, { type: 'founder', id: 'founder' }),
    ApprovalExpiredError,
  );
  await assert.rejects(runtime.approvalManager.resume(approvalId), ApprovalExpiredError);
  assert.deepEqual(runtime.tool.calls, []);
  assert.deepEqual(runtime.types(), [
    'tool.requested',
    'policy.evaluated',
    'policy.approval-required',
    'approval.requested',
    'approval.expired',
  ]);
});

test('secao 61: session cancelada cancela approvals pending; resume rejeitado', async () => {
  const runtime = approvalRuntime();
  // a Session segue running enquanto a invocation esta suspensa (secao 17)
  const session = runtime.createSession({ agentId: 'oracle', mission: 'migrate production' });
  session.start();
  let approvalId;
  try {
    await runtime.toolRuntime.execute(
      { toolId: 'database.migrate', input: { target: 'production' } },
      { agentId: 'oracle', session },
    );
  } catch (error) {
    approvalId = error.approvalId;
  }
  session.cancel('founder aborted');
  const types = runtime.types();
  // Ordem documentada (secao 34): a cascata e sincrona e reentrante, entao
  // approval.cancelled e entregue aos observers DURANTE o publish de
  // session.cancelled - aparece antes no stream, causalmente vem depois.
  // O que importa: ambos presentes, e o cancel completo antes de qualquer
  // resume (a sincronicidade elimina a janela de corrida).
  assert.ok(types.includes('session.cancelled'));
  assert.ok(types.includes('approval.cancelled'));
  await assert.rejects(runtime.approvalManager.resume(approvalId), ApprovalStateError);
  assert.throws(
    () => runtime.approvalManager.approve(approvalId, { type: 'founder', id: 'founder' }),
    ApprovalStateError,
  );
  assert.deepEqual(runtime.tool.calls, []);
});

test('secao 48: approve antes do cancel - resume ainda respeita a Session cancelada', async () => {
  const runtime = approvalRuntime();
  const session = runtime.createSession({ agentId: 'oracle', mission: 'm' });
  session.start();
  let approvalId;
  try {
    await runtime.toolRuntime.execute(
      { toolId: 'database.migrate', input: { target: 'production' } },
      { agentId: 'oracle', session },
    );
  } catch (error) {
    approvalId = error.approvalId;
  }
  runtime.approvalManager.approve(approvalId, { type: 'founder', id: 'founder' }); // aprovado primeiro
  session.cancel();
  await assert.rejects(runtime.approvalManager.resume(approvalId), ApprovalStateError);
  assert.deepEqual(runtime.tool.calls, []);
});

test('secao 62/92: policy muda para deny apos approve - PolicyRevalidationError, zero execucao', async () => {
  const runtime = approvalRuntime();
  const approvalId = await suspend(runtime);
  runtime.approvalManager.approve(approvalId, { type: 'founder', id: 'founder' });
  // a Policy muda entre a aprovacao e o resume
  runtime.policyRegistry.register({
    id: 'freeze-production',
    effect: 'deny',
    resource: 'production',
  });
  await assert.rejects(
    runtime.approvalManager.resume(approvalId),
    (error) => error instanceof PolicyRevalidationError && error.decision.effect === 'deny',
  );
  assert.deepEqual(runtime.tool.calls, []);
  assert.ok(!runtime.types().includes('tool.started'));
  assert.ok(!runtime.types().includes('approval.resumed'));
});

test('secao 21: policy NOVA de approval-required tambem bloqueia o resume', async () => {
  const runtime = approvalRuntime();
  const approvalId = await suspend(runtime);
  runtime.approvalManager.approve(approvalId, { type: 'founder', id: 'founder' });
  // substitui a exigencia original por outra policy de aprovacao
  runtime.policyRegistry.remove('production-approval');
  runtime.policyRegistry.register({
    id: 'new-stricter-approval',
    effect: 'approval-required',
    capability: 'database',
  });
  await assert.rejects(runtime.approvalManager.resume(approvalId), PolicyRevalidationError);
  assert.deepEqual(runtime.tool.calls, []);
});

test('secao 63/67: resume e unico - segunda chamada falha e a Tool nao reexecuta', async () => {
  const runtime = approvalRuntime();
  const approvalId = await suspend(runtime);
  runtime.approvalManager.approve(approvalId, { type: 'founder', id: 'founder' });
  await runtime.approvalManager.resume(approvalId);
  await assert.rejects(runtime.approvalManager.resume(approvalId), ApprovalStateError);
  assert.deepEqual(runtime.tool.calls, ['production']); // exatamente uma execucao
});

test('secao 66/93: decisao concorrente - uma vencedora, um unico evento terminal', async () => {
  const runtime = approvalRuntime();
  const approvalId = await suspend(runtime);
  const founder = { type: 'founder', id: 'founder' };
  const outcomes = await Promise.allSettled([
    Promise.resolve().then(() => runtime.approvalManager.approve(approvalId, founder)),
    Promise.resolve().then(() => runtime.approvalManager.deny(approvalId, founder)),
  ]);
  const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
  const rejected = outcomes.filter((o) => o.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reason instanceof ApprovalStateError);
  const terminalEvents = runtime.types().filter(
    (t) => t === 'approval.approved' || t === 'approval.denied',
  );
  assert.equal(terminalEvents.length, 1);
  // idempotencia segura (secao 46): repetir a decisao vencedora nao duplica evento
  const winner = fulfilled[0].value.status;
  if (winner === 'approved') runtime.approvalManager.approve(approvalId, founder);
  else runtime.approvalManager.deny(approvalId, founder);
  assert.equal(
    runtime.types().filter((t) => t === 'approval.approved' || t === 'approval.denied').length,
    1,
  );
});

test('secao 68/28: approval.requested nao carrega input - segredo nunca chega ao bus', async () => {
  const runtime = approvalRuntime();
  await suspend(runtime, { target: 'production', apiKey: 'super-secret' });
  const requested = runtime.events.find((e) => e.type === 'approval.requested');
  assert.deepEqual(
    Object.keys(requested.payload).sort(),
    ['approvalId', 'capabilityId', 'expiresAt', 'operation', 'policyId', 'reason', 'resource', 'toolId'],
  );
  assert.ok(!JSON.stringify(runtime.events).includes('super-secret'));
});

test('secao 69: ApprovalRequest captura o resource real, nao o forjado', async () => {
  const runtime = approvalRuntime();
  try {
    await runtime.toolRuntime.execute(
      {
        toolId: 'database.migrate',
        input: { target: 'production' },
        resource: { type: 'database', id: 'development' }, // spoof
      },
      { agentId: 'oracle' },
    );
  } catch (error) {
    const view = runtime.approvalManager.get(error.approvalId);
    assert.equal(view.resource, 'database/production');
  }
});

test('secao 70: o pedido e snapshot - mudar a Tool depois nao altera o registro', async () => {
  const runtime = approvalRuntime();
  const approvalId = await suspend(runtime);
  runtime.tool.operation = 'query';
  runtime.tool.resource = () => ({ type: 'database', id: 'development' });
  const view = runtime.approvalManager.get(approvalId);
  assert.equal(view.operation, 'migration');
  assert.equal(view.resource, 'database/production');
  assert.equal(view.toolId, 'database.migrate');
});

test('secao 71: isolamento - decisao de A nao alcanca B, cancelamento de B nao alcanca A', async () => {
  const runtime = approvalRuntime();
  const sessionA = runtime.createSession({ agentId: 'oracle', mission: 'a' });
  const sessionB = runtime.createSession({ agentId: 'oracle', mission: 'b' });
  const suspendIn = async (session) => {
    session.start();
    try {
      await runtime.toolRuntime.execute(
        { toolId: 'database.migrate', input: { target: 'production' } },
        { agentId: 'oracle', session },
      );
    } catch (error) {
      return error.approvalId;
    }
  };
  const approvalA = await suspendIn(sessionA);
  const approvalB = await suspendIn(sessionB);
  assert.notEqual(approvalA, approvalB);
  runtime.approvalManager.approve(approvalA, { type: 'founder', id: 'founder' });
  assert.equal(runtime.approvalManager.get(approvalB).status, 'pending'); // decisao nao vaza
  sessionB.cancel();
  assert.equal(runtime.approvalManager.get(approvalB).status, 'cancelled');
  assert.equal(runtime.approvalManager.get(approvalA).status, 'approved'); // cancelamento nao vaza
  await runtime.approvalManager.resume(approvalA);
  assert.deepEqual(runtime.tool.calls, ['production']);
});

test('secao 73: id inexistente - ApprovalNotFoundError e nenhum evento de approval', async () => {
  const runtime = approvalRuntime();
  const before = runtime.types().filter((t) => t.startsWith('approval.')).length;
  const founder = { type: 'founder', id: 'founder' };
  assert.throws(() => runtime.approvalManager.approve('apr_ghost', founder), ApprovalNotFoundError);
  assert.throws(() => runtime.approvalManager.deny('apr_ghost', founder), ApprovalNotFoundError);
  assert.throws(() => runtime.approvalManager.cancel('apr_ghost'), ApprovalNotFoundError);
  await assert.rejects(runtime.approvalManager.resume('apr_ghost'), ApprovalNotFoundError);
  assert.equal(runtime.types().filter((t) => t.startsWith('approval.')).length, before);
});

test('secao 93: matriz - pending nao resume; approved nao vira denied', async () => {
  const runtime = approvalRuntime();
  const approvalId = await suspend(runtime);
  await assert.rejects(runtime.approvalManager.resume(approvalId), ApprovalStateError); // pending
  const founder = { type: 'founder', id: 'founder' };
  runtime.approvalManager.approve(approvalId, founder);
  assert.throws(() => runtime.approvalManager.deny(approvalId, founder), ApprovalStateError);
});

test('secoes 64/65: superficie do Agent inalterada - nenhuma rota de approval no contexto', async () => {
  const runtime = recordedRuntime();
  runtime.capabilityRegistry.register({ id: 'plain', name: 'p', description: 'test', operations: ['execute'] });
  runtime.toolRuntime.register({ id: 'plain', name: 'P', description: 'p', execute: async () => 'x' });
  runtime.policyRegistry.register({ id: 'allow-plain', effect: 'allow', tools: ['plain'] });
  let seen;
  const agent = makeAgent('probe', async (context) => {
    seen = context;
    await context.runtime.requestTool('plain');
    return 'ok';
  });
  await runtime.loop.run(agent, runtime.createSession({ agentId: 'probe', mission: 'm' }));
  assert.deepEqual(Object.keys(seen).sort(), ['mission', 'runtime', 'session']);
  assert.deepEqual(Object.keys(seen.runtime), ['requestTool']);
  for (const forbidden of ['approve', 'deny', 'requestApproval', 'approvalManager', 'founderGate', 'approvalStore', 'resume']) {
    assert.equal(seen[forbidden], undefined);
    assert.equal(seen.runtime[forbidden], undefined);
    assert.equal(seen.session[forbidden], undefined);
  }
});

test('authorize() e puro: decide sem emitir evento algum', async () => {
  const runtime = approvalRuntime();
  const before = runtime.events.length;
  const { decision } = runtime.toolRuntime.authorize(
    { toolId: 'database.migrate', input: { target: 'development' } },
    { agentId: 'oracle' },
  );
  assert.equal(decision.effect, 'allow');
  assert.equal(runtime.events.length, before);
});

test('FounderGate: lista pending com contexto seguro e decide via manager', async () => {
  const runtime = approvalRuntime();
  const approvalId = await suspend(runtime, { target: 'production', apiKey: 'hush' });
  const pending = runtime.founderGate.pending();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].approvalId, approvalId);
  assert.ok(!JSON.stringify(pending).includes('hush')); // contexto seguro (secao 86)
  runtime.founderGate.approve(approvalId);
  assert.equal(runtime.founderGate.pending().length, 0);
  const result = await runtime.approvalManager.resume(approvalId);
  assert.equal(result.output, 'migrated production');
});
