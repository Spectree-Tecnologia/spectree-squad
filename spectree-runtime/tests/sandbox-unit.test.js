import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  SANDBOX_MODES,
  ENFORCEMENT_LEVELS,
  executionBoundaryFor,
  modeRank,
  mostRestrictiveMode,
} from '../sandbox/execution-boundary.js';
import { createSandboxPolicy, describeSandboxPolicy } from '../sandbox/sandbox-policy.js';
import { SandboxProviderRegistry } from '../sandbox/sandbox-provider-registry.js';
import { SandboxResolver, releaseSandbox } from '../sandbox/sandbox-resolver.js';
import { SandboxProfileResolver } from '../sandbox/sandbox-profile-resolver.js';
import { LocalFilesystemSandboxProvider } from '../sandbox/providers/local-filesystem-sandbox.js';
import { TestSandboxProvider } from '../sandbox/providers/test-sandbox-provider.js';
import { createSandboxEscalationRequest } from '../sandbox/sandbox-escalation.js';
import {
  SandboxConfigurationError,
  SandboxUnavailableError,
  SandboxDeniedError,
  SandboxCleanupError,
} from '../errors.js';

/** Unidades da Fase 5 (spec secao 155). */

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

function workspace() {
  const dir = mkdtempSync(path.join(tmpdir(), 'sbx-unit-'));
  return dir;
}

test('SandboxPolicy: modos, boundary e ordem de restritividade', () => {
  assert.deepEqual(SANDBOX_MODES, ['read-only', 'workspace-write', 'danger-full-access']);
  assert.deepEqual(ENFORCEMENT_LEVELS, ['none', 'partial', 'full']);
  assert.ok(modeRank('read-only') < modeRank('workspace-write'));
  assert.ok(modeRank('workspace-write') < modeRank('danger-full-access'));
  assert.equal(mostRestrictiveMode('danger-full-access', 'read-only'), 'read-only');
  // secao 55: cada modo descreve um boundary distinto
  assert.deepEqual(executionBoundaryFor('read-only').filesystem, { read: 'workspace', write: 'none' });
  assert.deepEqual(executionBoundaryFor('workspace-write').filesystem, { read: 'workspace', write: 'workspace' });
  assert.deepEqual(
    executionBoundaryFor('danger-full-access').filesystem,
    { read: 'unrestricted', write: 'unrestricted' },
  );
  // secoes 50-51: rede declarada como nao suportada, nunca fingida
  assert.equal(executionBoundaryFor('workspace-write').network.enforcement, 'unsupported');
});

test('R14: modo que promete confinement nao pare processo sem enforcement fisico', () => {
  // R8: superficie exata do eixo, sem chave a mais nem a menos
  assert.deepEqual(executionBoundaryFor('read-only').process, {
    allowSpawn: false, enforcement: 'unsupported', denialReason: 'mode-forbids-spawn',
  });
  // o coracao do R14: workspace-write PROMETE limite fisico, nenhum
  // backend o aplica a um processo do SO => nao executa
  assert.deepEqual(executionBoundaryFor('workspace-write').process, {
    allowSpawn: false, enforcement: 'unsupported', denialReason: 'unenforced-confinement',
  });
  // danger-full-access nao promete confinement nenhum: executar nao mente
  assert.deepEqual(executionBoundaryFor('danger-full-access').process, {
    allowSpawn: true, enforcement: 'unsupported', denialReason: null,
  });

  // 'partial' NAO e fisico: verificacao em JS nao alcanca o processo filho
  assert.equal(
    executionBoundaryFor('workspace-write', { processEnforcement: 'partial' }).process.allowSpawn,
    false,
  );
  // seam do backend fisico futuro: 'full' abre o spawn sob modo restritivo
  assert.deepEqual(executionBoundaryFor('workspace-write', { processEnforcement: 'full' }).process, {
    allowSpawn: true, enforcement: 'full', denialReason: null,
  });
  // read-only nao pare processo nem com backend fisico
  assert.equal(
    executionBoundaryFor('read-only', { processEnforcement: 'full' }).process.allowSpawn,
    false,
  );
  // typo nao abre fronteira por acidente
  assert.throws(() => executionBoundaryFor('workspace-write', { processEnforcement: 'Full' }), TypeError);
});

test('SandboxPolicy: defaults, imutabilidade e combinacoes invalidas', () => {
  const root = workspace();
  try {
    const policy = createSandboxPolicy({ mode: 'workspace-write', workspaceRoot: root });
    assert.ok(Object.isFrozen(policy), 'secao 101: congelada por execucao');
    assert.ok(Object.isFrozen(policy.readableRoots));
    assert.equal(policy.requiredEnforcement, 'full', 'secao 81: default full para modo restritivo');
    assert.equal(policy.allowPartialEnforcement, false, 'secao 126: default false');
    assert.equal(policy.inheritEnvironment, false, 'secao 49');
    // read-only nao pode declarar root de escrita
    assert.throws(
      () => createSandboxPolicy({ mode: 'read-only', workspaceRoot: root, writableRoots: [root] }),
      SandboxConfigurationError,
    );
    // workspace-write exige ao menos uma root de escrita
    assert.throws(
      () => createSandboxPolicy({ mode: 'workspace-write', workspaceRoot: root, writableRoots: [] }),
      SandboxConfigurationError,
    );
    // modo desconhecido, root ausente e ambiente herdado sao erros de configuracao
    assert.throws(() => createSandboxPolicy({ mode: 'sandbox-de-mentira' }), SandboxConfigurationError);
    assert.throws(() => createSandboxPolicy({ mode: 'read-only' }), SandboxConfigurationError);
    assert.throws(
      () => createSandboxPolicy({ mode: 'read-only', workspaceRoot: root, inheritEnvironment: true }),
      SandboxConfigurationError,
    );
    // secao 44: root fora do workspace nao entra
    assert.throws(
      () => createSandboxPolicy({
        mode: 'workspace-write', workspaceRoot: root, writableRoots: [path.join(root, '..')],
      }),
      SandboxConfigurationError,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('SandboxPolicy: descricao segura nao vaza roots (secoes 71-72)', () => {
  const root = workspace();
  try {
    const policy = createSandboxPolicy({ mode: 'workspace-write', workspaceRoot: root });
    const description = describeSandboxPolicy(policy);
    assert.deepEqual(Object.keys(description).sort(), [
      'allowPartialEnforcement', 'declaredResourceCount', 'mode', 'network',
      'readableRootCount', 'requiredEnforcement', 'writableRootCount',
    ]);
    assert.ok(!JSON.stringify(description).includes(root), 'o path nao aparece na descricao');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('SandboxRegistry: registro, duplicata e declaracoes invalidas (secao 16)', () => {
  const registry = new SandboxProviderRegistry();
  registry.register(new TestSandboxProvider());
  assert.ok(registry.has('test-sandbox'));
  assert.equal(registry.list()[0].enforcement, 'none');
  assert.throws(() => registry.register(new TestSandboxProvider()), SandboxConfigurationError);
  const base = { version: '1', platforms: ['*'], capabilities: ['filesystem-read-boundary'],
    supports: () => true, apply: async () => ({}), describe: () => ({}) };
  assert.throws(() => registry.register({ ...base, providerId: 'p1', platforms: ['plan9'] }), SandboxConfigurationError);
  assert.throws(() => registry.register({ ...base, providerId: 'p2', capabilities: ['telepatia'] }), SandboxConfigurationError);
  assert.throws(() => registry.register({ ...base, providerId: 'p3', apply: undefined }), SandboxConfigurationError);
  assert.throws(() => registry.get('fantasma'), SandboxUnavailableError);
});

test('SandboxResolver: selecao por plataforma, capability e enforcement', () => {
  const root = workspace();
  try {
    const registry = new SandboxProviderRegistry();
    registry.register(new LocalFilesystemSandboxProvider());
    const resolver = new SandboxResolver({ registry, platform: 'linux' });
    const partial = createSandboxPolicy({
      mode: 'workspace-write', workspaceRoot: root, requiredEnforcement: 'partial',
    });
    assert.equal(resolver.resolve(partial).providerId, 'local-filesystem-sandbox');
    // secao 125: pedir full com backend partial NAO executa
    const full = createSandboxPolicy({
      mode: 'workspace-write', workspaceRoot: root, requiredEnforcement: 'full',
    });
    assert.throws(() => resolver.resolve(full), SandboxUnavailableError);
    // secao 153: backend de outra plataforma nao serve
    const linuxOnly = new SandboxProviderRegistry();
    linuxOnly.register({
      providerId: 'linux-only', version: '1', platforms: ['linux'],
      capabilities: ['filesystem-read-boundary', 'filesystem-write-boundary'],
      enforcement: 'full', supports: () => true, apply: async () => ({}), describe: () => ({}),
    });
    const onWindows = new SandboxResolver({ registry: linuxOnly, platform: 'win32' });
    assert.throws(() => onWindows.resolve(partial), SandboxUnavailableError);
    // registry vazio: fail closed (secao 79)
    const empty = new SandboxResolver({ registry: new SandboxProviderRegistry(), platform: 'linux' });
    assert.throws(() => empty.resolve(partial), SandboxUnavailableError);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('SandboxProfileResolver: teto do Runtime vence o pedido da Tool (secoes 133-137)', () => {
  const root = workspace();
  try {
    const resolver = new SandboxProfileResolver({ document: PROFILE, workspaceRoot: root });
    const read = resolver.resolve({ tool: { id: 'filesystem.read' }, capabilityId: 'filesystem', operation: 'read' });
    assert.equal(read.policy.mode, 'read-only', 'secao 132: read -> read-only');
    const write = resolver.resolve({ tool: { id: 'filesystem.write' }, capabilityId: 'filesystem', operation: 'write' });
    assert.equal(write.policy.mode, 'workspace-write');
    // INV-508: a Tool NAO amplia — pedir danger-full-access nao concede
    const greedy = resolver.resolve({
      tool: { id: 'filesystem.write', sandbox: { mode: 'danger-full-access' } },
      capabilityId: 'filesystem', operation: 'write',
    });
    assert.equal(greedy.policy.mode, 'workspace-write', 'o teto do Runtime prevalece');
    assert.equal(greedy.ceiling, 'workspace-write');
    // a Tool PODE restringir a si mesma
    const humble = resolver.resolve({
      tool: { id: 'filesystem.read', sandbox: { mode: 'read-only' } },
      capabilityId: 'filesystem', operation: 'read',
    });
    assert.equal(humble.policy.mode, 'read-only');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('SandboxProfileResolver: teto restritivo nega a operacao mutante (secoes 31, 58)', () => {
  const root = workspace();
  try {
    const readOnlyRuntime = new SandboxProfileResolver({
      document: { ...PROFILE, runtimeMaxMode: 'read-only', capabilities: {
        filesystem: { maxMode: 'read-only', operations: PROFILE.capabilities.filesystem.operations },
      } },
      workspaceRoot: root,
    });
    assert.throws(
      () => readOnlyRuntime.resolve({ tool: { id: 'w' }, capabilityId: 'filesystem', operation: 'write' }),
      (error) => error instanceof SandboxDeniedError && error.requiredMode === 'workspace-write',
    );
    // leitura continua possivel
    assert.equal(
      readOnlyRuntime.resolve({ tool: { id: 'r' }, capabilityId: 'filesystem', operation: 'read' }).policy.mode,
      'read-only',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('SandboxProfileResolver: operacao nao classificada nao executa (secao 132)', () => {
  const root = workspace();
  try {
    const resolver = new SandboxProfileResolver({ document: PROFILE, workspaceRoot: root });
    assert.throws(
      () => resolver.resolve({ tool: { id: 'x' }, capabilityId: 'filesystem', operation: 'chmod' }),
      SandboxConfigurationError,
    );
    assert.throws(
      () => resolver.resolve({ tool: { id: 'x' }, capabilityId: 'network', operation: 'fetch' }),
      SandboxConfigurationError,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('SandboxHandle: superficie travada e dispose idempotente (secoes 89, 107, 166)', async () => {
  const root = workspace();
  const temp = mkdtempSync(path.join(tmpdir(), 'sbx-temp-'));
  try {
    const provider = new LocalFilesystemSandboxProvider({ tempRoot: temp });
    const policy = createSandboxPolicy({
      mode: 'workspace-write', workspaceRoot: root, requiredEnforcement: 'partial',
    });
    const handle = await provider.apply(policy, { sessionId: 'sess_a', agentId: 'oracle' });
    // R8 aplicado ao Handle (secao 89/166)
    assert.deepEqual(Object.keys(handle), [
      'mode', 'enforcement', 'providerId', 'sandboxInstanceId', 'boundary', 'sessionTemp',
      'assertPathAllowed', 'confineProcess', 'dispose',
    ]);
    // backend sem confinement fisico de processo: a porta e null (F7)
    assert.equal(handle.confineProcess, null);
    assert.match(handle.sandboxInstanceId, /^sbx_/);
    assert.ok(Object.isFrozen(handle));
    assert.equal(handle.enforcement, 'partial', 'secao 143: nunca mascarar partial como full');
    // o mecanismo bruto do SO nao vaza pelo handle
    for (const forbidden of ['provider', 'registry', 'policy', 'fs']) {
      assert.equal(handle[forbidden], undefined);
    }
    const sessionTemp = handle.sessionTemp;
    assert.ok(existsSync(sessionTemp));
    await handle.dispose();
    assert.ok(!existsSync(sessionTemp), 'secao 122: sem estado vazado');
    await handle.dispose(); // idempotente, sem double free
    await releaseSandbox(handle);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(temp, { recursive: true, force: true });
  }
});

test('releaseSandbox: falha de cleanup e observavel, nunca escondida (secao 66)', async () => {
  const provider = new TestSandboxProvider({ failDispose: new Error('mount ocupado') });
  const root = workspace();
  try {
    const policy = createSandboxPolicy({
      mode: 'workspace-write', workspaceRoot: root, requiredEnforcement: 'none',
    });
    const handle = await provider.apply(policy, { sessionId: 's', agentId: 'a' });
    let observed = null;
    await releaseSandbox(handle, (error) => { observed = error; });
    assert.ok(observed instanceof SandboxCleanupError);
    assert.match(observed.message, /mount ocupado/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('boundary fisico: symlink de root e resolvido pelo destino real (secoes 42-43)', async () => {
  const base = mkdtempSync(path.join(tmpdir(), 'sbx-link-'));
  const real = path.join(base, 'real');
  const outside = path.join(base, 'outside');
  mkdirSync(real, { recursive: true });
  mkdirSync(outside, { recursive: true });
  let linked = true;
  try {
    symlinkSync(outside, path.join(real, 'escape'), 'junction');
  } catch {
    linked = false; // ambiente sem permissao de symlink
  }
  try {
    const provider = new LocalFilesystemSandboxProvider();
    const policy = createSandboxPolicy({
      mode: 'workspace-write', workspaceRoot: real, requiredEnforcement: 'partial',
    });
    const handle = await provider.apply(policy, { sessionId: 's', agentId: 'a' });
    // dentro passa
    handle.assertPathAllowed(path.join(real, 'src', 'a.js'), 'write');
    // fora nao
    assert.throws(() => handle.assertPathAllowed(path.join(outside, 'x.js'), 'write'), SandboxDeniedError);
    if (linked) {
      // o ancestral e symlink para fora: a checagem lexical passaria,
      // a fisica nao (mesmo principio do R12)
      assert.throws(
        () => handle.assertPathAllowed(path.join(real, 'escape', 'x.js'), 'write'),
        SandboxDeniedError,
      );
    }
    await handle.dispose();
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('escalation e apenas o seam: representa o pedido, nao executa (secoes 74-77)', () => {
  const request = createSandboxEscalationRequest({
    currentPolicy: { mode: 'workspace-write' },
    requestedMode: 'danger-full-access',
    reason: 'precisa escrever fora do workspace',
    sessionId: 's1', agentId: 'oracle', capabilityId: 'filesystem', operation: 'write',
    resource: { type: 'filesystem', id: 'outside-workspace' },
  });
  assert.equal(request.currentMode, 'workspace-write');
  assert.equal(request.requestedMode, 'danger-full-access');
  assert.equal(request.scope, 'single-invocation', 'secao 76: nunca permissao permanente');
  assert.equal(request.status, 'not-implemented', 'INV-529: nao executa automaticamente');
  assert.ok(Object.isFrozen(request));
});
