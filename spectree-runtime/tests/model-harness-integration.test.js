import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRuntime } from '../index.js';
import { createModelHarnessTool, runModelHarness } from '../harness/model-harness.js';
import { parseStructuredHarnessOutput } from '../harness/harness-output.js';
import {
  LocalSubprocessProvider,
  processCapability,
} from '../providers/local/subprocess-provider.js';
import {
  LocalFilesystemProvider,
  filesystemCapability,
  filesystemTools,
} from '../providers/local/filesystem-provider.js';
import { ProcessRegistry } from '../process/process-registry.js';
import { SandboxProviderRegistry } from '../sandbox/sandbox-provider-registry.js';
import { SandboxProfileResolver } from '../sandbox/sandbox-profile-resolver.js';
import { LocalFilesystemSandboxProvider } from '../sandbox/providers/local-filesystem-sandbox.js';
import { SandboxUnavailableError } from '../errors.js';

/**
 * Integracao do Governed Model Harness (spec F9, secoes 2, 65, 74-75,
 * 100, 114) com o CONFORMANCE HARNESS (E3): deterministico, zero rede,
 * zero quota. Roda em qualquer plataforma; o confinement FISICO vive em
 * linux-model-harness-physical.test.js. Sem Invoker, sem Agent.run()
 * (secoes 74-75): o teste chama o launcher seam diretamente.
 */

const NODE = process.execPath;

const CONFORMANCE_SCRIPT = [
  "const fs = require('fs');",
  'const mission = process.argv[2] ?? "";',
  "fs.writeFileSync('mission-output.txt', 'governed: ' + mission);",
  "process.stdout.write(JSON.stringify({ result: 'ok', mission }));",
].join('\n');

function conformanceLauncher(workspaceRoot) {
  writeFileSync(path.join(workspaceRoot, 'conformance-harness.js'), CONFORMANCE_SCRIPT, 'utf8');
  return {
    launcherId: 'conformance-harness',
    version: '1',
    launch: ({ mission }) => Object.freeze({
      argv: Object.freeze([NODE, 'conformance-harness.js', mission]),
      cwd: '.',
      stdin: Object.freeze({ mode: 'ignore' }),
      stdout: Object.freeze({ mode: 'collect' }),
      stderr: Object.freeze({ mode: 'collect' }),
    }),
  };
}

function build({ policies, profile = null } = {}) {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'mh-int-'));
  const processRegistry = new ProcessRegistry();
  const options = { processRegistry };
  if (profile) {
    const sandboxProviderRegistry = new SandboxProviderRegistry();
    sandboxProviderRegistry.register(new LocalFilesystemSandboxProvider());
    options.sandboxProviderRegistry = sandboxProviderRegistry;
    options.sandboxProfileResolver = new SandboxProfileResolver({ document: profile, workspaceRoot });
  }
  const runtime = createRuntime(options);
  const events = [];
  runtime.eventBus.subscribe('*', (event) => events.push(event));
  runtime.capabilityRegistry.register(processCapability);
  runtime.capabilityRegistry.register(filesystemCapability);
  runtime.providerRegistry.register(new LocalFilesystemProvider({ workspaceRoot }));
  runtime.providerRegistry.register(new LocalSubprocessProvider({
    workspaceRoot,
    hostEnv: { PATH: process.env.PATH ?? '' },
    registry: processRegistry,
    emit: (type, envelope) => runtime.eventBus.publish(type, envelope),
  }));
  for (const tool of filesystemTools()) runtime.toolRuntime.register(tool);
  runtime.toolRuntime.register(createModelHarnessTool());
  runtime.policyRegistry.registerMany(policies);
  return {
    runtime, workspaceRoot, events,
    types: () => events.map((e) => e.type),
    cleanup: () => rmSync(workspaceRoot, { recursive: true, force: true }),
  };
}

const ctx = { agentId: 'oracle', session: { id: 'sess_mhi' } };
const POLICIES = [
  { id: 'allow-spawn', effect: 'allow', principal: 'oracle', capability: 'process', operations: ['spawn'], resources: ['workspace*', 'executable/*'] },
  { id: 'allow-fs', effect: 'allow', principal: 'oracle', capability: 'filesystem', resources: ['filesystem/workspace*'] },
];

test('cadeia completa: launcher -> EffectSet -> Policy -> Provider -> harness -> outcome (secoes 2, 65)', async () => {
  const env = build({ policies: POLICIES });
  try {
    const launcher = conformanceLauncher(env.workspaceRoot);
    const result = await runModelHarness({
      toolRuntime: env.runtime.toolRuntime,
      launcher,
      request: { mission: 'write the mission file' },
      context: ctx,
      parseOutput: parseStructuredHarnessOutput,
    });
    assert.equal(result.status, 'complete');
    assert.deepEqual(result.document, { result: 'ok', mission: 'write the mission file' });

    // secao 57: EffectSet resolvido ANTES do spawn — world + executavel
    const resolved = env.events.find((e) => e.type === 'effect.resolved');
    assert.equal(resolved.payload.effectCount, 2);
    const order = env.types();
    assert.ok(order.indexOf('effect.resolved') < order.indexOf('process.requested'));

    // secao 100 (lado logico): o host observa o MESMO recurso fisico
    const written = readFileSync(path.join(env.workspaceRoot, 'mission-output.txt'), 'utf8');
    assert.equal(written, 'governed: write the mission file');
    const viaProvider = await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.read', input: { path: 'mission-output.txt' } }, ctx,
    );
    assert.equal(viaProvider.output, written, 'F7 same-world + F8 resource identity + F9 harness');

    // secao 89: correlacao — fingerprint atravessa a cadeia
    assert.ok(env.events.find((e) => e.type === 'policy.evaluated').payload.effectSetFingerprint);
  } finally {
    env.cleanup();
  }
});

test('secao 90: eventos nao publicam argv completo nem a missao', async () => {
  const env = build({ policies: POLICIES });
  try {
    const launcher = conformanceLauncher(env.workspaceRoot);
    await runModelHarness({
      toolRuntime: env.runtime.toolRuntime, launcher,
      request: { mission: 'segredo-da-missao-XYZ' }, context: ctx,
      parseOutput: parseStructuredHarnessOutput,
    });
    const serialized = JSON.stringify(env.events);
    assert.ok(!serialized.includes('segredo-da-missao-XYZ'), 'a missao (argv) nunca vai ao bus');
  } finally {
    env.cleanup();
  }
});

test('secao 114: sandbox unavailable -> zero spawn, sem fallback para unconfined', async () => {
  const env = build({
    policies: POLICIES,
    profile: {
      runtimeMaxMode: 'workspace-write',
      requiredEnforcement: 'full', // o backend local so entrega partial
      allowPartialEnforcement: false,
      capabilities: {
        filesystem: { operations: { read: { requires: 'read-only' }, write: { requires: 'workspace-write' } } },
        process: { operations: { spawn: { requires: 'workspace-write' } } },
      },
    },
  });
  try {
    const launcher = conformanceLauncher(env.workspaceRoot);
    await assert.rejects(
      runModelHarness({
        toolRuntime: env.runtime.toolRuntime, launcher,
        request: { mission: 'never' }, context: ctx,
      }),
      SandboxUnavailableError,
    );
    assert.ok(!env.types().includes('process.requested'), 'zero spawn');
    assert.ok(!existsSync(path.join(env.workspaceRoot, 'mission-output.txt')));
  } finally {
    env.cleanup();
  }
});

test('secao 6: sem classificacao de process no perfil, o harness nao nasce', async () => {
  const env = build({
    policies: POLICIES,
    profile: {
      runtimeMaxMode: 'workspace-write',
      allowPartialEnforcement: true,
      requiredEnforcement: 'partial',
      capabilities: { filesystem: { operations: { read: { requires: 'read-only' }, write: { requires: 'workspace-write' } } } },
    },
  });
  try {
    const launcher = conformanceLauncher(env.workspaceRoot);
    await assert.rejects(
      runModelHarness({
        toolRuntime: env.runtime.toolRuntime, launcher,
        request: { mission: 'unclassified' }, context: ctx,
      }),
      /no sandbox profile declared for 'process.spawn'/,
    );
    assert.ok(!env.types().includes('process.requested'));
  } finally {
    env.cleanup();
  }
});
