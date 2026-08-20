import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPolicyDocument } from '../spectree-runtime/adapters/policy-document.js';

/**
 * Alcancabilidade da matriz (Fase 4.6). Uma policy que nenhum consumidor
 * consegue alcancar e autoridade decorativa: parece governar e nao
 * governa. Este teste exige que CADA policy declare quem a alcanca, e
 * prova a declaracao executando o guard de verdade.
 *
 * O R8 aplicado a matriz: policy nova sem declaracao de alcance quebra a
 * suite — o desalinhamento deixa de ser invisivel. Policies alcancaveis
 * so pelo runtime (onde o principal e construido em codigo) sao
 * legitimas, mas tem de ser declaradas como tal, nunca descobertas
 * depois em producao.
 */

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = path.join(REPO, 'hooks', 'guard.mjs');
const POLICIES = loadPolicyDocument(path.join(REPO, 'squad.policies.json'));

/** Repo falso com a branch pedida em .git/HEAD, para exercitar currentRef. */
function fakeRepo(ref) {
  const dir = mkdtempSync(path.join(tmpdir(), 'spectree-reach-'));
  mkdirSync(path.join(dir, '.git'), { recursive: true });
  writeFileSync(path.join(dir, '.git', 'HEAD'), 'ref: ' + ref + '\n', 'utf8');
  return dir;
}

function guard({ command, agentType, tool = 'Bash', input, cwd }) {
  const payload = { tool_name: tool, tool_input: input ?? { command }, cwd };
  if (agentType) payload.agent_type = agentType;
  const result = spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify(payload), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout).hookSpecificOutput : null;
}

/**
 * Declaracao de alcance, uma entrada por policy da matriz.
 *   guard  — o hook produz um pedido que casa esta policy; `probe`
 *            executa o guard e `expect` e a decisao esperada
 *            ('deny' | 'ask' | null quando allow vira silencio).
 *   runtime-only — alcancavel apenas via runtime (principal construido
 *            em codigo). Legitima, mas declarada: `why` diz por que o
 *            guard nao a alcanca.
 */
const REACHABILITY = {
  'oracle-database': {
    by: 'guard',
    expect: null, // allow -> silencio
    probe: () => guard({ command: 'psql -c "SELECT 1"', agentType: 'spectree-squad:oracle' }),
  },
  'destructive-migration-founder-gate': {
    by: 'guard',
    expect: 'ask',
    probe: () => guard({ command: 'psql -c "DROP TABLE t"', agentType: 'spectree-squad:oracle' }),
  },
  'disruptor-git': {
    by: 'guard',
    expect: null,
    probe: () => guard({ command: 'git push origin feat/x', agentType: 'spectree-squad:disruptor' }),
  },
  'no-direct-push-main': {
    by: 'guard',
    expect: 'deny',
    probe: () => guard({ command: 'git push origin main', agentType: 'spectree-squad:disruptor' }),
  },
  'destructive-git-founder-gate': {
    by: 'guard',
    expect: 'ask',
    probe: () => guard({ command: 'git push --force origin feat/x', agentType: 'spectree-squad:disruptor' }),
  },
  'disruptor-github': {
    by: 'guard',
    expect: null,
    probe: () => guard({ command: 'gh pr create --title x', agentType: 'spectree-squad:disruptor' }),
  },
  'jakiro-story-in-progress': {
    by: 'guard',
    expect: null,
    probe: () => guard({
      tool: 'Edit', agentType: 'spectree-squad:jakiro',
      input: {
        file_path: 'C:/p/docs/stories/STORY-001-x.md',
        old_string: 'status: approved', new_string: 'status: in-progress',
      },
    }),
  },
  'filesystem-outside-workspace-deny': {
    by: 'guard',
    expect: 'deny',
    probe: () => guard({ command: 'rm -rf /', agentType: 'spectree-squad:jakiro' }),
  },
  'keeper-edit-scope': {
    by: 'guard',
    expect: null,
    probe: () => guard({
      tool: 'Edit', agentType: 'spectree-squad:keeper-of-the-light',
      input: { file_path: 'C:/p/docs/LESSONS.md', old_string: 'a', new_string: 'b' },
    }),
  },
  // Declarada, nao descoberta: o principal 'invoker' nao existe entre os
  // agentes de agents/, entao nenhum agent_type o produz. Na thread
  // principal o guard usa 'bash-session' e a aprovacao passa pelo SKIP
  // do modo 4A — nao por esta policy. Ela governa o runtime, onde o
  // principal e construido em codigo (e sera o caminho quando o Squad
  // rodar sobre o runtime).
  'invoker-artifact-approval': {
    by: 'runtime-only',
    why: "principal 'invoker' nao e produzivel por agent_type; na thread principal vale o modo 4A",
  },
};

test('toda policy da matriz declara quem a alcanca', () => {
  assert.deepEqual(
    POLICIES.map((p) => p.id).sort(),
    Object.keys(REACHABILITY).sort(),
    'policy sem declaracao de alcance (ou declaracao orfa): atualize REACHABILITY',
  );
});

for (const [policyId, entry] of Object.entries(REACHABILITY)) {
  if (entry.by !== 'guard') continue;
  test('alcance provado pelo guard: ' + policyId, () => {
    const decision = entry.probe();
    if (entry.expect === null) {
      assert.equal(decision, null, policyId + ': allow deveria virar silencio');
      return;
    }
    assert.equal(decision?.permissionDecision, entry.expect, policyId);
    assert.match(
      decision.permissionDecisionReason,
      new RegExp(policyId),
      policyId + ': a decisao deveria citar esta policy',
    );
  });
}

test('policies runtime-only declaram o motivo de nao serem alcancaveis pelo guard', () => {
  for (const [policyId, entry] of Object.entries(REACHABILITY)) {
    if (entry.by !== 'runtime-only') continue;
    assert.ok(typeof entry.why === 'string' && entry.why.length > 20, policyId + ' sem justificativa');
  }
});

test('toda capability citada na matriz tem detector no guard', () => {
  // capability sem detector = policy que nunca dispara, o defeito que a
  // 4.6 encontrou em disruptor-github
  const capabilities = [...new Set(POLICIES.flatMap((p) => [p.capability ?? p.capabilities ?? []].flat()))];
  const detected = new Set();
  const probes = [
    [{ command: 'git push origin main' }, 'git'],
    [{ command: 'psql -c "DROP TABLE t"' }, 'database'],
    [{ command: 'rm -rf /' }, 'filesystem'],
    [{ command: 'gh pr merge 1', agentType: 'spectree-squad:jakiro' }, 'github'],
    [{
      tool: 'Edit', agentType: 'spectree-squad:lina',
      input: { file_path: 'C:/p/docs/PRD.md', old_string: 'a', new_string: 'status: approved' },
    }, 'artifact-status'],
    [{
      tool: 'Edit', agentType: 'spectree-squad:keeper-of-the-light',
      input: { file_path: 'C:/p/src/app.js', old_string: 'a', new_string: 'b' },
    }, 'artifact-edit'],
  ];
  for (const [probe, capability] of probes) {
    if (guard(probe) !== null) detected.add(capability);
  }
  assert.deepEqual(
    capabilities.filter((c) => !detected.has(c)),
    [],
    'capability citada na matriz sem detector que a dispare no guard',
  );
});

test('4.6: commit e merge na main negados via .git/HEAD, inclusive na thread principal', () => {
  const onMain = fakeRepo('refs/heads/main');
  const onFeature = fakeRepo('refs/heads/feat/x');
  try {
    for (const command of ['git commit -m "x"', 'git merge feat/y']) {
      const asDisruptor = guard({ command, agentType: 'spectree-squad:disruptor', cwd: onMain });
      assert.equal(asDisruptor?.permissionDecision, 'deny', command);
      assert.match(asDisruptor.permissionDecisionReason, /no-direct-push-main/);
      // universal: a thread principal (Founder/Invoker) tambem e barrada
      const asFounder = guard({ command, cwd: onMain });
      assert.equal(asFounder?.permissionDecision, 'deny', 'founder: ' + command);
      // e na branch de trabalho o Disruptor segue livre
      assert.equal(guard({ command, agentType: 'spectree-squad:disruptor', cwd: onFeature }), null, command);
    }
    // subdiretorio: currentRef sobe ate achar o .git
    const sub = path.join(onMain, 'a', 'b');
    mkdirSync(sub, { recursive: true });
    const deep = guard({ command: 'git commit -m "x"', agentType: 'spectree-squad:disruptor', cwd: sub });
    assert.equal(deep?.permissionDecision, 'deny');
    // sem repo (cwd fora de qualquer .git): sem ref, nada a negar
    assert.equal(
      guard({ command: 'git commit -m "x"', agentType: 'spectree-squad:disruptor', cwd: tmpdir() }),
      null,
    );
  } finally {
    rmSync(onMain, { recursive: true, force: true });
    rmSync(onFeature, { recursive: true, force: true });
  }
});

test('4.6: gh governado por operacao — pr/release/ci sim, auth/repo nao', () => {
  const denied = guard({ command: 'gh pr merge 1', agentType: 'spectree-squad:jakiro' });
  assert.equal(denied?.permissionDecision, 'deny');
  assert.match(denied.permissionDecisionReason, /no policy grants/);
  assert.equal(guard({ command: 'gh pr merge 1', agentType: 'spectree-squad:disruptor' }), null);
  for (const command of ['gh auth status', 'gh repo view', 'gh api /user']) {
    assert.equal(guard({ command, agentType: 'spectree-squad:jakiro' }), null, command);
  }
});

test('4.6: a trilha registra a decisao sob projecao R10, nunca o comando bruto', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'spectree-home-'));
  try {
    const result = spawnSync(process.execPath, [GUARD], {
      input: JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command: 'psql "postgresql://user:SENHA-SECRETA@host" -c "DROP TABLE t"' },
        agent_type: 'spectree-squad:oracle',
        session_id: 'sess-audit',
      }),
      encoding: 'utf8',
      env: { ...process.env, HOME: home, USERPROFILE: home },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'ask');
    const log = path.join(home, '.claude', 'spectree', 'policy-decisions.jsonl');
    const lines = readdirSync(path.join(home, '.claude', 'spectree'));
    assert.deepEqual(lines, ['policy-decisions.jsonl']);
    const entry = JSON.parse(readFileSync(log, 'utf8').trim().split('\n').pop());
    assert.deepEqual(Object.keys(entry).sort(), [
      'at', 'capability', 'cwd', 'decision', 'operation', 'outcome', 'policyId',
      'principal', 'principalKnown', 'resource', 'sessionId', 'tool', 'toolUseId',
    ]);
    // 4.7: ask e registro de PERGUNTA, e diz isso de si mesmo
    assert.equal(entry.outcome, 'pending');
    assert.equal(entry.decision, 'ask');
    assert.equal(entry.policyId, 'destructive-migration-founder-gate');
    assert.equal(entry.principal, 'oracle');
    // R10: o segredo do comando jamais chega a trilha
    assert.ok(!JSON.stringify(entry).includes('SENHA-SECRETA'));
    assert.ok(!JSON.stringify(entry).includes('psql'));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('4.7: o alvo do push e resolvido do refspec, e a policy decide', () => {
  const onMain = fakeRepo('refs/heads/main');
  try {
    // buraco 1: push puro na main passava em silencio
    for (const command of ['git push', 'git push origin', 'git push -u origin HEAD']) {
      const d = guard({ command, agentType: 'spectree-squad:disruptor', cwd: onMain });
      assert.equal(d?.permissionDecision, 'deny', command);
      assert.match(d.permissionDecisionReason, /no-direct-push-main/);
    }
    // buraco 2: a forma MAIS destrutiva tinha o tratamento MAIS fraco
    for (const command of ['git push --force origin main', 'git push origin --delete main']) {
      const d = guard({ command, agentType: 'spectree-squad:disruptor', cwd: onMain });
      assert.equal(d?.permissionDecision, 'deny', command);
      assert.match(d.permissionDecisionReason, /no-direct-push-main/);
    }
    // o destino do refspec manda: src:dst com dst fora da main nao e main
    assert.equal(
      guard({ command: 'git push origin main:refs/heads/outra', agentType: 'spectree-squad:disruptor', cwd: onMain }),
      null,
    );
    // e HEAD:main continua sendo main
    const spoof = guard({ command: 'git push origin HEAD:main', agentType: 'spectree-squad:disruptor', cwd: onMain });
    assert.equal(spoof?.permissionDecision, 'deny');
    // force-push fora da main segue sendo gate do Founder, nao deny
    const gate = guard({ command: 'git push --force origin feat/x', agentType: 'spectree-squad:disruptor', cwd: onMain });
    assert.equal(gate?.permissionDecision, 'ask');
    assert.match(gate.permissionDecisionReason, /destructive-git-founder-gate/);
  } finally {
    rmSync(onMain, { recursive: true, force: true });
  }
});

test('4.7: force-push registra o alvo, e ask/executed formam par auditavel', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'spectree-home47-'));
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const fire = (event, toolUseId) => spawnSync(process.execPath, [GUARD], {
    env, encoding: 'utf8',
    input: JSON.stringify({
      hook_event_name: event, tool_name: 'Bash', tool_use_id: toolUseId,
      tool_input: { command: 'git push --force origin feat/demo' },
      agent_type: 'spectree-squad:disruptor', session_id: 's47',
    }),
  });
  try {
    fire('PreToolUse', 'toolu_A');
    fire('PostToolUse', 'toolu_A'); // executou: o Founder aprovou na UI
    fire('PreToolUse', 'toolu_B');  // negado: nenhum PostToolUse chega
    const lines = readFileSync(path.join(home, '.claude', 'spectree', 'policy-decisions.jsonl'), 'utf8')
      .trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(lines.map((e) => e.decision), ['ask', 'executed', 'ask']);
    assert.deepEqual(lines.map((e) => e.outcome), ['pending', 'final', 'pending']);
    // buraco 3: o alvo do force-push deixou de ser null
    for (const entry of lines) assert.equal(entry.resource, 'git/refs/heads/feat/demo');
    // a trilha agora responde "passou ou nao passou"
    const executed = new Set(lines.filter((e) => e.decision === 'executed').map((e) => e.toolUseId));
    assert.ok(executed.has('toolu_A'));
    assert.ok(!executed.has('toolu_B'));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('4.7: deny e desfecho, nao pergunta — outcome final e sem par pendente', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'spectree-deny47-'));
  try {
    spawnSync(process.execPath, [GUARD], {
      env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: 'utf8',
      input: JSON.stringify({
        hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 'toolu_C',
        tool_input: { command: 'git push origin main' }, agent_type: 'spectree-squad:disruptor',
      }),
    });
    const entry = JSON.parse(
      readFileSync(path.join(home, '.claude', 'spectree', 'policy-decisions.jsonl'), 'utf8').trim(),
    );
    assert.equal(entry.decision, 'deny');
    assert.equal(entry.outcome, 'final');
    assert.equal(entry.resource, 'git/refs/heads/main');
    assert.equal(entry.toolUseId, 'toolu_C');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
