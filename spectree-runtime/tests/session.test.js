import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../events/event-bus.js';
import { Session } from '../session/session.js';
import { SessionError, SessionStateError } from '../errors.js';

function makeSession(bus = new EventBus()) {
  return new Session({ agentId: 'agent-x', mission: 'test mission', eventBus: bus });
}

test('lifecycle valido: created -> running -> completed, com timestamps e eventos', () => {
  const bus = new EventBus();
  const types = [];
  bus.subscribe('*', (e) => types.push(e.type));
  const session = makeSession(bus);
  assert.match(session.id, /^sess_/);
  assert.equal(session.state, 'created');
  assert.ok(session.createdAt);
  assert.equal(session.startedAt, null);
  session.start();
  assert.equal(session.state, 'running');
  assert.ok(session.startedAt);
  session.complete({ done: true });
  assert.equal(session.state, 'completed');
  assert.ok(session.finishedAt);
  assert.ok(session.isFinished);
  assert.deepEqual(types, ['session.created', 'session.started', 'session.completed']);
});

test('running -> failed e running -> cancelled', () => {
  const failed = makeSession();
  failed.start();
  failed.fail(new Error('why'));
  assert.equal(failed.state, 'failed');

  const cancelled = makeSession();
  cancelled.start();
  cancelled.cancel('user asked');
  assert.equal(cancelled.state, 'cancelled');
  assert.ok(cancelled.isCancelled);
});

test('transicoes invalidas lancam SessionStateError', () => {
  const session = makeSession();
  assert.throws(() => session.complete('x'), SessionStateError); // created -> completed
  assert.throws(() => session.fail('x'), SessionStateError);     // created -> failed
  session.start();
  assert.throws(() => session.start(), SessionStateError);       // running -> running
  session.complete('x');
  assert.throws(() => session.cancel(), SessionStateError);      // completed -> cancelled
  assert.throws(() => session.fail('x'), SessionStateError);     // completed -> failed
});

test('duas sessions tem IDs diferentes e estados independentes', () => {
  const a = makeSession();
  const b = makeSession();
  assert.notEqual(a.id, b.id);
  a.start();
  assert.equal(a.state, 'running');
  assert.equal(b.state, 'created');
});

test('agentId e mission sao obrigatorios', () => {
  const bus = new EventBus();
  assert.throws(() => new Session({ mission: 'm', eventBus: bus }), SessionError);
  assert.throws(() => new Session({ agentId: 'a', eventBus: bus }), SessionError);
});
