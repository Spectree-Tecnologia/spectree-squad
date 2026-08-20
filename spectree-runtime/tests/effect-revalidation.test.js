import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../index.js';
import { canonicalFilesystemPath } from '../effects/resource-ref.js';
import {
  PolicyApprovalRequiredError,
  PolicyRevalidationError,
  EffectRevalidationError,
} from '../errors.js';

/**
 * Revalidation do Effect Set (spec F8, secoes 20, 50, 84, INV-808): o
 * resume recalcula os efeitos do input ORIGINAL e o fingerprint e a
 * trava — aprovacao nunca fornece novos recursos ou efeitos.
 */

function build() {
  const runtime = createRuntime();
  const events = [];
  runtime.eventBus.subscribe('*', (event) => events.push(event));
  runtime.capabilityRegistry.register({
    id: 'filesystem', name: 'FS', description: 'teste',
    operations: ['write'], effectKinds: ['filesystem'],
  });
  const executed = [];
  runtime.toolRuntime.register({
    id: 'fs.write', name: 'w', description: 'w', capability: 'filesystem', operation: 'write',
    resolveEffects: (input) => [{
      kind: 'filesystem', operation: 'write',
      resource: { type: 'filesystem', id: canonicalFilesystemPath(input.path) },
    }],
    execute: async () => { executed.push(1); return 'written'; },
  });
  runtime.policyRegistry.register({
    id: 'write-gate', effect: 'approval-required', principal: 'oracle',
    capability: 'filesystem', operations: ['write'], resources: ['filesystem/workspace*'],
  });
  return { runtime, events, executed };
}

const ctx = { agentId: 'oracle', session: { id: 'sess_rv' } };

async function suspend(env, input) {
  try {
    await env.runtime.toolRuntime.execute({ toolId: 'fs.write', input }, ctx);
    throw new Error('deveria ter suspendido');
  } catch (error) {
    assert.ok(error instanceof PolicyApprovalRequiredError);
    return error.approvalId;
  }
}

test('mutacao de input entre approve e resume: fingerprint trava (secoes 50, 84)', async () => {
  const env = build();
  const approvalId = await suspend(env, { path: 'a.txt' });
  await env.runtime.approvalManager.approve(approvalId, { type: 'founder', id: 'founder' });
  // o input original muda por baixo (store comprometido/alterado):
  // write a.txt aprovado != write b.txt no resume
  env.runtime.approvalStore.get(approvalId).invocation.input.path = 'b.txt';
  await assert.rejects(
    env.runtime.approvalManager.resume(approvalId),
    (error) => error instanceof EffectRevalidationError
      && error.approvalId === approvalId
      && error.approvedFingerprint !== error.currentFingerprint,
  );
  assert.equal(env.executed.length, 0, 'nada executou');
  // a approval permanece approved (secao 21): nada e automatico
  assert.equal(env.runtime.approvalManager.get(approvalId).status, 'approved');
  assert.ok(!env.events.some((e) => e.type === 'effect.revalidated'),
    'a trava dispara ANTES do evento de revalidacao');
});

test('policy virou deny depois do approve: revalidacao de efeitos bloqueia (secao 20)', async () => {
  const env = build();
  const approvalId = await suspend(env, { path: 'a.txt' });
  await env.runtime.approvalManager.approve(approvalId, { type: 'founder', id: 'founder' });
  env.runtime.policyRegistry.register({
    id: 'hard-no', effect: 'deny', capability: 'filesystem', operations: ['write'],
  });
  // fingerprint IGUAL (mesmo input), mas a decisao composta agora e deny
  await assert.rejects(
    env.runtime.approvalManager.resume(approvalId),
    PolicyRevalidationError,
  );
  assert.equal(env.executed.length, 0);
});

test('resume integro: mesmo fingerprint, mesma decisao — executa (secao 20)', async () => {
  const env = build();
  const approvalId = await suspend(env, { path: 'a.txt' });
  await env.runtime.approvalManager.approve(approvalId, { type: 'founder', id: 'founder' });
  const result = await env.runtime.approvalManager.resume(approvalId);
  assert.ok(result.ok);
  assert.equal(env.executed.length, 1);
  const revalidated = env.events.find((e) => e.type === 'effect.revalidated');
  assert.equal(
    revalidated.payload.effectSetFingerprint,
    env.runtime.approvalManager.get(approvalId).effectSetFingerprint,
  );
});
