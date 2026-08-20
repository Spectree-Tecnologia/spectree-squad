import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, symlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProviderExecutionError, PolicyApprovalRequiredError } from '../errors.js';
import {
  LocalFilesystemProvider,
  filesystemCapability,
  filesystemTools,
  canonicalFilesystemId,
} from '../providers/local/filesystem-provider.js';
import { recordedRuntime, makeAgent } from './helpers.js';

/** Workspace temporario real (secao 143); limpo ao final (secao 144). */
function tempWorkspace(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'spectree-fs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function filesystemRuntime(t) {
  const root = tempWorkspace(t);
  const runtime = recordedRuntime();
  runtime.capabilityRegistry.register(filesystemCapability);
  runtime.providerRegistry.register(new LocalFilesystemProvider({ workspaceRoot: root }));
  for (const tool of filesystemTools()) runtime.toolRuntime.register(tool);
  runtime.policyRegistry.register({
    id: 'allow-workspace',
    effect: 'allow',
    capability: 'filesystem',
    resources: ['filesystem/workspace/*'],
  });
  return { runtime, root };
}

test('canonicalizacao (secoes 94-95): equivalentes iguais, escapes marcados', () => {
  assert.equal(canonicalFilesystemId('src/a.js'), 'workspace/src/a.js');
  assert.equal(canonicalFilesystemId('./src/a.js'), 'workspace/src/a.js');
  assert.equal(canonicalFilesystemId('src/../src/a.js'), 'workspace/src/a.js');
  assert.equal(canonicalFilesystemId('../outside'), 'outside-workspace');
  assert.equal(canonicalFilesystemId('/etc/passwd'), 'outside-workspace');
  assert.equal(canonicalFilesystemId('C:/windows/system32'), 'outside-workspace');
});

test('round-trip real: write -> read -> delete num workspace temporario (secao 146)', async (t) => {
  const { runtime, root } = filesystemRuntime(t);
  const ctx = { agentId: 'oracle', session: { id: 'sess_fs' } };
  await runtime.toolRuntime.execute(
    { toolId: 'filesystem.write', input: { path: 'src/index.js', content: 'export const x = 1;' } },
    ctx,
  );
  // resource invariance fisica (secoes 27/69/111): o arquivo REAL existe
  // exatamente no path canonico autorizado
  const physical = path.join(root, 'src', 'index.js');
  assert.equal(readFileSync(physical, 'utf8'), 'export const x = 1;');

  const read = await runtime.toolRuntime.execute(
    { toolId: 'filesystem.read', input: { path: './src/index.js' } },
    ctx,
  );
  assert.equal(read.output, 'export const x = 1;');

  await runtime.toolRuntime.execute(
    { toolId: 'filesystem.delete', input: { path: 'src/index.js' } },
    ctx,
  );
  assert.equal(existsSync(physical), false);
});

test('path traversal (secoes 42/112): a Policy nega primeiro, o arquivo externo fica intocado', async (t) => {
  const { runtime, root } = filesystemRuntime(t);
  const outside = path.join(path.dirname(root), 'spectree-secret-' + path.basename(root));
  writeFileSync(outside, 'secret');
  t.after(() => rmSync(outside, { force: true }));
  // canonical vira 'outside-workspace' -> nenhuma policy workspace/* casa -> deny
  await assert.rejects(
    runtime.toolRuntime.execute(
      { toolId: 'filesystem.read', input: { path: '../' + path.basename(outside) } },
      { agentId: 'oracle' },
    ),
    /policy|denied/i,
  );
  assert.equal(readFileSync(outside, 'utf8'), 'secret'); // intocado
  assert.ok(!runtime.types().includes('provider.started'));
});

test('defense in depth: o Provider rejeita traversal e mismatch mesmo sem Policy na frente', async (t) => {
  const root = tempWorkspace(t);
  const provider = new LocalFilesystemProvider({ workspaceRoot: root });
  // traversal direto no provider
  await assert.rejects(
    provider.execute({
      operation: 'read',
      input: { path: '../etc/passwd' },
      resource: { type: 'filesystem', id: 'outside-workspace' },
    }, {}),
    (e) => e instanceof ProviderExecutionError && e.code === 'boundary-violation',
  );
  // resource forjado != path executado (secao 139)
  await assert.rejects(
    provider.execute({
      operation: 'read',
      input: { path: 'real.txt' },
      resource: { type: 'filesystem', id: 'workspace/other.txt' },
    }, {}),
    (e) => e instanceof ProviderExecutionError && e.code === 'resource-mismatch',
  );
  // operacao desconhecida (secao 137)
  await assert.rejects(
    provider.execute({
      operation: 'chmod',
      input: { path: 'x' },
      resource: { type: 'filesystem', id: 'workspace/x' },
    }, {}),
    (e) => e instanceof ProviderExecutionError && e.code === 'unsupported-operation',
  );
  // delete da raiz (secoes 46/93)
  await assert.rejects(
    provider.execute({
      operation: 'delete',
      input: { path: '.' },
      resource: { type: 'filesystem', id: canonicalFilesystemId('.') },
    }, {}),
    ProviderExecutionError,
  );
});

test('symlink escape (secoes 43/113): acesso via symlink e negado, alvo externo intocado', async (t) => {
  const root = tempWorkspace(t);
  const outside = path.join(path.dirname(root), 'spectree-outside-' + path.basename(root));
  mkdirSync(outside, { recursive: true });
  writeFileSync(path.join(outside, 'secret.txt'), 'top-secret');
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  try {
    symlinkSync(outside, path.join(root, 'link'), 'junction');
  } catch {
    t.skip('symlink nao suportado neste ambiente');
    return;
  }
  const provider = new LocalFilesystemProvider({ workspaceRoot: root });
  await assert.rejects(
    provider.execute({
      operation: 'read',
      input: { path: 'link' },
      resource: { type: 'filesystem', id: 'workspace/link' },
    }, {}),
    (e) => e instanceof ProviderExecutionError &&
      (e.code === 'symlink-denied' || e.code === 'boundary-violation' || e.code === 'io-error'),
  );
  assert.equal(readFileSync(path.join(outside, 'secret.txt'), 'utf8'), 'top-secret');
});

test('arquivo inexistente: ProviderExecutionError com causa distinguivel (secao 91)', async (t) => {
  const { runtime } = filesystemRuntime(t);
  await assert.rejects(
    runtime.toolRuntime.execute(
      { toolId: 'filesystem.read', input: { path: 'ghost.txt' } },
      { agentId: 'oracle' },
    ),
    (e) => e instanceof ProviderExecutionError && e.code === 'io-error' && e.cause?.code === 'ENOENT',
  );
});

test('concorrencia (secoes 64/115): duas sessions escrevem em paralelo sem interleaving', async (t) => {
  const { runtime, root } = filesystemRuntime(t);
  const writer = (name, content) => makeAgent(name, async (context) => {
    await context.runtime.requestTool('filesystem.write', {
      path: name + '.txt',
      content,
    });
    return 'done';
  });
  const contentA = 'A'.repeat(5000);
  const contentB = 'B'.repeat(5000);
  const [ra, rb] = await Promise.all([
    runtime.loop.run(writer('agent-a', contentA), runtime.createSession({ agentId: 'agent-a', mission: 'a' })),
    runtime.loop.run(writer('agent-b', contentB), runtime.createSession({ agentId: 'agent-b', mission: 'b' })),
  ]);
  assert.equal(ra.status, 'completed');
  assert.equal(rb.status, 'completed');
  assert.equal(readFileSync(path.join(root, 'agent-a.txt'), 'utf8'), contentA);
  assert.equal(readFileSync(path.join(root, 'agent-b.txt'), 'utf8'), contentB);
});

test('aprovacao + provider (secoes 109/110/147): delete sob approval, resume executa; revalidacao bloqueia', async (t) => {
  const { runtime, root } = filesystemRuntime(t);
  // delete exige aprovacao (vence o allow por precedencia)
  runtime.policyRegistry.register({
    id: 'delete-needs-approval',
    effect: 'approval-required',
    capability: 'filesystem',
    operations: ['delete'],
  });
  const ctx = { agentId: 'oracle', session: { id: 'sess_apr_fs' } };
  await runtime.toolRuntime.execute(
    { toolId: 'filesystem.write', input: { path: 'todo.txt', content: 'x' } },
    ctx,
  );
  const physical = path.join(root, 'todo.txt');
  let approvalId;
  try {
    await runtime.toolRuntime.execute(
      { toolId: 'filesystem.delete', input: { path: 'todo.txt' } },
      ctx,
    );
  } catch (error) {
    assert.ok(error instanceof PolicyApprovalRequiredError);
    approvalId = error.approvalId;
  }
  assert.equal(existsSync(physical), true); // provider nao tocou (secao 84)
  // o write anterior tem provider events; o DELETE nao pode ter nenhum
  const deleteProviderEvents = runtime.events.filter(
    (e) => e.type.startsWith('provider.') && e.payload.operation === 'delete',
  );
  assert.equal(deleteProviderEvents.length, 0);

  runtime.founderGate.approve(approvalId);
  const result = await runtime.approvalManager.resume(approvalId);
  assert.deepEqual(result.output, { deleted: true });
  assert.equal(existsSync(physical), false); // executou de verdade

  // revalidacao continua mandando (secao 110): novo pedido, policy congela deletes
  await runtime.toolRuntime.execute(
    { toolId: 'filesystem.write', input: { path: 'todo2.txt', content: 'y' } },
    ctx,
  );
  let secondApproval;
  try {
    await runtime.toolRuntime.execute(
      { toolId: 'filesystem.delete', input: { path: 'todo2.txt' } },
      ctx,
    );
  } catch (error) {
    secondApproval = error.approvalId;
  }
  runtime.founderGate.approve(secondApproval);
  runtime.policyRegistry.register({
    id: 'freeze-deletes',
    effect: 'deny',
    capability: 'filesystem',
    operations: ['delete'],
  });
  await assert.rejects(runtime.approvalManager.resume(secondApproval), /revalidation/);
  assert.equal(existsSync(path.join(root, 'todo2.txt')), true); // intocado
});

test('contrato de provider (secoes 99/149): LocalFilesystemProvider passa no contrato uniforme', async (t) => {
  const root = tempWorkspace(t);
  const provider = new LocalFilesystemProvider({ workspaceRoot: root });
  // identidade
  for (const field of ['providerId', 'capabilityId', 'version']) {
    assert.equal(typeof provider[field], 'string');
    assert.ok(provider[field].length > 0);
  }
  assert.ok(Array.isArray(provider.operations) && provider.operations.length > 0);
  assert.equal(typeof provider.execute, 'function');
  // operacao nao suportada rejeita
  await assert.rejects(
    provider.execute({ operation: '__nope__', input: {}, resource: null }, {}),
    ProviderExecutionError,
  );
  // sucesso produz { output }
  const result = await provider.execute({
    operation: 'write',
    input: { path: 'c.txt', content: 'ok' },
    resource: { type: 'filesystem', id: 'workspace/c.txt' },
  }, {});
  assert.ok('output' in result);
});
