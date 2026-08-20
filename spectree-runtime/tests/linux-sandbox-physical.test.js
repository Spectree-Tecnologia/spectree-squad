import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRuntime } from '../index.js';
import {
  LinuxPhysicalSandboxProvider,
} from '../sandbox/providers/linux-physical/linux-physical-sandbox-provider.js';
import { createSandboxPolicy } from '../sandbox/sandbox-policy.js';
import {
  LocalFilesystemProvider,
  filesystemCapability,
  filesystemTools,
} from '../providers/local/filesystem-provider.js';
import {
  LocalSubprocessProvider,
  processCapability,
  processTools,
} from '../providers/local/subprocess-provider.js';
import { ProcessRegistry } from '../process/process-registry.js';
import { SandboxProviderRegistry } from '../sandbox/sandbox-provider-registry.js';
import { SandboxProfileResolver } from '../sandbox/sandbox-profile-resolver.js';

/**
 * Seguranca FISICA da Fase 7 (spec secoes 101-113, 122): processos REAIS
 * confinados por backend REAL. So roda em Linux; em qualquer outra
 * plataforma cada teste registra skip como "expected unavailable"
 * (matriz da secao 100).
 *
 * REGRA DA SECAO 99: em Linux, probe inutilizavel NAO vira "all
 * skipped -> green" — o primeiro teste FALHA com o diagnostico do chain.
 */

const LINUX = process.platform === 'linux';
const SKIP = LINUX ? false : 'expected unavailable on ' + process.platform + ' (secao 100)';
const NODE = process.execPath;

let provider = null;
let verdict = null;

before(async () => {
  if (!LINUX) return;
  provider = new LinuxPhysicalSandboxProvider({ tempRoot: mkdtempSync(path.join(tmpdir(), 'lnx-troot-')) });
  verdict = await provider.probe();
});

const world = () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lnx-phys-'));
  const workspaceRoot = path.join(root, 'workspace');
  const outsideDir = path.join(root, 'outside');
  mkdirSync(workspaceRoot, { recursive: true });
  mkdirSync(outsideDir, { recursive: true });
  writeFileSync(path.join(workspaceRoot, 'inside.txt'), 'inside', 'utf8');
  writeFileSync(path.join(outsideDir, 'secret.txt'), 'secret', 'utf8');
  return { root, workspaceRoot, outsideDir, cleanup: () => rmSync(root, { recursive: true, force: true }) };
};

/** Roda um script node confinado pelo handle e devolve o report JSON. */
async function confinedNode(handle, workspaceRoot, script) {
  const confined = handle.confineProcess({ argv: [NODE, '-e', script], cwd: workspaceRoot });
  return await new Promise((resolve, reject) => {
    const child = spawn(confined.argv[0], confined.argv.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += String(c); });
    child.stderr.on('data', (c) => { stderr += String(c); });
    child.once('error', reject);
    child.once('close', (code) => {
      const at = stdout.indexOf('REPORT:');
      if (at < 0) reject(new Error('confined child produced no report (exit ' + code + '): ' + stderr.slice(0, 300)));
      else resolve(JSON.parse(stdout.slice(at + 'REPORT:'.length)));
    });
  });
}

const tryFs = (expr) => 'try { ' + expr + '; r.push(true); } catch { r.push(false); }';

test('secao 99: em Linux o probe TEM de ser usavel — sem skip silencioso', { skip: SKIP }, () => {
  assert.equal(verdict.usable, true,
    'nenhum backend fisico usavel neste host Linux — ' +
    verdict.attempts.map((a) => a.backendId + ': ' + (a.reason ?? 'usable')).join('; '));
  assert.equal(verdict.backendId, 'bubblewrap', 'chain: bubblewrap preferencial (secao 7)');
  assert.equal(provider.enforcement, 'full', 'secao 38: bwrap prova full para o profile da fase');
});

test('workspace-write fisico: dentro tudo, fora NADA (secoes 101, 122)', { skip: SKIP }, async () => {
  const w = world();
  try {
    const policy = createSandboxPolicy({ mode: 'workspace-write', workspaceRoot: w.workspaceRoot, requiredEnforcement: 'full' });
    const handle = await provider.apply(policy, { sessionId: 'phys_a' });
    symlinkSync(path.join(w.outsideDir, 'secret.txt'), path.join(w.workspaceRoot, 'escape-link'));
    const outside = JSON.stringify(w.outsideDir);
    const report = await confinedNode(handle, w.workspaceRoot, [
      "const fs = require('fs'); const r = [];",
      tryFs("fs.readFileSync('inside.txt','utf8')"),                                 // 0 read in
      tryFs("fs.writeFileSync('w.txt','x')"),                                        // 1 write in
      tryFs("fs.unlinkSync('w.txt')"),                                               // 2 delete in
      tryFs('fs.readFileSync(' + outside + " + '/secret.txt','utf8')"),              // 3 read out
      tryFs('fs.writeFileSync(' + outside + " + '/leak.txt','x')"),                  // 4 write out
      tryFs('fs.unlinkSync(' + outside + " + '/secret.txt')"),                       // 5 delete out
      tryFs("fs.renameSync('inside.txt', " + outside + " + '/moved.txt')"),          // 6 rename across
      tryFs("fs.readFileSync('escape-link','utf8')"),                                // 7 symlink escape
      tryFs('fs.linkSync(' + outside + " + '/secret.txt','hard.txt')"),              // 8 hard-link
      "process.stdout.write('REPORT:' + JSON.stringify(r));",
    ].join('\n'));
    assert.deepEqual(report, [true, true, true, false, false, false, false, false, false],
      'read/write/delete dentro ✓; toda rota para fora ✗');
    // e o host confirma: nada vazou fisicamente
    assert.ok(existsSync(path.join(w.outsideDir, 'secret.txt')), 'secret intacto');
    assert.ok(!existsSync(path.join(w.outsideDir, 'leak.txt')));
    assert.ok(!existsSync(path.join(w.outsideDir, 'moved.txt')));
    await handle.dispose();
  } finally {
    w.cleanup();
  }
});

test('read-only fisico: le, nao escreve — negado pelo KERNEL (secoes 30, 101)', { skip: SKIP }, async () => {
  const w = world();
  try {
    const policy = createSandboxPolicy({ mode: 'read-only', workspaceRoot: w.workspaceRoot, requiredEnforcement: 'full' });
    const handle = await provider.apply(policy, { sessionId: 'phys_ro' });
    const report = await confinedNode(handle, w.workspaceRoot, [
      "const fs = require('fs'); const r = [];",
      tryFs("fs.readFileSync('inside.txt','utf8')"),
      tryFs("fs.writeFileSync('ro.txt','x')"),
      tryFs("fs.unlinkSync('inside.txt')"),
      "process.stdout.write('REPORT:' + JSON.stringify(r));",
    ].join('\n'));
    assert.deepEqual(report, [true, false, false]);
    assert.ok(existsSync(path.join(w.workspaceRoot, 'inside.txt')), 'INV-505: nada tocado');
    await handle.dispose();
  } finally {
    w.cleanup();
  }
});

test('child e grandchild permanecem confinados (secoes 40, 101, 122, INV-710)', { skip: SKIP }, async () => {
  const w = world();
  try {
    const policy = createSandboxPolicy({ mode: 'workspace-write', workspaceRoot: w.workspaceRoot, requiredEnforcement: 'full' });
    const handle = await provider.apply(policy, { sessionId: 'phys_tree' });
    // scripts como ARQUIVOS no workspace: visiveis dentro da sandbox,
    // sem quoting aninhado — o neto tenta escrever fora e dentro
    writeFileSync(path.join(w.workspaceRoot, 'grand.js'), [
      "const f = require('fs'); const r = [];",
      'try { f.writeFileSync(' + JSON.stringify(path.join(w.outsideDir, 'gc.txt')) + ", 'x'); r.push(true); } catch { r.push(false); }",
      "try { f.writeFileSync('gc-in.txt', 'x'); r.push(true); } catch { r.push(false); }",
      'process.stdout.write(JSON.stringify(r));',
    ].join('\n'), 'utf8');
    writeFileSync(path.join(w.workspaceRoot, 'child.js'), [
      "const cp = require('child_process');",
      "const g = cp.spawnSync(process.execPath, ['grand.js'], { encoding: 'utf8' });",
      'process.stdout.write(g.stdout);',
    ].join('\n'), 'utf8');
    const report = await confinedNode(handle, w.workspaceRoot, [
      "const cp = require('child_process');",
      "const child = cp.spawnSync(process.execPath, ['child.js'], { encoding: 'utf8' });",
      "process.stdout.write('REPORT:' + child.stdout);",
    ].join('\n'));
    assert.deepEqual(report, [false, true], 'neto: fora negado, dentro permitido — mesmo mundo');
    assert.ok(!existsSync(path.join(w.outsideDir, 'gc.txt')));
    assert.ok(existsSync(path.join(w.workspaceRoot, 'gc-in.txt')), 'a escrita interna do neto E o mesmo arquivo do host');
    await handle.dispose();
  } finally {
    w.cleanup();
  }
});

test('temp privado: invocation A nao enxerga o temp de B (secoes 32-34)', { skip: SKIP }, async () => {
  const w = world();
  try {
    const policy = createSandboxPolicy({ mode: 'workspace-write', workspaceRoot: w.workspaceRoot, requiredEnforcement: 'full' });
    const a = await provider.apply(policy, { sessionId: 'sess_A' });
    const b = await provider.apply(policy, { sessionId: 'sess_B' });
    writeFileSync(path.join(b.sessionTemp, 'b-private.txt'), 'b', 'utf8');
    const bTemp = JSON.stringify(b.sessionTemp);
    const report = await confinedNode(a, w.workspaceRoot, [
      "const fs = require('fs'); const r = [];",
      tryFs('fs.writeFileSync(' + JSON.stringify(a.sessionTemp) + " + '/a.txt','x')"),
      tryFs('fs.readFileSync(' + bTemp + " + '/b-private.txt','utf8')"),
      "process.stdout.write('REPORT:' + JSON.stringify(r));",
    ].join('\n'));
    assert.deepEqual(report, [true, false], 'proprio temp gravavel; temp alheio invisivel');
    await a.dispose();
    await b.dispose();
    assert.ok(!existsSync(a.sessionTemp) && !existsSync(b.sessionTemp), 'secao 86: temp removido');
  } finally {
    w.cleanup();
  }
});

test('cadeia completa: workspace-write agora PARE processo — o R14 encontra o backend (secoes 122, 125)', { skip: SKIP }, async () => {
  const w = world();
  const processRegistry = new ProcessRegistry();
  try {
    const sandboxProviderRegistry = new SandboxProviderRegistry();
    sandboxProviderRegistry.register(provider); // fisico PRIMEIRO no chain
    const sandboxProfileResolver = new SandboxProfileResolver({
      document: {
        runtimeMaxMode: 'workspace-write',
        requiredEnforcement: 'full',        // sem partial: so o backend fisico serve
        allowPartialEnforcement: false,
        capabilities: {
          filesystem: { operations: { read: { requires: 'read-only' }, write: { requires: 'workspace-write' } } },
          process: { operations: { spawn: { requires: 'workspace-write' } } },
        },
      },
      workspaceRoot: w.workspaceRoot,
    });
    const runtime = createRuntime({ sandboxProviderRegistry, sandboxProfileResolver, processRegistry });
    const events = [];
    runtime.eventBus.subscribe('*', (event) => events.push(event));
    runtime.capabilityRegistry.register(filesystemCapability);
    runtime.capabilityRegistry.register(processCapability);
    runtime.providerRegistry.register(new LocalFilesystemProvider({ workspaceRoot: w.workspaceRoot }));
    runtime.providerRegistry.register(new LocalSubprocessProvider({
      workspaceRoot: w.workspaceRoot,
      hostEnv: { PATH: process.env.PATH ?? '', HOST_SECRET: 'nunca' },
      registry: processRegistry,
      emit: (type, envelope) => runtime.eventBus.publish(type, envelope),
    }));
    for (const tool of [...filesystemTools(), ...processTools()]) runtime.toolRuntime.register(tool);
    runtime.policyRegistry.registerMany([
      { id: 'oracle-fs', effect: 'allow', principal: 'oracle', capability: 'filesystem', resources: ['filesystem/workspace*'] },
      { id: 'oracle-process', effect: 'allow', principal: 'oracle', capability: 'process', operations: ['spawn'], resources: ['workspace*'] },
    ]);
    const ctx = { agentId: 'oracle', session: { id: 'sess_chain' } };
    const stdio = { stdin: { mode: 'ignore' }, stdout: { mode: 'collect' }, stderr: { mode: 'collect' } };

    // ANTES da Fase 7 isto era SandboxDeniedError (R14). Agora: processo
    // fisicamente confinado sob workspace-write, sem danger-full-access.
    const result = await runtime.toolRuntime.execute({ toolId: 'process.spawn', input: {
      argv: [NODE, '-e', "require('fs').writeFileSync('by-confined-process.txt','same world')"],
      cwd: '.', ...stdio,
    } }, ctx);
    assert.equal(result.output.outcome.exitCode, 0);

    // same-world (secao 102, INV-717): o filesystem provider LE o arquivo
    const read = await runtime.toolRuntime.execute(
      { toolId: 'filesystem.read', input: { path: 'by-confined-process.txt' } }, ctx,
    );
    assert.equal(read.output, 'same world');

    // eventos: sandbox fisico aplicado com identidade do backend (secao 67)
    const applied = events.find((e) => e.type === 'sandbox.applied');
    assert.equal(applied.payload.enforcement, 'full');
    assert.equal(applied.payload.providerId, 'linux-physical-sandbox');
    assert.equal(applied.payload.backend, 'bubblewrap');
    const resolved = events.find((e) => e.type === 'process.resolved');
    assert.equal(resolved.payload.confined, true);

    // exit code continua outcome, nao erro — mesmo confinado (INV-621)
    const seven = await runtime.toolRuntime.execute({ toolId: 'process.spawn', input: {
      argv: [NODE, '-e', 'process.exit(7)'], cwd: '.', ...stdio,
    } }, ctx);
    assert.equal(seven.output.outcome.exitCode, 7);

    // e o processo confinado NAO alcanca fora do workspace
    const escape = await runtime.toolRuntime.execute({ toolId: 'process.spawn', input: {
      argv: [NODE, '-e',
        "try { require('fs').writeFileSync(" + JSON.stringify(path.join(w.outsideDir, 'leak.txt')) + ",'x'); } catch {} "],
      cwd: '.', ...stdio,
    } }, ctx);
    assert.equal(escape.output.outcome.exitCode, 0);
    assert.ok(!existsSync(path.join(w.outsideDir, 'leak.txt')), 'kernel negou, nao o JavaScript');
    await runtime.shutdown();
  } finally {
    await processRegistry.shutdown?.();
    w.cleanup();
  }
});
