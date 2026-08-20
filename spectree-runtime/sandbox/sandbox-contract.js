import assert from 'node:assert/strict';
import { createSandboxPolicy } from './sandbox-policy.js';
import { SANDBOX_MODES, ENFORCEMENT_LEVELS } from './execution-boundary.js';

/**
 * Contrato de SandboxProvider (spec Fase 5, secao 154). Todo backend
 * futuro — Landlock no Linux, Restricted Token no Windows, container,
 * remoto — passa por AQUI. E o que garante que trocar o mecanismo de
 * isolamento nao mude o contrato que o Runtime consome.
 *
 * O contrato NAO testa a forca do isolamento: isso e especifico de cada
 * backend. Ele testa a honestidade da declaracao e a disciplina do
 * ciclo de vida.
 *
 * @param {object} provider
 * @param {object} options
 * @param {string} options.workspaceRoot  diretorio real para as roots
 * @param {string} [options.mode]         modo a exercitar
 */
export async function sandboxProviderContract(provider, { workspaceRoot, mode = 'workspace-write' }) {
  // --- declaracao ---------------------------------------------------
  assert.equal(typeof provider.providerId, 'string', 'providerId');
  assert.ok(provider.providerId.length > 0, 'providerId nao vazio');
  assert.equal(typeof provider.version, 'string', 'version para diagnostico (secao 128)');
  assert.ok(Array.isArray(provider.platforms) && provider.platforms.length > 0, 'platforms');
  assert.ok(Array.isArray(provider.capabilities) && provider.capabilities.length > 0, 'capabilities');
  assert.ok(
    ENFORCEMENT_LEVELS.includes(provider.enforcement ?? 'none'),
    'enforcement declarado tem de ser full, partial ou none (secao 18)',
  );

  const policy = createSandboxPolicy({
    mode,
    workspaceRoot,
    requiredEnforcement: provider.enforcement ?? 'none',
    allowPartialEnforcement: true,
  });

  // --- supports -----------------------------------------------------
  assert.equal(typeof provider.supports, 'function', 'supports (secao 98)');
  assert.equal(
    provider.supports({ mode, capabilityId: 'filesystem', requiredEnforcement: provider.enforcement ?? 'none' }),
    true,
    'supports deve aceitar o proprio enforcement declarado',
  );
  // secao 143: nunca alegar mais do que entrega
  if ((provider.enforcement ?? 'none') !== 'full') {
    assert.equal(
      provider.supports({ mode, capabilityId: 'filesystem', requiredEnforcement: 'full' }),
      false,
      'backend nao-full nunca pode aceitar um pedido de enforcement full',
    );
  }
  assert.equal(
    provider.supports({ mode: 'modo-que-nao-existe', capabilityId: 'filesystem', requiredEnforcement: 'none' }),
    false,
    'modo desconhecido nao e suportado',
  );

  // --- describe -----------------------------------------------------
  const description = provider.describe(policy);
  assert.equal(typeof description, 'object', 'describe devolve objeto (secao 72)');
  assert.equal(description.providerId, provider.providerId);
  assert.equal(description.enforcement, provider.enforcement ?? 'none', 'describe nao pode inflar enforcement');
  assert.ok(SANDBOX_MODES.includes(description.mode));
  // secao 71: descricao nao carrega o conteudo das roots
  assert.ok(
    !JSON.stringify(description).includes(workspaceRoot),
    'describe nao pode vazar o path das roots',
  );

  // --- apply --------------------------------------------------------
  const handle = await provider.apply(policy, {
    sessionId: 'contract-session',
    agentId: 'contract-agent',
    capabilityId: 'filesystem',
    operation: 'write',
    resource: { type: 'filesystem', id: 'workspace/contract.js' },
    sandboxMode: policy.mode,
    workspaceRoot: policy.workspaceRoot,
  });
  assert.ok(Object.isFrozen(handle), 'handle congelado (secao 89)');
  assert.equal(handle.mode, policy.mode);
  assert.equal(handle.enforcement, provider.enforcement ?? 'none', 'handle nao pode inflar enforcement');
  assert.equal(handle.providerId, provider.providerId);
  assert.ok(handle.boundary, 'handle expoe o boundary');
  assert.equal(typeof handle.dispose, 'function');
  // secao 63: o mecanismo bruto nao vaza pelo handle
  for (const forbidden of ['provider', 'registry', 'policyEngine', 'toolRuntime']) {
    assert.equal(handle[forbidden], undefined, 'handle nao expoe ' + forbidden);
  }

  // --- cleanup ------------------------------------------------------
  await handle.dispose();
  await handle.dispose(); // idempotente (secao 107)

  return description;
}
