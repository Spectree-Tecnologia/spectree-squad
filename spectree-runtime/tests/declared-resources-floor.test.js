import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createSandboxPolicy,
  assertBindablePhysicalPath,
  isPathWithinOrEqual,
} from '../sandbox/sandbox-policy.js';
import { runCredentialCalibration } from '../harness/credential-calibration.js';
import { SandboxConfigurationError } from '../errors.js';

/**
 * Follow-up F9 (review do Founder no PR #28): o piso do physicalPath
 * vive no LADO COM AUTORIDADE — createSandboxPolicy, na normalizacao de
 * declaredResources — e a calibracao consome a MESMA proibicao. INV-906
 * corrigido na spec: a invariante e do BINDING; a calibracao e um dos
 * consumidores. Um teste por recusa, no estilo do contrato da F7.
 */

const FAKE_HOME = path.join(tmpdir(), 'floor-home-' + process.pid, 'founder');

function world() {
  const root = mkdtempSync(path.join(tmpdir(), 'floor-'));
  const workspaceRoot = path.join(root, 'workspace');
  const vault = path.join(root, 'vault', 'auth.json');
  mkdirSync(workspaceRoot, { recursive: true });
  mkdirSync(path.dirname(vault), { recursive: true });
  writeFileSync(vault, '{}', 'utf8');
  mkdirSync(FAKE_HOME, { recursive: true });
  return { root, workspaceRoot, vault, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const policyWith = (w, physicalPath, homePath = FAKE_HOME) => () => createSandboxPolicy({
  mode: 'workspace-write',
  workspaceRoot: w.workspaceRoot,
  homePath,
  declaredResources: [{ resourceId: 'credential/x', physicalPath, mode: 'read' }],
});

test('recusa: a raiz do filesystem NUNCA e recurso bindavel', () => {
  const w = world();
  try {
    const fsRoot = path.parse(w.root).root; // '/' ou 'C:\\'
    assert.throws(policyWith(w, fsRoot),
      (e) => e instanceof SandboxConfigurationError && /filesystem root/.test(e.message));
  } finally { w.cleanup(); }
});

test('recusa: o HOME inteiro NUNCA e recurso bindavel (INV-906, no lado do binding)', () => {
  const w = world();
  try {
    assert.throws(policyWith(w, FAKE_HOME),
      (e) => e instanceof SandboxConfigurationError && /INV-906/.test(e.message));
  } finally { w.cleanup(); }
});

test('recusa: ANCESTRAL do HOME e estritamente pior que o HOME — HOME/.. morre', () => {
  const w = world();
  try {
    const parent = path.dirname(FAKE_HOME); // o que HOME/.. resolve
    assert.throws(policyWith(w, parent),
      (e) => e instanceof SandboxConfigurationError && /ancestor of HOME/.test(e.message));
  } finally { w.cleanup(); }
});

// as raizes de sistema sao POSIX (e o backend fisico e Linux): no
// Windows '/usr' resolve para C:\usr e a recusa correta la ja e feita
// pelas outras regras do piso. O CI Linux exercita esta recusa sempre.
test('recusa: raiz de sistema que o backend ja monta nao e declared resource', { skip: process.platform === 'win32' ? 'posix system roots — verificado no CI Linux' : false }, () => {
  const w = world();
  try {
    for (const systemRoot of ['/usr', '/etc']) {
      assert.throws(policyWith(w, systemRoot), SandboxConfigurationError, systemRoot);
    }
  } finally { w.cleanup(); }
});

test('recusa: recurso DENTRO do workspace sombrearia subarvore gravavel com ro (item menor do review)', () => {
  const w = world();
  try {
    const inside = path.join(w.workspaceRoot, 'sub');
    mkdirSync(inside, { recursive: true });
    assert.throws(policyWith(w, inside),
      (e) => e instanceof SandboxConfigurationError && /overlaps the workspace/.test(e.message));
  } finally { w.cleanup(); }
});

test('recusa: ANCESTRAL do workspace sombrearia o workspace inteiro', () => {
  const w = world();
  try {
    assert.throws(policyWith(w, w.root),
      (e) => e instanceof SandboxConfigurationError && /overlaps the workspace/.test(e.message));
  } finally { w.cleanup(); }
});

test('aceita: recurso pontual legitimo — fora do workspace, fora do HOME, fora das raizes', () => {
  const w = world();
  try {
    const policy = policyWith(w, w.vault)();
    assert.equal(policy.declaredResources.length, 1);
    assert.equal(policy.declaredResources[0].mode, 'read');
    // dentro do HOME (nao o HOME) continua legitimo: e exatamente o que
    // a calibracao produz (~/.claude/algo) — o veto e HOME-ou-ancestral
    const underHome = path.join(FAKE_HOME, '.harness', 'auth.json');
    mkdirSync(path.dirname(underHome), { recursive: true });
    writeFileSync(underHome, '{}', 'utf8');
    const ok = policyWith(w, underHome)();
    assert.equal(ok.declaredResources.length, 1);
  } finally { w.cleanup(); }
});

test('os DOIS lados usam a mesma regra: calibracao recusa HOME, ancestral e raiz', async () => {
  for (const physicalPath of [FAKE_HOME, path.dirname(FAKE_HOME), path.parse(FAKE_HOME).root]) {
    await assert.rejects(
      runCredentialCalibration({
        adapterId: 'a@1',
        homePath: FAKE_HOME,
        candidates: [{ resourceId: 'claude/x', physicalPath }],
        runCandidate: async () => ({ verdict: 'auth-ok' }),
      }),
      SandboxConfigurationError,
      physicalPath,
    );
  }
});

test('helper: semantica igual-ou-ancestral e exata, sem falso positivo por prefixo', () => {
  const sep = path.sep;
  assert.equal(isPathWithinOrEqual(sep + 'a' + sep + 'b', sep + 'a'), true);
  assert.equal(isPathWithinOrEqual(sep + 'a', sep + 'a'), true);
  // '/ab' nao esta dentro de '/a' — prefixo de string nao e ancestral
  assert.equal(isPathWithinOrEqual(sep + 'ab', sep + 'a'), false);
  assert.throws(() => assertBindablePhysicalPath(path.parse(process.cwd()).root, {}),
    SandboxConfigurationError);
});
