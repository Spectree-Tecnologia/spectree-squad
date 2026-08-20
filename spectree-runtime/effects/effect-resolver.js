import { EffectResolutionError } from '../errors.js';
import { createExecutionEffect } from './execution-effect.js';
import { createEffectPlan } from './effect-set.js';

/**
 * EffectResolver (spec Fase 8, secoes 11-12, 21-23, 56): o seam que
 * transforma (tool, input, contexto) num EffectPlan DETERMINISTICO —
 * LLM nao participa; "provavelmente afeta o workspace" nao existe
 * (secao 11, INV-805).
 *
 * A resolucao pertence a quem tem conhecimento (secao 56) — nunca um
 * parser global adivinhando semantica:
 *
 *   1. tool.resolveEffects(input, context)  — efeito depende do input
 *   2. tool.effects                          — declaracao estatica
 *   3. capability.resolveEffects(tool, input, context)
 *   4. nenhum                                — caminho legado (secao 63)
 *
 * O caminho legado (null) existe APENAS como adaptador de
 * compatibilidade das Fases 1-7: uma capability que declara
 * `effectKinds` esta no modelo F8 e nao pode regredir — tool fisica
 * dela sem resolucao de efeitos falha fechado (secao 22, INV-805).
 */
export class EffectResolver {
  /**
   * @returns {object|null} EffectPlan, ou null para o caminho legado
   * @throws {EffectResolutionError} fail-closed (INV-805)
   */
  resolve({ tool, capability = null, input, principal = null, session = null, cwd = null } = {}) {
    const context = Object.freeze({ principal, session, cwd });
    let raw = null;
    if (typeof tool.resolveEffects === 'function') {
      raw = tool.resolveEffects(input, context);
    } else if (tool.effects !== undefined) {
      raw = tool.effects;
    } else if (typeof capability?.resolveEffects === 'function') {
      raw = capability.resolveEffects(tool, input, context);
    } else if (Array.isArray(capability?.effectKinds)) {
      // capability no modelo F8 sem rota de resolucao: fail closed —
      // "provavelmente so afeta o workspace" nao e autorizacao
      throw new EffectResolutionError(
        "capability '" + capability.id + "' declares effect kinds but tool '" + tool.id +
        "' provides no effect resolution — declare effects or resolveEffects",
      );
    } else {
      return null; // legado (secao 63): autorizacao single-resource das fases 1-7
    }

    const plan = this.#normalize(raw, tool);
    if (plan.completeness === 'complete') {
      this.#assertCapabilityKinds(plan, capability, tool);
    }
    return plan;
  }

  #normalize(raw, tool) {
    if (raw === null || raw === undefined) {
      throw new EffectResolutionError(
        "tool '" + tool.id + "' resolved no effects for a physical execution",
      );
    }
    // resolver pode devolver um plano ({effects, completeness}) ou a
    // lista/efeito direto — normalizamos para EffectPlan
    const isPlanShape = !Array.isArray(raw) && typeof raw === 'object' && 'completeness' in raw;
    const completeness = isPlanShape ? raw.completeness : 'complete';
    const list = isPlanShape ? raw.effects ?? [] : Array.isArray(raw) ? raw : [raw];
    if (completeness === 'incomplete') {
      return createEffectPlan({ effects: [], completeness: 'incomplete', reason: raw.reason ?? null });
    }
    if (list.length === 0) {
      throw new EffectResolutionError(
        "tool '" + tool.id + "' resolved an empty effect set for a physical execution",
      );
    }
    let effects;
    try {
      effects = list.map((entry) => (Object.isFrozen(entry) && entry.kind && entry.resource
        ? entry
        : createExecutionEffect(entry)));
    } catch (error) {
      if (error instanceof EffectResolutionError) throw error;
      throw new EffectResolutionError(
        "tool '" + tool.id + "' produced an invalid effect: " + (error?.message ?? error),
      );
    }
    return createEffectPlan({ effects, completeness: 'complete' });
  }

  /** secao 55: a Capability nao ganha efeito que sua definicao nao conhece. */
  #assertCapabilityKinds(plan, capability, tool) {
    const declared = capability?.effectKinds;
    if (!Array.isArray(declared)) return;
    for (const effect of plan.effects) {
      if (!declared.includes(effect.kind)) {
        throw new EffectResolutionError(
          "tool '" + tool.id + "' produced effect kind '" + effect.kind +
          "' not declared by capability '" + capability.id + "' (effectKinds: " +
          declared.join(', ') + ')',
        );
      }
    }
  }
}
