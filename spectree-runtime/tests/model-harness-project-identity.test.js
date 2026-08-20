import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Project identity (spec F9, secoes 51-53, 110): uma policy escopada por
 * projeto nao pode deixar de existir porque o processo mudou de
 * ambiente. Aqui provamos o lado HOST da igualdade — o guard resolve a
 * identidade pelo basename da raiz do repo e a policy escopada
 * `no-direct-push-main` (project: spectree-squad) decide. O lado CHILD
 * (mesmo guard, dentro do namespace fisico) vive em
 * linux-model-harness-physical.test.js; os dois lados usam a MESMA
 * sonda, entao divergencia quebra um dos dois.
 */

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUARD = path.join(REPO, 'hooks', 'guard.mjs');

function fakeRepo(project) {
  const base = mkdtempSync(path.join(tmpdir(), 'mh-ident-'));
  const dir = path.join(base, project);
  mkdirSync(path.join(dir, '.git'), { recursive: true });
  writeFileSync(path.join(dir, '.git', 'HEAD'), 'ref: refs/heads/feat/x\n', 'utf8');
  return { base, dir };
}

export function guardDecision({ cwd, command, agentType }) {
  const payload = { tool_name: 'Bash', tool_input: { command }, cwd };
  if (agentType) payload.agent_type = agentType;
  const result = spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify(payload), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout).hookSpecificOutput : null;
}

test('a policy escopada decide quando a identidade do projeto casa (secao 52)', () => {
  const { base, dir } = fakeRepo('spectree-squad');
  try {
    const decision = guardDecision({
      cwd: dir,
      command: 'git push origin main',
      agentType: 'spectree-squad:disruptor',
    });
    assert.equal(decision.permissionDecision, 'deny');
    assert.match(decision.permissionDecisionReason, /no-direct-push-main/,
      'a identidade resolvida alcancou a policy escopada');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('fora do projeto, a policy escopada NAO decide — e isso e simetrico ao namespace (secao 53)', () => {
  const { base, dir } = fakeRepo('outro-projeto');
  try {
    const decision = guardDecision({
      cwd: dir,
      command: 'git push origin main',
      agentType: 'spectree-squad:disruptor',
    });
    // sem a policy escopada, o que decide e o resto da matriz — nunca
    // um deny fantasma do projeto errado
    assert.ok(!decision || !/no-direct-push-main/.test(decision.permissionDecisionReason ?? ''),
      'a policy de spectree-squad nao vaza para outro projeto');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
