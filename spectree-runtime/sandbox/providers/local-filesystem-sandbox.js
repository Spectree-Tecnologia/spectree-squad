import { mkdirSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { SandboxDeniedError } from '../../errors.js';

/**
 * LocalFilesystemSandboxProvider (spec Fase 5, secao 90): o primeiro
 * backend real do Spectree.
 *
 * ENFORCEMENT = 'partial', e isso e uma afirmacao honesta, nao uma
 * limitacao envergonhada (secoes 93-95, 143, 176). A fronteira e
 * verificada em JavaScript, dentro do processo do Runtime: ela impede o
 * Provider de sair do workspace, mas NAO impede o processo de faze-lo
 * por outro caminho. Chamar isso de `full` seria mentir — `full` fica
 * reservado para um backend kernel-level (Landlock no Linux, secao 34;
 * Restricted Token no Windows, secao 35).
 *
 * O que este backend garante de verdade:
 *   - resolucao FISICA das roots (realpath), nunca so lexical (secao 43);
 *   - toda escrita/leitura do Provider tem de cair dentro de uma root
 *     declarada, com o boundary do modo aplicado (secoes 91, 109);
 *   - temp privado por Session, sem compartilhamento implicito
 *     (secoes 45-47).
 */
export class LocalFilesystemSandboxProvider {
  providerId = 'local-filesystem-sandbox';
  version = '1.0.0';
  platforms = ['*'];
  capabilities = ['filesystem-read-boundary', 'filesystem-write-boundary'];
  // honestidade estrutural: verificacao no processo != isolamento do SO
  enforcement = 'partial';
  modes = ['read-only', 'workspace-write', 'danger-full-access'];

  #tempRoot;

  constructor({ tempRoot = null } = {}) {
    this.#tempRoot = tempRoot;
  }

  supports({ mode, requiredEnforcement }) {
    if (!this.modes.includes(mode)) return false;
    // nunca alegar mais do que entrega (secao 143)
    if (requiredEnforcement === 'full') return false;
    return true;
  }

  describe(policy) {
    return Object.freeze({
      providerId: this.providerId,
      version: this.version,
      platform: process.platform,
      backend: 'in-process path boundary',
      mode: policy.mode,
      enforcement: this.enforcement,
      readableRootCount: policy.readableRoots.length,
      writableRootCount: policy.writableRoots.length,
      network: policy.network.enforcement,
    });
  }

  /**
   * Prepara a fronteira. NAO toca no recurso protegido (secao 61): nao
   * abre arquivo, nao lista diretorio, nao testa a policy contra o alvo.
   * Cria, no maximo, o temp privado da Session.
   */
  async apply(policy, context) {
    let sessionTemp = null;
    if (this.#tempRoot && context.sessionId) {
      // temp privado por Session (secoes 45-47): nunca um /tmp global
      // compartilhado entre Sessions
      sessionTemp = path.join(path.resolve(this.#tempRoot), 'sessions', String(context.sessionId));
      mkdirSync(sessionTemp, { recursive: true });
    }
    const readable = policy.readableRoots.map(realOf);
    const writable = policy.writableRoots.map(realOf);
    // F9 (E1): recursos declarados sao legiveis — autoridade ja veio do
    // EffectSet; aqui e so a materializacao (parcial, in-process)
    for (const resource of policy.declaredResources ?? []) {
      readable.push(realOf(resource.physicalPath));
    }

    const boundary = Object.freeze({
      filesystem: Object.freeze({
        read: policy.boundary.filesystem.read,
        write: policy.boundary.filesystem.write,
        readableRoots: Object.freeze(readable),
        writableRoots: Object.freeze(writable),
      }),
      network: policy.boundary.network,
      // este backend nao confina processo: repassa o eixo como o modo o
      // declarou ('unsupported' => R14 fecha o spawn em modo restritivo).
      // Um backend que confine processo de verdade constroi o proprio
      // eixo com executionBoundaryFor(mode, { processEnforcement: 'full' })
      process: policy.boundary.process,
      environment: policy.boundary.environment,
    });

    let disposed = false;
    const handle = Object.freeze({
      mode: policy.mode,
      enforcement: this.enforcement,
      providerId: this.providerId,
      sandboxInstanceId: 'sbx_' + randomUUID(),
      boundary,
      sessionTemp,
      /**
       * A porta que o CapabilityProvider usa: ele pergunta ao handle,
       * nunca ao SandboxProvider (secao 63). Devolve void ou lanca.
       */
      assertPathAllowed(targetPath, operation) {
        assertWithinBoundary(boundary, targetPath, operation, policy.mode);
      },
      // este backend nao confina processo fisicamente: a porta existe
      // na superficie uniforme (R8) e e honestamente null
      confineProcess: null,
      /** Idempotente (secao 107): dispose duas vezes nao quebra nada. */
      async dispose() {
        if (disposed) return;
        disposed = true;
        if (sessionTemp) rmSync(sessionTemp, { recursive: true, force: true });
      },
    });
    return handle;
  }
}

const realOf = (root) => (existsSync(root) ? realpathSync(root) : path.resolve(root));

const within = (target, root) => target === root || target.startsWith(root + path.sep);

/**
 * A verificacao propriamente dita. Resolve o caminho FISICO do ancestral
 * existente mais profundo — mesmo principio do R12 da Fase 4 — para que
 * um diretorio pai que virou symlink/junction para fora nao passe pela
 * checagem lexical (secoes 42-43, 109).
 */
export function assertWithinBoundary(boundary, targetPath, operation, mode) {
  const filesystem = boundary.filesystem;
  const mutating = operation === 'write' || operation === 'delete';
  const rule = mutating ? filesystem.write : filesystem.read;

  if (rule === 'unrestricted') return; // danger-full-access: sem fronteira ADICIONAL
  if (rule === 'none') {
    throw new SandboxDeniedError(
      "sandbox mode '" + mode + "' forbids " + operation + ' operations',
      { boundary: mode, operation, requiredMode: 'workspace-write' },
    );
  }

  const roots = mutating ? filesystem.writableRoots : filesystem.readableRoots;
  const resolved = path.resolve(targetPath);
  let probe = resolved;
  while (!existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const physical = existsSync(probe) ? realpathSync(probe) : probe;
  const suffix = resolved.slice(probe.length);
  const physicalTarget = physical + suffix;

  if (!roots.some((root) => within(physicalTarget, root))) {
    throw new SandboxDeniedError(
      operation + ' outside the sandbox boundary',
      { boundary: mode, operation, requiredMode: mode, outside: true },
    );
  }
}
