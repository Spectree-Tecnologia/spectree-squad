import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PolicyRegistry } from '../policy/policy-registry.js';
import { PolicyEngine } from '../policy/policy-engine.js';
import { PolicyConfigurationError } from '../errors.js';

/** Contexto base: oracle migrando o banco de development. */
const ctx = (over = {}) => ({
  principal: { type: 'agent', id: 'oracle' },
  session: { id: 'sess_x' },
  tool: { id: 'database.migrate', capability: 'database' },
  operation: 'migration',
  input: {},
  resource: { type: 'database', id: 'development' },
  ...over,
});

function engineWith(...policies) {
  const registry = new PolicyRegistry();
  registry.registerMany(policies);
  return new PolicyEngine({ registry });
}

test('matching por dimensao: principal, tool glob, capability, operation, resource', () => {
  const byPrincipal = engineWith({ id: 'p', effect: 'allow', principal: 'oracle' });
  assert.equal(byPrincipal.decide(ctx()).effect, 'allow');
  assert.equal(byPrincipal.decide(ctx({ principal: { type: 'agent', id: 'jakiro' } })).effect, 'deny');

  const byToolGlob = engineWith({ id: 't', effect: 'allow', tool: 'database.*' });
  assert.equal(byToolGlob.decide(ctx()).effect, 'allow');
  assert.equal(byToolGlob.decide(ctx({ tool: { id: 'filesystem.read', capability: 'filesystem' } })).effect, 'deny');

  const byCapability = engineWith({ id: 'c', effect: 'allow', capability: 'database' });
  assert.equal(byCapability.decide(ctx()).effect, 'allow');
  assert.equal(byCapability.decide(ctx({ tool: { id: 'x', capability: 'browser' } })).effect, 'deny');

  const byOperation = engineWith({ id: 'o', effect: 'allow', operations: ['query', 'migration'] });
  assert.equal(byOperation.decide(ctx()).effect, 'allow');
  assert.equal(byOperation.decide(ctx({ operation: 'delete' })).effect, 'deny');

  const byResourceId = engineWith({ id: 'r1', effect: 'allow', resource: 'development' });
  assert.equal(byResourceId.decide(ctx()).effect, 'allow');
  const byResourceFull = engineWith({ id: 'r2', effect: 'allow', resource: 'database/development' });
  assert.equal(byResourceFull.decide(ctx()).effect, 'allow');
  const byResourceGlob = engineWith({ id: 'r3', effect: 'allow', resources: ['database/*'] });
  assert.equal(byResourceGlob.decide(ctx()).effect, 'allow');
  assert.equal(byResourceGlob.decide(ctx({ resource: { type: 'git', id: 'repo' } })).effect, 'deny');
});

test('campo omitido e wildcard; policy com resource nao casa contexto sem resource', () => {
  const everything = engineWith({ id: 'wide', effect: 'allow' });
  assert.equal(everything.decide(ctx()).effect, 'allow');
  assert.equal(everything.decide(ctx({ principal: { type: 'agent', id: 'anyone' } })).effect, 'allow');

  const needsResource = engineWith({ id: 'res', effect: 'allow', resource: 'development' });
  assert.equal(needsResource.decide(ctx({ resource: null })).effect, 'deny');
});

test('decisoes carregam policyId e reason deterministica; default deny explicito', () => {
  const engine = engineWith(
    { id: 'oracle-dev', effect: 'allow', principal: 'oracle', resource: 'development' },
  );
  const allowed = engine.decide(ctx());
  assert.equal(allowed.policyId, 'oracle-dev');
  assert.match(allowed.reason, /policy 'oracle-dev' explicitly allows/);
  assert.match(allowed.reason, /database\.migrate/);

  const denied = engine.decide(ctx({ principal: { type: 'agent', id: 'jakiro' } }));
  assert.deepEqual(
    { effect: denied.effect, policyId: denied.policyId },
    { effect: 'deny', policyId: 'default-deny' },
  );
  assert.match(denied.reason, /no policy grants principal 'jakiro'/);
});

test('precedencia: deny > approval-required > allow > default deny', () => {
  const denyWins = engineWith(
    { id: 'allow-db', effect: 'allow', capability: 'database' },
    { id: 'deny-prod', effect: 'deny', resource: 'development' },
  );
  assert.deepEqual(
    denyWins.decide(ctx()).policyId, 'deny-prod',
  );

  const approvalWins = engineWith(
    { id: 'allow-db', effect: 'allow', capability: 'database' },
    { id: 'needs-ok', effect: 'approval-required', operations: ['migration'] },
  );
  assert.equal(approvalWins.decide(ctx()).effect, 'approval-required');

  const allowAlone = engineWith({ id: 'allow-db', effect: 'allow', capability: 'database' });
  assert.equal(allowAlone.decide(ctx()).effect, 'allow');
});

test('priority desempata a selecao mas NUNCA transforma deny em allow', () => {
  const engine = engineWith(
    { id: 'allow-vip', effect: 'allow', priority: 100, capability: 'database' },
    { id: 'deny-low', effect: 'deny', priority: 0, capability: 'database' },
  );
  assert.equal(engine.decide(ctx()).effect, 'deny');

  const tie = engineWith(
    { id: 'allow-a', effect: 'allow', priority: 1, capability: 'database' },
    { id: 'allow-b', effect: 'allow', priority: 9, capability: 'database' },
  );
  assert.equal(tie.decide(ctx()).policyId, 'allow-b');
});

test('determinismo: mesmo contexto, mesma decisao - inclusive com registry reconstruido', () => {
  const policies = [
    { id: 'a', effect: 'allow', capability: 'database' },
    { id: 'd', effect: 'deny', resource: 'production' },
  ];
  const first = engineWith(...policies).decide(ctx());
  const second = engineWith(...policies).decide(ctx());
  const third = engineWith(...policies).decide(ctx());
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);
});

test('policy registrada e imutavel; mutar o objeto de origem nao muda a decisao', () => {
  const source = { id: 'mutable', effect: 'deny', capability: 'database' };
  const registry = new PolicyRegistry();
  registry.register(source);
  source.effect = 'allow'; // mutacao no objeto original
  const engine = new PolicyEngine({ registry });
  assert.equal(engine.decide(ctx()).effect, 'deny');
  assert.ok(Object.isFrozen(registry.get('mutable')));
});

test('registry: duplicado, effect invalido, matcher invalido, remove e replace', () => {
  const registry = new PolicyRegistry();
  registry.register({ id: 'one', effect: 'allow' });
  assert.throws(() => registry.register({ id: 'one', effect: 'deny' }), PolicyConfigurationError);
  assert.throws(() => registry.register({ id: 'bad', effect: 'maybe' }), PolicyConfigurationError);
  assert.throws(() => registry.register({ effect: 'allow' }), PolicyConfigurationError);
  assert.throws(
    () => registry.register({ id: 'empty', effect: 'allow', tools: [] }),
    PolicyConfigurationError,
  );
  registry.replace({ id: 'one', effect: 'deny' });
  assert.equal(registry.get('one').effect, 'deny');
  registry.remove('one');
  assert.equal(registry.get('one'), undefined);
  assert.deepEqual(registry.list(), []);
});

test('o engine nao modifica o AuthorizationContext (INV-211)', () => {
  const engine = engineWith({ id: 'a', effect: 'allow' });
  const context = ctx();
  const snapshot = JSON.stringify(context);
  engine.decide(context);
  assert.equal(JSON.stringify(context), snapshot);
});
