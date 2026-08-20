import { mkdirSync, rmSync, existsSync, realpathSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  SandboxConfigurationError,
  SandboxUnavailableError,
} from '../../../errors.js';
import { executionBoundaryFor, enforcementRank } from '../../execution-boundary.js';
import { assertWithinBoundary } from '../local-filesystem-sandbox.js';
import { BubblewrapBackend } from './bubblewrap-backend.js';
import { LandlockBackend } from './landlock-backend.js';
import { functionalProbe } from './probe.js';

/**
 * LinuxPhysicalSandboxProvider (spec Fase 7): o primeiro backend FISICO
 * do Spectree. O sistema operacional passa a participar da enforcement
 * boundary — mount namespace via bubblewrap, com Landlock como fallback
 * formal do chain (secao 7).
 *
 * E implementacao de Sandbox, nao Capability de negocio (INV-701). O
 * Agent nao o conhece (INV-702); o Process Provider nao o conhece
 * (INV-703) — este provider entrega um SandboxHandle cuja porta generica
 * `confineProcess` prefixa o launcher sem alteracao semantica do argv.
 *
 * Disciplina central (secao 127, regra de ouro): nao basta saber que uma
 * sandbox existe — o provider PROVA por functional probe que o processo
 * fica confinado antes de chamar qualquer coisa de "confinado". Sem
 * probe aprovado: supports() = false e apply() = SandboxUnavailableError.
 * Nunca fallback unconfined silencioso (secao 60, INV-726).
 */
export class LinuxPhysicalSandboxProvider {
  providerId = 'linux-physical-sandbox';
  version = '1.0.0';
  platforms = ['linux'];
  capabilities = ['filesystem-read-boundary', 'filesystem-write-boundary', 'process-boundary'];
  /** danger-full-access NAO passa por backend fisico (secao 23). */
  modes = ['read-only', 'workspace-write'];
  /** Fato pos-probe (secao 14), nunca configuracao. Comeca fechado. */
  enforcement = 'none';

  #backends;
  #platform;
  #tempRoot;
  #probeTimeoutMs;
  #spawnImpl;
  #nodePath;
  #probeTmpRoot;
  #selected = null;
  #verdict = null;

  constructor({
    backends = null,
    platform = process.platform,
    tempRoot = null,
    probeTimeoutMs = 5000,
    spawnImpl = null,
    nodePath = process.execPath,
    probeTmpRoot = null,
  } = {}) {
    // ordem do chain (secao 7/21): bubblewrap primeiro, Landlock depois
    this.#backends = backends ?? [new BubblewrapBackend(), new LandlockBackend()];
    this.#platform = platform;
    this.#tempRoot = tempRoot;
    this.#probeTimeoutMs = probeTimeoutMs;
    this.#spawnImpl = spawnImpl;
    this.#nodePath = nodePath;
    this.#probeTmpRoot = probeTmpRoot;
  }

  /**
   * Seleciona o primeiro backend que PROVA funcionar (secoes 15-21):
   * locate (existe, executavel, caminho controlado) e depois probe
   * funcional em CADA modo restritivo. Falha de um backend nao some
   * (secao 20): fica registrada em attempts. Nenhum usavel = verdict
   * fechado, e o diagnostico inteiro viaja no erro (secao 118).
   *
   * Re-executar probe() renova o veredito (secao 22): cache nao pode
   * transformar backend quebrado em full indefinidamente.
   */
  async probe() {
    const attempts = [];
    this.#selected = null;
    this.enforcement = 'none';

    if (this.#platform !== 'linux') {
      this.#verdict = Object.freeze({
        usable: false,
        backendId: null,
        enforcement: 'none',
        attempts: Object.freeze(attempts),
        reason: "platform '" + this.#platform + "' — linux-physical-sandbox only runs on linux",
      });
      return this.#verdict;
    }

    for (const backend of this.#backends) {
      const located = await backend.locate();
      if (!located.ok) {
        attempts.push(Object.freeze({ backendId: backend.backendId, usable: false, reason: located.reason }));
        continue;
      }
      let failure = null;
      for (const mode of this.modes) {
        const report = await functionalProbe(backend, {
          mode,
          spawnImpl: this.#spawnImpl ?? undefined,
          nodePath: this.#nodePath,
          probeTimeoutMs: this.#probeTimeoutMs,
          tmpRoot: this.#probeTmpRoot ?? undefined,
        });
        if (!report.usable) { failure = report; break; }
      }
      if (failure) {
        attempts.push(Object.freeze({ backendId: backend.backendId, usable: false, reason: failure.reason }));
        continue;
      }
      attempts.push(Object.freeze({ backendId: backend.backendId, usable: true, reason: null }));
      this.#selected = backend;
      // secao 14: o enforcement vem do que o backend PROVOU entregar
      this.enforcement = located.enforcement ?? backend.enforcement;
      break;
    }

    this.#verdict = Object.freeze({
      usable: this.#selected !== null,
      backendId: this.#selected?.backendId ?? null,
      enforcement: this.enforcement,
      attempts: Object.freeze(attempts),
      reason: this.#selected ? null : 'no usable physical backend (chain exhausted)',
    });
    return this.#verdict;
  }

  /** Veredito atual do probe — diagnostico, nunca autorizacao. */
  get verdict() {
    return this.#verdict;
  }

  supports({ mode, requiredEnforcement }) {
    if (!this.#verdict?.usable) return false;
    if (!this.modes.includes(mode)) return false;
    // secao 39/143: nunca aceitar acima do que o probe PROVOU
    if (requiredEnforcement && enforcementRank(requiredEnforcement) > enforcementRank(this.enforcement)) {
      return false;
    }
    return true;
  }

  describe(policy) {
    return Object.freeze({
      providerId: this.providerId,
      version: this.version,
      platform: this.#platform,
      backend: this.#selected?.backendId ?? 'none',
      mode: policy.mode,
      enforcement: this.enforcement,
      readableRootCount: policy.readableRoots.length,
      writableRootCount: policy.writableRoots.length,
      network: policy.network.enforcement,
    });
  }

  /**
   * Prepara a fronteira de UMA invocation (secoes 63, 78-81, INV-708):
   * policy por chamada, instancia propria, temp privado. Nao toca no
   * recurso protegido. O confinement fisico em si acontece no momento do
   * spawn, via confineProcess — o processo ja INICIA dentro da boundary
   * (INV-713); nao existe pos-confinamento (INV-714).
   */
  async apply(policy, context) {
    if (!this.#verdict?.usable) {
      throw new SandboxUnavailableError(
        "no usable linux physical backend for mode '" + policy.mode + "' (required enforcement: " +
        policy.requiredEnforcement + ", platform: " + this.#platform + ') — ' +
        this.#describeAttempts(),
      );
    }
    if (!this.modes.includes(policy.mode)) {
      throw new SandboxConfigurationError(
        'linux-physical-sandbox does not apply to mode: ' + String(policy.mode),
      );
    }
    const backend = this.#selected;
    const sandboxInstanceId = 'sbx_' + randomUUID();

    // temp privado por invocation (secoes 32-34): nunca compartilhado
    let sessionTemp = null;
    if (this.#tempRoot) {
      sessionTemp = path.join(
        path.resolve(this.#tempRoot),
        'sessions',
        String(context.sessionId ?? 'anonymous'),
        sandboxInstanceId,
      );
      mkdirSync(sessionTemp, { recursive: true });
    }

    // roots FISICAS (secao 29): realpath, nunca so lexical
    const readableRoots = policy.readableRoots.map(physicalRoot);
    const writableRoots = policy.writableRoots.map(physicalRoot);
    if (sessionTemp) {
      readableRoots.push(sessionTemp);
      if (policy.mode === 'workspace-write') writableRoots.push(sessionTemp);
    }
    // F9 (E1): recursos declarados — ja autorizados pelo EffectSet —
    // entram como roots de LEITURA pontuais, e o backend os monta ro
    const declaredResources = policy.declaredResources ?? [];
    for (const resource of declaredResources) {
      readableRoots.push(physicalRoot(resource.physicalPath));
    }
    const physicalWorkspace = policy.workspaceRoot ? physicalRoot(policy.workspaceRoot) : null;

    const boundary = Object.freeze({
      filesystem: Object.freeze({
        read: policy.boundary.filesystem.read,
        write: policy.boundary.filesystem.write,
        readableRoots: Object.freeze(readableRoots),
        writableRoots: Object.freeze(writableRoots),
      }),
      network: policy.boundary.network,
      // R14 encontra o backend fisico: enforcement provado abre o eixo
      process: executionBoundaryFor(policy.mode, { processEnforcement: this.enforcement }).process,
      environment: policy.boundary.environment,
    });

    const mode = policy.mode;
    let disposed = false;
    const handle = Object.freeze({
      mode,
      enforcement: this.enforcement,
      providerId: this.providerId,
      sandboxInstanceId,
      boundary,
      sessionTemp,
      assertPathAllowed(targetPath, operation) {
        assertWithinBoundary(boundary, targetPath, operation, mode);
      },
      /**
       * A porta GENERICA de confinement de processo (secoes 24-26,
       * 48-50): recebe argv exato, devolve argv confinado — launcher
       * prefixado, `--`, argv original intacto. O consumidor (Process
       * Provider) nao sabe qual mecanismo esta por tras (INV-703).
       */
      confineProcess({ argv, cwd = null } = {}) {
        if (disposed) {
          throw new SandboxConfigurationError('sandbox handle already released');
        }
        const confined = backend.buildConfinedArgv({
          argv,
          cwd,
          mode,
          workspaceRoot: physicalWorkspace,
          sessionTemp,
          declaredResources,
        });
        return Object.freeze({ argv: confined, backendId: backend.backendId });
      },
      /** Idempotente (secoes 83-84): dispose duas vezes nao quebra. */
      async dispose() {
        if (disposed) return;
        disposed = true;
        if (sessionTemp) rmSync(sessionTemp, { recursive: true, force: true });
      },
    });
    return handle;
  }

  /**
   * Diagnostico de ambiente (secoes 93-95): plataforma, kernel, WSL —
   * sem dado pessoal. WSL2 e host de desenvolvimento, nao security
   * boundary (INV-723); a deteccao existe para troubleshooting.
   */
  diagnostics({ env = process.env, procVersionText = null } = {}) {
    let procVersion = procVersionText;
    if (procVersion === null && this.#platform === 'linux') {
      try { procVersion = readFileSync('/proc/version', 'utf8'); } catch { procVersion = ''; }
    }
    return Object.freeze({
      platform: this.#platform,
      wsl: detectWsl({ env, procVersion: procVersion ?? '' }),
      backend: this.#selected?.backendId ?? null,
      enforcement: this.enforcement,
      usable: this.#verdict?.usable ?? false,
      attempts: this.#verdict?.attempts ?? Object.freeze([]),
    });
  }

  #describeAttempts() {
    const attempts = this.#verdict?.attempts ?? [];
    if (attempts.length === 0) return this.#verdict?.reason ?? 'no backend attempted';
    return attempts.map((a) => a.backendId + ': ' + (a.usable ? 'usable' : a.reason)).join('; ');
  }
}

/** Deteccao de WSL (secao 93): interop env ou assinatura do kernel. */
export function detectWsl({ env = {}, procVersion = '' } = {}) {
  if (env.WSL_INTEROP || env.WSL_DISTRO_NAME) return true;
  return /microsoft/i.test(procVersion);
}

const physicalRoot = (root) => (existsSync(root) ? realpathSync(root) : path.resolve(root));
