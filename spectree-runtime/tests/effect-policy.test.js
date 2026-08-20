import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../index.js';
import { canonicalFilesystemPath } from '../effects/resource-ref.js';
import { renameEffects } from '../effects/execution-effect.js';
import {
  PolicyDeniedError,
  PolicyApprovalRequiredError,
  EffectAuthorizationError,
} from '../errors.js';

/**
 * Policy sobre Effect Set (spec F8, secoes 15-17, 33-34, 80-82,
 * INV-804): cada efeito e avaliado, qualquer DENY vence o conjunto, e
 * nao existe autorizacao parcial.
 */

const fsEffect = (operation, rawPath) => ({
  kind: 'filesystem',
  operation,
  resource: { type: 'filesystem', id: canonicalFilesystemPath(rawPath) },
});

/**
 * Tool de teste 'batch.fs': o input declara CAMINHOS (como qualquer tool
 * de filesystem) e o resolver os canonicaliza — o caller nunca fornece o
 * resource de autorizacao (INV-806); o matching acontece sobre o
 * canonico, nunca sobre o input bruto (secao 35).
 */
function build({ policies }) {
  const runtime = createRuntime();
  const events = [];
  runtime.eventBus.subscribe('*', (event) => events.push(event));
  runtime.capabilityRegistry.register({
    id: 'filesystem', name: 'FS', description: 'teste',
    operations: ['read', 'write', 'delete', 'rename', 'link', 'batch'],
    effectKinds: ['filesystem'],
  });
  const executed = [];
  runtime.toolRuntime.register({
    id: 'batch.fs', name: 'batch', description: 'multi-effect', capability: 'filesystem',
    operation: 'batch',
    resolveEffects(input) {
      return [
        ...(input.reads ?? []).map((p) => fsEffect('read', p)),
        ...(input.writes ?? []).map((p) => fsEffect('write', p)),
        ...(input.deletes ?? []).map((p) => fsEffect('delete', p)),
        ...(input.renames ?? []).flatMap(({ from, to }) => renameEffects({
          source: { type: 'filesystem', id: canonicalFilesystemPath(from) },
          destination: { type: 'filesystem', id: canonicalFilesystemPath(to) },
        })),
      ];
    },
    execute: async (input) => { executed.push(input); return 'executed'; },
  });
  runtime.policyRegistry.registerMany(policies);
  return { runtime, events, executed, types: () => events.map((e) => e.type) };
}

const ctx = { agentId: 'oracle', session: { id: 'sess_fx' } };
const ALLOW_WORKSPACE = {
  id: 'allow-ws', effect: 'allow', principal: 'oracle',
  capability: 'filesystem', resources: ['filesystem/workspace*'],
};

test('multi-effect: TODOS os efeitos sao avaliados e o conjunto executa (secao 81)', async () => {
  const env = build({ policies: [ALLOW_WORKSPACE] });
  const result = await env.runtime.toolRuntime.execute(
    { toolId: 'batch.fs', input: { reads: ['a.txt'], writes: ['b.txt'], deletes: ['c.txt'] } }, ctx,
  );
  assert.equal(result.output, 'executed');
  const resolved = env.events.find((e) => e.type === 'effect.resolved');
  assert.equal(resolved.payload.effectCount, 3);
  const evaluated = env.events.filter((e) => e.type === 'effect.evaluated');
  assert.equal(evaluated.length, 3, 'cada efeito passou pela Policy');
  assert.ok(evaluated.every((e) => e.payload.effectSetFingerprint === resolved.payload.effectSetFingerprint),
    'secao 72: fingerprint correlaciona resolucao e decisoes');
  assert.deepEqual(
    evaluated.map((e) => e.payload.operation).sort(),
    ['delete', 'read', 'write'],
  );
});

test('um DENY nega o conjunto inteiro: zero execucao (secoes 16, 33, 82, INV-804)', async () => {
  const env = build({ policies: [
    ALLOW_WORKSPACE,
    { id: 'no-delete', effect: 'deny', capability: 'filesystem', operations: ['delete'] },
  ] });
  await assert.rejects(
    env.runtime.toolRuntime.execute(
      { toolId: 'batch.fs', input: { reads: ['a.txt'], writes: ['b.txt'], deletes: ['c.txt'] } }, ctx,
    ),
    (error) => error instanceof EffectAuthorizationError
      && error instanceof PolicyDeniedError // o detalhe tipado existente e preservado (secao 69)
      && error.deniedEffect.operation === 'delete'
      && error.deniedEffect.resource === 'filesystem://workspace/c.txt',
  );
  assert.equal(env.executed.length, 0, 'read e write autorizados NAO fazem nada executar');
  assert.ok(env.types().includes('effect.denied'));
  assert.ok(!env.types().includes('tool.started'));
});

test('cwd/contexto nao amplia autorizacao: efeito fora do workspace morre no default deny (secoes 80, INV-802)', async () => {
  const env = build({ policies: [ALLOW_WORKSPACE] });
  await assert.rejects(
    env.runtime.toolRuntime.execute(
      { toolId: 'batch.fs', input: { reads: ['dentro.txt'], writes: ['../fora/x.txt'] } }, ctx,
    ),
    (error) => error instanceof EffectAuthorizationError
      && error.deniedEffect.resource === 'filesystem://outside-workspace',
  );
  assert.equal(env.executed.length, 0);
});

test('composicao: ALLOW + APPROVAL = APPROVAL; DENY vence APPROVAL (secao 17, 34)', async () => {
  const approval = build({ policies: [
    ALLOW_WORKSPACE,
    { id: 'delete-gate', effect: 'approval-required', capability: 'filesystem', operations: ['delete'], resources: ['filesystem/workspace*'] },
  ] });
  await assert.rejects(
    approval.runtime.toolRuntime.execute(
      { toolId: 'batch.fs', input: { reads: ['a.txt'], deletes: ['c.txt'] } }, ctx,
    ),
    PolicyApprovalRequiredError,
  );
  assert.ok(approval.types().includes('effect.approval-required'));
  assert.equal(approval.executed.length, 0, 'o processo nao inicia antes da decisao (secao 34)');

  const deny = build({ policies: [
    ALLOW_WORKSPACE,
    { id: 'delete-gate', effect: 'approval-required', capability: 'filesystem', operations: ['delete'] },
    { id: 'no-write', effect: 'deny', capability: 'filesystem', operations: ['write'] },
  ] });
  await assert.rejects(
    deny.runtime.toolRuntime.execute(
      { toolId: 'batch.fs', input: { writes: ['b.txt'], deletes: ['c.txt'] } }, ctx,
    ),
    EffectAuthorizationError,
  );
  assert.ok(!deny.types().includes('approval.requested'), 'DENY vence: nenhuma approval nasce');
});

test('rename: source E destination participam — destino fora do subtree nega (secao 40)', async () => {
  const env = build({ policies: [
    { id: 'docs-only', effect: 'allow', principal: 'oracle', capability: 'filesystem', resources: ['filesystem/workspace/docs*'] },
  ] });
  // dentro do subtree: os dois recursos casam
  const ok = await env.runtime.toolRuntime.execute(
    { toolId: 'batch.fs', input: { renames: [{ from: 'docs/a.md', to: 'docs/b.md' }] } }, ctx,
  );
  assert.equal(ok.output, 'executed');
  // destino fora do subtree autorizado: o rename inteiro morre
  await assert.rejects(
    env.runtime.toolRuntime.execute(
      { toolId: 'batch.fs', input: { renames: [{ from: 'docs/a.md', to: 'src/a.md' }] } }, ctx,
    ),
    (error) => error instanceof EffectAuthorizationError
      && error.deniedEffect.resource === 'filesystem://workspace/src/a.md',
  );
});

test('projecao segura: eventos de efeito carregam canonico e decisao, nunca input bruto (secoes 46-47)', async () => {
  const env = build({ policies: [ALLOW_WORKSPACE] });
  await env.runtime.toolRuntime.execute(
    { toolId: 'batch.fs', input: { writes: ['./docs/../dist/a.js'], secretPayload: 'senha-XYZ' } }, ctx,
  );
  const evaluated = env.events.find((e) => e.type === 'effect.evaluated');
  assert.deepEqual(Object.keys(evaluated.payload).sort(),
    ['effect', 'effectSetFingerprint', 'kind', 'operation', 'policyId', 'resource']);
  assert.equal(evaluated.payload.resource, 'filesystem://workspace/dist/a.js', 'canonico, nao o alias bruto');
  assert.ok(!JSON.stringify(env.events).includes('senha-XYZ'), 'input bruto nunca vai ao bus');
});
