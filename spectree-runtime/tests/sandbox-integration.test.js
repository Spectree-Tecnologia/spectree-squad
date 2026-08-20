import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRuntime } from '../index.js';
import {
  LocalFilesystemProvider,
  filesystemCapability,
  filesystemTools,
} from '../providers/local/filesystem-provider.js';
import { SandboxProviderRegistry } from '../sandbox/sandbox-provider-registry.js';
import { SandboxProfileResolver } from '../sandbox/sandbox-profile-resolver.js';
import { LocalFilesystemSandboxProvider } from '../sandbox/providers/local-filesystem-sandbox.js';
import { TestSandboxProvider } from '../sandbox/providers/test-sandbox-provider.js';
import {
  PolicyDeniedError,
  PolicyApprovalRequiredError,
  SandboxDeniedError,
  SandboxUnavailableError,
} from '../errors.js';

/**
 * A prova da Fase 5 (spec secoes 156-164, 178): cada camada tem
 * responsabilidade distinta, e o Sandbox fica ENTRE a autoridade e a
 * execucao fisica.
 */

const PROFILE = {
  runtimeMaxMode: 'workspace-write',
  allowPartialEnforcement: true,
  requiredEnforcement: 'partial',
  capabilities: {
    filesystem: {
      maxMode: 'workspace-write',
      operations: {
        read: { requires: 'read-only' },
        write: { requires: 'workspace-write' },
        delete: { requires: 'workspace-write' },
      },
    },
  },
};

/**
 * Monta o runtime completo com Sandbox. `profile` permite apertar o teto
 * (read-only), e `sandboxProvider` permite trocar o backend.
 */
function build({ profileOverrides = {}, sandboxProvider = null, tempRoot = null, policies = null } = {}) {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'sbx-int-'));
  const sandboxProviderRegistry = new SandboxProviderRegistry();
  sandboxProviderRegistry.register(
    sandboxProvider ?? new LocalFilesystemSandboxProvider({ tempRoot }),
  );
  const document = { ...PROFILE, ...profileOverrides };
  const sandboxProfileResolver = new SandboxProfileResolver({ document, workspaceRoot });
  const runtime = createRuntime({ sandboxProviderRegistry, sandboxProfileResolver });
  const events = [];
  runtime.eventBus.subscribe('*', (event) => events.push(event));

  runtime.capabilityRegistry.register(filesystemCapability);
  runtime.providerRegistry.register(new LocalFilesystemProvider({ workspaceRoot }));
  for (const tool of filesystemTools()) runtime.toolRuntime.register(tool);
  runtime.policyRegistry.registerMany(policies ?? [{
    id: 'oracle-workspace',
    effect: 'allow',
    principal: 'oracle',
    capability: 'filesystem',
    resources: ['filesystem/workspace/*'],
  }]);
  return {
    runtime, workspaceRoot, events,
    types: () => events.map((e) => e.type),
    cleanup: () => rmSync(workspaceRoot, { recursive: true, force: true }),
  };
}

const ctx = { agentId: 'oracle', session: { id: 'sess_sbx' } };

test('workspace-write: read, write e delete acontecem; fora do workspace nao (secao 111)', async () => {
  const env = build();
  try {
    await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.write', input: { path: 'src/a.js', content: 'export const a = 1;' } }, ctx,
    );
    assert.ok(existsSync(path.join(env.workspaceRoot, 'src', 'a.js')));
    const read = await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.read', input: { path: 'src/a.js' } }, ctx,
    );
    assert.equal(read.output, 'export const a = 1;');
    await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.delete', input: { path: 'src/a.js' } }, ctx,
    );
    assert.ok(!existsSync(path.join(env.workspaceRoot, 'src', 'a.js')));
    // fora do workspace morre na Policy, antes do Sandbox (defesa em camadas)
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'filesystem.write', input: { path: '../fora.js', content: 'x' } }, ctx),
      PolicyDeniedError,
    );
  } finally {
    env.cleanup();
  }
});

test('read-only: leitura passa, escrita e delete viram SandboxDeniedError (secoes 110, 117)', async () => {
  const env = build({
    profileOverrides: {
      runtimeMaxMode: 'read-only',
      capabilities: { filesystem: { maxMode: 'read-only', operations: PROFILE.capabilities.filesystem.operations } },
    },
  });
  try {
    // semeia direto no disco: a Policy permite, o Sandbox e que recusa
    mkdirSync(path.join(env.workspaceRoot, 'src'), { recursive: true });
    writeFileSync(path.join(env.workspaceRoot, 'src', 'b.js'), 'const b = 2;', 'utf8');
    const read = await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.read', input: { path: 'src/b.js' } }, ctx,
    );
    assert.equal(read.output, 'const b = 2;');
    for (const [toolId, input] of [
      ['filesystem.write', { path: 'src/c.js', content: 'x' }],
      ['filesystem.delete', { path: 'src/b.js' }],
    ]) {
      await assert.rejects(
        env.runtime.toolRuntime.execute({ toolId, input }, ctx),
        (error) => error instanceof SandboxDeniedError && error.requiredMode === 'workspace-write',
      );
    }
    // INV-505: nada foi tocado no disco
    assert.ok(existsSync(path.join(env.workspaceRoot, 'src', 'b.js')));
    assert.ok(!existsSync(path.join(env.workspaceRoot, 'src', 'c.js')));
    // secao 69: sandbox.denied sem tool.started nem provider.started
    const denied = env.events.filter((e) => e.type === 'sandbox.denied');
    assert.ok(denied.length >= 1);
    // a leitura legitima produziu provider.started; as mutantes, nenhuma
    const mutating = env.events.filter(
      (e) => e.type === 'provider.started' && ['write', 'delete'].includes(e.payload.operation),
    );
    assert.equal(mutating.length, 0, 'nenhuma execucao fisica mutante foi iniciada');
    assert.equal(
      env.events.filter((e) => e.type === 'provider.started').length, 1,
      'so a leitura chegou ao Provider',
    );
  } finally {
    env.cleanup();
  }
});

test('sequencia de eventos congelada, com sandbox antes da execucao (secao 68)', async () => {
  const env = build();
  try {
    await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.write', input: { path: 'x.js', content: 'x' } }, ctx,
    );
    assert.deepEqual(env.types(), [
      'tool.requested',
      // Fase 8: o efeito unico da escrita e resolvido e avaliado
      'effect.resolved', 'effect.evaluated',
      'policy.evaluated',
      'sandbox.requested',
      'sandbox.applied',
      'tool.started',
      'provider.started',
      'provider.completed',
      'tool.completed',
      'sandbox.released',
    ]);
    const applied = env.events.find((e) => e.type === 'sandbox.applied');
    // secao 123/150: modo, enforcement e providerId — nunca roots
    assert.equal(applied.payload.mode, 'workspace-write');
    assert.equal(applied.payload.enforcement, 'partial');
    assert.equal(applied.payload.providerId, 'local-filesystem-sandbox');
    assert.ok(!JSON.stringify(env.events).includes(env.workspaceRoot), 'secao 71: roots nao vao ao bus');
  } finally {
    env.cleanup();
  }
});

test('Policy deny impede a aplicacao do Sandbox (secoes 112, 158)', async () => {
  const env = build({ policies: [{
    id: 'no-write', effect: 'deny', capability: 'filesystem', operations: ['write'],
  }] });
  try {
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'filesystem.write', input: { path: 'x.js', content: 'x' } }, ctx),
      PolicyDeniedError,
    );
    assert.ok(!env.types().includes('sandbox.requested'), 'INV-513: sandbox nem foi pedido');
    assert.ok(!env.types().includes('provider.started'));
  } finally {
    env.cleanup();
  }
});

test('Policy deny vence mesmo com danger-full-access (secao 112, INV-501)', async () => {
  const env = build({
    profileOverrides: {
      runtimeMaxMode: 'danger-full-access',
      capabilities: { filesystem: { maxMode: 'danger-full-access', operations: {
        read: { requires: 'read-only' }, write: { requires: 'danger-full-access' },
        delete: { requires: 'workspace-write' },
      } } },
    },
    policies: [{ id: 'no-write', effect: 'deny', capability: 'filesystem', operations: ['write'] }],
  });
  try {
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'filesystem.write', input: { path: 'x.js', content: 'x' } }, ctx),
      PolicyDeniedError,
    );
    assert.ok(!env.types().includes('sandbox.requested'));
  } finally {
    env.cleanup();
  }
});

test('Approval pendente impede a aplicacao do Sandbox (secoes 113, 159)', async () => {
  const env = build({ policies: [{
    id: 'write-needs-founder', effect: 'approval-required', capability: 'filesystem', operations: ['write'],
  }] });
  try {
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'filesystem.write', input: { path: 'x.js', content: 'x' } }, ctx),
      PolicyApprovalRequiredError,
    );
    // secao 104: nao inicializar ambiente para operacao nunca autorizada
    assert.ok(!env.types().includes('sandbox.requested'));
    assert.ok(!env.types().includes('provider.started'));
  } finally {
    env.cleanup();
  }
});

test('Approval aprovado: revalidacao, entao Sandbox, entao Provider (secoes 114, 160)', async () => {
  const env = build({ policies: [{
    id: 'write-needs-founder', effect: 'approval-required', capability: 'filesystem', operations: ['write'],
  }] });
  try {
    let approvalId = null;
    try {
      await env.runtime.toolRuntime.execute(
        { toolId: 'filesystem.write', input: { path: 'gated.js', content: 'aprovado' } }, ctx,
      );
    } catch (error) {
      approvalId = error.approvalId;
    }
    assert.ok(approvalId);
    await env.runtime.approvalManager.approve(approvalId, { decidedBy: 'founder' });
    const result = await env.runtime.approvalManager.resume(approvalId);
    assert.ok(result.ok);
    assert.equal(readFileSync(path.join(env.workspaceRoot, 'gated.js'), 'utf8'), 'aprovado');
    // secao 103: o sandbox e reconstruido no resume, nao reaproveitado
    const applied = env.events.filter((e) => e.type === 'sandbox.applied');
    assert.equal(applied.length, 1, 'aplicado uma vez, no resume');
    const order = env.types();
    assert.ok(order.indexOf('approval.resumed') < order.indexOf('sandbox.applied'));
    assert.ok(order.indexOf('sandbox.applied') < order.indexOf('provider.started'));
  } finally {
    env.cleanup();
  }
});

test('policy mudou entre approve e resume: sem Sandbox, sem Provider (secoes 115, 161)', async () => {
  const env = build({ policies: [{
    id: 'write-needs-founder', effect: 'approval-required', capability: 'filesystem', operations: ['write'],
  }] });
  try {
    let approvalId = null;
    try {
      await env.runtime.toolRuntime.execute(
        { toolId: 'filesystem.write', input: { path: 'never.js', content: 'x' } }, ctx,
      );
    } catch (error) {
      approvalId = error.approvalId;
    }
    await env.runtime.approvalManager.approve(approvalId, { decidedBy: 'founder' });
    // o Founder aprovou, mas a policy virou deny antes do resume
    env.runtime.policyRegistry.register({
      id: 'hard-deny', effect: 'deny', capability: 'filesystem', operations: ['write'],
    });
    await assert.rejects(env.runtime.approvalManager.resume(approvalId));
    assert.ok(!env.types().includes('sandbox.applied'), 'INV-513');
    assert.ok(!env.types().includes('provider.started'));
    assert.ok(!existsSync(path.join(env.workspaceRoot, 'never.js')));
  } finally {
    env.cleanup();
  }
});

test('Sandbox indisponivel: fail closed, zero execucao (secoes 116, 163)', async () => {
  // pede enforcement full; o backend local so entrega partial (secao 125)
  const env = build({ profileOverrides: { requiredEnforcement: 'full', allowPartialEnforcement: false } });
  try {
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'filesystem.write', input: { path: 'x.js', content: 'x' } }, ctx),
      SandboxUnavailableError,
    );
    assert.deepEqual(env.types(), ['tool.requested', 'effect.resolved', 'effect.evaluated', 'policy.evaluated', 'sandbox.requested', 'sandbox.failed']);
    assert.ok(!existsSync(path.join(env.workspaceRoot, 'x.js')));
  } finally {
    env.cleanup();
  }
});

test('cleanup acontece no sucesso, na falha e no cancelamento (secoes 118-121, 162)', async () => {
  // sucesso e falha com backend de lifecycle, para contar disposes
  const provider = new TestSandboxProvider();
  const env = build({
    sandboxProvider: provider,
    profileOverrides: { requiredEnforcement: 'none' }, // backend honesto: none
  });
  try {
    await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.write', input: { path: 'ok.js', content: 'x' } }, ctx,
    );
    assert.equal(provider.disposed, 1, 'sucesso libera o sandbox');
    // falha do Provider: delete de arquivo inexistente
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'filesystem.delete', input: { path: 'nao-existe.js' } }, ctx),
    );
    assert.equal(provider.disposed, 2, 'falha tambem libera (secao 119)');
    const released = env.events.filter((e) => e.type === 'sandbox.released');
    assert.equal(released.length, 2);
    // secao 118: provider.failed + tool.failed + sandbox.released
    const tail = env.types().slice(-4);
    assert.deepEqual(tail, ['provider.started', 'provider.failed', 'tool.failed', 'sandbox.released']);
  } finally {
    env.cleanup();
  }
});

test('falha de cleanup nao falsifica o resultado da operacao (secao 66)', async () => {
  const provider = new TestSandboxProvider({ failDispose: new Error('handle preso') });
  const env = build({
    sandboxProvider: provider,
    profileOverrides: { requiredEnforcement: 'none' },
  });
  try {
    const result = await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.write', input: { path: 'ok.js', content: 'x' } }, ctx,
    );
    assert.deepEqual(result.output, { written: true }, 'a operacao principal foi bem-sucedida');
    assert.ok(env.types().includes('tool.completed'), 'nao vira tool.failed');
    assert.ok(env.types().includes('sandbox.cleanup.failed'), 'mas a falha e observavel');
    const released = env.events.find((e) => e.type === 'sandbox.released');
    assert.equal(released.payload.cleanupFailed, true);
  } finally {
    env.cleanup();
  }
});

test('duas Sessions nao compartilham temp de sandbox (secoes 47, 108)', async () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'sbx-sessions-'));
  const seen = [];
  const env = build({ tempRoot });
  try {
    env.runtime.eventBus.subscribe('sandbox.applied', () => {});
    const provider = new LocalFilesystemSandboxProvider({ tempRoot });
    const { createSandboxPolicy } = await import('../sandbox/sandbox-policy.js');
    const policy = createSandboxPolicy({
      mode: 'workspace-write', workspaceRoot: env.workspaceRoot, requiredEnforcement: 'partial',
    });
    for (const sessionId of ['sess_A', 'sess_B']) {
      const handle = await provider.apply(policy, { sessionId, agentId: 'oracle' });
      seen.push(handle.sessionTemp);
      writeFileSync(path.join(handle.sessionTemp, 'segredo.txt'), sessionId, 'utf8');
    }
    assert.notEqual(seen[0], seen[1], 'cada Session tem seu proprio temp');
    // e o boundary de uma nao alcanca o da outra
    const handleA = await provider.apply(policy, { sessionId: 'sess_A', agentId: 'oracle' });
    assert.throws(() => handleA.assertPathAllowed(path.join(seen[1], 'segredo.txt'), 'read'), SandboxDeniedError);
    await handleA.dispose();
  } finally {
    env.cleanup();
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('invariantes do Provider seguem valendo com Sandbox ativo (secoes 39-40, 164)', async () => {
  const env = build();
  try {
    // R12 da Fase 4: deletar a raiz continua proibido pelo Provider
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'filesystem.delete', input: { path: '.' } }, ctx),
      PolicyDeniedError, // '.' canonicaliza para outside-workspace: morre na Policy
    );
    // e o binding resource <-> path fisico continua intacto
    await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.write', input: { path: './src/dup.js', content: 'x' } }, ctx,
    );
    assert.ok(existsSync(path.join(env.workspaceRoot, 'src', 'dup.js')));
  } finally {
    env.cleanup();
  }
});

test('o Agent nao alcanca sandbox algum (secoes 22, 87, 167, INV-522/523)', async () => {
  const env = build();
  try {
    const { Agent } = await import('../agent/agent.js');
    let seen = null;
    class Probe extends Agent {
      async run(context) {
        seen = context;
        const result = await context.runtime.requestTool('filesystem.write', { path: 'p.js', content: 'x' });
        return result.output;
      }
    }
    const agent = new Probe({ id: 'oracle', name: 'Oracle', instructions: 'escreva' });
    const session = env.runtime.createSession({ agentId: 'oracle', mission: 'probe' });
    const result = await env.runtime.loop.run(agent, session);
    assert.equal(result.status, 'completed');
    assert.deepEqual(Object.keys(seen).sort(), ['mission', 'runtime', 'session']);
    assert.deepEqual(Object.keys(seen.runtime), ['requestTool']);
    for (const forbidden of [
      'sandbox', 'sandboxMode', 'sandboxProvider', 'sandboxPolicy', 'sandboxHandle', 'sandboxResolver',
    ]) {
      assert.equal(seen[forbidden], undefined);
      assert.equal(seen.runtime[forbidden], undefined);
      assert.equal(seen.session[forbidden], undefined);
    }
  } finally {
    env.cleanup();
  }
});

test('SandboxExecutionContext: superficie exata e congelada (secoes 21, 165)', async () => {
  const captured = [];
  class Spy extends TestSandboxProvider {
    async apply(policy, context) {
      captured.push(context);
      return super.apply(policy, context);
    }
  }
  const env = build({ sandboxProvider: new Spy(), profileOverrides: { requiredEnforcement: 'none' } });
  try {
    await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.write', input: { path: 'ctx.js', content: 'x' } }, ctx,
    );
    const context = captured[0];
    assert.deepEqual(Object.keys(context), [
      'sessionId', 'agentId', 'capabilityId', 'operation', 'resource', 'sandboxMode', 'workspaceRoot',
    ]);
    assert.ok(Object.isFrozen(context));
    assert.equal(context.sessionId, 'sess_sbx');
    assert.equal(context.agentId, 'oracle');
    assert.equal(context.sandboxMode, 'workspace-write');
    // INV-522: nenhuma autoridade desce ao backend de sandbox
    for (const forbidden of ['policyEngine', 'toolRuntime', 'eventBus', 'approvalManager', 'registry']) {
      assert.equal(context[forbidden], undefined);
    }
  } finally {
    env.cleanup();
  }
});
