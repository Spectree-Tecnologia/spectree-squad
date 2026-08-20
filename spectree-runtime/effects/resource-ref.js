import path from 'node:path';
import { EffectResolutionError } from '../errors.js';

/**
 * ResourceRef (spec Fase 8, secoes 6-9): a identidade NORMATIVA de um
 * recurso. A Policy trabalha sobre esta identidade canonica; Provider e
 * Sandbox trabalham com a resolucao fisica — nunca o contrario
 * (secao 9: physical path -> policy recolocaria plataforma dentro da
 * autoridade).
 *
 * A forma canonica preserva o vocabulario das Fases 4-7
 * (`{type, id}`, com id workspace-relativo como 'workspace/<posix>'):
 * as policies existentes continuam casando por construcao (secao 62). A
 * forma URI da spec (`filesystem://workspace/...`) e a serializacao
 * canonica DERIVADA — usada em fingerprint, evento e audit.
 */
export function createResourceRef({ type, id } = {}) {
  if (typeof type !== 'string' || type.length === 0) {
    throw new EffectResolutionError('resource ref requires a non-empty type');
  }
  if (typeof id !== 'string' || id.length === 0) {
    throw new EffectResolutionError('resource ref requires a non-empty id');
  }
  return Object.freeze({ type, id });
}

/** Serializacao canonica (secao 6): `type://id`. */
export const resourceUri = (resource) => resource.type + '://' + resource.id;

const BACKSLASH = String.fromCharCode(92);

/**
 * Canonicalizacao lexical de caminho de filesystem (secao 7): a MESMA
 * regra da Fase 4 — separadores normalizados, `.`/`..` resolvidos,
 * aliases convergem ('./src/a.js' == 'src/a.js', secao 36), absoluto e
 * traversal viram 'outside-workspace', que nenhuma policy de
 * 'workspace/*' casa (secao 38, defesa em profundidade). A verdade
 * FISICA (symlink/junction/realpath) continua na F7 (secao 39).
 */
export function canonicalFilesystemPath(rawPath) {
  if (typeof rawPath !== 'string' || rawPath.length === 0) return 'outside-workspace';
  const posix = rawPath.split(BACKSLASH).join('/');
  if (posix.startsWith('/') || /^[A-Za-z]:/.test(posix)) return 'outside-workspace';
  const normalized = path.posix.normalize(posix);
  if (normalized === '.' || normalized === './') return 'workspace';
  if (normalized === '..' || normalized.startsWith('../')) return 'outside-workspace';
  return 'workspace/' + normalized;
}

/** ResourceRef de filesystem a partir de caminho bruto. */
export const filesystemResource = (rawPath) =>
  createResourceRef({ type: 'filesystem', id: canonicalFilesystemPath(rawPath) });

/**
 * WorkspaceRef (secao 8): identidade estavel do workspace dentro da
 * execucao — o modelo logico nao depende do pathname fisico.
 */
export function createWorkspaceRef({ id = 'workspace', root } = {}) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new EffectResolutionError('workspace ref requires a root');
  }
  return Object.freeze({ id, root: path.resolve(root) });
}
