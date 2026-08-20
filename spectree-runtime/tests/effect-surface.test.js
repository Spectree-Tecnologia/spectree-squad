import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime, ToolRuntime } from '../index.js';
import { createResourceRef } from '../effects/resource-ref.js';
import { createExecutionEffect } from '../effects/execution-effect.js';
import { createExecutionEffectSet, createEffectPlan } from '../effects/effect-set.js';
import { EffectResolver } from '../effects/effect-resolver.js';

/**
 * R8 sobre as superficies da F8 (spec secao 64): igualdade estrutural
 * por Object.keys — mudar um campo quebra este teste, deliberadamente.
 */

const effect = () => createExecutionEffect({
  kind: 'filesystem', operation: 'write',
  resource: { type: 'filesystem', id: 'workspace/a.txt' },
});

test('R8: ResourceRef e ExecutionEffect com superficie exata (secao 64)', () => {
  assert.deepEqual(Object.keys(createResourceRef({ type: 'filesystem', id: 'workspace/x' })), ['type', 'id']);
  assert.deepEqual(Object.keys(effect()), ['kind', 'operation', 'resource', 'metadata']);
  // metadata presente na superficie mesmo quando ausente no conteudo
  assert.equal(effect().metadata, null);
});

test('R8: ExecutionEffectSet e EffectPlan com superficie exata (secao 64)', () => {
  assert.deepEqual(Object.keys(createExecutionEffectSet([effect()])), ['effects', 'fingerprint']);
  assert.deepEqual(
    Object.keys(createEffectPlan({ effects: [effect()] })),
    ['effects', 'fingerprint', 'completeness', 'reason'],
  );
  assert.deepEqual(
    Object.keys(createEffectPlan({ completeness: 'incomplete' })),
    ['effects', 'fingerprint', 'completeness', 'reason'],
  );
});

test('R8: EffectResolver expoe exatamente resolve() (secao 64)', () => {
  const names = Object.getOwnPropertyNames(EffectResolver.prototype).filter((n) => n !== 'constructor');
  assert.deepEqual(names, ['resolve']);
});

test('seguranca por construcao: nenhuma rota executeWithoutEffects existe (secao 61)', () => {
  const publicNames = Object.getOwnPropertyNames(ToolRuntime.prototype);
  for (const forbidden of ['executeWithoutEffects', 'executeAssumingWorkspace', 'executeAllWorkspace']) {
    assert.ok(!publicNames.includes(forbidden), forbidden + ' nao pode existir');
  }
});

test('R8: EffectDecision projetado no evento com chaves exatas; Agent segue isolado (secoes 47, 64, 66)', async () => {
  const runtime = createRuntime();
  const events = [];
  runtime.eventBus.subscribe('effect.evaluated', (event) => events.push(event));
  runtime.capabilityRegistry.register({
    id: 'filesystem', name: 'FS', description: 't', operations: ['write'], effectKinds: ['filesystem'],
  });
  runtime.toolRuntime.register({
    id: 'fs.w', name: 'w', description: 'w', capability: 'filesystem', operation: 'write',
    resolveEffects: () => [effect()],
    execute: async () => 'ok',
  });
  runtime.policyRegistry.register({
    id: 'allow', effect: 'allow', capability: 'filesystem', resources: ['filesystem/workspace*'],
  });
  const { Agent } = await import('../agent/agent.js');
  let seen = null;
  class Probe extends Agent {
    async run(context) {
      seen = context;
      const result = await context.runtime.requestTool('fs.w', {});
      return result.output;
    }
  }
  const agent = new Probe({ id: 'a1', name: 'A', instructions: 'x' });
  const session = runtime.createSession({ agentId: 'a1', mission: 'probe' });
  const result = await runtime.loop.run(agent, session);
  assert.equal(result.status, 'completed');
  // a projecao publica de EffectDecision (secao 47)
  assert.deepEqual(Object.keys(events[0].payload).sort(),
    ['effect', 'effectSetFingerprint', 'kind', 'operation', 'policyId', 'resource']);
  // INV-810/R8 (secao 66): o Agent continua vendo apenas requestTool —
  // nenhum EffectResolver, PolicyEngine ou SandboxProvider no contexto
  assert.deepEqual(Object.keys(seen.runtime), ['requestTool']);
});
