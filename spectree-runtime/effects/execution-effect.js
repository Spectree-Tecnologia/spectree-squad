import { EffectResolutionError } from '../errors.js';
import { createResourceRef, resourceUri } from './resource-ref.js';

/**
 * ExecutionEffect (spec Fase 8, secoes 3-5, INV-803): a unidade
 * normativa do que uma execucao pretende afetar. Explicito — kind,
 * operation, resource — com identidade deterministica.
 *
 * `network` e `environment` entram no VOCABULARIO (secao 4) mas nao
 * possuem operacoes nesta fase: criar um efeito desses kinds e erro,
 * nao permissao implicita — vocabulario sem backend nao vira autoridade.
 */
export const EFFECT_KINDS = Object.freeze(['filesystem', 'process', 'network', 'environment']);

export const EFFECT_OPERATIONS = Object.freeze({
  // secao 5: write != delete != create != rename != link — politicas
  // futuras governam cada uma; reduzir tudo a 'write' e proibido
  filesystem: Object.freeze(['read', 'write', 'create', 'delete', 'rename', 'link']),
  process: Object.freeze(['spawn', 'terminate']),
  // reservados (secao 4): sem enforcement fisico, sem operacao nesta fase
  network: Object.freeze([]),
  environment: Object.freeze([]),
});

/** Serializacao estavel da metadata para a identidade canonica. */
function canonicalMetadata(metadata) {
  if (!metadata) return '';
  const keys = Object.keys(metadata).sort();
  return '#' + keys.map((key) => key + '=' + String(metadata[key])).join('&');
}

/**
 * Cria um efeito valido e congelado. Identidade canonica deterministica
 * (INV-803): `kind:operation:type://id[#metadata]` — a metadata entra na
 * identidade porque rename/link com counterparts diferentes SAO efeitos
 * diferentes (secoes 40-41).
 */
export function createExecutionEffect({ kind, operation, resource, metadata = null } = {}) {
  if (!EFFECT_KINDS.includes(kind)) {
    throw new EffectResolutionError('unknown effect kind: ' + String(kind));
  }
  const operations = EFFECT_OPERATIONS[kind];
  if (operations.length === 0) {
    throw new EffectResolutionError(
      "effect kind '" + kind + "' is reserved vocabulary in this phase — no operations are defined",
    );
  }
  if (!operations.includes(operation)) {
    throw new EffectResolutionError(
      "unknown operation '" + String(operation) + "' for effect kind '" + kind + "'",
    );
  }
  const ref = createResourceRef(resource ?? {});
  const frozenMetadata = metadata ? Object.freeze({ ...metadata }) : null;
  return Object.freeze({
    kind,
    operation,
    resource: ref,
    metadata: frozenMetadata,
  });
}

/** Identidade canonica do efeito — base de dedup e fingerprint. */
export const canonicalEffect = (effect) =>
  effect.kind + ':' + effect.operation + ':' + resourceUri(effect.resource) +
  canonicalMetadata(effect.metadata);

/**
 * rename e efeito COMPOSTO (secao 40): source E destination participam
 * da autorizacao — autorizar so o destination nao basta. Modelado como
 * dois efeitos, um por recurso, com o counterpart na metadata: a Policy
 * existente decide sobre cada recurso sem mudar o engine.
 */
export function renameEffects({ source, destination }) {
  const src = createResourceRef(source ?? {});
  const dst = createResourceRef(destination ?? {});
  return [
    createExecutionEffect({
      kind: 'filesystem', operation: 'rename', resource: src,
      metadata: { role: 'source', counterpart: resourceUri(dst) },
    }),
    createExecutionEffect({
      kind: 'filesystem', operation: 'rename', resource: dst,
      metadata: { role: 'destination', counterpart: resourceUri(src) },
    }),
  ];
}

/** link segue a mesma regra do rename (secao 41) — a fronteira de
 * hardlink provada na Fase 7 exige os DOIS recursos na autorizacao. */
export function linkEffects({ source, destination }) {
  const src = createResourceRef(source ?? {});
  const dst = createResourceRef(destination ?? {});
  return [
    createExecutionEffect({
      kind: 'filesystem', operation: 'link', resource: src,
      metadata: { role: 'source', counterpart: resourceUri(dst) },
    }),
    createExecutionEffect({
      kind: 'filesystem', operation: 'link', resource: dst,
      metadata: { role: 'destination', counterpart: resourceUri(src) },
    }),
  ];
}
