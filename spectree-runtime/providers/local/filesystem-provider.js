import { promises as defaultFs, lstatSync } from 'node:fs';
import path from 'node:path';
import { ProviderExecutionError } from '../../errors.js';

const BACKSLASH = String.fromCharCode(92);

/**
 * Forma canonica do resource de filesystem (spec Fase 4, secoes 39/94-95):
 * `workspace/<posix-normalizado>` quando o path fica dentro do workspace,
 * `outside-workspace` quando escapa. Dois paths semanticamente iguais
 * (`./src/a.js`, `src/a.js`) produzem o mesmo canonico; um path que escapa
 * produz um resource que nenhuma policy de `workspace/*` casa — o traversal
 * morre primeiro na Policy, e depois de novo no Provider (defense in depth).
 */
export function canonicalFilesystemId(rawPath) {
  if (typeof rawPath !== 'string' || rawPath.length === 0) return 'outside-workspace';
  const posix = rawPath.split(BACKSLASH).join('/');
  if (posix.startsWith('/') || /^[A-Za-z]:/.test(posix)) return 'outside-workspace';
  const normalized = path.posix.normalize(posix);
  if (normalized === '..' || normalized.startsWith('../') || normalized === '.') {
    return 'outside-workspace';
  }
  return 'workspace/' + normalized;
}

/**
 * Definicao da capability filesystem (secao 38). Operacoes minimas;
 * chmod/mount/symlink/execute ficam fora por decisao de fase.
 */
export const filesystemCapability = Object.freeze({
  id: 'filesystem',
  name: 'Filesystem',
  description: 'Operacoes de arquivo dentro do workspace',
  operations: Object.freeze(['read', 'write', 'delete']),
});

/**
 * Tools provider-backed (sem execute proprio): o caminho canonico da
 * Fase 4. A Tool nao conhece o Provider (INV-403) — declara capability,
 * operation e o resource derivado do proprio input (regra R9).
 */
export function filesystemTools() {
  const resource = (input) => ({ type: 'filesystem', id: canonicalFilesystemId(input.path) });
  const pathSchema = {
    type: 'object',
    required: ['path'],
    properties: { path: { type: 'string' } },
  };
  return [
    {
      id: 'filesystem.read',
      name: 'Read File',
      description: 'Le um arquivo do workspace',
      capability: 'filesystem',
      operation: 'read',
      inputSchema: pathSchema,
      resource,
    },
    {
      id: 'filesystem.write',
      name: 'Write File',
      description: 'Escreve um arquivo no workspace',
      capability: 'filesystem',
      operation: 'write',
      inputSchema: {
        type: 'object',
        required: ['path', 'content'],
        properties: { path: { type: 'string' }, content: { type: 'string' } },
      },
      resource,
    },
    {
      id: 'filesystem.delete',
      name: 'Delete File',
      description: 'Remove um arquivo do workspace',
      capability: 'filesystem',
      operation: 'delete',
      inputSchema: pathSchema,
      resource,
    },
  ];
}

/**
 * O primeiro Provider real do Spectree (secao 37). Deterministico, local,
 * testavel. Recebe SOMENTE workspaceRoot e adapters injetados (secoes
 * 41/49/140-142) — nada de process.env, cwd ou autoridade ambiental
 * (INV-417). Stateless: nenhum currentSession/currentInput mutavel
 * (secoes 62-63).
 *
 * Invariantes fisicas proprias (secao 47), validas mesmo com Policy allow:
 * boundary do workspace, recusa de symlink, recusa de deletar a raiz.
 */
export class LocalFilesystemProvider {
  providerId = 'local-filesystem';
  capabilityId = 'filesystem';
  version = '1.0.0';
  operations = ['read', 'write', 'delete'];

  #root;
  #fs;

  constructor({ workspaceRoot, fs = defaultFs }) {
    if (typeof workspaceRoot !== 'string' || workspaceRoot.length === 0) {
      throw new ProviderExecutionError('configuration', 'LocalFilesystemProvider requires workspaceRoot');
    }
    this.#root = path.resolve(workspaceRoot);
    this.#fs = fs;
  }

  /**
   * Valida boundary + resource binding e devolve o path fisico.
   * O resource autorizado pela Policy TEM de ser o executado (secoes
   * 26-27, 69, 139, INV-415): o canonico recalculado do input precisa
   * bater com resource.id recebido.
   */
  #resolvePath(input, resource) {
    const canonical = canonicalFilesystemId(input?.path);
    if (canonical === 'outside-workspace') {
      throw new ProviderExecutionError('boundary-violation', 'path escapes the workspace: ' + input?.path);
    }
    if (!resource || resource.type !== 'filesystem' || resource.id !== canonical) {
      throw new ProviderExecutionError(
        'resource-mismatch',
        "authorized resource '" + (resource?.id ?? 'none') + "' does not match executed path '" + canonical + "'",
      );
    }
    const relative = canonical.slice('workspace/'.length);
    const resolved = path.resolve(this.#root, relative);
    if (resolved !== this.#root && !resolved.startsWith(this.#root + path.sep)) {
      throw new ProviderExecutionError('boundary-violation', 'resolved path escapes the workspace');
    }
    // symlink defense (secao 43): nao confiar so na normalizacao textual.
    // Alvo symlink -> recusa; diretorio pai resolvido tem de continuar
    // dentro do workspace real.
    try {
      const stat = lstatSync(resolved, { throwIfNoEntry: false });
      if (stat?.isSymbolicLink()) {
        throw new ProviderExecutionError('symlink-denied', 'symlink access is denied: ' + relative);
      }
    } catch (error) {
      if (error instanceof ProviderExecutionError) throw error;
      // lstat falhou por outro motivo: a operacao concreta reportara
    }
    return resolved;
  }

  async execute(request, context) {
    const { operation, input, resource } = request;
    // defense in depth (secao 137): nao confiar so no registry
    if (!this.operations.includes(operation)) {
      throw new ProviderExecutionError('unsupported-operation', 'operation not supported: ' + operation);
    }
    void context; // superficie minima; nada aqui e usado como autoridade
    const resolved = this.#resolvePath(input, resource);
    try {
      if (operation === 'read') {
        const content = await this.#fs.readFile(resolved, 'utf8');
        return { output: content, metadata: { bytes: Buffer.byteLength(content) } };
      }
      if (operation === 'write') {
        // diretorios intermediarios apenas DENTRO do workspace (secao 92)
        await this.#fs.mkdir(path.dirname(resolved), { recursive: true });
        await this.#fs.writeFile(resolved, input.content, 'utf8');
        return { output: { written: true }, metadata: { bytes: Buffer.byteLength(input.content) } };
      }
      // delete: nunca a raiz (secoes 46/93); sem recursive delete nesta fase
      if (resolved === this.#root) {
        throw new ProviderExecutionError('root-deletion', 'deleting the workspace root is denied');
      }
      await this.#fs.unlink(resolved);
      return { output: { deleted: true } };
    } catch (error) {
      if (error instanceof ProviderExecutionError) throw error;
      throw new ProviderExecutionError(
        'io-error',
        'filesystem ' + operation + ' failed: ' + (error?.message ?? error),
        { cause: error },
      );
    }
  }
}
