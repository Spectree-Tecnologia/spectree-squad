import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRuntime } from '../index.js';
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
import { LocalFilesystemSandboxProvider } from '../sandbox/providers/local-filesystem-sandbox.js';
import { canonicalFilesystemPath } from '../effects/resource-ref.js';
import {
  EffectAuthorizationError,
  SandboxConfigurationError,
} from '../errors.js';

/**
 * Integracao da F8 (spec secoes 24-34, 44, 48, 72, 80, 85): o modelo de
 * efeitos atravessando o runtime REAL — process, filesystem e sandbox.
 */

const NODE = process.execPath;

function build({ policies, profile = null }) {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'fx-int-'));
  const options = {};
  if (profile) {
    const sandboxProviderRegistry = new SandboxProviderRegistry();
    sandboxProviderRegistry.register(new LocalFilesystemSandboxProvider());
    options.sandboxProviderRegistry = sandboxProviderRegistry;
    options.sandboxProfileResolver = new SandboxProfileResolver({ document: profile, workspaceRoot });
  }
  const processRegistry = new ProcessRegistry();
  options.processRegistry = processRegistry;
  const runtime = createRuntime(options);
  const events = [];
  runtime.eventBus.subscribe('*', (event) => events.push(event));
  runtime.capabilityRegistry.register(filesystemCapability);
  runtime.capabilityRegistry.register(processCapability);
  runtime.providerRegistry.register(new LocalFilesystemProvider({ workspaceRoot }));
  runtime.providerRegistry.register(new LocalSubprocessProvider({
    workspaceRoot,
    hostEnv: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '' },
    registry: processRegistry,
    emit: (type, envelope) => runtime.eventBus.publish(type, envelope),
  }));
  for (const tool of [...filesystemTools(), ...processTools()]) runtime.toolRuntime.register(tool);
  runtime.policyRegistry.registerMany(policies);
  return {
    runtime, workspaceRoot, events,
    types: () => events.map((e) => e.type),
    cleanup: () => rmSync(workspaceRoot, { recursive: true, force: true }),
  };
}

const ctx = { agentId: 'oracle', session: { id: 'sess_fxi' } };
const stdio = { stdin: { mode: 'ignore' }, stdout: { mode: 'collect' }, stderr: { mode: 'collect' } };

test('process + multi-effect: world e executavel autorizados por si, fingerprint correlaciona tudo (secoes 24-25, 72)', async () => {
  const env = build({
    policies: [
      { id: 'oracle-process', effect: 'allow', principal: 'oracle', capability: 'process', operations: ['spawn'], resources: ['workspace*', 'executable/*'] },
    ],
    profile: {
      runtimeMaxMode: 'danger-full-access',
      allowPartialEnforcement: true,
      requiredEnforcement: 'partial',
      capabilities: { process: { operations: { spawn: { requires: 'danger-full-access' } } } },
    },
  });
  try {
    const result = await env.runtime.toolRuntime.execute(
      { toolId: 'process.spawn', input: { argv: [NODE, '-e', '1'], cwd: '.', ...stdio } }, ctx,
    );
    assert.equal(result.output.outcome.exitCode, 0);
    const resolved = env.events.find((e) => e.type === 'effect.resolved');
    assert.equal(resolved.payload.effectCount, 2, 'world + executavel');
    const evaluated = env.events.filter((e) => e.type === 'effect.evaluated');
    assert.deepEqual(
      evaluated.map((e) => e.payload.resource).sort(),
      ['process://executable/node', 'process://workspace'],
    );
    // secao 72: o MESMO fingerprint em resolucao, decisao, policy e sandbox
    const fingerprint = resolved.payload.effectSetFingerprint;
    assert.ok(evaluated.every((e) => e.payload.effectSetFingerprint === fingerprint));
    assert.equal(env.events.find((e) => e.type === 'policy.evaluated').payload.effectSetFingerprint, fingerprint);
    assert.equal(env.events.find((e) => e.type === 'sandbox.applied').payload.effectSetFingerprint, fingerprint);
  } finally {
    env.cleanup();
  }
});

test('cwd nao e autoridade: comecar no workspace nao autoriza o executavel (secoes 80, INV-802)', async () => {
  // a policy autoriza APENAS o execution world — sem 'executable/*'.
  // Antes da F8, cwd='.' bastava; agora o efeito do executavel morre no
  // default deny e NENHUM processo nasce.
  const env = build({
    policies: [
      { id: 'world-only', effect: 'allow', principal: 'oracle', capability: 'process', operations: ['spawn'], resources: ['workspace*'] },
    ],
  });
  try {
    await assert.rejects(
      env.runtime.toolRuntime.execute(
        { toolId: 'process.spawn', input: { argv: [NODE, '-e', '1'], cwd: '.', ...stdio } }, ctx,
      ),
      (error) => error instanceof EffectAuthorizationError
        && error.deniedEffect.resource === 'process://executable/node',
    );
    assert.ok(!env.types().includes('process.requested'), 'zero spawn');
    assert.ok(!env.types().includes('tool.started'));
  } finally {
    env.cleanup();
  }
});

test('filesystem + multi-effect + same-world: o efeito autorizado e o efeito fisico (secoes 32, 85)', async () => {
  const env = build({
    policies: [
      { id: 'oracle-fs', effect: 'allow', principal: 'oracle', capability: 'filesystem', resources: ['filesystem/workspace*'] },
    ],
  });
  try {
    // write autorizado pelo efeito canonico do alias './docs/../a.txt'
    await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.write', input: { path: './docs/../a.txt', content: 'same model' } }, ctx,
    );
    const evaluated = env.events.find((e) => e.type === 'effect.evaluated');
    assert.equal(evaluated.payload.resource, 'filesystem://workspace/a.txt', 'alias canonicalizado (secao 36)');
    // secao 85: o mesmo resource model le o que escreveu
    const read = await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.read', input: { path: 'a.txt' } }, ctx,
    );
    assert.equal(read.output, 'same model');
  } finally {
    env.cleanup();
  }
});

test('sandbox consome o conjunto: o modo vem dos efeitos, nunca ampliado por eles (secoes 28-31)', async () => {
  const profile = {
    runtimeMaxMode: 'workspace-write',
    allowPartialEnforcement: true,
    requiredEnforcement: 'partial',
    capabilities: {
      filesystem: {
        operations: { read: { requires: 'read-only' }, write: { requires: 'workspace-write' } },
      },
    },
  };
  const env = build({
    policies: [
      { id: 'oracle-fs', effect: 'allow', principal: 'oracle', capability: 'filesystem', resources: ['filesystem/workspace*'] },
    ],
    profile,
  });
  try {
    // tool fisica cuja operacao declarada e 'write', mas cujo CONJUNTO
    // resolvido so tem read: o modo derivado e read-only — o teto
    // efetivo segue o conjunto autorizado, nao a etiqueta da tool
    env.runtime.toolRuntime.register({
      id: 'fs.snapshot', name: 's', description: 'le sem escrever',
      capability: 'filesystem', operation: 'write', execution: 'physical',
      resolveEffects: (input) => [{
        kind: 'filesystem', operation: 'read',
        resource: { type: 'filesystem', id: canonicalFilesystemPath(input.path) },
      }],
      execute: async (input, context) => {
        // a boundary recebida e de read-only: escrever fora dela lanca
        assert.equal(context.sandbox.mode, 'read-only');
        return 'snapshot';
      },
    });
    const result = await env.runtime.toolRuntime.execute(
      { toolId: 'fs.snapshot', input: { path: 'a.txt' } }, ctx,
    );
    assert.equal(result.output, 'snapshot');
    const applied = env.events.find((e) => e.type === 'sandbox.applied');
    assert.equal(applied.payload.mode, 'read-only', 'o conjunto REDUZIU o modo');

    // efeito de kind/operation nao classificado no perfil: fail closed
    env.runtime.toolRuntime.register({
      id: 'fs.rogue-kind', name: 'r', description: 'efeito sem perfil',
      capability: 'filesystem', operation: 'write', execution: 'physical',
      resolveEffects: () => [{
        kind: 'filesystem', operation: 'delete',
        resource: { type: 'filesystem', id: 'workspace/x' },
      }],
      execute: async () => 'nunca',
    });
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'fs.rogue-kind', input: {} }, ctx),
      SandboxConfigurationError,
    );
  } finally {
    env.cleanup();
  }
});

test('ordem congelada com efeitos: nenhum sinal fisico antes da autorizacao completa (secao 48)', async () => {
  const env = build({
    policies: [
      { id: 'oracle-fs', effect: 'allow', principal: 'oracle', capability: 'filesystem', resources: ['filesystem/workspace*'] },
    ],
  });
  try {
    await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.write', input: { path: 'x.txt', content: 'x' } }, ctx,
    );
    assert.deepEqual(env.types(), [
      'tool.requested',
      'effect.resolved', 'effect.evaluated',
      'policy.evaluated',
      'tool.started', 'provider.started', 'provider.completed', 'tool.completed',
    ]);
  } finally {
    env.cleanup();
  }
});
