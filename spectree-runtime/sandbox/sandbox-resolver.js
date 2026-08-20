import { platform as currentPlatform } from 'node:process';
import {
  SandboxUnavailableError,
  SandboxCapabilityError,
  SandboxCleanupError,
} from '../errors.js';
import { enforcementRank } from './execution-boundary.js';

/**
 * SandboxResolver (spec Fase 5, secao 15): SandboxPolicy -> SandboxProvider.
 * O Runtime nao conhece Landlock, ACL do Windows, container ou VM
 * (secao 15) — conhece este resolver, e o resolver escolhe o backend
 * capaz. Se nenhum for capaz, FALHA FECHADO (secoes 19, 79).
 *
 * Capabilities exigidas por modo (secao 17): a Fase 5 entrega apenas as
 * duas de filesystem.
 */
const REQUIRED_CAPABILITIES = Object.freeze({
  'read-only': Object.freeze(['filesystem-read-boundary']),
  'workspace-write': Object.freeze(['filesystem-read-boundary', 'filesystem-write-boundary']),
  'danger-full-access': Object.freeze([]),
});

export class SandboxResolver {
  #registry;
  #platform;

  constructor({ registry, platform = currentPlatform }) {
    this.#registry = registry;
    this.#platform = platform;
  }

  /**
   * Backend compativel com a policy, ou erro tipado. Nunca "aproxima"
   * silenciosamente (secao 99) e nunca faz downgrade (secao 100).
   */
  resolve(policy, { capabilityId } = {}) {
    const required = REQUIRED_CAPABILITIES[policy.mode] ?? [];
    const reasons = [];
    for (const provider of this.#registry.candidates()) {
      const platformOk = provider.platforms.includes('*') || provider.platforms.includes(this.#platform);
      if (!platformOk) {
        reasons.push(provider.providerId + ': platform ' + this.#platform + ' not supported');
        continue;
      }
      const missing = required.filter((capability) => !provider.capabilities.includes(capability));
      if (missing.length > 0) {
        reasons.push(provider.providerId + ': missing ' + missing.join(', '));
        continue;
      }
      if (!provider.supports({
        mode: policy.mode,
        capabilityId: capabilityId ?? null,
        requiredEnforcement: policy.requiredEnforcement,
      })) {
        reasons.push(provider.providerId + ': supports() declined');
        continue;
      }
      // secao 125: pedido `full` com backend `partial` NAO executa, a menos
      // que a policy tenha aceitado partial explicitamente (secao 126)
      const declared = provider.enforcement ?? 'none';
      const enough = enforcementRank(declared) >= enforcementRank(policy.requiredEnforcement);
      if (!enough && !(policy.allowPartialEnforcement && declared !== 'none')) {
        reasons.push(
          provider.providerId + ': enforcement ' + declared + ' < required ' + policy.requiredEnforcement,
        );
        continue;
      }
      return provider;
    }
    throw new SandboxUnavailableError(
      "no sandbox backend can enforce mode '" + policy.mode + "' on platform '" + this.#platform +
      "' (required enforcement: " + policy.requiredEnforcement + ')' +
      (reasons.length > 0 ? ' — ' + reasons.join('; ') : ''),
    );
  }

  /**
   * Capability declarada pela Tool tem de ser coberta pelo backend
   * (secao 152): capability sem fronteira correspondente e erro ANTES do
   * Provider, nunca uma execucao sem limite.
   */
  assertCapabilitySupported(provider, capabilityId, mode) {
    if (mode === 'danger-full-access') return;
    if (capabilityId === 'filesystem') {
      const needed = REQUIRED_CAPABILITIES[mode] ?? [];
      const missing = needed.filter((capability) => !provider.capabilities.includes(capability));
      if (missing.length > 0) {
        throw new SandboxCapabilityError(
          "sandbox provider '" + provider.providerId + "' cannot bound capability '" +
          capabilityId + "': missing " + missing.join(', '),
        );
      }
    }
  }
}

/**
 * dispose() idempotente e observavel (secoes 65-66, 107). Falha de
 * cleanup NUNCA falsifica o resultado da operacao principal: ela vira
 * SandboxCleanupError entregue ao observador, e quem chamou decide.
 */
export async function releaseSandbox(handle, onCleanupError) {
  if (!handle || typeof handle.dispose !== 'function') return;
  try {
    await handle.dispose();
  } catch (error) {
    const wrapped = error instanceof SandboxCleanupError
      ? error
      : new SandboxCleanupError('sandbox cleanup failed: ' + (error?.message ?? error), { cause: error });
    if (typeof onCleanupError === 'function') onCleanupError(wrapped);
    else throw wrapped;
  }
}
