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

import { tmpdir } from 'node:os';

// escada normativa (#29 item 2a): degrau mais estreito PRIMEIRO
const CANDIDATES = [
  { resourceId: 'claude/auth-file', physicalPath: '/tmp/fake/.claude/auth.json', granularity: 'file' },
  { resourceId: 'claude/auth-dir', physicalPath: '/tmp/fake/.claude/auth', granularity: 'directory' },
];
// HOME de referencia para o veto — o piso NAO tem interruptor (#29 item 1)
const HOME = path.join(tmpdir(), 'cal-home-' + process.pid);

test('ordem progressiva: PROFILE-0 primeiro, um candidato por vez, para no auth-ok (secoes 10-12)', async () => {
  const probed = [];
  const report = await runCredentialCalibration({
    adapterId: 'claude-model-harness@1',
    homePath: HOME,
    candidates: CANDIDATES,
    runCandidate: async (candidate) => {
      probed.push(candidate === null ? 'PROFILE-0' : candidate.resourceId);
      if (candidate === null) return { verdict: 'auth-insufficient', reason: 'no credential' };
      return { verdict: 'auth-ok' };
    },
  });
  assert.deepEqual(probed, ['PROFILE-0', 'claude/auth-file'],
    'parou no primeiro auth-ok — o degrau mais estreito, sem tocar o diretorio');
  assert.deepEqual(report.approved,
    { resourceId: 'claude/auth-file', granularity: 'file', profile: 'declared-resource' },
    'o record registra QUAL degrau foi aprovado (#29 item 2a)');
  assert.equal(report.results.length, 2);
});

test('PROFILE-0 suficiente = resultado A: aprovado sem recurso (secoes 11, 24)', async () => {
  const report = await runCredentialCalibration({
    adapterId: 'claude-model-harness@1',
    homePath: HOME,
    candidates: CANDIDATES,
    runCandidate: async () => ({ verdict: 'auth-ok' }),
  });
  assert.deepEqual(report.approved, { resourceId: null, granularity: 'none', profile: 'PROFILE-0' });
  assert.equal(report.results.length, 1, 'nenhum candidato adicional foi tocado');
});

test('nenhum candidato suficiente = resultado C: approved null, diagnostico completo (secoes 24-25)', async () => {
  const report = await runCredentialCalibration({
    adapterId: 'claude-model-harness@1',
    homePath: HOME,
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
      candidates: [{ resourceId: 'claude/home', physicalPath: '/home/founder', granularity: 'directory' }],
      runCandidate: async () => ({ verdict: 'auth-ok' }),
    }),
    (e) => e instanceof SandboxConfigurationError && /never a bindable resource \(INV-906\)/.test(e.message),
  );
});

test('#29 item 1 (simetria): candidatos sem homePath resoluvel = recusa, nunca skip', async () => {
  await assert.rejects(
    runCredentialCalibration({
      adapterId: 'a@1',
      candidates: CANDIDATES, // homePath ausente
      runCandidate: async () => ({ verdict: 'auth-ok' }),
    }),
    (e) => e instanceof SandboxConfigurationError && /requires a resolvable homePath/.test(e.message),
  );
});

test('#29 item 2a: a escada e norma — diretorio antes de arquivo e erro, nunca reordenacao', async () => {
  await assert.rejects(
    runCredentialCalibration({
      adapterId: 'a@1',
      homePath: HOME,
      candidates: [
        { resourceId: 'claude/dir', physicalPath: '/tmp/fake/.claude', granularity: 'directory' },
        { resourceId: 'claude/file', physicalPath: '/tmp/fake/.claude/a.json', granularity: 'file' },
      ],
      runCandidate: async () => ({ verdict: 'auth-ok' }),
    }),
    (e) => e instanceof SandboxConfigurationError && /narrowest first/.test(e.message),
  );
  // granularity ausente tambem e erro: o degrau nao e opcional
  await assert.rejects(
    runCredentialCalibration({
      adapterId: 'a@1',
      homePath: HOME,
      candidates: [{ resourceId: 'claude/x', physicalPath: '/tmp/fake/x' }],
      runCandidate: async () => ({ verdict: 'auth-ok' }),
    }),
    (e) => e instanceof SandboxConfigurationError && /granularity/.test(e.message),
  );
});

test('R8 do record: identidade canonica e veredito — nunca physicalPath ou segredo (secoes 13, 21, 83)', async () => {
  const report = await runCredentialCalibration({
    adapterId: 'claude-model-harness@1',
    homePath: HOME,
    candidates: CANDIDATES,
    runCandidate: async () => ({ verdict: 'auth-insufficient' }),
  });
  assert.deepEqual(Object.keys(report).sort(), ['adapterId', 'approved', 'outputMode', 'probedAt', 'results']);
  for (const entry of report.results) {
    // #29 item 2a: o DEGRAU entra no record — physicalPath continua fora
    assert.deepEqual(Object.keys(entry).sort(), ['candidate', 'granularity', 'reason', 'verdict']);
  }
  assert.ok(!JSON.stringify(report).includes('/tmp/fake'), 'caminho fisico nao entra no record');
  assert.ok(Object.isFrozen(report) && Object.isFrozen(report.results));
  // resourceId com cara de path e recusado na entrada
  await assert.rejects(
    runCredentialCalibration({
      adapterId: 'a@1', homePath: HOME,
      candidates: [{ resourceId: '/abs/path', physicalPath: '/x', granularity: 'file' }],
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
