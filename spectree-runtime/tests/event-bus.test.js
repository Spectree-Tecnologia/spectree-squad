import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus, WILDCARD } from '../events/event-bus.js';

test('publish monta o envelope: id unico, timestamp, type, payload', () => {
  const bus = new EventBus();
  const a = bus.publish('x.one', { sessionId: 's1', payload: { n: 1 } });
  const b = bus.publish('x.one', { sessionId: 's1' });
  assert.match(a.id, /^evt_/);
  assert.notEqual(a.id, b.id);
  assert.equal(a.type, 'x.one');
  assert.ok(!Number.isNaN(Date.parse(a.timestamp)));
  assert.equal(a.sessionId, 's1');
  assert.deepEqual(a.payload, { n: 1 });
  assert.deepEqual(b.payload, {});
});

test('subscribe recebe; unsubscribe (fn devolvida e metodo) para de receber', () => {
  const bus = new EventBus();
  const seen = [];
  const handler = (e) => seen.push(e.type);
  const off = bus.subscribe('x.one', handler);
  bus.publish('x.one');
  off();
  bus.publish('x.one');
  bus.subscribe('x.two', handler);
  bus.unsubscribe('x.two', handler);
  bus.publish('x.two');
  assert.deepEqual(seen, ['x.one']);
});

test('multiplos subscribers recebem o mesmo evento; wildcard recebe tudo', () => {
  const bus = new EventBus();
  const seen = [];
  bus.subscribe('x.one', () => seen.push('a'));
  bus.subscribe('x.one', () => seen.push('b'));
  bus.subscribe(WILDCARD, (e) => seen.push('w:' + e.type));
  bus.publish('x.one');
  bus.publish('x.other');
  assert.deepEqual(seen, ['a', 'b', 'w:x.one', 'w:x.other']);
});

test('falha de um subscriber e isolada: os demais recebem, runtime nao cai', () => {
  const errors = [];
  const bus = new EventBus({ onSubscriberError: (error) => errors.push(error.message) });
  const seen = [];
  bus.subscribe('x.one', () => {
    throw new Error('observer exploded');
  });
  bus.subscribe('x.one', (e) => seen.push(e.type));
  assert.doesNotThrow(() => bus.publish('x.one'));
  assert.deepEqual(seen, ['x.one']);
  assert.deepEqual(errors, ['observer exploded']);
});

test('eventos chegam na ordem de publicacao', () => {
  const bus = new EventBus();
  const seen = [];
  bus.subscribe(WILDCARD, (e) => seen.push(e.type));
  for (const t of ['a', 'b', 'c', 'd']) bus.publish(t);
  assert.deepEqual(seen, ['a', 'b', 'c', 'd']);
});
