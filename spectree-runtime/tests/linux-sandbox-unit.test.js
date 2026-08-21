import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import {
  LinuxPhysicalSandboxProvider,
  detectWsl,
} from '../sandbox/providers/linux-physical/linux-physical-sandbox-provider.js';
import { BubblewrapBackend } from '../sandbox/providers/linux-physical/bubblewrap-backend.js';
import { LandlockBackend } from '../sandbox/providers/linux-physical/landlock-backend.js';
import { functionalProbe, PROBE_SENTINEL } from '../sandbox/providers/linux-physical/probe.js';
import { createSandboxPolicy } from '../sandbox/sandbox-policy.js';
import { sandboxProviderContract } from '../sandbox/sandbox-contract.js';
import { SandboxConfigurationError, SandboxUnavailableError } from '../errors.js';

/**
 * Unidades da Fase 7 (spec secoes 101-115) que nao dependem de Linux:
 * selecao de backend, probe como autoridade, fail-closed, superficie do
 * handle e preservacao do argv — tudo com backends e spawn falsos. A
 * seguranca FISICA e provada em linux-sandbox-physical.test.js.
 */

const workspace = () => mkdtempSync(path.join(tmpdir(), 'lnx-unit-'));

// ---------------------------------------------------------------- fakes

/** Filho falso: emite o sentinel do probe conforme o modo pedido. */
function fakeSpawn({ conformFor = ['read-only', 'workspace-write'], sentinel = true, exitCode = 0, hang = false } = {}) {
  const calls = [];
  const impl = (cmd, args) => {
    calls.push([cmd, ...args]);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => { child.killed = true; };
    if (!hang) {
      queueMicrotask(() => {
        const mode = args[args.indexOf('--mode') + 1] ?? 'workspace-write';
        if (sentinel) {
          const conforms = conformFor.includes(mode);
          const effects = {
            read: true,
            outsideRead: conforms ? false : true, // nao-conforme: outside vaza
            write: mode === 'workspace-write',
          };
          child.stdout.emit('data', PROBE_SENTINEL + JSON.stringify(effects));
        }
        child.emit('close', exitCode);
      });
    }
    return child;
  };
  impl.calls = calls;
  return impl;
}

/** Backend falso com locate/buildConfinedArgv controlaveis. */
function fakeBackend({ id, usable = true, enforcement = 'full', reason = 'not installed' } = {}) {
  return {
    backendId: id,
    enforcement,
    async locate() {
      return usable
        ? { ok: true, path: '/fake/' + id, enforcement }
        : { ok: false, reason };
    },
    buildConfinedArgv({ argv, cwd, mode }) {
      return Object.freeze(['/fake/' + id, '--mode', mode, '--chdir', cwd ?? '.', '--', ...argv]);
    },
  };
}

function provider(overrides = {}) {
  return new LinuxPhysicalSandboxProvider({
    platform: 'linux',
    spawnImpl: fakeSpawn(),
    ...overrides,
  });
}

// ------------------------------------------------- selecao e fail-closed

test('selecao: bwrap usavel e selecionado; enforcement vira fato do probe (secoes 21, 14)', async () => {
  const p = provider({ backends: [fakeBackend({ id: 'bubblewrap' }), fakeBackend({ id: 'landlock' })] });
  assert.equal(p.enforcement, 'none', 'antes do probe, nada e prometido');
  assert.equal(p.supports({ mode: 'workspace-write', requiredEnforcement: 'none' }), false, 'sem probe, supports fecha');
  const verdict = await p.probe();
  assert.equal(verdict.usable, true);
  assert.equal(verdict.backendId, 'bubblewrap');
  assert.equal(p.enforcement, 'full');
  assert.equal(p.supports({ mode: 'workspace-write', requiredEnforcement: 'full' }), true);
});

test('fallback: bwrap inutilizavel, Landlock usavel -> Landlock (secao 107)', async () => {
  const p = provider({ backends: [
    fakeBackend({ id: 'bubblewrap', usable: false, reason: 'bwrap not found' }),
    fakeBackend({ id: 'landlock', enforcement: 'partial' }),
  ] });
  const verdict = await p.probe();
  assert.equal(verdict.backendId, 'landlock');
  assert.equal(p.enforcement, 'partial', 'secao 37: ABI limitada = partial, nunca inflado');
  // secao 105/INV-711: partial provado nunca aceita pedido de full
  assert.equal(p.supports({ mode: 'workspace-write', requiredEnforcement: 'full' }), false);
  assert.equal(p.supports({ mode: 'workspace-write', requiredEnforcement: 'partial' }), true);
  // secao 20: a falha do bwrap nao desapareceu
  assert.deepEqual(verdict.attempts.map((a) => [a.backendId, a.usable]), [['bubblewrap', false], ['landlock', true]]);
  assert.match(verdict.attempts[0].reason, /bwrap not found/);
});

test('chain esgotado: SandboxUnavailableError com diagnostico, zero fallback (secoes 60, 97, 106, INV-726)', async () => {
  const p = provider({ backends: [
    fakeBackend({ id: 'bubblewrap', usable: false, reason: 'bwrap not found' }),
    fakeBackend({ id: 'landlock', usable: false, reason: 'kernel ABI insufficient' }),
  ] });
  const verdict = await p.probe();
  assert.equal(verdict.usable, false);
  assert.equal(p.supports({ mode: 'workspace-write', requiredEnforcement: 'none' }), false);
  const root = workspace();
  try {
    const policy = createSandboxPolicy({ mode: 'workspace-write', workspaceRoot: root, requiredEnforcement: 'full' });
    await assert.rejects(
      p.apply(policy, { sessionId: 's' }),
      (error) => error instanceof SandboxUnavailableError
        && /bwrap not found/.test(error.message)
        && /kernel ABI insufficient/.test(error.message),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('plataforma nao-linux: verdict fechado sem tocar backend (secao 100)', async () => {
  const p = provider({ platform: 'win32', backends: [fakeBackend({ id: 'bubblewrap' })] });
  const verdict = await p.probe();
  assert.equal(verdict.usable, false);
  assert.match(verdict.reason, /platform 'win32'/);
});

test('probe que reprova enforcement mata o backend: config nunca vira full (secoes 14, 39, 104)', async () => {
  // o backend DIZ full, mas o probe observa outside vazando em read-only
  const p = provider({
    backends: [fakeBackend({ id: 'bubblewrap' })],
    spawnImpl: fakeSpawn({ conformFor: ['workspace-write'] }), // read-only nao conforme
  });
  const verdict = await p.probe();
  assert.equal(verdict.usable, false);
  assert.match(verdict.attempts[0].reason, /enforcement mismatch/);
  assert.equal(p.enforcement, 'none', 'nada provado, nada prometido');
});

// -------------------------------------------------------------- probe

test('probe: sem sentinel = falha do RUNNER, nao veredito do filho (secao 58)', async () => {
  const report = await functionalProbe(fakeBackend({ id: 'b' }), {
    mode: 'workspace-write',
    spawnImpl: fakeSpawn({ sentinel: false, exitCode: 1 }),
  });
  assert.equal(report.usable, false);
  assert.match(report.reason, /runner failure/);
  assert.match(report.reason, /exit 1/);
});

test('probe: exit code != 0 COM sentinel conforme ainda e usavel (secao 58)', async () => {
  const report = await functionalProbe(fakeBackend({ id: 'b' }), {
    mode: 'workspace-write',
    spawnImpl: fakeSpawn({ exitCode: 3 }),
  });
  assert.equal(report.usable, true, 'exit do filho nao e falha do runner');
});

test('probe: timeout mata o processo e devolve unusable (secao 18)', async () => {
  const impl = fakeSpawn({ hang: true });
  const report = await functionalProbe(fakeBackend({ id: 'b' }), {
    mode: 'workspace-write', spawnImpl: impl, probeTimeoutMs: 50,
  });
  assert.equal(report.usable, false);
  assert.match(report.reason, /probe timeout/);
});

test('probe: mundo descartavel e destruido, nunca o workspace real (secoes 71-72)', async () => {
  let seenWorkspace = null;
  const backend = {
    backendId: 'spy', enforcement: 'full',
    async locate() { return { ok: true, path: '/fake/spy' }; },
    buildConfinedArgv({ argv, workspaceRoot }) { seenWorkspace = workspaceRoot; return Object.freeze(['/fake/spy', '--', ...argv]); },
  };
  await functionalProbe(backend, { mode: 'workspace-write', spawnImpl: fakeSpawn() });
  assert.ok(seenWorkspace.includes('spectree-probe-'), 'probe roda num mundo proprio');
  assert.ok(!existsSync(seenWorkspace), 'probe-root destruido depois');
});

// ------------------------------------------------------------- handle

test('handle: superficie R8, instancia unica, confineProcess e dispose (secoes 46-47, 81-83)', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'lnx-temp-'));
  const root = workspace();
  try {
    const p = provider({ backends: [fakeBackend({ id: 'bubblewrap' })], tempRoot: temp });
    await p.probe();
    const policy = createSandboxPolicy({ mode: 'workspace-write', workspaceRoot: root, requiredEnforcement: 'full' });
    const a = await p.apply(policy, { sessionId: 'sess_a' });
    const b = await p.apply(policy, { sessionId: 'sess_b' });
    // superficie identica a dos demais backends (R8, secao 47)
    assert.deepEqual(Object.keys(a), [
      'mode', 'enforcement', 'providerId', 'sandboxInstanceId', 'boundary', 'sessionTemp',
      'assertPathAllowed', 'confineProcess', 'dispose',
    ]);
    assert.ok(Object.isFrozen(a));
    assert.notEqual(a.sandboxInstanceId, b.sandboxInstanceId, 'secao 81: instancia por invocation');
    assert.equal(a.enforcement, 'full');
    // R14 encontra o backend fisico: spawn aberto sob workspace-write
    assert.deepEqual(a.boundary.process, { allowSpawn: true, enforcement: 'full', denialReason: null });

    // secoes 25-26: launcher prefixado, argv original INTACTO no fim
    const argv = ['/usr/bin/node', '-e', 'console.log(1)'];
    const confined = a.confineProcess({ argv, cwd: root });
    assert.equal(confined.backendId, 'bubblewrap');
    assert.deepEqual(confined.argv.slice(-argv.length), argv, 'sem alteracao semantica');
    assert.equal(confined.argv[confined.argv.length - argv.length - 1], '--', 'separador explicito');

    // temp privado por invocation (secoes 32-34) e cleanup (secao 86)
    assert.ok(a.sessionTemp.includes('sess_a'));
    assert.ok(existsSync(a.sessionTemp));
    assert.notEqual(a.sessionTemp, b.sessionTemp);
    await a.dispose();
    assert.ok(!existsSync(a.sessionTemp));
    await a.dispose(); // idempotente (secao 83)
    assert.throws(() => a.confineProcess({ argv, cwd: root }), SandboxConfigurationError,
      'handle liberado nao confina mais nada (INV-727)');
    await b.dispose();
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(temp, { recursive: true, force: true });
  }
});

test('policies concorrentes por invocation: A read-only, B workspace-write (secoes 78-80, 109)', async () => {
  const root = workspace();
  try {
    const p = provider({ backends: [fakeBackend({ id: 'bubblewrap' })] });
    await p.probe();
    const ro = await p.apply(
      createSandboxPolicy({ mode: 'read-only', workspaceRoot: root, requiredEnforcement: 'full' }),
      { sessionId: 'A' },
    );
    const rw = await p.apply(
      createSandboxPolicy({ mode: 'workspace-write', workspaceRoot: root, requiredEnforcement: 'full' }),
      { sessionId: 'B' },
    );
    // nenhum estado global de modo (secao 79): cada handle carrega o seu
    assert.equal(ro.mode, 'read-only');
    assert.equal(rw.mode, 'workspace-write');
    assert.equal(ro.confineProcess({ argv: ['/bin/x'], cwd: root }).argv.includes('read-only'), true);
    assert.equal(rw.confineProcess({ argv: ['/bin/x'], cwd: root }).argv.includes('workspace-write'), true);
    await ro.dispose();
    await rw.dispose();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('contrato oficial de SandboxProvider vale para o backend fisico (secao 154 F5)', async () => {
  const root = workspace();
  try {
    const p = provider({ backends: [fakeBackend({ id: 'bubblewrap' })] });
    await p.probe();
    const description = await sandboxProviderContract(p, { workspaceRoot: root });
    assert.equal(description.backend, 'bubblewrap');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ------------------------------------------------- backends de verdade

test('BubblewrapBackend: locate falha fechado fora de caminho controlado (secoes 51-52)', async () => {
  const missing = new BubblewrapBackend({ bwrapPath: path.join(tmpdir(), 'nao-existe-bwrap') });
  const located = await missing.locate();
  assert.equal(located.ok, false);
  assert.match(located.reason, /not found in controlled locations/);
  assert.throws(() => missing.buildConfinedArgv({ argv: ['/bin/x'], mode: 'read-only', workspaceRoot: '/w' }),
    SandboxConfigurationError, 'sem locate, nao constroi invocacao');
});

test('BubblewrapBackend: forma da invocacao por modo (secoes 26, 30-31, 35)', () => {
  const fs = {
    existsSync: (p) => ['/usr', '/etc', '/fake/bwrap', '/w', '/t'].includes(p),
    lstatSync: () => { throw new Error('absent'); },
    readlinkSync: () => { throw new Error('absent'); },
    realpathSync: (p) => p,
    statSync: () => { throw new Error('absent'); },
    accessSync: () => {},
  };
  const backend = new BubblewrapBackend({ bwrapPath: '/fake/bwrap', fsImpl: fs });
  return backend.locate().then(() => {
    const argv = ['/usr/bin/node', '-e', '1'];
    const ro = backend.buildConfinedArgv({ argv, cwd: '/w', mode: 'read-only', workspaceRoot: '/w', sessionTemp: '/t' });
    const roJoined = ro.join(' ');
    assert.ok(roJoined.includes('--ro-bind /w /w'), 'read-only: workspace e ro');
    assert.ok(!roJoined.includes('--bind /t /t'), 'read-only: NENHUMA root gravavel, nem temp (secao 30)');
    const rw = backend.buildConfinedArgv({ argv, cwd: '/w', mode: 'workspace-write', workspaceRoot: '/w', sessionTemp: '/t' });
    const rwJoined = rw.join(' ');
    assert.ok(rwJoined.includes('--bind /w /w'), 'workspace-write: workspace rw');
    assert.ok(rwJoined.includes('--bind /t /t'), 'workspace-write: temp explicito (secao 31)');
    assert.ok(rwJoined.includes('--die-with-parent'));
    assert.deepEqual(rw.slice(-3), argv, 'argv original intacto');
    assert.throws(() => backend.buildConfinedArgv({ argv, mode: 'danger-full-access', workspaceRoot: '/w' }),
      SandboxConfigurationError, 'secao 23: danger nao passa por backend');
  });
});

/**
 * Fidelidade do mount plan (patch F7). O defeito real: bindar /etc NAO
 * binda o que os symlinks dele alcancam, e o sintoma e timeout de DNS —
 * invisivel para o conformance harness zero-rede. Cada caso e derivado
 * do disco por fsImpl injetado, entao roda em qualquer plataforma.
 */
function backendWithLink({ target, targetIsFile = true, symlink = true, extraExists = [] } = {}) {
  const present = new Set(['/usr', '/etc', '/fake/bwrap', '/w', '/etc/resolv.conf', ...extraExists]);
  if (target) present.add(target);
  const fs = {
    existsSync: (p) => present.has(p),
    lstatSync: (p) => {
      if (!present.has(p)) throw new Error('absent');
      return { isSymbolicLink: () => p === '/etc/resolv.conf' && symlink, isDirectory: () => false };
    },
    readlinkSync: () => { throw new Error('absent'); },
    realpathSync: (p) => (p === '/etc/resolv.conf' && target ? target : p),
    statSync: (p) => {
      if (!present.has(p)) throw new Error('absent');
      return { isFile: () => targetIsFile, isDirectory: () => !targetIsFile };
    },
    accessSync: () => {},
  };
  return new BubblewrapBackend({ bwrapPath: '/fake/bwrap', fsImpl: fs });
}

const fidelityOf = async (backend) => {
  await backend.locate();
  const argv = backend.buildConfinedArgv({
    argv: ['/usr/bin/node', '-e', '1'], cwd: '/w', mode: 'read-only', workspaceRoot: '/w',
  });
  return { status: backend.mountFidelity()[0], joined: argv.join(' ') };
};

test('mount plan: symlink de sistema PENDURADO tem o alvo bindado (patch F7)', async () => {
  // o caso real do WSL (/mnt/wsl) e do systemd-resolved (/run/...)
  const { status, joined } = await fidelityOf(backendWithLink({ target: '/run/systemd/resolve/stub-resolv.conf' }));
  assert.equal(status.status, 'bindable');
  assert.equal(status.target, '/run/systemd/resolve/stub-resolv.conf');
  assert.ok(joined.includes('--ro-bind /run/systemd/resolve/stub-resolv.conf /run/systemd/resolve/stub-resolv.conf'),
    'o alvo entra como bind PONTUAL, nunca a root /run inteira');
  assert.ok(!joined.includes('--ro-bind /run /run'), 'nunca a root ampla');
});

test('mount plan: arquivo real nao vira bind — /etc ja o cobre (patch F7)', async () => {
  const { status, joined } = await fidelityOf(backendWithLink({ symlink: false }));
  assert.equal(status.status, 'not-a-symlink');
  assert.equal(status.target, null);
  assert.ok(!joined.includes('resolv.conf'), 'nada adicional entra no plano');
});

test('mount plan: alvo ja coberto pelas roots nao vira bind (patch F7)', async () => {
  const { status, joined } = await fidelityOf(backendWithLink({ target: '/etc/resolv.conf.real' }));
  assert.equal(status.status, 'covered');
  assert.ok(!joined.includes('--ro-bind /etc/resolv.conf.real'), 'bind duplicado nao entra');
});

test('mount plan: o alvo passa pelo MESMO piso do INV-906 (patch F7)', async () => {
  // alvo apontando para o HOME: o piso dos declaredResources vence, e o
  // status diz POR QUE em vez de sumir
  const { status, joined } = await fidelityOf(backendWithLink({ target: homedir() }));
  assert.equal(status.status, 'refused-by-floor');
  assert.ok(!joined.includes('--ro-bind ' + homedir() + ' '), 'HOME nunca entra pelo mount plan');
});

test('mount plan: alvo que nao e arquivo nao vira bind (patch F7)', async () => {
  const { status, joined } = await fidelityOf(backendWithLink({ target: '/run/algum-dir', targetIsFile: false }));
  assert.equal(status.status, 'not-a-file');
  assert.ok(!joined.includes('--ro-bind /run/algum-dir'), 'derivado do disco: so arquivo vira bind');
});

test('LandlockBackend: seam formal — sem helper instalado, unusable com razao (secoes 54-57)', async () => {
  const backend = new LandlockBackend();
  const located = await backend.locate();
  assert.equal(located.ok, false);
  assert.match(located.reason, /landlock helper not installed/);
});

// -------------------------------------------------------- diagnostics

test('deteccao de WSL: interop env ou assinatura do kernel (secao 93, INV-723)', () => {
  assert.equal(detectWsl({ env: { WSL_INTEROP: '/run/WSL/1_interop' } }), true);
  assert.equal(detectWsl({ env: {}, procVersion: 'Linux version 6.18.33.2-microsoft-standard-WSL2' }), true);
  assert.equal(detectWsl({ env: {}, procVersion: 'Linux version 6.8.0-generic ubuntu' }), false);
});

test('diagnostics: plataforma, backend e attempts sem dado pessoal (secoes 20, 95)', async () => {
  const p = provider({ backends: [
    fakeBackend({ id: 'bubblewrap', usable: false, reason: 'bwrap not found' }),
    fakeBackend({ id: 'landlock' }),
  ] });
  await p.probe();
  const diag = p.diagnostics({ env: {}, procVersionText: 'Linux version 6.18-microsoft-standard-WSL2' });
  assert.equal(diag.platform, 'linux');
  assert.equal(diag.wsl, true);
  assert.equal(diag.backend, 'landlock');
  assert.equal(diag.usable, true);
  assert.equal(diag.attempts.length, 2);
});
