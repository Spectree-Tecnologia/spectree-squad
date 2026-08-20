import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadPolicyDocument,
  policyEngineFromDocument,
} from '../spectree-runtime/adapters/policy-document.js';
import { createRuntime } from '../spectree-runtime/index.js';
import {
  PolicyConfigurationError,
  PolicyDeniedError,
  PolicyApprovalRequiredError,
} from '../spectree-runtime/errors.js';

/**
 * Fase 4.5 — a prova central: squad.policies.json alimenta Guard,
 * Runtime e Tests pelo MESMO adapter, e os tres produzem a MESMA
 * decisao. Cada caso canonico e julgado tres vezes — pelo engine
 * isolado, por uma execucao real de tool no runtime completo, e pelo
 * guard como processo — e os policyIds tem de bater.
 */

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MATRIX = new URL('../squad.policies.json', import.meta.url);
const GUARD = path.join(REPO, 'hooks', 'guard.mjs');
// escopo (4.8): o guard deriva o projeto do basename da raiz do repo da
// cwd, e REPO e o proprio spectree-squad
const PROJECT = path.basename(REPO);

function guardDecision(command, agentType) {
  const result = spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify({
      tool_name: 'Bash', tool_input: { command }, agent_type: agentType, cwd: REPO,
    }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout).hookSpecificOutput : null;
}

/** Runtime completo com a matriz injetada pelo adapter — nenhuma copia. */
function runtimeFromMatrix() {
  const { registry } = policyEngineFromDocument(MATRIX, { project: PROJECT });
  const runtime = createRuntime({ policyRegistry: registry });
  runtime.capabilityRegistry.register({
    id: 'database', name: 'Database', description: 'd',
    operations: ['query', 'destructive-migration'],
  });
  runtime.capabilityRegistry.register({
    id: 'git', name: 'Git', description: 'g', operations: ['push'],
  });
  runtime.toolRuntime.register({
    id: 'database.query', name: 'q', description: 'q',
    capability: 'database', operation: 'query', execute: async () => 'ok',
  });
  runtime.toolRuntime.register({
    id: 'database.drop', name: 'd', description: 'd',
    capability: 'database', operation: 'destructive-migration', execute: async () => 'dropped',
  });
  runtime.toolRuntime.register({
    id: 'git.push', name: 'p', description: 'p',
    capability: 'git', operation: 'push',
    resource: (input) => ({ type: 'git', id: input.ref }), execute: async () => 'pushed',
  });
  return runtime;
}

test('adapter: valida documento — inexistente, nao-JSON-array, e o feliz', () => {
  assert.throws(() => loadPolicyDocument(path.join(REPO, 'nao-existe.json')), PolicyConfigurationError);
  // package.json e JSON valido mas nao e uma lista de policies
  assert.throws(() => loadPolicyDocument(path.join(REPO, 'package.json')), PolicyConfigurationError);
  const policies = loadPolicyDocument(MATRIX);
  assert.deepEqual(policies, JSON.parse(readFileSync(MATRIX, 'utf8'))); // igualdade com o arquivo
  const loaded = policyEngineFromDocument(MATRIX, { project: PROJECT });
  assert.deepEqual(loaded.document, policies); // documento inteiro, sem filtro
  assert.equal(loaded.registry.list().length, loaded.policies.length);
  assert.ok(loaded.engine);
});

test('4.8: o escopo mora no adapter — mesmo arquivo, projetos diferentes', () => {
  const here = policyEngineFromDocument(MATRIX, { project: PROJECT });
  const canary = policyEngineFromDocument(MATRIX, { project: 'spectree-slack' });
  const nowhere = policyEngineFromDocument(MATRIX); // fora de qualquer repo
  // o documento e identico nos tres; o que muda e o que se APLICA
  assert.deepEqual(here.document, canary.document);
  assert.deepEqual(here.document, nowhere.document);
  const ids = (loaded) => loaded.policies.map((policy) => policy.id);
  assert.ok(ids(here).includes('no-direct-push-main'));
  assert.ok(!ids(canary).includes('no-direct-push-main'));
  assert.ok(!ids(nowhere).includes('no-direct-push-main'), 'sem projeto: so as globais');
  for (const loaded of [here, canary, nowhere]) {
    assert.ok(ids(loaded).includes('destructive-git-founder-gate'), 'global vale em todo lugar');
  }
  // e a decisao acompanha o escopo, nos tres consumidores
  const request = {
    principal: { id: 'disruptor' }, tool: { id: 'git.push', capability: 'git' },
    operation: 'push', resource: { type: 'git', id: 'refs/heads/main' },
  };
  assert.equal(here.engine.decide(request).policyId, 'no-direct-push-main');
  assert.equal(canary.engine.decide(request).policyId, 'disruptor-git');
  assert.equal(canary.engine.decide(request).effect, 'allow');
});

test('mesma decisao nos tres consumidores: allow — oracle e o banco', async () => {
  const { engine } = policyEngineFromDocument(MATRIX, { project: PROJECT });
  const decision = engine.decide({
    principal: { id: 'oracle' }, tool: { id: 'database.query', capability: 'database' },
    operation: 'query',
  });
  assert.equal(decision.effect, 'allow');
  assert.equal(decision.policyId, 'oracle-database');
  // Runtime: a execucao real completa
  const result = await runtimeFromMatrix().toolRuntime.execute(
    { toolId: 'database.query', input: {} }, { agentId: 'oracle' },
  );
  assert.equal(result.output, 'ok');
  // Guard: allow e silencio (nunca "allow" explicito)
  assert.equal(guardDecision('psql -c "SELECT 1"', 'spectree-squad:oracle'), null);
});

test('mesma decisao nos tres consumidores: default deny — jakiro no banco', async () => {
  const { engine } = policyEngineFromDocument(MATRIX, { project: PROJECT });
  const decision = engine.decide({
    principal: { id: 'jakiro' }, tool: { id: 'database.query', capability: 'database' },
    operation: 'query',
  });
  assert.equal(decision.effect, 'deny');
  assert.equal(decision.policyId, 'default-deny');
  await assert.rejects(
    runtimeFromMatrix().toolRuntime.execute({ toolId: 'database.query', input: {} }, { agentId: 'jakiro' }),
    (error) => error instanceof PolicyDeniedError && error.decision.policyId === 'default-deny',
  );
  const guard = guardDecision('psql -c "SELECT 1"', 'spectree-squad:jakiro');
  assert.equal(guard?.permissionDecision, 'deny');
  assert.match(guard.permissionDecisionReason, /no policy grants/);
});

test('mesma decisao nos tres consumidores: deny explicito — main nega ate o Disruptor', async () => {
  const { engine } = policyEngineFromDocument(MATRIX, { project: PROJECT });
  const decision = engine.decide({
    principal: { id: 'disruptor' }, tool: { id: 'git.push', capability: 'git' },
    operation: 'push', resource: { type: 'git', id: 'refs/heads/main' },
  });
  assert.equal(decision.effect, 'deny');
  assert.equal(decision.policyId, 'no-direct-push-main');
  await assert.rejects(
    runtimeFromMatrix().toolRuntime.execute(
      { toolId: 'git.push', input: { ref: 'refs/heads/main' } }, { agentId: 'disruptor' },
    ),
    (error) => error instanceof PolicyDeniedError && error.decision.policyId === 'no-direct-push-main',
  );
  const guard = guardDecision('git push origin main', 'spectree-squad:disruptor');
  assert.equal(guard?.permissionDecision, 'deny');
  assert.match(guard.permissionDecisionReason, /no-direct-push-main/);
});

test('mesma decisao nos tres consumidores: approval-required — gate vence o allow do Oracle', async () => {
  const { engine } = policyEngineFromDocument(MATRIX, { project: PROJECT });
  const decision = engine.decide({
    principal: { id: 'oracle' }, tool: { id: 'database.drop', capability: 'database' },
    operation: 'destructive-migration',
  });
  assert.equal(decision.effect, 'approval-required');
  assert.equal(decision.policyId, 'destructive-migration-founder-gate');
  await assert.rejects(
    runtimeFromMatrix().toolRuntime.execute({ toolId: 'database.drop', input: {} }, { agentId: 'oracle' }),
    (error) => error instanceof PolicyApprovalRequiredError &&
      error.decision.policyId === 'destructive-migration-founder-gate',
  );
  const guard = guardDecision('psql -c "DROP TABLE users"', 'spectree-squad:oracle');
  assert.equal(guard?.permissionDecision, 'ask');
  assert.match(guard.permissionDecisionReason, /destructive-migration-founder-gate/);
});

test('trava: existe exatamente UMA matriz de autoridade no repo', () => {
  const matrices = readdirSync(REPO, { recursive: true })
    .map((f) => String(f).split(path.sep).join('/'))
    .filter((f) => !f.startsWith('.git/') && !f.startsWith('node_modules/'))
    .filter((f) => /policies[^/]*\.json$/i.test(f));
  assert.deepEqual(matrices, ['squad.policies.json']);
});
