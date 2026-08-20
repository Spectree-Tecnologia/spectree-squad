import { realpathSync, existsSync } from 'node:fs';
import path from 'node:path';
import { SandboxConfigurationError } from '../errors.js';
import {
  SANDBOX_MODES,
  ENFORCEMENT_LEVELS,
  executionBoundaryFor,
  modeRank,
} from './execution-boundary.js';

/**
 * SandboxPolicy (spec Fase 5, secao 7): a descricao imutavel do ambiente
 * fisico de UMA execucao. Nao concede autorizacao (INV-501); apenas
 * limita onde a execucao autorizada pode acontecer.
 *
 * Congelada por execucao (secao 101): nenhuma alteracao enquanto o
 * Provider roda. A auditoria guarda o snapshot (secao 102).
 */

/** Roots canonicas: realpath do fisico (secoes 42-43, mesmo principio R12). */
function canonicalRoot(root, label) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new SandboxConfigurationError(label + ' must be a non-empty path');
  }
  const resolved = path.resolve(root);
  // boundary FISICO, nunca so lexical (secao 43): um root que e symlink
  // para fora precisa ser tratado pelo destino real
  return existsSync(resolved) ? realpathSync(resolved) : resolved;
}

/**
 * Uma writableRoot precisa existir ou poder nascer dentro de uma root ja
 * validada (secao 44). `/../outside` e equivalentes sao recusados: a
 * checagem e feita contra o workspace fisico.
 */
function assertRootWithin(root, workspaceRoot, label) {
  if (root !== workspaceRoot && !root.startsWith(workspaceRoot + path.sep)) {
    throw new SandboxConfigurationError(
      label + " escapes the workspace root: '" + root + "' is outside '" + workspaceRoot + "'",
    );
  }
}

/**
 * @typedef {object} SandboxPolicyInput
 * @property {string} mode
 * @property {string} [workspaceRoot]
 * @property {string[]} [writableRoots]
 * @property {string[]} [readableRoots]
 * @property {object} [network]
 * @property {boolean} [inheritEnvironment]
 * @property {string} [tempDirectory]
 * @property {'full'|'partial'|'none'} [requiredEnforcement]
 * @property {boolean} [allowPartialEnforcement]
 */

/**
 * Normaliza, valida e congela. Erro de configuracao e tipado
 * (SandboxConfigurationError) e acontece ANTES de qualquer backend —
 * configuracao invalida nunca vira execucao.
 */
export function createSandboxPolicy(input) {
  if (!input || typeof input !== 'object') {
    throw new SandboxConfigurationError('sandbox policy must be an object');
  }
  const { mode } = input;
  if (!SANDBOX_MODES.includes(mode)) {
    throw new SandboxConfigurationError(
      'unknown sandbox mode: ' + String(mode) + ' (expected one of ' + SANDBOX_MODES.join(', ') + ')',
    );
  }

  const unrestricted = mode === 'danger-full-access';
  let workspaceRoot = null;
  let readableRoots = [];
  let writableRoots = [];

  if (!unrestricted) {
    // modo restritivo exige workspace: sem raiz nao ha fronteira a aplicar
    workspaceRoot = canonicalRoot(input.workspaceRoot, 'workspaceRoot');
    const readable = input.readableRoots ?? [input.workspaceRoot];
    readableRoots = readable.map((root, i) => {
      const canonical = canonicalRoot(root, 'readableRoots[' + i + ']');
      assertRootWithin(canonical, workspaceRoot, 'readableRoots[' + i + ']');
      return canonical;
    });
    const writable = input.writableRoots ?? (mode === 'read-only' ? [] : [input.workspaceRoot]);
    writableRoots = writable.map((root, i) => {
      const canonical = canonicalRoot(root, 'writableRoots[' + i + ']');
      assertRootWithin(canonical, workspaceRoot, 'writableRoots[' + i + ']');
      return canonical;
    });
    if (mode === 'read-only' && writableRoots.length > 0) {
      throw new SandboxConfigurationError('read-only sandbox cannot declare writableRoots');
    }
    if (mode === 'workspace-write' && writableRoots.length === 0) {
      throw new SandboxConfigurationError('workspace-write sandbox requires at least one writableRoot');
    }
  } else if (input.workspaceRoot) {
    workspaceRoot = canonicalRoot(input.workspaceRoot, 'workspaceRoot');
  }

  // F9 (E1): materializacao fisica de recursos JA AUTORIZADOS pelo
  // EffectSet — nao e nova autoridade. A unica fonte legitima e o
  // SandboxProfileResolver (efeitos autorizados x bindings declarados);
  // physicalPath nunca vem de Agent/Tool, e nesta fase so 'read'.
  // Deliberadamente FORA de assertRootWithin: o ponto e montar um
  // recurso pontual fora do workspace (ex.: credencial calibrada),
  // ro-bind a ro-bind, nunca uma root ampla.
  const declaredResources = (input.declaredResources ?? []).map((entry, i) => {
    const label = 'declaredResources[' + i + ']';
    if (!entry || typeof entry.resourceId !== 'string' || entry.resourceId.length === 0) {
      throw new SandboxConfigurationError(label + ' requires a canonical resourceId');
    }
    if (entry.mode !== 'read') {
      throw new SandboxConfigurationError(label + " mode must be 'read' in this phase");
    }
    return Object.freeze({
      resourceId: entry.resourceId,
      physicalPath: canonicalRoot(entry.physicalPath, label + '.physicalPath'),
      mode: 'read',
    });
  });

  const requiredEnforcement = input.requiredEnforcement
    ?? (unrestricted ? 'none' : 'full'); // secao 81: default full para modo restritivo
  if (!ENFORCEMENT_LEVELS.includes(requiredEnforcement)) {
    throw new SandboxConfigurationError('unknown enforcement level: ' + String(requiredEnforcement));
  }
  if (input.inheritEnvironment === true) {
    // secao 49: herdar o ambiente inteiro vaza segredo por construcao
    throw new SandboxConfigurationError(
      'inheritEnvironment=true is not supported in this phase (secrets would be inherited wholesale)',
    );
  }

  return Object.freeze({
    mode,
    workspaceRoot,
    readableRoots: Object.freeze(readableRoots),
    writableRoots: Object.freeze(writableRoots),
    tempDirectory: input.tempDirectory ? canonicalRoot(input.tempDirectory, 'tempDirectory') : null,
    declaredResources: Object.freeze(declaredResources),
    // rede declarada, nunca aplicada nesta fase (secoes 50-51)
    network: Object.freeze({ enabled: false, enforcement: 'unsupported' }),
    inheritEnvironment: false,
    requiredEnforcement,
    allowPartialEnforcement: input.allowPartialEnforcement === true, // secao 126: default false
    boundary: executionBoundaryFor(mode),
  });
}

/**
 * Descricao segura para observacao e eventos (secoes 71-72): modos e
 * contagens, nunca conteudo de root, ambiente ou credencial.
 */
export function describeSandboxPolicy(policy) {
  return Object.freeze({
    mode: policy.mode,
    requiredEnforcement: policy.requiredEnforcement,
    allowPartialEnforcement: policy.allowPartialEnforcement,
    readableRootCount: policy.readableRoots.length,
    writableRootCount: policy.writableRoots.length,
    declaredResourceCount: policy.declaredResources.length,
    network: policy.network.enforcement,
  });
}

/** O modo `a` e ao menos tao permissivo quanto o necessario em `b`? */
export const modeSatisfies = (effective, required) => modeRank(effective) >= modeRank(required);
