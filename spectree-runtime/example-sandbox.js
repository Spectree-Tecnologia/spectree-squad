/**
 * Prova minima da Fase 5 (spec secoes 172-175):
 *   node spectree-runtime/example-sandbox.js
 *
 * A mesma Tool, a mesma Policy e o mesmo Provider, sob dois boundaries
 * diferentes. O que muda o desfecho nao e a autoridade — e o ambiente
 * fisico concedido.
 *
 *   Policy  responde "pode?"
 *   Sandbox responde "dentro de quais limites?"
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createRuntime,
  Agent,
  SandboxProviderRegistry,
  SandboxProfileResolver,
  LocalFilesystemSandboxProvider,
  LocalFilesystemProvider,
  filesystemCapability,
  filesystemTools,
  PolicyDeniedError,
  SandboxDeniedError,
} from './index.js';

const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'spectree-sandbox-'));
mkdirSync(path.join(workspaceRoot, 'src'), { recursive: true });
writeFileSync(path.join(workspaceRoot, 'src', 'hello.js'), 'export const hello = "spectree";', 'utf8');

const PROFILE = {
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
  },
};

/** Monta um runtime com o teto de sandbox pedido. */
function build(runtimeMaxMode, policies) {
  const sandboxProviderRegistry = new SandboxProviderRegistry();
  sandboxProviderRegistry.register(new LocalFilesystemSandboxProvider());
  const sandboxProfileResolver = new SandboxProfileResolver({
    document: {
      ...PROFILE,
      runtimeMaxMode,
      capabilities: { filesystem: { maxMode: runtimeMaxMode, operations: PROFILE.capabilities.filesystem.operations } },
    },
    workspaceRoot,
  });
  const runtime = createRuntime({ sandboxProviderRegistry, sandboxProfileResolver });
  runtime.eventBus.subscribe('*', (event) => {
    if (event.type.startsWith('sandbox.')) {
      const { mode, enforcement, reason } = event.payload;
      console.log('    ' + event.type + (mode ? ' -> ' + mode + ' (' + enforcement + ')' : '') +
        (reason ? ' -> ' + reason.slice(0, 72) : ''));
    }
  });
  runtime.capabilityRegistry.register(filesystemCapability);
  runtime.providerRegistry.register(new LocalFilesystemProvider({ workspaceRoot }));
  for (const tool of filesystemTools()) runtime.toolRuntime.register(tool);
  runtime.policyRegistry.registerMany(policies);
  return runtime;
}

const ALLOW_ALL = [{
  id: 'oracle-workspace',
  effect: 'allow',
  principal: 'oracle',
  capability: 'filesystem',
  resources: ['filesystem/workspace/*'],
}];

/** A chamada vai no proprio agente; a mission continua sendo texto. */
class FileAgent extends Agent {
  constructor(definition, call) {
    super(definition);
    this.call = call;
  }

  async run(context) {
    const [toolId, input] = this.call;
    const result = await context.runtime.requestTool(toolId, input);
    return result.output;
  }
}

async function scenario(label, runtimeMaxMode, call, policies = ALLOW_ALL) {
  console.log(label);
  const runtime = build(runtimeMaxMode, policies);
  const agent = new FileAgent(
    { id: 'oracle', name: 'Oracle', instructions: 'opere o workspace' },
    call,
  );
  const session = runtime.createSession({ agentId: 'oracle', mission: call[0] });
  const result = await runtime.loop.run(agent, session);
  if (result.status === 'completed') {
    console.log('    resultado: ' + JSON.stringify(result.output));
  } else if (result.error instanceof SandboxDeniedError) {
    console.log('    BLOQUEADO pelo Sandbox: ' + result.error.message);
    console.log('    (autorizado pela Policy; o ambiente fisico e que recusou)');
  } else if (result.error instanceof PolicyDeniedError) {
    console.log('    BLOQUEADO pela Policy: nem chegou ao Sandbox');
  } else {
    console.log('    erro: ' + result.error?.message);
  }
  console.log('');
}

console.log('workspace: ' + workspaceRoot + '\n');

await scenario(
  '1. filesystem.read sob read-only -> sucesso',
  'read-only',
  ['filesystem.read', { path: 'src/hello.js' }],
);

await scenario(
  '2. filesystem.write sob read-only -> SandboxDeniedError',
  'read-only',
  ['filesystem.write', { path: 'src/novo.js', content: 'const novo = 1;' }],
);

await scenario(
  '3. filesystem.write sob workspace-write -> sucesso',
  'workspace-write',
  ['filesystem.write', { path: 'src/novo.js', content: 'const novo = 1;' }],
);

await scenario(
  '4. Policy deny + workspace-write -> Sandbox nunca aplicado',
  'workspace-write',
  ['filesystem.write', { path: 'src/proibido.js', content: 'x' }],
  [{ id: 'no-write', effect: 'deny', capability: 'filesystem', operations: ['write'] }],
);

rmSync(workspaceRoot, { recursive: true, force: true });
