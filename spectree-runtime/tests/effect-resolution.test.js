import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EffectResolver } from '../effects/effect-resolver.js';
import { processTools } from '../providers/local/subprocess-provider.js';
import { filesystemTools, filesystemCapability } from '../providers/local/filesystem-provider.js';
import { EffectResolutionError } from '../errors.js';

/** EffectResolver (spec F8, secoes 11-12, 21-23, 51-56). */

const resolver = new EffectResolver();
const FX = (operation, id) => ({ kind: 'filesystem', operation, resource: { type: 'filesystem', id } });

test('precedencia de fonte: tool.resolveEffects > tool.effects > capability (secao 56)', () => {
  const capability = {
    id: 'filesystem', effectKinds: ['filesystem'],
    resolveEffects: () => [FX('read', 'workspace/da-capability')],
  };
  const viaFn = resolver.resolve({
    tool: { id: 't1', resolveEffects: () => [FX('read', 'workspace/da-funcao')], effects: FX('read', 'workspace/estatico') },
    capability, input: {},
  });
  assert.equal(viaFn.effects[0].resource.id, 'workspace/da-funcao');
  const viaStatic = resolver.resolve({ tool: { id: 't2', effects: FX('read', 'workspace/estatico') }, capability, input: {} });
  assert.equal(viaStatic.effects[0].resource.id, 'workspace/estatico');
  const viaCapability = resolver.resolve({ tool: { id: 't3' }, capability, input: {} });
  assert.equal(viaCapability.effects[0].resource.id, 'workspace/da-capability');
});

test('caminho legado: sem fonte e sem effectKinds -> null (secao 63)', () => {
  assert.equal(resolver.resolve({ tool: { id: 'legacy' }, capability: { id: 'database' }, input: {} }), null);
  assert.equal(resolver.resolve({ tool: { id: 'legacy2' }, capability: null, input: {} }), null);
});

test('capability no modelo F8 sem rota de resolucao: fail closed (secoes 22, INV-805)', () => {
  assert.throws(
    () => resolver.resolve({ tool: { id: 'orfa' }, capability: { id: 'filesystem', effectKinds: ['filesystem'] }, input: {} }),
    (e) => e instanceof EffectResolutionError && /no effect resolution/.test(e.message),
  );
});

test('efeito fora dos effectKinds da capability nao passa (secao 55)', () => {
  assert.throws(
    () => resolver.resolve({
      tool: { id: 'x', resolveEffects: () => [{ kind: 'process', operation: 'spawn', resource: { type: 'process', id: 'workspace' } }] },
      capability: { id: 'filesystem', effectKinds: ['filesystem'] },
      input: {},
    }),
    /not declared by capability/,
  );
});

test('conjunto vazio e efeito invalido falham fechado (INV-805)', () => {
  assert.throws(
    () => resolver.resolve({ tool: { id: 'vazio', resolveEffects: () => [] }, capability: null, input: {} }),
    /empty effect set/,
  );
  assert.throws(
    () => resolver.resolve({ tool: { id: 'torto', resolveEffects: () => [{ kind: 'filesystem' }] }, capability: null, input: {} }),
    EffectResolutionError,
  );
});

test('plano incomplete atravessa sem virar workspace/* (secoes 51-52, 54)', () => {
  const plan = resolver.resolve({
    tool: { id: 'cego', resolveEffects: () => ({ completeness: 'incomplete', reason: 'escreve em algum lugar' }) },
    capability: null, input: {},
  });
  assert.equal(plan.completeness, 'incomplete');
  assert.equal(plan.fingerprint, null);
  assert.equal(plan.effects.length, 0, 'nada e inventado');
});

test('determinismo: mesma entrada, mesmo fingerprint (secao 11)', () => {
  const tool = filesystemTools()[1]; // write
  const one = resolver.resolve({ tool, capability: filesystemCapability, input: { path: './src/../src/a.js' } });
  const two = resolver.resolve({ tool, capability: filesystemCapability, input: { path: 'src/a.js' } });
  assert.equal(one.fingerprint, two.fingerprint, 'aliases canonicalizam para a mesma identidade (secao 36)');
});

test('spawn resolve DOIS efeitos: world e executavel (secoes 24-25)', () => {
  const spawn = processTools()[0];
  const plan = resolver.resolve({
    tool: spawn,
    capability: { id: 'process', effectKinds: ['process', 'filesystem'] },
    input: { argv: ['/usr/bin/node', '-e', '1'], cwd: '.' },
  });
  assert.equal(plan.effects.length, 2);
  assert.deepEqual(
    plan.effects.map((e) => e.resource.id).sort(),
    ['executable/node', 'workspace'],
  );
  assert.ok(plan.effects.every((e) => e.kind === 'process' && e.operation === 'spawn'));
});

test('spawn sem identidade de executavel: plano incomplete, nunca palpite (secoes 26, 52)', () => {
  const spawn = processTools()[0];
  const plan = resolver.resolve({ tool: spawn, capability: null, input: { argv: [], cwd: '.' } });
  assert.equal(plan.completeness, 'incomplete');
});
