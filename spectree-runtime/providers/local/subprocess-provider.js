import { spawn as nodeSpawn, spawnSync } from 'node:child_process';
import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ProcessConfigurationError,
  ProcessCwdError,
  ProcessSpawnError,
  ProcessSandboxError,
} from '../../errors.js';
import { createProcessSpawnSpec } from '../../process/spawn-spec.js';
import { buildProcessEnvironment } from '../../process/environment.js';
import { resolveExecutable } from '../../process/executable.js';
import { OutputCollector } from '../../process/output.js';

const BACKSLASH = String.fromCharCode(92);

/**
 * Forma canonica do execution world de um processo (spec Fase 6, secoes
 * 27-29): o cwd, workspace-relativo, vira o resource que a Policy julga.
 * `.` e a raiz do workspace ('workspace'); path interno vira
 * 'workspace/<posix>'; escape vira 'outside-workspace' — e morre na
 * Policy antes de qualquer spawn. Mesma familia do canonico de
 * filesystem: um unico vocabulario de mundo (INV-630).
 */
export function canonicalProcessWorld(rawCwd) {
  if (typeof rawCwd !== 'string' || rawCwd.length === 0) return 'outside-workspace';
  const posix = rawCwd.split(BACKSLASH).join('/');
  if (posix.startsWith('/') || /^[A-Za-z]:/.test(posix)) return 'outside-workspace';
  const normalized = path.posix.normalize(posix);
  if (normalized === '.' || normalized === './') return 'workspace';
  if (normalized === '..' || normalized.startsWith('../')) return 'outside-workspace';
  return 'workspace/' + normalized;
}

/** Definicao da capability process (secoes 7, 121). */
export const processCapability = Object.freeze({
  id: 'process',
  name: 'Process',
  description: 'Execucao governada de processos externos com argv explicito',
  operations: Object.freeze(['spawn', 'terminate']),
  // INV-624: o Provider e o gate unico — nenhuma tool self-provided
  // pode carregar o proprio spawn (secoes 121/160)
  providerOnly: true,
});

/** Tool process.spawn (secoes 8, 140): spec estruturado, nunca string. */
export function processTools() {
  return [
    {
      id: 'process.spawn',
      name: 'Spawn Process',
      description: 'Inicia um processo com argv explicito dentro do workspace',
      capability: 'process',
      operation: 'spawn',
      execution: 'physical', // processo e sempre fisico (secao 119)
      inputSchema: {
        type: 'object',
        required: ['argv', 'cwd', 'stdin', 'stdout', 'stderr'],
        properties: {
          argv: { type: 'array' },
          cwd: { type: 'string' },
        },
      },
      resource: (input) => ({ type: 'process', id: canonicalProcessWorld(input.cwd) }),
    },
  ];
}

/**
 * LocalSubprocessProvider (spec Fase 6, secao 9). Executa processos; NAO
 * interpreta shell (secao 10, INV-622), NAO e terminal (secao 11,
 * INV-623), NAO decide autorizacao. Configuracao injetada (secao 129):
 * workspaceRoot, ambiente do host e ate o spawn sao parametros — nada de
 * autoridade ambiental.
 */
export class LocalSubprocessProvider {
  providerId = 'local-subprocess';
  capabilityId = 'process';
  version = '1.0.0';
  operations = ['spawn', 'terminate'];

  /** Capacidades reais da plataforma (secoes 94-95): declarar, nao inflar. */
  capabilities;

  #root;
  #hostEnv;
  #registry;
  #emit;
  #spawnImpl;
  #platform;

  constructor({ workspaceRoot, hostEnv, registry, emit = null, spawnImpl = nodeSpawn, platform = process.platform }) {
    if (typeof workspaceRoot !== 'string' || workspaceRoot.length === 0) {
      throw new ProcessConfigurationError('LocalSubprocessProvider requires workspaceRoot');
    }
    if (!hostEnv || typeof hostEnv !== 'object') {
      throw new ProcessConfigurationError('LocalSubprocessProvider requires an injected hostEnv');
    }
    if (!registry) {
      throw new ProcessConfigurationError('LocalSubprocessProvider requires a ProcessRegistry');
    }
    this.#root = path.resolve(workspaceRoot);
    this.#hostEnv = hostEnv;
    this.#registry = registry;
    this.#emit = emit;
    this.#spawnImpl = spawnImpl;
    this.#platform = platform;
    this.capabilities = Object.freeze({
      platform: this.#platform,
      // posix: process group (detached + kill(-pid)); win32: taskkill /T.
      // Nenhum dos dois segura um descendente que troca de grupo/job:
      // 'best-effort-tree', nunca 'full' (secao 95)
      processTreeTermination: 'best-effort-tree',
      signalSupport: this.#platform !== 'win32',
      stdinPipe: true,
      stdoutPipe: true,
      stderrPipe: true,
    });
  }

  #event(type, payload, context) {
    if (!this.#emit) return;
    this.#emit(type, {
      sessionId: context.sessionId ?? null,
      agentId: context.agentId ?? null,
      payload,
    });
  }

  /** cwd fisico validado: workspace, sandbox e resource concordam (secao 29). */
  #resolveCwd(rawCwd, resource, sandbox) {
    const canonical = canonicalProcessWorld(rawCwd);
    if (canonical === 'outside-workspace') {
      throw new ProcessCwdError('cwd escapes the workspace: ' + rawCwd);
    }
    if (!resource || resource.type !== 'process' || resource.id !== canonical) {
      throw new ProcessConfigurationError(
        "authorized resource '" + (resource?.id ?? 'none') + "' does not match executed cwd '" + canonical + "'",
      );
    }
    const relative = canonical === 'workspace' ? '.' : canonical.slice('workspace/'.length);
    const resolved = path.resolve(this.#root, relative);
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
      throw new ProcessCwdError('cwd does not exist or is not a directory: ' + canonical);
    }
    const physical = realpathSync(resolved);
    // o Sandbox precisa permitir spawn E o cwd (secoes 27, 30-33)
    if (sandbox) {
      if (sandbox.boundary?.process && sandbox.boundary.process.allowSpawn === false) {
        throw new ProcessSandboxError(
          "sandbox mode '" + sandbox.mode + "' does not allow process spawn",
        );
      }
      if (typeof sandbox.assertPathAllowed === 'function') {
        sandbox.assertPathAllowed(physical, 'read');
      }
    }
    return physical;
  }

  async execute(request, context) {
    const { operation, input, resource } = request;
    if (operation === 'terminate') {
      // interno (secao 84): encerra APENAS processo da propria Session
      const entry = this.#registry.get(input.invocationId, { sessionId: context.sessionId ?? null });
      if (!entry) return { output: { terminated: false, reason: 'not-found' } };
      await entry.handle.terminate();
      const outcome = await entry.handle.done;
      return { output: { terminated: true, outcome } };
    }
    if (operation !== 'spawn') {
      throw new ProcessConfigurationError('operation not supported: ' + operation);
    }

    // 1. spec valido ANTES de qualquer efeito (secao 14)
    const spec = createProcessSpawnSpec(input);
    this.#event('process.requested', {
      // projecao segura (secao 108): identidade e contagem, nunca o argv
      executable: spec.argv[0],
      argumentCount: spec.argv.length - 1,
      cwd: canonicalProcessWorld(spec.cwd),
    }, context);

    // 2. cwd fisico + coerencia resource/sandbox/cwd (secoes 26-33)
    const cwd = this.#resolveCwd(spec.cwd, resource, context.sandbox);

    // 3. ambiente controlado (secoes 19-25): scrub + allowlist + managed
    const env = buildProcessEnvironment({
      hostEnv: this.#hostEnv,
      allowedEnvironmentKeys: spec.allowedEnvironmentKeys,
      overrides: spec.env,
      managed: {
        SPECTREE_SESSION_ID: context.sessionId,
        SPECTREE_AGENT_ID: context.agentId,
        SPECTREE_CAPABILITY: context.capabilityId,
        SPECTREE_SANDBOX: context.sandbox?.mode ?? null,
      },
    });

    // 4. executavel pelo PATH CONTROLADO do ambiente composto (secao 75)
    const executable = resolveExecutable(spec.argv[0], env.PATH ?? env.Path, this.#platform);
    this.#event('process.resolved', {
      executable: executable.path,
      source: executable.source,
    }, context);

    // 5. spawn — o Sandbox ja foi aplicado pelo ToolRuntime ANTES de o
    // Provider existir nesta invocacao (secoes 30-32): nao ha rota
    // spawn-primeiro-confina-depois
    const invocationId = 'prc_' + randomUUID();
    const handle = this.#spawn(spec, executable.path, cwd, env, context, invocationId);
    this.#registry.register({
      handle,
      sessionId: context.sessionId ?? null,
      agentId: context.agentId ?? null,
      invocationId,
      executionWorldId: 'local:' + this.#root,
    });
    this.#event('process.started', {
      processId: handle.pid,
      providerId: this.providerId,
      capabilityId: context.capabilityId,
      operation,
      cwd: canonicalProcessWorld(spec.cwd),
      sandboxMode: context.sandbox?.mode ?? null,
    }, context);

    // 6. a Tool retorna o OUTCOME (secao 129): o handle e seam interno
    // para consumidores futuros (shell, terminal), nunca superficie do
    // Agent. done resolve DEPOIS da drenagem de output (secao 73).
    const outcome = await handle.done;
    this.#event('process.exited', {
      processId: handle.pid,
      exitCode: outcome.exitCode,
      signal: outcome.signal,
      durationMs: outcome.durationMs,
    }, context);
    const output = {
      outcome: {
        exitCode: outcome.exitCode,
        signal: outcome.signal,
        startedAt: outcome.startedAt,
        endedAt: outcome.endedAt,
        durationMs: outcome.durationMs,
      },
      stdout: outcome.stdout,
      stderr: outcome.stderr,
    };
    return { output, metadata: { invocationId, executable: executable.path } };
  }

  /** Monta o ProcessHandle (secoes 38-42, 63-72). */
  #spawn(spec, executablePath, cwd, env, context, invocationId) {
    const stdio = [
      spec.stdin.mode === 'ignore' ? 'ignore' : 'pipe',
      spec.stdout.mode === 'inherit' ? 'inherit' : 'pipe',
      spec.stderr.mode === 'inherit' ? 'inherit' : 'pipe',
    ];
    const posix = this.#platform !== 'win32';
    let child;
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    try {
      child = this.#spawnImpl(executablePath, spec.argv.slice(1), {
        cwd,
        env,
        stdio,
        // posix: grupo proprio para terminacao em arvore (secao 93)
        detached: posix,
        windowsHide: true,
      });
    } catch (error) {
      throw new ProcessSpawnError('spawn failed: ' + (error?.message ?? error), { cause: error });
    }

    const collectors = {};
    for (const [name, streamSpec, stream] of [
      ['stdout', spec.stdout, child.stdout],
      ['stderr', spec.stderr, child.stderr],
    ]) {
      if (streamSpec.mode === 'collect' && stream) {
        collectors[name] = new OutputCollector({ maxBytes: streamSpec.maxBytes, spill: streamSpec.spill ?? null });
        stream.on('data', (chunk) => collectors[name].write(chunk));
      }
    }
    if (spec.stdin.mode === 'data' && child.stdin) {
      child.stdin.write(spec.stdin.data);
      child.stdin.end();
    }

    let terminating = false;
    const platform = this.#platform;
    const terminateTree = () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      if (platform === 'win32') {
        // arvore inteira, best effort (secao 93): taskkill segue a arvore
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch {} }
      }
    };

    const done = new Promise((resolve, reject) => {
      child.once('error', (error) => {
        // erro ANTES de iniciar = ProcessSpawnError (secoes 43-44)
        reject(new ProcessSpawnError('spawn failed: ' + (error?.message ?? error), { cause: error }));
      });
      child.once('close', async (exitCode, signal) => {
        // 'close' garante streams drenados ANTES do outcome (secao 73)
        const endedMs = Date.now();
        const stdout = collectors.stdout ? await collectors.stdout.finish() : null;
        const stderr = collectors.stderr ? await collectors.stderr.finish() : null;
        resolve(Object.freeze({
          exitCode,
          signal: signal ?? null,
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: endedMs - startedMs,
          stdout,
          stderr,
        }));
      });
    });

    const emit = (type, payload) => this.#event(type, payload, context);
    const graceMs = spec.graceMs;
    const handle = Object.freeze({
      pid: child.pid ?? null,
      done,
      stdout: spec.stdout.mode === 'pipe' ? child.stdout : null,
      stderr: spec.stderr.mode === 'pipe' ? child.stderr : null,
      stdin: spec.stdin.mode === 'pipe' && child.stdin
        ? Object.freeze({
            write: (data) => child.stdin.write(data),
            end: () => child.stdin.end(),
          })
        : null,
      /**
       * Escalada de terminacao (secoes 63-65): graceful -> graceMs ->
       * forcada, sempre em arvore quando o backend alcanca. Idempotente
       * (secao 71); done resolve com os fatos finais (secao 72).
       */
      async terminate() {
        if (terminating) return done.catch(() => null).then(() => undefined);
        terminating = true;
        if (child.exitCode === null && child.signalCode === null) {
          emit('process.terminated', { processId: child.pid ?? null, phase: 'graceful' });
          if (platform === 'win32') {
            // sem SIGTERM confiavel no win32: taskkill sem /F e o graceful
            spawnSync('taskkill', ['/pid', String(child.pid), '/T'], { windowsHide: true });
          } else {
            try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
          }
          const exited = await Promise.race([
            done.then(() => true).catch(() => true),
            new Promise((resolve) => setTimeout(() => resolve(false), graceMs)),
          ]);
          if (!exited) {
            emit('process.terminated', { processId: child.pid ?? null, phase: 'forced' });
            terminateTree();
          }
        }
        await done.catch(() => null);
      },
    });

    // AbortSignal (secao 67): abortar aciona terminate, nada alem disso
    if (spec.signal) {
      if (spec.signal.aborted) queueMicrotask(() => handle.terminate());
      else spec.signal.addEventListener('abort', () => handle.terminate(), { once: true });
    }
    return handle;
  }
}
