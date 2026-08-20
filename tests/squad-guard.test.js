import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * O guard PreToolUse (hooks/guard.mjs) exercitado como o Claude Code o
 * executa: processo real, payload real no stdin, decisao no stdout.
 * Prova os dois lados: a deny-list global bloqueia (deny) ou escala ao
 * Founder (ask) citando a policy da matriz, e — tao importante quanto —
 * comando legitimo passa SEM decisao, porque guard que atrapalha o
 * trabalho normal e guard que alguem desliga.
 */

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = path.join(REPO, 'hooks', 'guard.mjs');

function runGuard(command, toolName = 'Bash', agentType = undefined) {
  const payload = JSON.stringify({
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: { command },
    ...(agentType ? { agent_type: agentType } : {}),
  });
  const result = spawnSync(process.execPath, [GUARD], { input: payload, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout).hookSpecificOutput : null;
}

test('comando comum passa sem decisao: o guard nao atrapalha o trabalho', () => {
  for (const command of [
    'npm test',
    'git push origin feat/nova-feature',
    'git push -u origin feat/branch-com-main-no-nome-nao',
    'rm -rf node_modules',
    'rm build/output.js',
    'psql -c "SELECT * FROM users"',
  ]) {
    assert.equal(runGuard(command), null, 'nao devia decidir sobre: ' + command);
  }
});

test('push na main: deny citando no-direct-push-main', () => {
  for (const command of [
    'git push origin main',
    'git push origin master',
    'git push origin HEAD:main',
    'git commit -m x; git push origin main',
  ]) {
    const decision = runGuard(command);
    assert.equal(decision?.permissionDecision, 'deny', command);
    assert.match(decision.permissionDecisionReason, /no-direct-push-main/);
  }
});

test('operacao git destrutiva: ask — o gate do Founder na UI', () => {
  for (const command of [
    'git push --force origin feat/x',
    'git push -f origin feat/x',
    'git push origin :feat/x',
    'git push origin --delete feat/x',
  ]) {
    const decision = runGuard(command);
    assert.equal(decision?.permissionDecision, 'ask', command);
    assert.match(decision.permissionDecisionReason, /destructive-git-founder-gate/);
  }
});

test('migration destrutiva via CLI de banco: ask citando o gate', () => {
  const decision = runGuard('psql -d app -c "DROP TABLE users;"');
  assert.equal(decision?.permissionDecision, 'ask');
  assert.match(decision.permissionDecisionReason, /destructive-migration-founder-gate/);
});

test('rm -rf fora do workspace: deny citando filesystem-outside-workspace-deny', () => {
  for (const command of ['rm -rf /', 'rm -rf ~/projects', 'rm -rf ../outro-repo', 'rm -rf C:/Users']) {
    const decision = runGuard(command);
    assert.equal(decision?.permissionDecision, 'deny', command);
    assert.match(decision.permissionDecisionReason, /filesystem-outside-workspace-deny/);
  }
});

test('4B: com principal real, o default deny vale — banco e do Oracle', () => {
  // namespaced e puro normalizam para o mesmo principal
  for (const agentType of ['spectree-squad:oracle', 'oracle']) {
    assert.equal(runGuard('psql -c "SELECT 1"', 'Bash', agentType), null, agentType);
  }
  for (const outsider of ['spectree-squad:jakiro', 'spectree-squad:keeper-of-the-light']) {
    const decision = runGuard('psql -c "SELECT 1"', 'Bash', outsider);
    assert.equal(decision?.permissionDecision, 'deny', outsider);
    assert.match(decision.permissionDecisionReason, /no policy grants/);
  }
});

test('4B: git mutavel e do Disruptor; leitura de git nao e governada', () => {
  for (const command of ['git commit -m "x"', 'git push origin feat/x', 'git checkout -b feat/y']) {
    assert.equal(runGuard(command, 'Bash', 'spectree-squad:disruptor'), null, command);
    const decision = runGuard(command, 'Bash', 'spectree-squad:jakiro');
    assert.equal(decision?.permissionDecision, 'deny', 'jakiro: ' + command);
  }
  // leitura passa para qualquer um — Keeper audita diff, Disruptor audita log
  for (const command of ['git log --oneline', 'git diff HEAD~1', 'git status', 'git branch']) {
    assert.equal(runGuard(command, 'Bash', 'spectree-squad:keeper-of-the-light'), null, command);
  }
});

test('4B: a main nega ate o Disruptor, e o gate destrutivo vence o allow do Oracle', () => {
  const main = runGuard('git push origin main', 'Bash', 'spectree-squad:disruptor');
  assert.equal(main?.permissionDecision, 'deny');
  assert.match(main.permissionDecisionReason, /no-direct-push-main/);
  // precedencia real: oracle-database (allow) e o gate (approval-required)
  // casam a mesma request — approval-required vence allow, vira ask
  const drop = runGuard('psql -c "DROP TABLE users"', 'Bash', 'spectree-squad:oracle');
  assert.equal(drop?.permissionDecision, 'ask');
  assert.match(drop.permissionDecisionReason, /destructive-migration-founder-gate/);
});

test('4B: principal desconhecido ou ausente degrada para o modo 4A', () => {
  // subagente fora do squad: default deny NAO e acionavel daqui
  assert.equal(runGuard('psql -c "SELECT 1"', 'Bash', 'Explore'), null);
  assert.equal(runGuard('git commit -m "x"', 'Bash', 'Explore'), null);
  // thread principal (sem agent_type): idem
  assert.equal(runGuard('git commit -m "x"'), null);
  // mas as policies universais continuam valendo para qualquer um
  const force = runGuard('git push --force origin feat/x', 'Bash', 'Explore');
  assert.equal(force?.permissionDecision, 'ask');
});

test('ferramenta que nao e Bash e payload ilegivel: sem decisao, sem crash', () => {
  assert.equal(runGuard('qualquer coisa', 'Write'), null);
  const result = spawnSync(process.execPath, [GUARD], { input: 'nao-e-json', encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');
});
