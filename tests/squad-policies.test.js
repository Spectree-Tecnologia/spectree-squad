import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PolicyRegistry } from '../spectree-runtime/policy/policy-registry.js';
import { PolicyEngine } from '../spectree-runtime/policy/policy-engine.js';

/**
 * A matriz de autoridade do Squad como dado (squad.policies.json),
 * provada pelo motor do proprio Runtime: o arquivo carrega no
 * PolicyRegistry real e cada fronteira que os agentes declaram em prosa
 * e decidida pelo PolicyEngine real. Compatibilidade literal, nao por
 * convencao — quando o Squad rodar sobre o Runtime, este arquivo
 * alimenta o registry sem traducao. A direcao da dependencia e
 * Squad -> Runtime (INV-007 preservada: o runtime segue sem conhecer
 * nomes do Squad; quem os conhece e este teste, da camada de plugin).
 */

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POLICIES = JSON.parse(readFileSync(path.join(REPO, 'squad.policies.json'), 'utf8'));

const KNOWN_PRINCIPALS = [
  'invoker',
  ...readdirSync(path.join(REPO, 'agents'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, '')),
];

// escopo (4.8): estes casos julgam a matriz DESTE projeto
function engine(project = 'spectree-squad') {
  const registry = new PolicyRegistry();
  registry.registerMany(POLICIES.filter((p) => (p.project ?? project) === project));
  return new PolicyEngine({ registry });
}

/** Contexto no shape exato que o PolicyEngine.decide consome. */
function request(principal, capability, operation, resourceId) {
  return {
    principal: { id: principal },
    tool: { id: capability + '.' + operation, capability },
    operation,
    resource: resourceId ? { type: capability, id: resourceId } : undefined,
  };
}

test('squad.policies.json carrega no PolicyRegistry real sem traducao', () => {
  const registry = new PolicyRegistry();
  registry.registerMany(POLICIES); // shape invalido ou id duplicado lancaria aqui
  assert.equal(registry.list().length, POLICIES.length);
});

test('todo principal citado na matriz e o Invoker ou um agente existente', () => {
  for (const policy of POLICIES) {
    for (const principal of [policy.principal ?? []].flat()) {
      assert.ok(
        KNOWN_PRINCIPALS.includes(principal),
        "policy '" + policy.id + "' cita principal desconhecido: " + principal,
      );
    }
  }
});

test('banco e do Oracle: allow nominal, default deny para o resto do squad', () => {
  const policyEngine = engine();
  const oracle = policyEngine.decide(request('oracle', 'database', 'migration'));
  assert.equal(oracle.effect, 'allow');
  assert.equal(oracle.policyId, 'oracle-database');
  for (const outsider of ['jakiro', 'keeper-of-the-light', 'disruptor', 'lina']) {
    const decision = policyEngine.decide(request(outsider, 'database', 'query'));
    assert.equal(decision.effect, 'deny');
    assert.equal(decision.policyId, 'default-deny');
  }
});

test('migration destrutiva passa pelo Founder — inclusive para o Oracle', () => {
  const decision = engine().decide(request('oracle', 'database', 'destructive-migration'));
  assert.equal(decision.effect, 'approval-required');
  assert.equal(decision.policyId, 'destructive-migration-founder-gate');
});

test('git e do Disruptor, mas a main nega ate ele: deny vence allow', () => {
  const policyEngine = engine();
  const branch = policyEngine.decide(request('disruptor', 'git', 'push', 'refs/heads/feat/x'));
  assert.equal(branch.effect, 'allow');
  assert.equal(branch.policyId, 'disruptor-git');
  // refs/heads/* casa refs/heads/main — a MESMA request casa allow e deny,
  // e o deny vence pela precedencia estrutural, nunca por priority
  const main = policyEngine.decide(request('disruptor', 'git', 'push', 'refs/heads/main'));
  assert.equal(main.effect, 'deny');
  assert.equal(main.policyId, 'no-direct-push-main');
  const outsider = policyEngine.decide(request('jakiro', 'git', 'commit', 'refs/heads/feat/x'));
  assert.equal(outsider.effect, 'deny');
  assert.equal(outsider.policyId, 'default-deny');
});

test('operacao git destrutiva e gate do Founder, nao autoridade do Disruptor', () => {
  const decision = engine().decide(request('disruptor', 'git', 'force-push', 'refs/heads/feat/x'));
  assert.equal(decision.effect, 'approval-required');
  assert.equal(decision.policyId, 'destructive-git-founder-gate');
});

test('status approved/done e do Invoker; in-progress e do Jakiro em stories', () => {
  const policyEngine = engine();
  const approve = policyEngine.decide(request('invoker', 'artifact-status', 'approve', 'docs/PRD.md'));
  assert.equal(approve.effect, 'allow');
  assert.equal(approve.policyId, 'invoker-artifact-approval');
  // Keeper valida, nao aprova; Jakiro implementa, nao aprova
  for (const outsider of ['keeper-of-the-light', 'jakiro', 'lina']) {
    const decision = policyEngine.decide(request(outsider, 'artifact-status', 'approve', 'docs/PRD.md'));
    assert.equal(decision.effect, 'deny');
  }
  const start = policyEngine.decide(
    request('jakiro', 'artifact-status', 'in-progress', 'docs/stories/STORY-001-example.md'),
  );
  assert.equal(start.effect, 'allow');
  assert.equal(start.policyId, 'jakiro-story-in-progress');
});
