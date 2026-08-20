import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EFFECT_KINDS,
  EFFECT_OPERATIONS,
  createExecutionEffect,
  canonicalEffect,
  renameEffects,
  linkEffects,
} from '../effects/execution-effect.js';
import { createExecutionEffectSet, createEffectPlan } from '../effects/effect-set.js';
import { EffectResolutionError } from '../errors.js';

/** Unidades do modelo de efeitos (spec F8, secoes 3-5, 10, 13-14, 40-43). */

const fx = (operation, id, metadata = null) =>
  createExecutionEffect({ kind: 'filesystem', operation, resource: { type: 'filesystem', id }, metadata });

test('vocabulario: kinds fechados, operacoes por kind, reservados falham (secoes 4-5)', () => {
  assert.deepEqual(EFFECT_KINDS, ['filesystem', 'process', 'network', 'environment']);
  assert.deepEqual(EFFECT_OPERATIONS.filesystem, ['read', 'write', 'create', 'delete', 'rename', 'link']);
  assert.deepEqual(EFFECT_OPERATIONS.process, ['spawn', 'terminate']);
  assert.throws(() => createExecutionEffect({ kind: 'telepatia', operation: 'ler', resource: { type: 'x', id: 'y' } }), EffectResolutionError);
  assert.throws(() => fx('escrever', 'workspace/a'), EffectResolutionError, 'operacao desconhecida');
  // secao 4: network/environment sao vocabulario SEM operacao nesta fase
  assert.throws(
    () => createExecutionEffect({ kind: 'network', operation: 'connect', resource: { type: 'network', id: 'x' } }),
    /reserved vocabulary/,
  );
});

test('semantica distinta: write != delete != create != rename != link (secoes 5, 42-43)', () => {
  const ids = ['write', 'delete', 'create', 'rename', 'link', 'read']
    .map((op) => canonicalEffect(fx(op, 'workspace/a.txt')));
  assert.equal(new Set(ids).size, 6, 'cada operacao tem identidade propria');
});

test('dedup: identicos colapsam; read A e write A permanecem distintos (secao 13)', () => {
  const set = createExecutionEffectSet([
    fx('read', 'workspace/a'), fx('read', 'workspace/a'), fx('read', 'workspace/a'),
    fx('write', 'workspace/a'),
  ]);
  assert.equal(set.effects.length, 2);
});

test('ordenacao canonica: a ordem de descoberta nao muda o fingerprint (secao 14)', () => {
  const a = fx('read', 'workspace/a');
  const b = fx('write', 'workspace/b');
  const c = fx('delete', 'workspace/c');
  const one = createExecutionEffectSet([a, b, c]);
  const two = createExecutionEffectSet([c, a, b]);
  assert.equal(one.fingerprint, two.fingerprint);
  assert.deepEqual(one.effects, two.effects);
});

test('fingerprint muda quando o conjunto muda (secoes 10, 84)', () => {
  const one = createExecutionEffectSet([fx('write', 'workspace/a')]);
  const two = createExecutionEffectSet([fx('write', 'workspace/b')]);
  assert.notEqual(one.fingerprint, two.fingerprint);
  assert.match(one.fingerprint, /^[0-9a-f]{64}$/);
});

test('rename: source E destination participam, e counterparts diferentes diferem (secao 40)', () => {
  const pair = renameEffects({
    source: { type: 'filesystem', id: 'workspace/a' },
    destination: { type: 'filesystem', id: 'workspace/b' },
  });
  assert.equal(pair.length, 2);
  assert.deepEqual(pair.map((e) => e.metadata.role), ['source', 'destination']);
  assert.deepEqual(pair.map((e) => e.resource.id), ['workspace/a', 'workspace/b']);
  // metadata entra na identidade: rename a->b != rename a->c
  const other = renameEffects({
    source: { type: 'filesystem', id: 'workspace/a' },
    destination: { type: 'filesystem', id: 'workspace/c' },
  });
  assert.notEqual(canonicalEffect(pair[0]), canonicalEffect(other[0]));
});

test('link segue a regra do rename: dois recursos na autorizacao (secao 41)', () => {
  const pair = linkEffects({
    source: { type: 'filesystem', id: 'workspace/original' },
    destination: { type: 'filesystem', id: 'workspace/hard' },
  });
  assert.equal(pair.length, 2);
  assert.equal(pair[0].operation, 'link');
  assert.equal(pair[1].metadata.counterpart, 'filesystem://workspace/original');
});

test('imutabilidade: efeito e conjunto congelados (secao 74, INV-803)', () => {
  const effect = fx('write', 'workspace/a', { role: 'x' });
  const set = createExecutionEffectSet([effect]);
  assert.ok(Object.isFrozen(effect));
  assert.ok(Object.isFrozen(effect.resource));
  assert.ok(Object.isFrozen(effect.metadata));
  assert.ok(Object.isFrozen(set));
  assert.ok(Object.isFrozen(set.effects));
});

test('conjunto vazio nao existe; plano incomplete nao tem fingerprint (secoes 51-52)', () => {
  assert.throws(() => createExecutionEffectSet([]), EffectResolutionError);
  const plan = createEffectPlan({ completeness: 'incomplete', reason: 'escreve em arquivos desconhecidos' });
  assert.equal(plan.fingerprint, null, 'nada confiavel a correlacionar');
  assert.equal(plan.completeness, 'incomplete');
  assert.match(plan.reason, /desconhecidos/);
  const complete = createEffectPlan({ effects: [fx('read', 'workspace/a')] });
  assert.equal(complete.completeness, 'complete');
  assert.equal(complete.reason, null);
  assert.match(complete.fingerprint, /^[0-9a-f]{64}$/);
});
