import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRuntime } from '../index.js';
import { createModelHarnessTool } from '../harness/model-harness.js';
import {
  LocalSubprocessProvider,
  processCapability,
  processTools,
} from '../providers/local/subprocess-provider.js';
import { ProcessRegistry } from '../process/process-registry.js';
import { policyEngineFromDocument } from '../adapters/policy-document.js';
import {
  PolicyApprovalRequiredError,
  EffectAuthorizationError,
  EffectRevalidationError,
} from '../errors.js';

/**
 * credential-founder-gate (spec F9, secoes 16-17, 55, 104-106, E4): a
 * credencial do Founder e governada pela MATRIZ UNICA, alcancada pelo
 * Effect Pipeline da F8 — o guard nao detecta leitura de credencial e
 * nao finge que detecta.
 */

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NODE = process.execPath;

test('alcancabilidade E4: a MATRIZ REAL decide approval-required para credential/* (secoes 16-17)', () => {
  const { engine } = policyEngineFromDocument(
    path.join(REPO, 'squad.policies.json'),
    { project: 'spectree-squad' },
  );
  const decision = engine.decide({
    principal: Object.freeze({ type: 'agent', id: 'oracle' }),
    session: Object.freeze({ id: 'sess_cred' }),
    tool: Object.freeze({ id: 'model-harness.run', capability: 'filesystem' }),
    operation: 'read',
    input: {},
    resource: Object.freeze({ type: 'credential', id: 'claude/auth' }),
  });
  assert.equal(decision.effect, 'approval-required');
  assert.equal(decision.policyId, 'credential-founder-gate');
});

test('allow generico de filesystem NAO engole credential/*: precedencia vale (secao 17)', () => {
  const { engine, registry } = policyEngineFromDocument(
    path.join(REPO, 'squad.policies.json'),
    { project: 'spectree-squad' },
  );
  // mesmo com um allow amplo adicional, approval-required vence
  registry.register({
    id: 'wide-open-read', effect: 'allow', capability: 'filesystem', operations: ['read'],
  });
  const decision = engine.decide({
    principal: Object.freeze({ type: 'agent', id: 'oracle' }),
    session: Object.freeze({ id: 's' }),
    tool: Object.freeze({ id: 't', capability: 'filesystem' }),
    operation: 'read',
    input: {},
    resource: Object.freeze({ type: 'credential', id: 'claude/auth' }),
  });
  assert.equal(decision.effect, 'approval-required');
  assert.equal(decision.policyId, 'credential-founder-gate');
});

// ------------------------------------------------ runtime (pipeline F8)

function build({ policies }) {
  const processRegistry = new ProcessRegistry();
  const runtime = createRuntime({ processRegistry });
  const events = [];
  runtime.eventBus.subscribe('*', (event) => events.push(event));
  runtime.capabilityRegistry.register(processCapability);
  runtime.providerRegistry.register(new LocalSubprocessProvider({
    workspaceRoot: REPO,
    hostEnv: { PATH: process.env.PATH ?? '' },
    registry: processRegistry,
    emit: (type, envelope) => runtime.eventBus.publish(type, envelope),
  }));
  for (const tool of processTools()) runtime.toolRuntime.register(tool);
  runtime.toolRuntime.register(createModelHarnessTool({
    calibration: { adapterId: 'conformance-harness@1', resources: [{ resourceId: 'conformance/auth' }] },
  }));
  runtime.policyRegistry.registerMany(policies);
  return { runtime, events, types: () => events.map((e) => e.type) };
}

const ctx = { agentId: 'oracle', session: { id: 'sess_cp' } };
const input = Object.freeze({
  argv: Object.freeze([NODE, '-e', '1']), cwd: '.',
  stdin: { mode: 'ignore' }, stdout: { mode: 'collect' }, stderr: { mode: 'collect' },
});
const ALLOW_SPAWN = {
  id: 'allow-spawn', effect: 'allow', principal: 'oracle',
  capability: 'process', operations: ['spawn'], resources: ['workspace*', 'executable/*'],
};
const CREDENTIAL_GATE = {
  id: 'credential-founder-gate', effect: 'approval-required',
  capability: 'filesystem', operations: ['read'], resources: ['credential/*'],
};

test('secao 105: UMA approval com fingerprint e efeitos projetados, sem segredo', async () => {
  const env = build({ policies: [ALLOW_SPAWN, CREDENTIAL_GATE] });
  let approvalId = null;
  try {
    await env.runtime.toolRuntime.execute({ toolId: 'model-harness.run', input }, ctx);
    throw new Error('deveria exigir aprovacao');
  } catch (error) {
    assert.ok(error instanceof PolicyApprovalRequiredError);
    approvalId = error.approvalId;
  }
  assert.ok(!env.types().includes('process.requested'), 'zero spawn antes da decisao (secao 58)');
  const view = env.runtime.approvalManager.get(approvalId);
  assert.match(view.effectSetFingerprint, /^[0-9a-f]{64}$/);
  assert.ok(view.effects.some((e) => e.resource === 'credential://conformance/auth'),
    'o recurso de credencial esta projetado na approval');
  assert.ok(!JSON.stringify(env.events).includes('.claude'), 'nenhum caminho de host nos eventos');
});

test('secao 104: deny credential/* impede o spawn completamente', async () => {
  const env = build({ policies: [
    ALLOW_SPAWN,
    { id: 'no-credential', effect: 'deny', capability: 'filesystem', operations: ['read'], resources: ['credential/*'] },
  ] });
  await assert.rejects(
    env.runtime.toolRuntime.execute({ toolId: 'model-harness.run', input }, ctx),
    (error) => error instanceof EffectAuthorizationError
      && error.deniedEffect.resource === 'credential://conformance/auth',
  );
  assert.ok(!env.types().includes('process.requested'));
  assert.ok(!env.types().includes('tool.started'));
});

test('secao 106: EffectSet alterado entre approval e resume -> EffectRevalidationError', async () => {
  const env = build({ policies: [ALLOW_SPAWN, CREDENTIAL_GATE] });
  let approvalId = null;
  try {
    await env.runtime.toolRuntime.execute({ toolId: 'model-harness.run', input }, ctx);
  } catch (error) { approvalId = error.approvalId; }
  await env.runtime.approvalManager.approve(approvalId, { type: 'founder', id: 'founder' });
  // o executavel muda por baixo: o conjunto aprovado nao e mais o atual
  env.runtime.approvalStore.get(approvalId).invocation.input.argv =
    ['/usr/bin/other-binary', '-e', '1'];
  await assert.rejects(
    env.runtime.approvalManager.resume(approvalId),
    EffectRevalidationError,
  );
  assert.ok(!env.types().includes('process.requested'), 'sem execucao');
});
