import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

/**
 * Fixture de repo (4.8): o guard deriva o escopo de projeto do basename
 * da raiz do repo da cwd, e a ref corrente de .git/HEAD. Um repo fixo
 * chamado spectree-squad, numa branch de trabalho, mantem estes casos
 * deterministicos — sem depender de qual branch o repo real esta.
 */
const FIXTURE = (() => {
  const base = mkdtempSync(path.join(tmpdir(), 'spectree-guard-'));
  const dir = path.join(base, 'spectree-squad');
  mkdirSync(path.join(dir, '.git'), { recursive: true });
  writeFileSync(path.join(dir, '.git', 'HEAD'), 'ref: refs/heads/feat/fixture\n', 'utf8');
  return dir;
})();

function runGuard(command, toolName = 'Bash', agentType = undefined) {
  const payload = JSON.stringify({
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: { command },
    cwd: FIXTURE,
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

test('4.5: principal ausente e a thread principal (4A); desconhecido e fail closed', () => {
  // desconhecido (subagente fora do squad): DENY nas operacoes governadas
  for (const command of ['psql -c "SELECT 1"', 'git commit -m "x"']) {
    const decision = runGuard(command, 'Bash', 'Explore');
    assert.equal(decision?.permissionDecision, 'deny', command);
    assert.match(decision.permissionDecisionReason, /no policy grants/);
  }
  // operacao nao governada segue livre, mesmo para desconhecido
  assert.equal(runGuard('git status', 'Bash', 'Explore'), null);
  assert.equal(runGuard('npm test', 'Bash', 'Explore'), null);
  // thread principal (sem agent_type): modo 4A — Invoker e Founder vivem la
  assert.equal(runGuard('git commit -m "x"'), null);
  assert.equal(runGuard('psql -c "SELECT 1"'), null);
  // policies universais valem para ambos
  const force = runGuard('git push --force origin feat/x', 'Bash', 'Explore');
  assert.equal(force?.permissionDecision, 'ask');
});

function runGuardFile(toolName, toolInput, agentType = undefined) {
  const payload = JSON.stringify({
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
    cwd: FIXTURE,
    ...(agentType ? { agent_type: agentType } : {}),
  });
  const result = spawnSync(process.execPath, [GUARD], { input: payload, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout).hookSpecificOutput : null;
}

test('4C: tokenizador — flag global com argumento e wrapper com aspas nao escondem o push', () => {
  const flagged = runGuard('git -C ../outro push origin main', 'Bash', 'spectree-squad:disruptor');
  assert.equal(flagged?.permissionDecision, 'deny');
  assert.match(flagged.permissionDecisionReason, /no-direct-push-main/);
  const wrapped = runGuard('bash -c "git push origin main"');
  assert.equal(wrapped?.permissionDecision, 'deny');
  // e a leitura continua livre mesmo com flag global
  assert.equal(runGuard('git -C ../outro log --oneline', 'Bash', 'spectree-squad:keeper-of-the-light'), null);
});

test('4C: subagente escrevendo status approved/done em docs/ cai no default deny', () => {
  for (const [agent, tool, input] of [
    ['spectree-squad:keeper-of-the-light', 'Edit', {
      file_path: 'C:/proj/docs/stories/STORY-001-login.md',
      old_string: 'status: in-review', new_string: 'status: approved',
    }],
    ['spectree-squad:lion', 'Write', {
      file_path: 'C:/proj/docs/stories/STORY-002-x.md',
      content: 'status: done' + String.fromCharCode(10) + 'owner: lion',
    }],
  ]) {
    const decision = runGuardFile(tool, input, agent);
    assert.equal(decision?.permissionDecision, 'deny', agent);
    assert.match(decision.permissionDecisionReason, /no policy grants/);
  }
  // thread principal (Invoker/Founder): passa — modo 4A
  assert.equal(runGuardFile('Edit', {
    file_path: 'C:/proj/docs/PRD.md',
    old_string: 'status: in-review', new_string: 'status: approved',
  }), null);
  // Jakiro setando in-progress na story: allow da matriz, passa em silencio
  assert.equal(runGuardFile('Edit', {
    file_path: 'C:/proj/docs/stories/STORY-001-login.md',
    old_string: 'status: approved', new_string: 'status: in-progress',
  }, 'spectree-squad:jakiro'), null);
  // status fora de docs/ (codigo de aplicacao) nao e governado
  assert.equal(runGuardFile('Write', {
    file_path: 'C:/proj/src/config.yaml', content: 'status: done',
  }, 'spectree-squad:jakiro'), null);
});

test('4C: superficie de edicao fechada — Keeper so edita o que a matriz concede', () => {
  const keeper = 'spectree-squad:keeper-of-the-light';
  assert.equal(runGuardFile('Edit', {
    file_path: 'C:/proj/docs/stories/STORY-001-login.md',
    old_string: 'x', new_string: '### 2026-08-20 — veredito: APROVADO',
  }, keeper), null);
  assert.equal(runGuardFile('Edit', {
    file_path: 'C:/proj/docs/LESSONS.md', old_string: 'x', new_string: 'y',
  }, keeper), null);
  const code = runGuardFile('Edit', {
    file_path: 'C:/proj/src/app.js', old_string: 'bug', new_string: 'fix',
  }, keeper);
  assert.equal(code?.permissionDecision, 'deny');
  assert.match(code.permissionDecisionReason, /no policy grants/);
  const foreignDoc = runGuardFile('Edit', {
    file_path: 'C:/proj/docs/PRD.md', old_string: 'a', new_string: 'b',
  }, keeper);
  assert.equal(foreignDoc?.permissionDecision, 'deny');
  // superficie aberta: Jakiro edita codigo livremente
  assert.equal(runGuardFile('Edit', {
    file_path: 'C:/proj/src/app.js', old_string: 'bug', new_string: 'fix',
  }, 'spectree-squad:jakiro'), null);
});

test('4C: hooks.json integro por igualdade estrita — typo nao desliga o guard em silencio', () => {
  const hooks = JSON.parse(readFileSync(path.join(REPO, 'hooks', 'hooks.json'), 'utf8'));
  const entry = {
    matcher: 'Bash|Edit|Write',
    hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs"' }],
  };
  // PostToolUse (4.7) fecha o par de auditoria do `ask`: sem ele, a
  // trilha volta a registrar pergunta sem resposta
  assert.deepEqual(hooks, { hooks: { PreToolUse: [entry], PostToolUse: [entry] } });
  assert.ok(existsSync(GUARD), 'o comando do hook referencia hooks/guard.mjs, que deve existir');
});

test('ferramenta que nao e Bash e payload ilegivel: sem decisao, sem crash', () => {
  assert.equal(runGuard('qualquer coisa', 'Glob'), null);
  const result = spawnSync(process.execPath, [GUARD], { input: 'nao-e-json', encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');
});
