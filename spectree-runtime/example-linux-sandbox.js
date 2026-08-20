/**
 * Prova minima da Fase 7 (spec secoes 122, 125):
 *   node spectree-runtime/example-linux-sandbox.js
 *
 * Em Linux (nativo ou WSL2) com bubblewrap: um processo executa sob
 * workspace-write FISICO — sem danger-full-access — e o kernel, nao o
 * JavaScript, nega a escrita fora do workspace.
 *
 * Fora de Linux: o diagnostico honesto do chain (secao 20), sem fingir.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createRuntime,
  ProcessRegistry,
  LocalSubprocessProvider,
  processCapability,
  processTools,
  LocalFilesystemProvider,
  filesystemCapability,
  filesystemTools,
  SandboxProviderRegistry,
  SandboxProfileResolver,
  LinuxPhysicalSandboxProvider,
} from './index.js';

const NODE = process.execPath;

console.log('1. probe: o backend prova que confina, ou o Runtime recusa');
const provider = new LinuxPhysicalSandboxProvider({
  tempRoot: mkdtempSync(path.join(tmpdir(), 'spectree-lnx-temp-')),
});
const verdict = await provider.probe();
const diag = provider.diagnostics();
console.log('    platform: ' + diag.platform + (diag.wsl ? ' (WSL2 — host de desenvolvimento, nao sandbox)' : ''));
for (const attempt of verdict.attempts) {
  console.log('    ' + attempt.backendId + ': ' + (attempt.usable ? 'usable' : attempt.reason));
}
if (!verdict.usable) {
  console.log('    verdict: UNAVAILABLE — ' + (verdict.reason ?? 'sem backend fisico'));
  console.log('\nSem backend fisico nao ha confinement: modo restritivo nao');
  console.log('pare processo (R14) e o Runtime nao finge o contrario.');
  process.exit(0);
}
console.log('    verdict: ' + verdict.backendId + ', enforcement ' + verdict.enforcement + ' (provado, nao configurado)');

const root = mkdtempSync(path.join(tmpdir(), 'spectree-lnx-'));
const workspaceRoot = path.join(root, 'workspace');
const outsideDir = path.join(root, 'outside');
mkdirSync(workspaceRoot, { recursive: true });
mkdirSync(outsideDir, { recursive: true });
writeFileSync(path.join(outsideDir, 'secret.txt'), 'nunca-visto', 'utf8');

const sandboxProviderRegistry = new SandboxProviderRegistry();
sandboxProviderRegistry.register(provider);
const sandboxProfileResolver = new SandboxProfileResolver({
  document: {
    runtimeMaxMode: 'workspace-write',
    requiredEnforcement: 'full', // so o backend fisico serve
    allowPartialEnforcement: false,
    capabilities: {
      filesystem: { operations: { read: { requires: 'read-only' }, write: { requires: 'workspace-write' } } },
      process: { operations: { spawn: { requires: 'workspace-write' } } },
    },
  },
  workspaceRoot,
});
const processRegistry = new ProcessRegistry();
const runtime = createRuntime({ sandboxProviderRegistry, sandboxProfileResolver, processRegistry });
runtime.eventBus.subscribe('sandbox.applied', (event) => {
  console.log('    sandbox.applied: mode=' + event.payload.mode +
    ' enforcement=' + event.payload.enforcement + ' backend=' + event.payload.backend);
});

runtime.capabilityRegistry.register(filesystemCapability);
runtime.capabilityRegistry.register(processCapability);
runtime.providerRegistry.register(new LocalFilesystemProvider({ workspaceRoot }));
runtime.providerRegistry.register(new LocalSubprocessProvider({
  workspaceRoot,
  hostEnv: { PATH: process.env.PATH ?? '' },
  registry: processRegistry,
  emit: (type, envelope) => runtime.eventBus.publish(type, envelope),
}));
for (const tool of [...filesystemTools(), ...processTools()]) runtime.toolRuntime.register(tool);
runtime.policyRegistry.registerMany([
  { id: 'oracle-fs', effect: 'allow', principal: 'oracle', capability: 'filesystem', resources: ['filesystem/workspace*'] },
  { id: 'oracle-process', effect: 'allow', principal: 'oracle', capability: 'process', operations: ['spawn'], resources: ['workspace*'] },
]);

const ctx = { agentId: 'oracle', session: { id: 'sess_demo' } };
const stdio = { stdin: { mode: 'ignore' }, stdout: { mode: 'collect' }, stderr: { mode: 'collect' } };

console.log('\n2. processo sob workspace-write FISICO — antes da Fase 7, isto era SandboxDeniedError');
const run = await runtime.toolRuntime.execute({ toolId: 'process.spawn', input: {
  argv: [NODE, '-e', "require('fs').writeFileSync('confined.txt', 'kernel-boundary')"],
  cwd: '.', ...stdio,
} }, ctx);
console.log('    exitCode = ' + run.output.outcome.exitCode);

console.log('\n3. same-world: o filesystem provider le o que o processo confinado escreveu');
const read = await runtime.toolRuntime.execute(
  { toolId: 'filesystem.read', input: { path: 'confined.txt' } }, ctx,
);
console.log('    conteudo: ' + JSON.stringify(read.output));

console.log('\n4. o processo tenta escapar: escrever e ler FORA do workspace');
const escape = await runtime.toolRuntime.execute({ toolId: 'process.spawn', input: {
  argv: [NODE, '-e',
    'const fs = require("fs"); const r = [];' +
    'try { fs.writeFileSync(' + JSON.stringify(path.join(outsideDir, 'leak.txt')) + ', "x"); r.push("write-LEAK"); } catch { r.push("write-denied"); }' +
    'try { fs.readFileSync(' + JSON.stringify(path.join(outsideDir, 'secret.txt')) + ', "utf8"); r.push("read-LEAK"); } catch { r.push("read-denied"); }' +
    'console.log(r.join(", "));'],
  cwd: '.', ...stdio,
} }, ctx);
console.log('    dentro da sandbox: ' + escape.output.stdout.text.trim());
console.log('    no host: leak.txt existe? ' + existsSync(path.join(outsideDir, 'leak.txt')) +
  ' — quem negou foi o KERNEL, nao o JavaScript');

await runtime.shutdown();
rmSync(root, { recursive: true, force: true });
