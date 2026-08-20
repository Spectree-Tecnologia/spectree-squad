import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ClaudeModelHarnessLauncher } from '../harness/claude-launcher.js';
import { createProcessSpawnSpec } from '../process/spawn-spec.js';
import { createSandboxPolicy } from '../sandbox/sandbox-policy.js';

/** R8 da F9 (spec secoes 81-87, 112, E1-E2): superficies travadas. */

const RUNTIME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'tests' || entry === 'node_modules') continue;
      yield* sourceFiles(full);
    } else if (entry.endsWith('.js')) {
      yield full;
    }
  }
}

test('secao 112: os literais do CLI existem SOMENTE no adapter do Claude', () => {
  const adapter = path.join(RUNTIME_DIR, 'harness', 'claude-launcher.js');
  // fora do runtime-core nao ha varredura: exemplos e scripts de
  // calibracao IMPORTAM o adapter (por caminho explicito) e sao
  // superficie de operacao, nao core (secao 82: "nenhum arquivo core")
  const operational = ['example-model-harness.js', 'calibrate-model-harness.js'];
  const forbidden = ["'claude'", '"claude"', "'-p'", '"-p"', '--output-format'];
  for (const file of sourceFiles(RUNTIME_DIR)) {
    if (file === adapter) continue;
    if (operational.includes(path.basename(file))) continue;
    const source = readFileSync(file, 'utf8');
    for (const literal of forbidden) {
      assert.ok(!source.includes(literal),
        path.relative(RUNTIME_DIR, file) + " nao pode conter " + literal + ' (INV-903)');
    }
  }
});

test('R8: superficie do ClaudeModelHarnessLauncher (secao 81)', () => {
  const launcher = new ClaudeModelHarnessLauncher();
  assert.deepEqual(Object.keys(launcher), ['launcherId', 'version', 'outputContract']);
  const methods = Object.getOwnPropertyNames(ClaudeModelHarnessLauncher.prototype)
    .filter((name) => name !== 'constructor');
  assert.deepEqual(methods, ['launch']);
});

test('R8 E2: ProcessSpawnSpec ganhou maxLifetimeMs — superficie exata', () => {
  const spec = createProcessSpawnSpec({
    argv: ['/bin/x'], cwd: '.',
    stdin: { mode: 'ignore' }, stdout: { mode: 'collect' }, stderr: { mode: 'collect' },
  });
  assert.deepEqual(Object.keys(spec), [
    'argv', 'cwd', 'stdin', 'stdout', 'stderr', 'env',
    'allowedEnvironmentKeys', 'graceMs', 'maxLifetimeMs', 'signal',
  ]);
  assert.equal(spec.maxLifetimeMs, null, 'sem pedido = teto do Runtime decide');
});

test('R8 E1: declaredResources com superficie e invariantes exatas', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'mh-sfc-'));
  const credential = path.join(root, 'cred.json');
  writeFileSync(credential, '{}', 'utf8');
  try {
    const policy = createSandboxPolicy({
      mode: 'workspace-write',
      workspaceRoot: root,
      declaredResources: [{ resourceId: 'credential/claude/auth', physicalPath: credential, mode: 'read' }],
    });
    assert.ok(Object.isFrozen(policy.declaredResources));
    assert.equal(policy.declaredResources.length, 1);
    const entry = policy.declaredResources[0];
    assert.deepEqual(Object.keys(entry), ['resourceId', 'physicalPath', 'mode']);
    assert.ok(Object.isFrozen(entry));
    assert.equal(entry.mode, 'read');
    // read-only nesta fase (E1): write nao existe como modo declarado
    assert.throws(() => createSandboxPolicy({
      mode: 'workspace-write', workspaceRoot: root,
      declaredResources: [{ resourceId: 'x', physicalPath: credential, mode: 'write' }],
    }), /mode must be 'read'/);
    assert.throws(() => createSandboxPolicy({
      mode: 'workspace-write', workspaceRoot: root,
      declaredResources: [{ physicalPath: credential, mode: 'read' }],
    }), /canonical resourceId/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('isolamento (secoes 85-87): Provider e Sandbox nao conhecem modelo algum', () => {
  for (const file of [
    'providers/local/subprocess-provider.js',
    'sandbox/providers/linux-physical/linux-physical-sandbox-provider.js',
    'sandbox/providers/linux-physical/bubblewrap-backend.js',
    'sandbox/sandbox-policy.js',
    'tools/tool-runtime.js',
    'agent/agent.js',
  ]) {
    const source = readFileSync(path.join(RUNTIME_DIR, file), 'utf8').toLowerCase();
    for (const forbidden of ['modelharness', 'anthropic', 'openai', 'credentialprobe', 'calibration']) {
      assert.ok(!source.includes(forbidden), file + ' nao pode conhecer ' + forbidden);
    }
  }
});
