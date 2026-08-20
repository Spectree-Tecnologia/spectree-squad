import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRuntime } from '../index.js';
import { SandboxProviderRegistry } from '../sandbox/sandbox-provider-registry.js';
import { SandboxProfileResolver } from '../sandbox/sandbox-profile-resolver.js';
import { LocalFilesystemSandboxProvider } from '../sandbox/providers/local-filesystem-sandbox.js';
import { ToolError, SandboxConfigurationError, SandboxDeniedError } from '../errors.js';

/**
 * R13 — classificacao de execucao de Tool. O efeito fisico nao muda de
 * natureza por a tool carregar o proprio execute(): tool self-provided
 * 'physical' passa pela MESMA fronteira de Sandbox que a rota
 * provider-backed, e tool 'pure' fica explicitamente fora dela — a
 * decisao mora no registro, nunca implicita.
 */

const PROFILE = {
  runtimeMaxMode: 'workspace-write',
  allowPartialEnforcement: true,
  requiredEnforcement: 'partial',
  capabilities: {
    notes: {
      maxMode: 'workspace-write',
      operations: {
        format: { requires: 'read-only' },
        write: { requires: 'workspace-write' },
      },
    },
  },
};

function build({ runtimeMaxMode = 'workspace-write' } = {}) {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'sbx-r13-'));
  const sandboxProviderRegistry = new SandboxProviderRegistry();
  sandboxProviderRegistry.register(new LocalFilesystemSandboxProvider());
  const sandboxProfileResolver = new SandboxProfileResolver({
    document: {
      ...PROFILE,
      runtimeMaxMode,
      capabilities: { notes: { maxMode: runtimeMaxMode, operations: PROFILE.capabilities.notes.operations } },
    },
    workspaceRoot,
  });
  const runtime = createRuntime({ sandboxProviderRegistry, sandboxProfileResolver });
  const events = [];
  runtime.eventBus.subscribe('*', (event) => events.push(event));
  runtime.capabilityRegistry.register({
    id: 'notes', name: 'Notes', description: 'd', operations: ['format', 'write'],
  });
  runtime.policyRegistry.register({
    id: 'allow-notes', effect: 'allow', principal: 'oracle', capability: 'notes',
  });
  return {
    runtime, workspaceRoot, events,
    types: () => events.map((e) => e.type),
    cleanup: () => rmSync(workspaceRoot, { recursive: true, force: true }),
  };
}

const ctx = { agentId: 'oracle', session: { id: 'sess_r13' } };

test('R13: registro — self-provided sem classificacao nao entra em runtime com sandbox', () => {
  const env = build();
  try {
    // sem classificacao: fail closed, fail early
    assert.throws(
      () => env.runtime.toolRuntime.register({
        id: 'notes.mystery', name: 'm', description: 'm',
        capability: 'notes', operation: 'write', execute: async () => 'x',
      }),
      SandboxConfigurationError,
    );
    // classificacao invalida e erro de Tool
    assert.throws(
      () => env.runtime.toolRuntime.register({
        id: 'notes.weird', name: 'w', description: 'w', execution: 'quantum',
        capability: 'notes', operation: 'write', execute: async () => 'x',
      }),
      ToolError,
    );
    // as duas classificacoes validas registram
    env.runtime.toolRuntime.register({
      id: 'notes.format', name: 'f', description: 'f', execution: 'pure',
      capability: 'notes', operation: 'format', execute: async () => 'ok',
    });
    env.runtime.toolRuntime.register({
      id: 'notes.write', name: 'w', description: 'w', execution: 'physical',
      capability: 'notes', operation: 'write', execute: async () => 'ok',
    });
    // provider-backed (sem execute) nao exige classificacao: e fisica por
    // definicao e ja passa pela fronteira
    env.runtime.toolRuntime.register({
      id: 'notes.backed', name: 'b', description: 'b', capability: 'notes', operation: 'write',
    });
  } finally {
    env.cleanup();
  }
});

test('R13: runtime SEM sandbox configurado aceita tool sem classificacao (fases 1-4)', async () => {
  const runtime = createRuntime();
  runtime.capabilityRegistry.register({ id: 'notes', name: 'n', description: 'd', operations: ['format'] });
  runtime.policyRegistry.register({ id: 'allow', effect: 'allow', capability: 'notes' });
  runtime.toolRuntime.register({
    id: 'notes.legacy', name: 'l', description: 'l',
    capability: 'notes', operation: 'format', execute: async () => 'legacy-ok',
  });
  const result = await runtime.toolRuntime.execute({ toolId: 'notes.legacy', input: {} }, ctx);
  assert.equal(result.output, 'legacy-ok');
});

test('R13: rota pure — executa sem fronteira, e isso e explicito', async () => {
  const env = build();
  try {
    let seenContext = null;
    env.runtime.toolRuntime.register({
      id: 'notes.format', name: 'f', description: 'f', execution: 'pure',
      capability: 'notes', operation: 'format',
      execute: async (input, context) => { seenContext = context; return 'formatted'; },
    });
    const result = await env.runtime.toolRuntime.execute({ toolId: 'notes.format', input: {} }, ctx);
    assert.equal(result.output, 'formatted');
    // nenhum evento de sandbox: pure nao passa pela fronteira
    assert.deepEqual(env.types(), ['tool.requested', 'policy.evaluated', 'tool.started', 'tool.completed']);
    // e o contexto continua minimo (INV-002): sem handle
    assert.deepEqual(Object.keys(seenContext), ['sessionId', 'agentId']);
  } finally {
    env.cleanup();
  }
});

test('R13: rota physical — mesma fronteira da rota provider-backed', async () => {
  const env = build();
  try {
    let seenContext = null;
    env.runtime.toolRuntime.register({
      id: 'notes.write', name: 'w', description: 'w', execution: 'physical',
      capability: 'notes', operation: 'write',
      execute: async (input, context) => { seenContext = context; return 'written'; },
    });
    const result = await env.runtime.toolRuntime.execute({ toolId: 'notes.write', input: {} }, ctx);
    assert.equal(result.output, 'written');
    assert.deepEqual(env.types(), [
      'tool.requested', 'policy.evaluated',
      'sandbox.requested', 'sandbox.applied',
      'tool.started', 'tool.completed',
      'sandbox.released',
    ]);
    // a tool recebe o HANDLE — a mesma porta que o Provider usa
    assert.deepEqual(Object.keys(seenContext), ['sessionId', 'agentId', 'sandbox']);
    assert.equal(seenContext.sandbox.mode, 'workspace-write');
    assert.equal(seenContext.sandbox.enforcement, 'partial');
    assert.equal(typeof seenContext.sandbox.assertPathAllowed, 'function');
  } finally {
    env.cleanup();
  }
});

test('R13: physical sob teto read-only — SandboxDeniedError e execute() nunca roda', async () => {
  const env = build({ runtimeMaxMode: 'read-only' });
  try {
    let executed = 0;
    env.runtime.toolRuntime.register({
      id: 'notes.write', name: 'w', description: 'w', execution: 'physical',
      capability: 'notes', operation: 'write',
      execute: async () => { executed += 1; return 'x'; },
    });
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'notes.write', input: {} }, ctx),
      (error) => error instanceof SandboxDeniedError && error.requiredMode === 'workspace-write',
    );
    assert.equal(executed, 0, 'o efeito fisico nunca aconteceu');
    assert.deepEqual(env.types(), ['tool.requested', 'policy.evaluated', 'sandbox.requested', 'sandbox.denied']);
  } finally {
    env.cleanup();
  }
});

test('R13: physical que falha — cleanup roda e a sequencia termina em sandbox.released', async () => {
  const env = build();
  try {
    env.runtime.toolRuntime.register({
      id: 'notes.write', name: 'w', description: 'w', execution: 'physical',
      capability: 'notes', operation: 'write',
      execute: async () => { throw new Error('disco cheio'); },
    });
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'notes.write', input: {} }, ctx),
      /disco cheio/,
    );
    assert.deepEqual(env.types(), [
      'tool.requested', 'policy.evaluated',
      'sandbox.requested', 'sandbox.applied',
      'tool.started', 'tool.failed',
      'sandbox.released',
    ]);
  } finally {
    env.cleanup();
  }
});
