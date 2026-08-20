/**
 * Prova minima da F9 (spec secoes 65-66):
 *   node spectree-runtime/example-model-harness.js
 *
 * Em Linux/WSL2 com bubblewrap: o CONFORMANCE HARNESS (E3 —
 * deterministico, zero rede, zero quota) nasce como processo governado:
 * launcher -> EffectSet -> Policy -> Sandbox fisico -> Provider ->
 * outcome estruturado. Fora de Linux: diagnostico honesto, sem
 * danger-full-access para mascarar incapacidade (secao 66).
 *
 * O adapter REAL do Claude (harness/claude-launcher.js) exige calibracao
 * de credencial deliberada (npm run calibrate:model-harness) — sem
 * configuracao calibrada, este exemplo diz isso explicitamente em vez de
 * desativar seguranca.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createRuntime,
  ProcessRegistry,
  LocalSubprocessProvider,
  processCapability,
  LocalFilesystemProvider,
  filesystemCapability,
  filesystemTools,
  SandboxProviderRegistry,
  SandboxProfileResolver,
  LinuxPhysicalSandboxProvider,
  createModelHarnessTool,
  runModelHarness,
  parseStructuredHarnessOutput,
} from './index.js';

const NODE = process.execPath;

console.log('1. backend fisico: probe como autoridade');
const provider = new LinuxPhysicalSandboxProvider({
  tempRoot: mkdtempSync(path.join(tmpdir(), 'spectree-mh-temp-')),
});
const verdict = await provider.probe();
for (const attempt of verdict.attempts) {
  console.log('    ' + attempt.backendId + ': ' + (attempt.usable ? 'usable' : attempt.reason));
}
if (!verdict.usable) {
  console.log('    verdict: ' + (verdict.reason ?? 'no usable backend'));
  console.log('\nconfined harness unavailable — sem backend fisico o harness');
  console.log('governado nao nasce, e o exemplo NAO rebaixa para');
  console.log('danger-full-access para parecer que funciona (secoes 66, 115).');
  process.exit(0);
}

const root = mkdtempSync(path.join(tmpdir(), 'spectree-mh-'));
const workspaceRoot = path.join(root, 'workspace');
mkdirSync(workspaceRoot, { recursive: true });

// o conformance harness: um "modelo" deterministico que cumpre a missao
// escrevendo no workspace e respondendo JSON estruturado
writeFileSync(path.join(workspaceRoot, 'conformance-harness.js'), [
  "const fs = require('fs');",
  'const mission = process.argv[2];',
  "fs.writeFileSync('mission-output.txt', 'governed: ' + mission);",
  "try { fs.readFileSync(process.env.HOME + '/x'); } catch { /* HOME env != HOME filesystem */ }",
  "process.stdout.write(JSON.stringify({ result: 'mission accomplished', mission }));",
].join('\n'), 'utf8');

const sandboxProviderRegistry = new SandboxProviderRegistry();
sandboxProviderRegistry.register(provider);
const sandboxProfileResolver = new SandboxProfileResolver({
  document: {
    runtimeMaxMode: 'workspace-write',
    requiredEnforcement: 'full',
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
runtime.eventBus.subscribe('*', (event) => {
  if (['effect.resolved', 'policy.evaluated', 'sandbox.applied', 'process.started', 'process.exited'].includes(event.type)) {
    const extra = event.type === 'sandbox.applied'
      ? ' (mode=' + event.payload.mode + ' enforcement=' + event.payload.enforcement + ' backend=' + event.payload.backend + ')'
      : '';
    console.log('    ' + event.type + extra);
  }
});
runtime.capabilityRegistry.register(processCapability);
runtime.capabilityRegistry.register(filesystemCapability);
runtime.providerRegistry.register(new LocalFilesystemProvider({ workspaceRoot }));
runtime.providerRegistry.register(new LocalSubprocessProvider({
  workspaceRoot,
  hostEnv: { PATH: process.env.PATH ?? '', HOME: '/home/spectree-conformance' },
  registry: processRegistry,
  emit: (type, envelope) => runtime.eventBus.publish(type, envelope),
  maxLifetimeMs: 120_000, // teto do Runtime (secao 39)
}));
for (const tool of filesystemTools()) runtime.toolRuntime.register(tool);
runtime.toolRuntime.register(createModelHarnessTool()); // PROFILE-0
runtime.policyRegistry.registerMany([
  { id: 'oracle-process', effect: 'allow', principal: 'oracle', capability: 'process', operations: ['spawn'], resources: ['workspace*', 'executable/*'] },
  { id: 'oracle-fs', effect: 'allow', principal: 'oracle', capability: 'filesystem', resources: ['filesystem/workspace*'] },
]);

const ctx = { agentId: 'oracle', session: { id: 'sess_demo' } };
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

console.log('\n2. missao governada: launcher -> EffectSet -> Policy -> Sandbox -> harness');
const result = await runModelHarness({
  toolRuntime: runtime.toolRuntime,
  launcher,
  request: { mission: 'prove the governed envelope' },
  context: ctx,
  parseOutput: parseStructuredHarnessOutput,
});
console.log('    status: ' + result.status);
console.log('    documento: ' + JSON.stringify(result.document));

console.log('\n3. same-world: o runtime le o que o harness confinado escreveu');
const read = await runtime.toolRuntime.execute(
  { toolId: 'filesystem.read', input: { path: 'mission-output.txt' } }, ctx,
);
console.log('    conteudo: ' + JSON.stringify(read.output));

console.log('\n4. adapter real do Claude: estado da calibracao');
console.log('    confined Claude harness unavailable — calibracao de credencial');
console.log('    pendente (operacao deliberada do Founder: npm run calibrate:model-harness).');
console.log('    O contrato esta provado pelo conformance harness acima; o que falta');
console.log('    e a prova de que o adapter concreto opera dentro dele (E3).');

await runtime.shutdown();
rmSync(root, { recursive: true, force: true });
