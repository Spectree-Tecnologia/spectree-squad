import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRuntime } from '../index.js';
import { createModelHarnessTool, runModelHarness } from '../harness/model-harness.js';
import { parseStructuredHarnessOutput } from '../harness/harness-output.js';
import {
  LocalSubprocessProvider,
  processCapability,
} from '../providers/local/subprocess-provider.js';
import { ProcessRegistry } from '../process/process-registry.js';
import { ProcessConfigurationError } from '../errors.js';

/** Lifetime e ownership (spec F9, secoes 38-45, 108-109, E2). */

const NODE = process.execPath;

function build({ maxLifetimeMs = null } = {}) {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'mh-life-'));
  const processRegistry = new ProcessRegistry();
  const runtime = createRuntime({ processRegistry });
  runtime.capabilityRegistry.register(processCapability);
  runtime.providerRegistry.register(new LocalSubprocessProvider({
    workspaceRoot,
    hostEnv: { PATH: process.env.PATH ?? '' },
    registry: processRegistry,
    // F9 (secao 39, E2): o TETO vem do Runtime por DI
    maxLifetimeMs,
  }));
  runtime.toolRuntime.register(createModelHarnessTool());
  runtime.policyRegistry.register({
    id: 'allow-spawn', effect: 'allow', principal: 'oracle',
    capability: 'process', operations: ['spawn'], resources: ['workspace*', 'executable/*'],
  });
  return {
    runtime, workspaceRoot, processRegistry,
    cleanup: () => rmSync(workspaceRoot, { recursive: true, force: true }),
  };
}

const ctx = { agentId: 'oracle', session: { id: 'sess_life' } };
const stdio = { stdin: { mode: 'ignore' }, stdout: { mode: 'collect' }, stderr: { mode: 'collect' } };

/** Launcher de conformidade (E3): deterministico, zero rede, zero quota. */
function conformanceLauncher(workspaceRoot, script, extra = {}) {
  const file = path.join(workspaceRoot, 'conformance-harness.js');
  writeFileSync(file, script, 'utf8');
  return {
    launcherId: 'conformance-harness',
    version: '1',
    launch: ({ mission }) => Object.freeze({
      argv: Object.freeze([NODE, 'conformance-harness.js', mission]),
      cwd: '.',
      stdin: Object.freeze({ mode: 'ignore' }),
      stdout: Object.freeze({ mode: 'collect' }),
      stderr: Object.freeze({ mode: 'collect' }),
      ...extra,
    }),
  };
}

test('E2: pedido acima do teto do Runtime e REJECT, nao clamp (secao 39)', async () => {
  const env = build({ maxLifetimeMs: 1_000 });
  try {
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'model-harness.run', input: {
        argv: [NODE, '-e', '1'], cwd: '.', maxLifetimeMs: 5_000, ...stdio,
      } }, ctx),
      // o frame embrulha erro de provider (F4); a causa tipada e o reject
      (e) => e.cause instanceof ProcessConfigurationError && /exceeds the runtime ceiling/.test(e.message),
    );
  } finally {
    env.cleanup();
  }
});

test('secoes 40-42, 108: deadline expira -> terminacao em arvore -> outcome timedOut como FATO', async () => {
  const env = build({ maxLifetimeMs: 60_000 });
  try {
    const launcher = conformanceLauncher(env.workspaceRoot,
      'setTimeout(() => {}, 60000);', // dorme alem do budget
      { maxLifetimeMs: 400, graceMs: 200 }); // pedido MENOR que o teto: permitido
    const result = await runModelHarness({
      toolRuntime: env.runtime.toolRuntime, launcher,
      request: { mission: 'sleep' }, context: ctx,
      parseOutput: parseStructuredHarnessOutput,
    });
    assert.equal(result.status, 'timed-out', 'timeout e semanticamente distinto (secao 41)');
    assert.equal(result.outcome.timedOut, true, 'fato persistido, nao inferido de signal (E2)');
  } finally {
    env.cleanup();
  }
});

test('saida normal NAO e timeout: timedOut false por construcao (secao 42)', async () => {
  const env = build({ maxLifetimeMs: 60_000 });
  try {
    const launcher = conformanceLauncher(env.workspaceRoot,
      "process.stdout.write(JSON.stringify({ result: process.argv[2] }));");
    const result = await runModelHarness({
      toolRuntime: env.runtime.toolRuntime, launcher,
      request: { mission: 'quick' }, context: ctx,
      parseOutput: parseStructuredHarnessOutput,
    });
    assert.equal(result.status, 'complete');
    assert.equal(result.outcome.timedOut, false);
    assert.deepEqual(result.document, { result: 'quick' });
  } finally {
    env.cleanup();
  }
});

test('R8 (secao 84): superficie do outcome atualizada NO MESMO PR — chaves exatas', async () => {
  const env = build();
  try {
    const result = await env.runtime.toolRuntime.execute({ toolId: 'model-harness.run', input: {
      argv: [NODE, '-e', '1'], cwd: '.', ...stdio,
    } }, ctx);
    assert.deepEqual(Object.keys(result.output.outcome), [
      'exitCode', 'signal', 'timedOut', 'startedAt', 'endedAt', 'durationMs',
    ]);
  } finally {
    env.cleanup();
  }
});

test('secoes 43-45, 109: a Session encerra o harness — nada fica orfao', async () => {
  const env = build();
  try {
    const session = env.runtime.createSession({ agentId: 'oracle', mission: 'long harness' });
    session.start();
    const pending = env.runtime.toolRuntime.execute({ toolId: 'model-harness.run', input: {
      argv: [NODE, '-e', 'setTimeout(() => {}, 60000)'], cwd: '.', graceMs: 300, ...stdio,
    } }, { agentId: 'oracle', session: { id: session.id } });
    let entry = null;
    for (let i = 0; i < 100 && !entry; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      entry = env.processRegistry.listBySession(session.id)[0] ?? null;
    }
    assert.ok(entry, 'harness registrado sob a Session (secao 43)');
    session.cancel('teste');
    const result = await pending;
    assert.ok(result.output.outcome.exitCode !== 0 || result.output.outcome.signal);
    assert.equal(result.output.outcome.timedOut, false, 'cancel nao e timeout: categorias distintas (secao 79)');
    assert.equal(env.processRegistry.listBySession(session.id).length, 0, 'registry limpo');
  } finally {
    env.cleanup();
  }
});
