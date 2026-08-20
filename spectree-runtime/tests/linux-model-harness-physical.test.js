import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
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
import { LinuxPhysicalSandboxProvider } from '../sandbox/providers/linux-physical/linux-physical-sandbox-provider.js';
import { createSandboxPolicy } from '../sandbox/sandbox-policy.js';
import { PolicyApprovalRequiredError } from '../errors.js';

/**
 * Fisica do Governed Model Harness (spec F9, secoes 99-111, E3): o
 * CONFORMANCE HARNESS — deterministico, zero rede, zero quota — nasce
 * sob workspace-write com process confinement FULL, via bubblewrap real.
 * Em Linux, probe inutilizavel FALHA (secao 64); fora de Linux, cada
 * teste registra skip como expected unavailable (secao 63).
 */

const LINUX = process.platform === 'linux';
const SKIP = LINUX ? false : 'expected unavailable on ' + process.platform + ' (secao 63)';
const NODE = process.execPath;
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let provider = null;
let verdict = null;

before(async () => {
  if (!LINUX) return;
  provider = new LinuxPhysicalSandboxProvider({ tempRoot: mkdtempSync(path.join(tmpdir(), 'mh-troot-')) });
  verdict = await provider.probe();
});

const PROFILE = {
  runtimeMaxMode: 'workspace-write',
  requiredEnforcement: 'full',
  allowPartialEnforcement: false,
  capabilities: {
    filesystem: { operations: { read: { requires: 'read-only' }, write: { requires: 'workspace-write' } } },
    // secao 6: process classificado — sem isto o harness nao nasce
    process: { operations: { spawn: { requires: 'workspace-write' }, terminate: { requires: 'workspace-write' } } },
  },
};

function world() {
  const root = mkdtempSync(path.join(tmpdir(), 'mh-phys-'));
  const workspaceRoot = path.join(root, 'workspace');
  const outsideDir = path.join(root, 'outside');
  const credentialFile = path.join(root, 'vault', 'auth.json');
  mkdirSync(workspaceRoot, { recursive: true });
  mkdirSync(outsideDir, { recursive: true });
  mkdirSync(path.dirname(credentialFile), { recursive: true });
  writeFileSync(path.join(outsideDir, 'secret.txt'), 'outside-secret', 'utf8');
  writeFileSync(credentialFile, '{"token":"conformance-credential"}', 'utf8');
  return { root, workspaceRoot, outsideDir, credentialFile, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/**
 * O conformance harness (E3): le a "missao" do argv, tenta os acessos
 * que a fase exige provar e responde JSON estruturado.
 */
function conformanceScript({ outsideDir, credentialFile }) {
  return [
    "const fs = require('fs');",
    'const report = { mission: process.argv[2] ?? null };',
    "fs.writeFileSync('mission-output.txt', 'governed: ' + report.mission);",
    'report.envHome = process.env.HOME ?? null;',
    "try { fs.readFileSync(process.env.HOME + '/anything', 'utf8'); report.homeRead = true; } catch { report.homeRead = false; }",
    'try { fs.readFileSync(' + JSON.stringify(path.join(outsideDir, 'secret.txt')) + ", 'utf8'); report.outsideRead = true; } catch { report.outsideRead = false; }",
    'try { report.credential = JSON.parse(fs.readFileSync(' + JSON.stringify(credentialFile) + ", 'utf8')).token; } catch { report.credential = null; }",
    'try { fs.writeFileSync(' + JSON.stringify(credentialFile) + ", 'x'); report.credentialWrite = true; } catch { report.credentialWrite = false; }",
    'process.stdout.write(JSON.stringify(report));',
  ].join('\n');
}

function build(w, { calibration = null, resourceBindings = null, policies }) {
  writeFileSync(path.join(w.workspaceRoot, 'conformance-harness.js'), conformanceScript(w), 'utf8');
  const sandboxProviderRegistry = new SandboxProviderRegistry();
  sandboxProviderRegistry.register(provider);
  const sandboxProfileResolver = new SandboxProfileResolver({
    document: PROFILE,
    workspaceRoot: w.workspaceRoot,
    resourceBindings,
  });
  const processRegistry = new ProcessRegistry();
  const runtime = createRuntime({ sandboxProviderRegistry, sandboxProfileResolver, processRegistry });
  const events = [];
  runtime.eventBus.subscribe('*', (event) => events.push(event));
  runtime.capabilityRegistry.register(processCapability);
  runtime.capabilityRegistry.register(filesystemCapability);
  runtime.providerRegistry.register(new LocalFilesystemProvider({ workspaceRoot: w.workspaceRoot }));
  runtime.providerRegistry.register(new LocalSubprocessProvider({
    workspaceRoot: w.workspaceRoot,
    // secoes 8, 32 (INV-905): HOME no AMBIENTE aponta para um caminho
    // que NAO esta montado no namespace — env HOME != filesystem HOME
    hostEnv: { PATH: process.env.PATH ?? '', HOME: '/home/spectree-conformance' },
    registry: processRegistry,
    emit: (type, envelope) => runtime.eventBus.publish(type, envelope),
  }));
  for (const tool of filesystemTools()) runtime.toolRuntime.register(tool);
  runtime.toolRuntime.register(createModelHarnessTool({ calibration }));
  runtime.policyRegistry.registerMany(policies);
  return { runtime, events, types: () => events.map((e) => e.type) };
}

const ctx = { agentId: 'oracle', session: { id: 'sess_mhp' } };
const launcher = {
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
const ALLOW = [
  { id: 'allow-spawn', effect: 'allow', principal: 'oracle', capability: 'process', operations: ['spawn'], resources: ['workspace*', 'executable/*'] },
  { id: 'allow-fs', effect: 'allow', principal: 'oracle', capability: 'filesystem', resources: ['filesystem/workspace*'] },
];
const CREDENTIAL_GATE = {
  id: 'credential-founder-gate', effect: 'approval-required',
  capability: 'filesystem', operations: ['read'], resources: ['credential/*'],
};

test('secao 64: em Linux o probe TEM de ser usavel', { skip: SKIP }, () => {
  assert.equal(verdict.usable, true,
    'nenhum backend fisico — ' + verdict.attempts.map((a) => a.backendId + ': ' + (a.reason ?? 'ok')).join('; '));
  assert.equal(provider.enforcement, 'full');
});

test('secoes 99-102: harness PROFILE-0 confinado — same-world, outside e HOME negados pelo kernel', { skip: SKIP }, async () => {
  const w = world();
  try {
    const env = build(w, { policies: ALLOW });
    const result = await runModelHarness({
      toolRuntime: env.runtime.toolRuntime, launcher,
      request: { mission: 'conformance' }, context: ctx,
      parseOutput: parseStructuredHarnessOutput,
    });
    assert.equal(result.status, 'complete');
    const report = result.document;
    // secao 102 (INV-905): HOME no ambiente, HOME ausente do filesystem
    assert.equal(report.envHome, '/home/spectree-conformance');
    assert.equal(report.homeRead, false, 'env HOME nao concede filesystem HOME');
    // secao 101: fora do namespace nao existe — negado pelo kernel
    assert.equal(report.outsideRead, false);
    // secao 103 (metade PROFILE-0): credencial NAO declarada NAO aparece
    assert.equal(report.credential, null, 'sem declaracao, sem mount');
    // secao 100: same-world — o host observa o MESMO recurso fisico
    assert.equal(
      readFileSync(path.join(w.workspaceRoot, 'mission-output.txt'), 'utf8'),
      'governed: conformance',
    );
    const applied = env.events.find((e) => e.type === 'sandbox.applied');
    assert.equal(applied.payload.enforcement, 'full');
    assert.equal(applied.payload.backend, 'bubblewrap');
    assert.ok(applied.payload.effectSetFingerprint);
  } finally {
    w.cleanup();
  }
});

test('secoes 103-105: credencial so aparece DEPOIS de Policy + Founder + EffectSet + Sandbox', { skip: SKIP }, async () => {
  const w = world();
  try {
    const env = build(w, {
      calibration: { adapterId: 'conformance-harness@1', resources: [{ resourceId: 'conformance/auth' }] },
      resourceBindings: { 'credential/conformance/auth': w.credentialFile },
      policies: [...ALLOW, CREDENTIAL_GATE],
    });
    let approvalId = null;
    try {
      await runModelHarness({
        toolRuntime: env.runtime.toolRuntime, launcher,
        request: { mission: 'credentialed' }, context: ctx,
      });
      throw new Error('deveria exigir aprovacao');
    } catch (error) {
      assert.ok(error instanceof PolicyApprovalRequiredError);
      approvalId = error.approvalId;
    }
    assert.ok(!env.types().includes('process.requested'), 'zero spawn antes do Founder (secao 58)');
    // secao 105: a approval carrega fingerprint + efeitos, sem host path
    const view = env.runtime.approvalManager.get(approvalId);
    assert.ok(view.effects.some((e) => e.resource === 'credential://conformance/auth'));
    assert.ok(!JSON.stringify(env.events).includes(w.credentialFile), 'caminho fisico nao vaza');

    await env.runtime.approvalManager.approve(approvalId, { type: 'founder', id: 'founder' });
    const result = await env.runtime.approvalManager.resume(approvalId);
    assert.ok(result.ok);
    const report = parseStructuredHarnessOutput(result.output);
    // secao 103: com aprovacao, o recurso esta montado — e SO leitura
    assert.equal(report.document.credential, 'conformance-credential');
    assert.equal(report.document.credentialWrite, false, 'E1: ro-bind — write morre no kernel');
    assert.equal(report.document.outsideRead, false, 'o mount e PONTUAL: o resto de fora continua inexistente');
  } finally {
    w.cleanup();
  }
});

test('secoes 110-111: guard no namespace — mesma identidade de projeto, audit unavailable explicito', { skip: SKIP }, async () => {
  const policy = createSandboxPolicy({
    mode: 'read-only', workspaceRoot: REPO, requiredEnforcement: 'full',
  });
  const handle = await provider.apply(policy, { sessionId: 'phys_guard' });
  try {
    const confined = handle.confineProcess({
      argv: [NODE, path.join(REPO, 'hooks', 'guard.mjs')],
      cwd: REPO,
    });
    const payload = JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git push origin main' },
      cwd: REPO,
      agent_type: 'spectree-squad:disruptor',
    });
    const output = await new Promise((resolve, reject) => {
      const child = spawn(confined.argv[0], confined.argv.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe'],
        // HOME aponta para um sink que NAO existe no namespace: o guard
        // tem de responder mesmo com audit unavailable (secao 111)
        env: { PATH: process.env.PATH ?? '', HOME: '/home/spectree-conformance' },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c) => { stdout += String(c); });
      child.stderr.on('data', (c) => { stderr += String(c); });
      child.stdin.write(payload);
      child.stdin.end();
      child.once('error', reject);
      child.once('close', (code) => resolve({ code, stdout, stderr }));
    });
    assert.equal(output.code, 0, output.stderr);
    const decision = JSON.parse(output.stdout).hookSpecificOutput;
    // secao 110: a MESMA sonda decide igual no host
    // (model-harness-project-identity.test.js) e dentro do namespace
    assert.equal(decision.permissionDecision, 'deny');
    assert.match(decision.permissionDecisionReason, /no-direct-push-main/,
      'a policy escopada por projeto continua existindo dentro do namespace (secao 53)');
  } finally {
    await handle.dispose();
  }
});
