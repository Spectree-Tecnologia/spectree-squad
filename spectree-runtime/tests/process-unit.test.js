import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createProcessSpawnSpec } from '../process/spawn-spec.js';
import { buildProcessEnvironment } from '../process/environment.js';
import { resolveExecutable } from '../process/executable.js';
import { OutputCollector } from '../process/output.js';
import { ProcessRegistry } from '../process/process-registry.js';
import { canonicalProcessWorld } from '../providers/local/subprocess-provider.js';
import {
  ProcessConfigurationError,
  ProcessExecutableNotFoundError,
  ProcessOwnershipError,
} from '../errors.js';

/** Unidades da Fase 6 (spec secoes 149-155). */

const STDIO = { stdin: { mode: 'ignore' }, stdout: { mode: 'collect' }, stderr: { mode: 'collect' } };

test('SpawnSpec: argv explicito, nunca shell (secoes 6, 13-14)', () => {
  const spec = createProcessSpawnSpec({ argv: ['node', '-e', '1'], cwd: '.', ...STDIO });
  assert.deepEqual([...spec.argv], ['node', '-e', '1']);
  assert.ok(Object.isFrozen(spec));
  // argv vazio: erro de configuracao, process.start = 0
  assert.throws(() => createProcessSpawnSpec({ argv: [], cwd: '.', ...STDIO }), ProcessConfigurationError);
  assert.throws(() => createProcessSpawnSpec({ argv: [42], cwd: '.', ...STDIO }), ProcessConfigurationError);
  // nao existe shell: true (secao 15) — campo desconhecido simplesmente
  // nao entra no spec congelado
  const sneaky = createProcessSpawnSpec({ argv: ['node'], cwd: '.', shell: true, ...STDIO });
  assert.equal(sneaky.shell, undefined);
});

test('SpawnSpec: cwd explicito e stdio sem default silencioso (secoes 26, 48)', () => {
  assert.throws(() => createProcessSpawnSpec({ argv: ['node'], ...STDIO }), ProcessConfigurationError);
  // cada stream tem de declarar modo
  assert.throws(
    () => createProcessSpawnSpec({ argv: ['node'], cwd: '.', stdout: { mode: 'collect' }, stderr: { mode: 'collect' } }),
    ProcessConfigurationError,
  );
  assert.throws(
    () => createProcessSpawnSpec({ argv: ['node'], cwd: '.', stdin: { mode: 'tty' }, stdout: { mode: 'collect' }, stderr: { mode: 'collect' } }),
    ProcessConfigurationError,
  );
  // graceMs limitado (secao 66)
  assert.throws(
    () => createProcessSpawnSpec({ argv: ['node'], cwd: '.', graceMs: Infinity, ...STDIO }),
    ProcessConfigurationError,
  );
  assert.throws(
    () => createProcessSpawnSpec({ argv: ['node'], cwd: '.', graceMs: 10 ** 9, ...STDIO }),
    ProcessConfigurationError,
  );
});

test('Environment: segredo do host nao entra; SPECTREE_* e scrubado e regravado (secoes 20-25)', () => {
  const hostEnv = {
    PATH: '/usr/bin',
    AWS_SECRET_ACCESS_KEY: 'shhh',
    DATABASE_URL: 'postgres://user:senha@host/db',
    SPECTREE_SESSION_ID: 'forjado-pelo-host',
    HOME: '/home/x',
  };
  const env = buildProcessEnvironment({
    hostEnv,
    overrides: { APP_MODE: 'test' },
    managed: { SPECTREE_SESSION_ID: 'sess_real' },
  });
  // allowlist minima: PATH/HOME passam, credenciais nao
  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined, 'credencial nao herdada');
  assert.equal(env.DATABASE_URL, undefined);
  // SPECTREE_* do host e removido; o do Runtime e a unica fonte
  assert.equal(env.SPECTREE_SESSION_ID, 'sess_real');
  assert.equal(env.APP_MODE, 'test');
  // override nao pode invadir o namespace do Runtime (INV-611)
  assert.throws(
    () => buildProcessEnvironment({ hostEnv, overrides: { SPECTREE_AGENT_ID: 'fake' } }),
    ProcessConfigurationError,
  );
  // allowlist explicita libera chave adicional
  const wide = buildProcessEnvironment({ hostEnv, allowedEnvironmentKeys: ['DATABASE_URL'] });
  assert.equal(wide.DATABASE_URL, hostEnv.DATABASE_URL);
});

test('resolveExecutable: absoluto verificado, bare via PATH controlado (secoes 16-19)', () => {
  const absolute = resolveExecutable(process.execPath, '');
  assert.equal(absolute.source, 'absolute');
  assert.ok(existsSync(absolute.path));
  // bare resolvido pelo PATH CONTROLADO — o diretorio do proprio node
  const controlled = path.dirname(process.execPath);
  const bare = resolveExecutable('node', controlled);
  assert.equal(bare.source, 'path');
  assert.ok(bare.path.toLowerCase().includes('node'));
  // inexistente
  assert.throws(() => resolveExecutable('nao-existe-mesmo-9x7', controlled), ProcessExecutableNotFoundError);
  assert.throws(() => resolveExecutable('/nao/existe/bin', ''), ProcessExecutableNotFoundError);
  // relativo com separador: nem absoluto, nem bare — recusado
  assert.throws(() => resolveExecutable('./tools/bin', controlled), ProcessConfigurationError);
});

test('OutputCollector: coleta limitada, truncation e spill limitado (secoes 49-52)', async () => {
  const collector = new OutputCollector({ maxBytes: 10 });
  collector.write('0123456789ABCDEF');
  const output = await collector.finish();
  assert.equal(output.text, '0123456789');
  assert.equal(output.truncated, true, 'secao 52: nunca fingir texto completo');
  assert.equal(output.bytes, 10);
  assert.equal(output.spillPath, null);
  // com spill: o excedente vai ao arquivo, tambem limitado
  const dir = mkdtempSync(path.join(tmpdir(), 'prc-spill-'));
  try {
    const spilling = new OutputCollector({ maxBytes: 4, spill: { dir, maxBytes: 6 } });
    spilling.write('AAAABBBBCCCC');
    const spilled = await spilling.finish();
    assert.equal(spilled.text, 'AAAA');
    assert.equal(spilled.truncated, true);
    assert.ok(spilled.spillPath);
    assert.equal(readFileSync(spilled.spillPath, 'utf8'), 'BBBBCC', 'spill respeita o proprio teto');
    spilling.cleanup();
    assert.ok(!existsSync(spilled.spillPath), 'spill cleanup');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ProcessRegistry: posse por Session e remocao no encerramento (secoes 85-89)', async () => {
  const registry = new ProcessRegistry();
  let resolveDone;
  const handle = {
    pid: 1234,
    done: new Promise((resolve) => { resolveDone = resolve; }),
    terminate: async () => { resolveDone({ exitCode: null, signal: 'SIGKILL' }); },
  };
  registry.register({ handle, sessionId: 'sess_A', agentId: 'oracle', invocationId: 'prc_1', executionWorldId: 'local:x' });
  assert.equal(registry.get('prc_1').sessionId, 'sess_A');
  assert.equal(registry.listBySession('sess_A').length, 1);
  assert.equal(registry.listBySession('sess_B').length, 0);
  // INV-617: a Session errada nao alcanca o processo
  assert.throws(() => registry.get('prc_1', { sessionId: 'sess_B' }), ProcessOwnershipError);
  // cancelamento da Session termina e limpa
  await registry.terminateSession('sess_A');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(registry.list().length, 0, 'secao 89: encerrado sai do registry');
});

test('canonicalProcessWorld: o cwd vira resource canonico (secoes 27-29)', () => {
  assert.equal(canonicalProcessWorld('.'), 'workspace');
  assert.equal(canonicalProcessWorld('src'), 'workspace/src');
  assert.equal(canonicalProcessWorld('./src/app'), 'workspace/src/app');
  assert.equal(canonicalProcessWorld('../fora'), 'outside-workspace');
  assert.equal(canonicalProcessWorld('/abs'), 'outside-workspace');
  assert.equal(canonicalProcessWorld('C:/abs'), 'outside-workspace');
  assert.equal(canonicalProcessWorld(''), 'outside-workspace');
});
