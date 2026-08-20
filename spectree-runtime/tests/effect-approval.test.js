import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../index.js';
import { canonicalFilesystemPath } from '../effects/resource-ref.js';
import { PolicyApprovalRequiredError } from '../errors.js';

/**
 * Approval sobre Effect Set (spec F8, secoes 18-19, 34, 83, INV-807):
 * uma UNICA approval representa o conjunto completo, identificada pelo
 * fingerprint — nunca so pelo toolId.
 */

const fsEffect = (operation, rawPath) => ({
  kind: 'filesystem', operation,
  resource: { type: 'filesystem', id: canonicalFilesystemPath(rawPath) },
});

function build({ policies }) {
  const runtime = createRuntime();
  const events = [];
  runtime.eventBus.subscribe('*', (event) => events.push(event));
  runtime.capabilityRegistry.register({
    id: 'filesystem', name: 'FS', description: 'teste',
    operations: ['read', 'write', 'batch'], effectKinds: ['filesystem'],
  });
  const executed = [];
  runtime.toolRuntime.register({
    id: 'batch.fs', name: 'batch', description: 'multi', capability: 'filesystem', operation: 'batch',
    resolveEffects: (input) => [
      ...(input.reads ?? []).map((p) => fsEffect('read', p)),
      ...(input.writes ?? []).map((p) => fsEffect('write', p)),
    ],
    execute: async () => { executed.push(1); return 'executed'; },
  });
  runtime.policyRegistry.registerMany(policies);
  return { runtime, events, executed, types: () => events.map((e) => e.type) };
}

const ctx = { agentId: 'oracle', session: { id: 'sess_ap' } };
const POLICIES = [
  { id: 'allow-read', effect: 'allow', principal: 'oracle', capability: 'filesystem', operations: ['read'], resources: ['filesystem/workspace*'] },
  { id: 'write-gate', effect: 'approval-required', principal: 'oracle', capability: 'filesystem', operations: ['write'], resources: ['filesystem/workspace*'] },
];
const INPUT = { reads: ['a.txt'], writes: ['b.txt'], apiKey: 'super-secreta' };

test('approval composto: uma unica approval carrega o conjunto e o fingerprint (secoes 18, 83, INV-807)', async () => {
  const env = build({ policies: POLICIES });
  let approvalId = null;
  try {
    await env.runtime.toolRuntime.execute({ toolId: 'batch.fs', input: INPUT }, ctx);
  } catch (error) {
    assert.ok(error instanceof PolicyApprovalRequiredError);
    assert.match(error.effectSetFingerprint, /^[0-9a-f]{64}$/);
    approvalId = error.approvalId;
  }
  assert.ok(approvalId);
  assert.equal(env.executed.length, 0, 'nao executa antes da decisao');
  assert.equal(env.events.filter((e) => e.type === 'approval.requested').length, 1, 'UMA approval para o conjunto');

  // a identidade da aprovacao e o conjunto, nao so o toolId (secao 18)
  const view = env.runtime.approvalManager.get(approvalId);
  const resolved = env.events.find((e) => e.type === 'effect.resolved');
  assert.equal(view.effectSetFingerprint, resolved.payload.effectSetFingerprint);
  assert.deepEqual(view.effects, [
    { kind: 'filesystem', operation: 'read', resource: 'filesystem://workspace/a.txt' },
    { kind: 'filesystem', operation: 'write', resource: 'filesystem://workspace/b.txt' },
  ]);

  // projecao publica sem segredo (secao 19)
  const requested = env.events.find((e) => e.type === 'approval.requested');
  assert.equal(requested.payload.effectSetFingerprint, view.effectSetFingerprint);
  assert.ok(!JSON.stringify(env.events).includes('super-secreta'));

  // aprovado + resume: revalida o conjunto e executa (secao 83)
  await env.runtime.approvalManager.approve(approvalId, { type: 'founder', id: 'founder' });
  const result = await env.runtime.approvalManager.resume(approvalId);
  assert.ok(result.ok);
  assert.equal(env.executed.length, 1);
  // secao 49: effect.revalidated entre a aprovacao e a execucao
  const order = env.types();
  assert.ok(order.indexOf('approval.approved') < order.indexOf('effect.revalidated'));
  assert.ok(order.indexOf('effect.revalidated') < order.indexOf('approval.resumed'));
  assert.ok(order.indexOf('approval.resumed') < order.indexOf('tool.started'));
});

test('ordem de eventos do approval: resolucao e avaliacao ANTES do pedido (secao 49)', async () => {
  const env = build({ policies: POLICIES });
  await assert.rejects(
    env.runtime.toolRuntime.execute({ toolId: 'batch.fs', input: INPUT }, ctx),
    PolicyApprovalRequiredError,
  );
  const order = env.types();
  assert.ok(order.indexOf('effect.resolved') < order.indexOf('effect.evaluated'));
  assert.ok(order.indexOf('effect.evaluated') < order.indexOf('approval.requested'));
  assert.ok(!order.includes('tool.started'), 'nenhum sinal fisico antes da autorizacao (secao 48)');
});
