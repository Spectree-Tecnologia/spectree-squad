/**
 * Prova minima da Fase 6 (spec secoes 141-148):
 *   node spectree-runtime/example-process.js
 *
 * Um processo governado de ponta a ponta:
 *   Policy -> Sandbox -> Capability process -> LocalSubprocessProvider
 * — argv explicito, nunca shell; mesmo execution world do filesystem.
 */
import { mkdtempSync, rmSync } from 'node:fs';
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
  LocalFilesystemSandboxProvider,
  PolicyDeniedError,
  SandboxDeniedError,
} from './index.js';

const NODE = process.execPath;
const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'spectree-process-'));

/**
 * `spawnRequires` e a decisao operacional do R14: qual modo de sandbox
 * uma execucao de processo exige. Enquanto nenhum backend confinar
 * processo de verdade, so 'danger-full-access' — o modo que nao promete
 * confinement — pode parir um.
 */
function makeRuntime({ runtimeMaxMode, spawnRequires, verbose = false }) {
  const sandboxProviderRegistry = new SandboxProviderRegistry();
  sandboxProviderRegistry.register(new LocalFilesystemSandboxProvider());
  const sandboxProfileResolver = new SandboxProfileResolver({
    document: {
      runtimeMaxMode,
      allowPartialEnforcement: true,
      requiredEnforcement: 'partial',
      capabilities: {
        filesystem: {
          operations: {
            read: { requires: 'read-only' },
            write: { requires: 'workspace-write' },
            delete: { requires: 'workspace-write' },
          },
        },
        process: { operations: { spawn: { requires: spawnRequires } } },
      },
    },
    workspaceRoot,
  });
  const processRegistry = new ProcessRegistry();
  const runtime = createRuntime({ sandboxProviderRegistry, sandboxProfileResolver, processRegistry });
  if (verbose) {
    runtime.eventBus.subscribe('*', (event) => {
      if (event.type.startsWith('process.') || event.type.startsWith('sandbox.')) {
        console.log('    ' + event.type);
      }
    });
  }

  runtime.capabilityRegistry.register(filesystemCapability);
  runtime.capabilityRegistry.register(processCapability);
  runtime.providerRegistry.register(new LocalFilesystemProvider({ workspaceRoot }));
  runtime.providerRegistry.register(new LocalSubprocessProvider({
    workspaceRoot,
    hostEnv: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', FAKE_HOST_SECRET: 'nunca-me-viu' },
    registry: processRegistry,
    emit: (type, envelope) => runtime.eventBus.publish(type, envelope),
  }));
  for (const tool of [...filesystemTools(), ...processTools()]) runtime.toolRuntime.register(tool);
  runtime.policyRegistry.registerMany([
    { id: 'oracle-fs', effect: 'allow', principal: 'oracle', capability: 'filesystem', resources: ['filesystem/workspace*'] },
    { id: 'oracle-process', effect: 'allow', principal: 'oracle', capability: 'process', operations: ['spawn'], resources: ['workspace*', 'executable/*'] },
  ]);
  return runtime;
}

const runtime = makeRuntime({
  runtimeMaxMode: 'danger-full-access',
  spawnRequires: 'danger-full-access',
  verbose: true,
});

const ctx = { agentId: 'oracle', session: { id: 'sess_demo' } };
const stdio = { stdin: { mode: 'ignore' }, stdout: { mode: 'collect' }, stderr: { mode: 'collect' } };

console.log('workspace: ' + workspaceRoot + '\n');

console.log('1. processo governado escreve no workspace');
await runtime.toolRuntime.execute({ toolId: 'process.spawn', input: {
  argv: [NODE, '-e', "require('fs').writeFileSync('created-by-process.txt', 'spectree-process-ok')"],
  cwd: '.', ...stdio,
} }, ctx);

console.log('\n2. filesystem.read enxerga o arquivo — MESMO execution world');
const read = await runtime.toolRuntime.execute(
  { toolId: 'filesystem.read', input: { path: 'created-by-process.txt' } }, ctx,
);
console.log('    conteudo: ' + JSON.stringify(read.output));

console.log('\n3. ambiente controlado: segredo do host fora, SPECTREE_* dentro');
const envProof = await runtime.toolRuntime.execute({ toolId: 'process.spawn', input: {
  argv: [NODE, '-e', "console.log(JSON.stringify({secret: process.env.FAKE_HOST_SECRET ?? null, session: process.env.SPECTREE_SESSION_ID}))"],
  cwd: '.', ...stdio,
} }, ctx);
console.log('    processo viu: ' + envProof.output.stdout.text.trim());

console.log('\n4. exit code 7 e OUTCOME, nao erro do runtime');
const seven = await runtime.toolRuntime.execute({ toolId: 'process.spawn', input: {
  argv: [NODE, '-e', 'process.exit(7)'], cwd: '.', ...stdio,
} }, ctx);
console.log('    outcome.exitCode = ' + seven.output.outcome.exitCode);

console.log('\n5. cwd fora do workspace: morre na Policy, zero spawn');
try {
  await runtime.toolRuntime.execute({ toolId: 'process.spawn', input: {
    argv: [NODE, '-e', '1'], cwd: '../fora', ...stdio,
  } }, ctx);
} catch (error) {
  console.log('    ' + (error instanceof PolicyDeniedError ? 'PolicyDeniedError' : error.name) +
    ' (resource outside-workspace nao casa workspace*)');
}

console.log('\n6. R14: o MESMO spawn sob um modo que promete confinement');
const confined = makeRuntime({ runtimeMaxMode: 'workspace-write', spawnRequires: 'workspace-write' });
try {
  await confined.toolRuntime.execute({ toolId: 'process.spawn', input: {
    argv: [NODE, '-e', "require('fs').writeFileSync('nunca-nasci.txt','x')"], cwd: '.', ...stdio,
  } }, ctx);
  console.log('    ERRO: o processo nasceu sob uma promessa que ninguem aplica');
} catch (error) {
  console.log('    ' + (error instanceof SandboxDeniedError ? 'SandboxDeniedError' : error.name) +
    ' — autorizado pela Policy, recusado pelo ambiente: nenhum backend');
  console.log('    confina um processo do SO, entao o modo nao pode prometer');
  console.log('    o que nao cumpre. Zero processo, nada no disco.');
}

rmSync(workspaceRoot, { recursive: true, force: true });
