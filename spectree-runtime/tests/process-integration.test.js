import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
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
import {
  PolicyDeniedError,
  PolicyApprovalRequiredError,
  SandboxDeniedError,
  CapabilityError,
  ProcessCwdError,
} from '../errors.js';

/**
 * A prova arquitetural da Fase 6 (spec secoes 158-168, 173):
 *
 *   Tool -> Policy -> Approval -> Capability process -> Sandbox
 *        -> LocalSubprocessProvider -> OS Process
 *
 * e filesystem + process compartilham o MESMO execution world (INV-630).
 */

const NODE = process.execPath;

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
    process: {
      maxMode: 'workspace-write',
      // R14: nenhum backend confina processo hoje, entao um modo que
      // PROMETE confinement nao pode pari-lo. Executar exige declarar
      // 'danger-full-access' — a execucao nao confinada vira escolha
      // explicita do operador, nunca efeito colateral de um modo que
      // diz "workspace"
      operations: { spawn: { requires: 'danger-full-access' }, terminate: { requires: 'workspace-write' } },
    },
  },
};

function build({
  runtimeMaxMode = 'danger-full-access',
  spawnRequires = 'danger-full-access',
  policies = null,
} = {}) {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'prc-int-'));
  const sandboxProviderRegistry = new SandboxProviderRegistry();
  sandboxProviderRegistry.register(new LocalFilesystemSandboxProvider());
  const sandboxProfileResolver = new SandboxProfileResolver({
    document: {
      ...PROFILE,
      runtimeMaxMode,
      capabilities: {
        filesystem: { ...PROFILE.capabilities.filesystem, maxMode: runtimeMaxMode },
        process: {
          ...PROFILE.capabilities.process,
          maxMode: runtimeMaxMode,
          operations: {
            ...PROFILE.capabilities.process.operations,
            spawn: { requires: spawnRequires },
          },
        },
      },
    },
    workspaceRoot,
  });
  const processRegistry = new ProcessRegistry();
  const runtime = createRuntime({ sandboxProviderRegistry, sandboxProfileResolver, processRegistry });
  const events = [];
  runtime.eventBus.subscribe('*', (event) => events.push(event));

  runtime.capabilityRegistry.register(filesystemCapability);
  runtime.capabilityRegistry.register(processCapability);
  runtime.providerRegistry.register(new LocalFilesystemProvider({ workspaceRoot }));
  runtime.providerRegistry.register(new LocalSubprocessProvider({
    workspaceRoot,
    hostEnv: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', HOST_SECRET: 'nunca' },
    registry: processRegistry,
    emit: (type, envelope) => runtime.eventBus.publish(type, envelope),
  }));
  for (const tool of filesystemTools()) runtime.toolRuntime.register(tool);
  for (const tool of processTools()) runtime.toolRuntime.register(tool);
  runtime.policyRegistry.registerMany(policies ?? [
    {
      id: 'oracle-workspace', effect: 'allow', principal: 'oracle',
      capability: 'filesystem', resources: ['filesystem/workspace*'],
    },
    {
      id: 'oracle-process', effect: 'allow', principal: 'oracle',
      capability: 'process', operations: ['spawn'], resources: ['workspace*'],
    },
  ]);
  return {
    runtime, workspaceRoot, processRegistry, events,
    types: () => events.map((e) => e.type),
    cleanup: () => rmSync(workspaceRoot, { recursive: true, force: true }),
  };
}

const ctx = { agentId: 'oracle', session: { id: 'sess_p6' } };

function spawnInput(overrides = {}) {
  return {
    argv: [NODE, '-e', "console.log('governed')"],
    cwd: '.',
    stdin: { mode: 'ignore' },
    stdout: { mode: 'collect' },
    stderr: { mode: 'collect' },
    ...overrides,
  };
}

test('cadeia completa: Policy -> Sandbox -> Provider -> OS process (secao 173)', async () => {
  const env = build();
  try {
    const result = await env.runtime.toolRuntime.execute(
      { toolId: 'process.spawn', input: spawnInput() }, ctx,
    );
    assert.equal(result.output.outcome.exitCode, 0);
    assert.equal(result.output.stdout.text.trim(), 'governed');
    // ordem congelada (secao 60), com process.* entre provider.started e completed
    assert.deepEqual(env.types(), [
      'tool.requested', 'policy.evaluated',
      'sandbox.requested', 'sandbox.applied',
      'tool.started', 'provider.started',
      'process.requested', 'process.resolved', 'process.started', 'process.exited',
      'provider.completed', 'tool.completed',
      'sandbox.released',
    ]);
  } finally {
    env.cleanup();
  }
});

test('same-world: processo cria arquivo, filesystem.read enxerga (secoes 142, 159, INV-630)', async () => {
  const env = build();
  try {
    await env.runtime.toolRuntime.execute(
      { toolId: 'process.spawn', input: spawnInput({
        argv: [NODE, '-e', "require('fs').writeFileSync('made-by-process.txt','same world')"],
      }) }, ctx,
    );
    const read = await env.runtime.toolRuntime.execute(
      { toolId: 'filesystem.read', input: { path: 'made-by-process.txt' } }, ctx,
    );
    assert.equal(read.output, 'same world');
  } finally {
    env.cleanup();
  }
});

test('Policy deny: zero sandbox, zero spawn (secao 158)', async () => {
  const env = build({ policies: [
    { id: 'no-process', effect: 'deny', capability: 'process' },
  ] });
  try {
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'process.spawn', input: spawnInput() }, ctx),
      PolicyDeniedError,
    );
    assert.ok(!env.types().includes('sandbox.requested'));
    assert.ok(!env.types().includes('process.started'));
  } finally {
    env.cleanup();
  }
});

test('Approval pendente: zero sandbox, zero spawn (secoes 134, 158)', async () => {
  const env = build({ policies: [
    { id: 'process-gate', effect: 'approval-required', capability: 'process', operations: ['spawn'] },
  ] });
  try {
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'process.spawn', input: spawnInput() }, ctx),
      PolicyApprovalRequiredError,
    );
    assert.ok(!env.types().includes('sandbox.requested'));
    assert.ok(!env.types().includes('process.requested'));
  } finally {
    env.cleanup();
  }
});

test('Approval aprovado + resume: revalida, reconstrui sandbox, spawn (secao 135)', async () => {
  const env = build({ policies: [
    { id: 'process-gate', effect: 'approval-required', capability: 'process', operations: ['spawn'] },
  ] });
  try {
    let approvalId = null;
    try {
      await env.runtime.toolRuntime.execute({ toolId: 'process.spawn', input: spawnInput() }, ctx);
    } catch (error) { approvalId = error.approvalId; }
    assert.ok(approvalId);
    await env.runtime.approvalManager.approve(approvalId, { decidedBy: 'founder' });
    const result = await env.runtime.approvalManager.resume(approvalId);
    assert.ok(result.ok);
    const order = env.types();
    assert.ok(order.indexOf('approval.resumed') < order.indexOf('sandbox.applied'));
    assert.ok(order.indexOf('sandbox.applied') < order.indexOf('process.started'));
  } finally {
    env.cleanup();
  }
});

test('Policy virou deny antes do resume: zero spawn (secao 136)', async () => {
  const env = build({ policies: [
    { id: 'process-gate', effect: 'approval-required', capability: 'process', operations: ['spawn'] },
  ] });
  try {
    let approvalId = null;
    try {
      await env.runtime.toolRuntime.execute({ toolId: 'process.spawn', input: spawnInput() }, ctx);
    } catch (error) { approvalId = error.approvalId; }
    await env.runtime.approvalManager.approve(approvalId, { decidedBy: 'founder' });
    env.runtime.policyRegistry.register({ id: 'hard-no', effect: 'deny', capability: 'process' });
    await assert.rejects(env.runtime.approvalManager.resume(approvalId));
    assert.ok(!env.types().includes('sandbox.applied'));
    assert.ok(!env.types().includes('process.started'));
  } finally {
    env.cleanup();
  }
});

test('teto read-only: spawn e negado pelo Sandbox, nao pela Policy (secao 158)', async () => {
  const env = build({ runtimeMaxMode: 'read-only' });
  try {
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'process.spawn', input: spawnInput() }, ctx),
      SandboxDeniedError,
    );
    assert.ok(env.types().includes('sandbox.denied'));
    assert.ok(!env.types().includes('process.requested'));
  } finally {
    env.cleanup();
  }
});

test('R14: modo que promete confinement nao pare processo — zero spawn', async () => {
  // o operador classifica spawn como workspace-write: autorizado pela
  // Policy, sandbox construido, e mesmo assim NENHUM processo nasce —
  // porque nenhum backend aplica esse limite a um processo do SO
  const env = build({ runtimeMaxMode: 'workspace-write', spawnRequires: 'workspace-write' });
  try {
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'process.spawn', input: spawnInput() }, ctx),
      (error) => error instanceof SandboxDeniedError
        && error.capabilityId === 'process'
        && /no backend physically enforces/.test(error.message),
    );
    // a recusa vem DEPOIS da autorizacao e do sandbox: e o ambiente, nao
    // a autoridade, que disse nao
    assert.ok(env.types().includes('policy.evaluated'));
    assert.ok(env.types().includes('sandbox.applied'));
    // e nada de processo aconteceu — nem o evento de pedido
    assert.ok(!env.types().includes('process.requested'));
    assert.ok(!env.types().includes('process.started'));
    assert.equal(env.processRegistry.list().length, 0);
    // sandbox liberado mesmo na recusa (secao 65 F5)
    assert.ok(env.types().includes('sandbox.released'));
  } finally {
    env.cleanup();
  }
});

test('R14: sob danger-full-access o mesmo spawn executa — a promessa e que muda', async () => {
  const env = build(); // danger-full-access: nao promete confinement
  try {
    const result = await env.runtime.toolRuntime.execute(
      { toolId: 'process.spawn', input: spawnInput() }, ctx,
    );
    assert.equal(result.output.outcome.exitCode, 0);
    // o processo recebe a verdade sobre o proprio confinamento
    const started = env.events.find((e) => e.type === 'process.started');
    assert.equal(started.payload.sandboxMode, 'danger-full-access');
  } finally {
    env.cleanup();
  }
});

test('cwd fora do workspace: morre na Policy via resource canonico (secoes 27-28)', async () => {
  const env = build();
  try {
    await assert.rejects(
      env.runtime.toolRuntime.execute(
        { toolId: 'process.spawn', input: spawnInput({ cwd: '../fora' }) }, ctx,
      ),
      PolicyDeniedError, // resource 'outside-workspace' nao casa 'workspace*'
    );
    assert.ok(!env.types().includes('process.requested'));
  } finally {
    env.cleanup();
  }
});

test('bypass: tool process.* com execute() proprio e recusada — nao existe terceira rota (secoes 121, 160)', async () => {
  const env = build();
  try {
    env.runtime.toolRuntime.register({
      id: 'process.rogue', name: 'r', description: 'r',
      capability: 'process', operation: 'spawn', execution: 'physical',
      // resource legitimo para a Policy PERMITIR — e provar que quem
      // recusa e o gate provider-only, nao o default deny
      resource: () => ({ type: 'process', id: 'workspace' }),
      execute: async () => 'spawnei por fora',
    });
    await assert.rejects(
      env.runtime.toolRuntime.execute({ toolId: 'process.rogue', input: spawnInput() }, ctx),
      (error) => error instanceof CapabilityError && /provider-only/.test(error.message),
    );
    assert.ok(!env.types().includes('tool.started'), 'zero execucao');
  } finally {
    env.cleanup();
  }
});

test('Session.cancel termina o processo vivo (secoes 68-69, INV-618)', async () => {
  const env = build();
  try {
    const session = env.runtime.createSession({ agentId: 'oracle', mission: 'long' });
    session.start();
    const pending = env.runtime.toolRuntime.execute(
      { toolId: 'process.spawn', input: spawnInput({
        argv: [NODE, '-e', 'setTimeout(()=>{},60000)'], graceMs: 300,
      }) },
      { agentId: 'oracle', session: { id: session.id } },
    );
    // espera o processo aparecer no registry
    let entry = null;
    for (let i = 0; i < 100 && !entry; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      entry = env.processRegistry.listBySession(session.id)[0] ?? null;
    }
    assert.ok(entry, 'processo registrado sob a session');
    session.cancel('teste');
    const result = await pending; // o provider conclui com o outcome do kill
    assert.ok(result.output.outcome.exitCode !== 0 || result.output.outcome.signal);
    assert.equal(env.processRegistry.listBySession(session.id).length, 0);
  } finally {
    env.cleanup();
  }
});

test('isolamento entre Sessions: A nao termina processo de B (secao 165, INV-617)', async () => {
  const env = build();
  try {
    const pending = env.runtime.toolRuntime.execute(
      { toolId: 'process.spawn', input: spawnInput({
        argv: [NODE, '-e', 'setTimeout(()=>{},60000)'], graceMs: 300,
      }) },
      { agentId: 'oracle', session: { id: 'sess_B' } },
    );
    let entry = null;
    for (let i = 0; i < 100 && !entry; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      entry = env.processRegistry.listBySession('sess_B')[0] ?? null;
    }
    assert.ok(entry);
    // a Session A pede pelo invocationId de B: posse negada
    assert.throws(
      () => env.processRegistry.get(entry.invocationId, { sessionId: 'sess_A' }),
      /another session/,
    );
    // e o cancel da A nao toca o processo de B
    await env.processRegistry.terminateSession('sess_A');
    assert.equal(env.processRegistry.listBySession('sess_B').length, 1, 'processo de B intacto');
    await entry.handle.terminate();
    await pending;
  } finally {
    env.cleanup();
  }
});

test('shutdown do Runtime encerra processos vivos (secao 91)', async () => {
  const env = build();
  try {
    const pending = env.runtime.toolRuntime.execute(
      { toolId: 'process.spawn', input: spawnInput({
        argv: [NODE, '-e', 'setTimeout(()=>{},60000)'], graceMs: 300,
      }) }, ctx,
    );
    let entry = null;
    for (let i = 0; i < 100 && !entry; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      entry = env.processRegistry.list()[0] ?? null;
    }
    assert.ok(entry);
    await env.runtime.shutdown();
    const result = await pending;
    assert.ok(result.output.outcome.exitCode !== 0 || result.output.outcome.signal);
    assert.equal(env.processRegistry.list().length, 0);
  } finally {
    env.cleanup();
  }
});

test('seguranca de eventos: segredo, argv e stdin nunca chegam ao bus (secao 164)', async () => {
  const env = build();
  try {
    await env.runtime.toolRuntime.execute(
      { toolId: 'process.spawn', input: spawnInput({
        argv: [NODE, '-e', "process.stdin.resume();process.stdin.on('end',()=>console.log('ok'))"],
        stdin: { mode: 'data', data: 'senha-no-stdin-XYZ' },
        env: { APP_TOKEN_VALUE: 'token-explicito-ABC' },
      }) }, ctx,
    );
    const serialized = JSON.stringify(env.events);
    assert.ok(!serialized.includes('senha-no-stdin-XYZ'), 'stdin nao vaza');
    assert.ok(!serialized.includes('token-explicito-ABC'), 'env nao vaza');
    assert.ok(!serialized.includes('nunca'), 'segredo do host nao vaza');
    assert.ok(!serialized.includes('process.stdin.resume'), 'argv nao vaza');
  } finally {
    env.cleanup();
  }
});

test('R8: superficie do Agent segue sem process (secoes 118, 163)', async () => {
  const env = build();
  try {
    const { Agent } = await import('../agent/agent.js');
    let seen = null;
    class Probe extends Agent {
      async run(context) {
        seen = context;
        const result = await context.runtime.requestTool('process.spawn', spawnInput());
        return result.output.outcome.exitCode;
      }
    }
    const agent = new Probe({ id: 'oracle', name: 'Oracle', instructions: 'spawn governado' });
    const session = env.runtime.createSession({ agentId: 'oracle', mission: 'probe' });
    const result = await env.runtime.loop.run(agent, session);
    assert.equal(result.status, 'completed');
    assert.equal(result.output, 0);
    assert.deepEqual(Object.keys(seen.runtime), ['requestTool']);
    for (const forbidden of ['spawn', 'processRegistry', 'processHandle', 'shutdown']) {
      assert.equal(seen[forbidden], undefined);
      assert.equal(seen.runtime[forbidden], undefined);
    }
  } finally {
    env.cleanup();
  }
});
