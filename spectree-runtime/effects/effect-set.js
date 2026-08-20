import { createHash } from 'node:crypto';
import { EffectResolutionError } from '../errors.js';
import { canonicalEffect } from './execution-effect.js';

/**
 * ExecutionEffectSet (spec Fase 8, secoes 10, 13-14, INV-801/804): a
 * unidade normativa da autorizacao. Deduplicado (read A tres vezes = um
 * efeito; read A e write A permanecem distintos), ordenado
 * deterministicamente (kind, operation, resource.type, resource.id — a
 * ordem de descoberta nao muda o fingerprint) e com fingerprint sha256
 * das identidades canonicas: correlacao entre authorization, approval,
 * sandbox, execution e audit (secao 72) sem expor dado sensivel.
 */
export function createExecutionEffectSet(effects) {
  if (!Array.isArray(effects) || effects.length === 0) {
    throw new EffectResolutionError('an execution effect set requires at least one effect');
  }
  const byCanonical = new Map();
  for (const effect of effects) {
    byCanonical.set(canonicalEffect(effect), effect); // dedup (secao 13)
  }
  const ordered = [...byCanonical.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) // canonico embute kind:op:type://id (secao 14)
    .map(([, effect]) => effect);
  const fingerprint = createHash('sha256')
    .update(ordered.map((effect) => canonicalEffect(effect)).join('\n'))
    .digest('hex');
  return Object.freeze({
    effects: Object.freeze(ordered),
    fingerprint,
  });
}

/**
 * EffectPlan (secoes 51-52): a representacao normalizada ANTES da
 * execucao. Somente `completeness === 'complete'` alcanca a execucao
 * fisica governada; um resolver que sabe "escreve em arquivos" mas nao
 * sabe QUAIS produz um plano incomplete — que falha fechado, nunca vira
 * 'workspace/*' por conveniencia (secoes 52, 54).
 */
export function createEffectPlan({ effects = [], completeness = 'complete', reason = null } = {}) {
  if (completeness !== 'complete' && completeness !== 'incomplete') {
    throw new EffectResolutionError('effect plan completeness must be complete or incomplete');
  }
  if (completeness === 'complete') {
    const set = createExecutionEffectSet(effects);
    return Object.freeze({
      effects: set.effects,
      fingerprint: set.fingerprint,
      completeness,
      reason: null,
    });
  }
  return Object.freeze({
    effects: Object.freeze([...effects]),
    fingerprint: null, // nada confiavel a correlacionar num plano incompleto
    completeness,
    reason: reason ?? 'effect resolution incomplete',
  });
}
