import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  LocalSubprocessProvider,
  canonicalProcessWorld,
} from '../providers/local/subprocess-provider.js';
import { ProcessRegistry } from '../process/process-registry.js';
import {
  ProcessCwdError,
  ProcessConfigurationError,
  ProcessExecutableNotFoundError,
} from '../errors.js';

/**
 * O LocalSubprocessProvider exercitado com PROCESSOS REAIS (spec secoes
 * 151-157). Os specs usam o node do proprio host (process.execPath) por
 * determinismo — nenhum shell, nenhum PATH de sorte.
 */

const NODE = process.execPath;
const NODE_DIR = path.dirname(NODE);

function build() {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'prc-prov-'));
  const registry = new ProcessRegistry();
  const events = [];
  const provider = new LocalSubprocessProvider({
    workspaceRoot,
    hostEnv: { PATH: process.env.PATH ?? NODE_DIR, SYSTEMROOT: process.env.SYSTEMROOT ?? '', SECRET_TOKEN: 'vazou?' },
    registry,
    emit: (type, envelope) => events.push({ type, ...envelope }),
  });
  return {
    provider, registry, workspaceRoot, events,
    cleanup: () => rmSync(workspaceRoot, { recursive: true, force: true }),
  };
}

const context = Object.freeze({
  sessionId: 'sess_prc', agentId: 'oracle', capabilityId: 'process',
  operation: 'spawn', resource: null, metadata: Object.freeze({}), sandbox: null,
});

function spawnRequest(overrides = {}) {
  return {
    operation: 'spawn',
    input: {
      argv: [NODE, '-e', "console.log('spectree-ok')"],
      cwd: '.',
      stdin: { mode: 'ignore' },
      stdout: { mode: 'collect' },
      stderr: { mode: 'collect' },
      ...overrides,
    },
    resource: { type: 'process', id: canonicalProcessWorld(overrides.cwd ?? '.') },
  };
}

test('spawn: sucesso com outcome, stdout coletado e eventos seguros', async () => {
  const env = build();
  try {
    const result = await env.provider.execute(spawnRequest(), context);
    assert.equal(result.output.outcome.exitCode, 0);
    assert.equal(result.output.outcome.signal, null);
    assert.ok(result.output.outcome.durationMs >= 0);
    assert.equal(result.output.stdout.text.trim(), 'spectree-ok');
    assert.equal(result.output.stdout.truncated, false);
    // eventos: requested -> resolved -> started -> exited
    assert.deepEqual(env.events.map((e) => e.type), [
      'process.requested', 'process.resolved', 'process.started', 'process.exited',
    ]);
    // projecao segura (secao 108): argv bruto nao aparece nos eventos
    const serialized = JSON.stringify(env.events);
    assert.ok(!serialized.includes('spectree-ok'), 'argumento nao vaza');
    assert.equal(env.events[0].payload.argumentCount, 2);
    // registry limpo depois do exit (secao 89)
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(env.registry.list().length, 0);
  } finally {
    env.cleanup();
  }
});

test('exit != 0 e OUTCOME, nao ProcessError (secoes 44-45, 112, INV-621)', async () => {
  const env = build();
  try {
    const result = await env.provider.execute(
      spawnRequest({ argv: [NODE, '-e', 'process.exit(7)'] }), context,
    );
    assert.equal(result.output.outcome.exitCode, 7, 'o Provider devolve os fatos');
  } finally {
    env.cleanup();
  }
});

test('executavel inexistente: ProcessExecutableNotFoundError, zero processo (secao 148)', async () => {
  const env = build();
  try {
    await assert.rejects(
      env.provider.execute(spawnRequest({ argv: ['executavel-fantasma-9x7'] }), context),
      ProcessExecutableNotFoundError,
    );
    assert.ok(!env.events.some((e) => e.type === 'process.started'));
  } finally {
    env.cleanup();
  }
});

test('cwd: inexistente e fora do workspace morrem antes do spawn (secoes 26-27, 114)', async () => {
  const env = build();
  try {
    await assert.rejects(
      env.provider.execute(spawnRequest({ cwd: 'nao/existe' }), context),
      ProcessCwdError,
    );
    await assert.rejects(
      env.provider.execute(spawnRequest({ cwd: '../fora' }), context),
      ProcessCwdError,
    );
    // resource forjado != cwd executado: mismatch (secao 29)
    const forged = spawnRequest();
    forged.resource = { type: 'process', id: 'workspace/outro' };
    await assert.rejects(env.provider.execute(forged, context), ProcessConfigurationError);
    assert.ok(!env.events.some((e) => e.type === 'process.started'));
  } finally {
    env.cleanup();
  }
});

test('ambiente: segredo do host fora, SPECTREE_* do Runtime dentro (secoes 103, 144)', async () => {
  const env = build();
  try {
    const result = await env.provider.execute(
      spawnRequest({
        argv: [NODE, '-e',
          "console.log(JSON.stringify({secret: process.env.SECRET_TOKEN ?? null, session: process.env.SPECTREE_SESSION_ID ?? null}))"],
      }), context,
    );
    const seen = JSON.parse(result.output.stdout.text.trim());
    assert.equal(seen.secret, null, 'SECRET_TOKEN do host nao herdado');
    assert.equal(seen.session, 'sess_prc', 'SPECTREE_SESSION_ID gerenciado pelo Runtime');
  } finally {
    env.cleanup();
  }
});

test('stdin data: bytes escritos e stdin fechado (secao 54)', async () => {
  const env = build();
  try {
    const result = await env.provider.execute(
      spawnRequest({
        argv: [NODE, '-e',
          "let d='';process.stdin.on('data',(c)=>d+=c);process.stdin.on('end',()=>console.log('got:'+d))"],
        stdin: { mode: 'data', data: 'entrada-controlada' },
      }), context,
    );
    assert.equal(result.output.stdout.text.trim(), 'got:entrada-controlada');
  } finally {
    env.cleanup();
  }
});

test('output cap: truncated=true e memoria limitada (secoes 50, 52, 146)', async () => {
  const env = build();
  try {
    const result = await env.provider.execute(
      spawnRequest({
        argv: [NODE, '-e', "for(let i=0;i<5000;i++)console.log('x'.repeat(100))"],
        stdout: { mode: 'collect', maxBytes: 2048 },
      }), context,
    );
    assert.equal(result.output.stdout.truncated, true);
    assert.ok(result.output.stdout.bytes <= 2048);
  } finally {
    env.cleanup();
  }
});

test('terminate: escalada graceful->forced, arvore encerrada, done resolve (secoes 63-65, 145, 157)', async () => {
  const env = build();
  try {
    // parent que cria child; ambos gravam o proprio pid e dormem
    mkdirSync(path.join(env.workspaceRoot, 'out'), { recursive: true });
    const script = "const {spawn}=require('child_process');const fs=require('fs');" +
      "const c=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'ignore'});" +
      "fs.writeFileSync('out/pids.json',JSON.stringify({parent:process.pid,child:c.pid}));" +
      'setTimeout(()=>{},60000);';
    writeFileSync(path.join(env.workspaceRoot, 'runner.js'), script, 'utf8');

    const done = env.provider.execute(
      spawnRequest({ argv: [NODE, 'runner.js'], graceMs: 300 }), context,
    );
    // espera os pids aparecerem
    const pidsPath = path.join(env.workspaceRoot, 'out', 'pids.json');
    let pids = null;
    for (let i = 0; i < 100 && !pids; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      try { pids = JSON.parse((await import('node:fs')).readFileSync(pidsPath, 'utf8')); } catch {}
    }
    assert.ok(pids, 'processo escreveu os pids');
    const entry = env.registry.list()[0];
    assert.ok(entry, 'processo registrado');
    await entry.handle.terminate();
    await entry.handle.terminate(); // idempotente (secao 71, 167)
    const outcome = await entry.handle.done; // done resolve com fatos (secao 72)
    assert.ok(outcome.exitCode !== 0 || outcome.signal, 'terminado, nao sucesso normal');
    await done; // a execucao do provider tambem conclui
    // arvore: parent e child mortos (dentro do best effort do backend)
    await new Promise((resolve) => setTimeout(resolve, 300));
    const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
    assert.equal(alive(pids.parent), false, 'parent encerrado');
    assert.equal(alive(pids.child), false, 'child encerrado (INV-619)');
  } finally {
    env.cleanup();
  }
});

test('AbortSignal aciona terminate (secao 67)', async () => {
  const env = build();
  try {
    const controller = new AbortController();
    const pending = env.provider.execute(
      spawnRequest({
        argv: [NODE, '-e', 'setTimeout(()=>{},60000)'],
        graceMs: 300,
        signal: controller.signal,
      }), context,
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    controller.abort();
    const result = await pending;
    assert.ok(result.output.outcome.exitCode !== 0 || result.output.outcome.signal);
  } finally {
    env.cleanup();
  }
});
