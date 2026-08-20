import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createModelHarnessTool,
  modelHarnessLauncherContract,
} from '../harness/model-harness.js';
import { ProcessConfigurationError } from '../errors.js';

/** Contrato do Governed Model Harness (spec F9, secoes 3, 7, 57, 113). */

const validLauncher = (overrides = {}) => ({
  launcherId: 'conformance-harness',
  version: '1',
  launch: ({ mission, cwd = '.' }) => Object.freeze({
    argv: Object.freeze(['/usr/bin/node', 'harness.js', mission]),
    cwd,
    stdin: Object.freeze({ mode: 'ignore' }),
    stdout: Object.freeze({ mode: 'collect' }),
    stderr: Object.freeze({ mode: 'collect' }),
  }),
  ...overrides,
});

test('launcher valido passa o contrato; shell string e recusada (secoes 77, 113)', () => {
  const input = modelHarnessLauncherContract(validLauncher());
  assert.deepEqual(input.argv.slice(0, 2), ['/usr/bin/node', 'harness.js']);
  // uma "launch" que devolve comando shell nao e um launcher
  assert.throws(() => modelHarnessLauncherContract(validLauncher({
    launch: () => Object.freeze({
      command: 'node harness.js', cwd: '.',
      stdin: { mode: 'ignore' }, stdout: { mode: 'collect' }, stderr: { mode: 'collect' },
    }),
  })));
  assert.throws(() => modelHarnessLauncherContract(validLauncher({
    launch: () => ({ argv: ['x'], cwd: '.' }), // nao congelado, sem stdio
  })));
  assert.throws(() => modelHarnessLauncherContract({ launcherId: 'x' }), /version|launch/);
});

test('tool model-harness.run: provider-backed, capability process, spawn (secoes 5, 7)', () => {
  const tool = createModelHarnessTool();
  assert.equal(tool.id, 'model-harness.run');
  assert.equal(tool.capability, 'process');
  assert.equal(tool.operation, 'spawn');
  assert.equal(tool.execution, 'physical');
  assert.equal(tool.execute, undefined, 'provider-backed: o gate providerOnly da F6 continua valendo');
});

test('PROFILE-0: dois efeitos de spawn, nenhum recurso de credencial (secoes 11, 57)', () => {
  const tool = createModelHarnessTool();
  const effects = tool.resolveEffects({ argv: ['/usr/bin/node', 'h.js'], cwd: '.' });
  assert.equal(effects.length, 2);
  assert.deepEqual(effects.map((e) => e.resource.id).sort(), ['executable/node', 'workspace']);
});

test('calibracao declarada vira efeito filesystem.read(credential/...) (secoes 14-15, 57)', () => {
  const tool = createModelHarnessTool({
    calibration: { adapterId: 'conformance-harness@1', resources: [{ resourceId: 'conformance/auth' }] },
  });
  const effects = tool.resolveEffects({ argv: ['/usr/bin/node', 'h.js'], cwd: '.' });
  assert.equal(effects.length, 3);
  const credential = effects.find((e) => e.resource.type === 'credential');
  assert.equal(credential.kind, 'filesystem', 'secao 15: resource.type nao determina effect.kind');
  assert.equal(credential.operation, 'read');
  assert.equal(credential.resource.id, 'conformance/auth');
});

test('identidade de executavel indeterminada = plano incomplete (secoes 26, 80 F8)', () => {
  const tool = createModelHarnessTool();
  const plan = tool.resolveEffects({ argv: [], cwd: '.' });
  assert.equal(plan.completeness, 'incomplete');
});

test('resourceId com cara de path de host e recusado na configuracao (secao 13)', () => {
  assert.throws(
    () => createModelHarnessTool({ calibration: { resources: [{ resourceId: '/home/user/.secret' }] } }),
    ProcessConfigurationError,
  );
  assert.throws(
    () => createModelHarnessTool({ calibration: { resources: [{ resourceId: 'C:/Users/x' }] } }),
    ProcessConfigurationError,
  );
});
