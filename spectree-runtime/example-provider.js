/**
 * Prova minima da Fase 4 (spec secao 146):
 *   node spectree-runtime/example-provider.js
 *
 * oracle -> filesystem.write -> Policy allow -> Capability filesystem
 * -> LocalFilesystemProvider -> arquivo criado num workspace temporario.
 * Depois filesystem.read prova o round-trip real, e um path traversal
 * mostra a Policy negando antes do Provider.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createRuntime,
  Agent,
  LocalFilesystemProvider,
  filesystemCapability,
  filesystemTools,
} from './index.js';

const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'spectree-demo-'));

const runtime = createRuntime();
runtime.eventBus.subscribe('*', (event) => {
  if (event.type.startsWith('provider.') || event.type.startsWith('policy.')) {
    console.log('  ' + event.type + (event.payload.resource ? ' -> ' + event.payload.resource : ''));
  }
});

runtime.capabilityRegistry.register(filesystemCapability);
runtime.providerRegistry.register(new LocalFilesystemProvider({ workspaceRoot }));
for (const tool of filesystemTools()) runtime.toolRuntime.register(tool);
runtime.policyRegistry.register({
  id: 'oracle-workspace',
  effect: 'allow',
  principal: 'oracle',
  capability: 'filesystem',
  resources: ['filesystem/workspace/*'],
});

class FileAgent extends Agent {
  async run(context) {
    await context.runtime.requestTool('filesystem.write', {
      path: 'src/hello.js',
      content: 'export const hello = "spectree";',
    });
    const read = await context.runtime.requestTool('filesystem.read', {
      path: './src/hello.js',
    });
    let traversalBlocked = false;
    try {
      await context.runtime.requestTool('filesystem.read', { path: '../secret' });
    } catch {
      traversalBlocked = true;
    }
    return { roundTrip: read.output, traversalBlocked };
  }
}

const agent = new FileAgent({ id: 'oracle', name: 'Oracle', instructions: 'escreva e leia no workspace' });
const session = runtime.createSession({ agentId: 'oracle', mission: 'first real capability' });
console.log('workspace: ' + workspaceRoot);
const result = await runtime.loop.run(agent, session);
console.log('result:', result.output);
rmSync(workspaceRoot, { recursive: true, force: true });
