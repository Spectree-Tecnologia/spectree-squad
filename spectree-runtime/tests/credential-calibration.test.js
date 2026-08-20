import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  runCredentialCalibration,
  CALIBRATION_VERDICTS,
} from '../harness/credential-calibration.js';
import { SandboxConfigurationError } from '../errors.js';

/** Credential Calibration (spec F9, secoes 9-13, 18-25, 80, 83, E3). */

const CANDIDATES = [
  { resourceId: 'claude/auth-dir', physicalPath: '/tmp/fake/.claude/auth' },
  { resourceId: 'claude/auth-file', physicalPath: '/tmp/fake/.claude/auth.json' },
];

test('ordem progressiva: PROFILE-0 primeiro, um candidato por vez, para no auth-ok (secoes 10-12)', async () => {
  const probed = [];
  const report = await runCredentialCalibration({
    adapterId: 'claude-model-harness@1',
    candidates: CANDIDATES,
    runCandidate: async (candidate) => {
      probed.push(candidate === null ? 'PROFILE-0' : candidate.resourceId);
      if (candidate === null) return { verdict: 'auth-insufficient', reason: 'no credential' };
      if (candidate.resourceId === 'claude/auth-dir') return { verdict: 'auth-ok' };
      return { verdict: 'auth-ok' };
    },
  });
  assert.deepEqual(probed, ['PROFILE-0', 'claude/auth-dir'], 'parou no primeiro auth-ok');
  assert.deepEqual(report.approved, { resourceId: 'claude/auth-dir', profile: 'declared-resource' });
  assert.equal(report.results.length, 2);
});

test('PROFILE-0 suficiente = resultado A: aprovado sem recurso (secoes 11, 24)', async () => {
  const report = await runCredentialCalibration({
    adapterId: 'claude-model-harness@1',
    candidates: CANDIDATES,
    runCandidate: async () => ({ verdict: 'auth-ok' }),
  });
  assert.deepEqual(report.approved, { resourceId: null, profile: 'PROFILE-0' });
  assert.equal(report.results.length, 1, 'nenhum candidato adicional foi tocado');
});

test('nenhum candidato suficiente = resultado C: approved null, diagnostico completo (secoes 24-25)', async () => {
  const report = await runCredentialCalibration({
    adapterId: 'claude-model-harness@1',
    candidates: CANDIDATES,
    runCandidate: async () => ({ verdict: 'auth-insufficient', reason: 'still unauthenticated' }),
  });
  assert.equal(report.approved, null);
  assert.equal(report.results.length, 3, 'PROFILE-0 + os dois candidatos, cada um com diagnostico');
  assert.ok(report.results.every((r) => r.verdict === 'auth-insufficient'));
});

test('sem classificacao segura: RUNNER-FAILURE, nunca UNKNOWN nem auth-insufficient (secoes 19, 80)', async () => {
  const report = await runCredentialCalibration({
    adapterId: 'a@1',
    candidates: [],
    runCandidate: async () => ({ verdict: 'talvez?' }),
  });
  assert.equal(report.results[0].verdict, 'runner-failure');
  const thrown = await runCredentialCalibration({
    adapterId: 'a@1',
    candidates: [],
    runCandidate: async () => { throw new Error('CLI exploded'); },
  });
  assert.equal(thrown.results[0].verdict, 'runner-failure');
  assert.match(thrown.results[0].reason, /CLI exploded/);
  assert.deepEqual(CALIBRATION_VERDICTS, ['auth-ok', 'auth-insufficient', 'runner-failure']);
});

test('o HOME inteiro NUNCA e candidato (INV-906, criterio 13)', async () => {
  await assert.rejects(
    runCredentialCalibration({
      adapterId: 'a@1',
      homePath: '/home/founder',
      candidates: [{ resourceId: 'claude/home', physicalPath: '/home/founder' }],
      runCandidate: async () => ({ verdict: 'auth-ok' }),
    }),
    (e) => e instanceof SandboxConfigurationError && /never a bindable resource \(INV-906\)/.test(e.message),
  );
});

test('R8 do record: identidade canonica e veredito — nunca physicalPath ou segredo (secoes 13, 21, 83)', async () => {
  const report = await runCredentialCalibration({
    adapterId: 'claude-model-harness@1',
    candidates: CANDIDATES,
    runCandidate: async () => ({ verdict: 'auth-insufficient' }),
  });
  assert.deepEqual(Object.keys(report).sort(), ['adapterId', 'approved', 'outputMode', 'probedAt', 'results']);
  for (const entry of report.results) {
    assert.deepEqual(Object.keys(entry).sort(), ['candidate', 'reason', 'verdict']);
  }
  assert.ok(!JSON.stringify(report).includes('/tmp/fake'), 'caminho fisico nao entra no record');
  assert.ok(Object.isFrozen(report) && Object.isFrozen(report.results));
  // resourceId com cara de path e recusado na entrada
  await assert.rejects(
    runCredentialCalibration({
      adapterId: 'a@1', candidates: [{ resourceId: '/abs/path', physicalPath: '/x' }],
      runCandidate: async () => ({ verdict: 'auth-ok' }),
    }),
    SandboxConfigurationError,
  );
});

test('calibracao NUNCA roda em apply(): o sandbox provider nem importa o modulo (secoes 9, 22, criterio 11)', () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const providerSource = readFileSync(
    path.join(dir, '..', 'sandbox', 'providers', 'linux-physical', 'linux-physical-sandbox-provider.js'),
    'utf8',
  );
  assert.ok(!providerSource.includes('credential-calibration'), 'apply() consulta configuracao, nunca o probe');
  assert.ok(!providerSource.includes('runCredentialCalibration'));
});
