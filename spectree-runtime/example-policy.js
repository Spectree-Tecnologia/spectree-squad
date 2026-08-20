/**
 * Prova minima da Fase 2 (spec secao 68):
 *   node spectree-runtime/example-policy.js
 *
 * Mesmo Agent + mesma Tool + mesmo Runtime produzem ALLOW num contexto
 * autorizado e DENY num contexto nao autorizado, sem modificar Agent,
 * Tool ou AgentLoop. As policies chegam de um arquivo JSON — configuracao
 * desacoplada do PolicyEngine (secao 42).
 */
import { readFileSync } from 'node:fs';
import { createRuntime, Agent, PolicyDeniedError, PolicyApprovalRequiredError } from './index.js';

const policies = JSON.parse(
  readFileSync(new URL('./policy/spectree.policies.json', import.meta.url), 'utf8'),
);

class MigrationAgent extends Agent {
  async run(context) {
    const result = await context.runtime.requestTool('database.migrate', {
      target: context.mission,
    });
    return result.output;
  }
}

function build() {
  const runtime = createRuntime();
  runtime.policyRegistry.registerMany(policies);
  runtime.capabilityRegistry.register({
    id: 'database',
    name: 'Database',
    description: 'familia de operacoes de banco de dados',
    operations: ['query', 'migration'],
  });
  runtime.toolRuntime.register({
    id: 'database.migrate',
    name: 'Database Migrate',
    description: 'aplica migrations no banco alvo',
    capability: 'database',
    operation: 'migration',
    resource: (input) => ({ type: 'database', id: input.target }),
    inputSchema: { type: 'object', required: ['target'], properties: { target: { type: 'string' } } },
    execute: async ({ target }) => 'migrated ' + target,
  });
  return runtime;
}

async function scenario(label, agentId, target) {
  const runtime = build();
  runtime.eventBus.subscribe('policy.evaluated', (event) =>
    console.log('  policy.evaluated -> ' + event.payload.effect + ' (' + event.payload.policyId + ')'),
  );
  const agent = new MigrationAgent({ id: agentId, name: agentId, instructions: 'migrate the database' });
  const session = runtime.createSession({ agentId, mission: target });
  console.log(label);
  const result = await runtime.loop.run(agent, session);
  if (result.status === 'completed') {
    console.log('  result: ' + result.output);
  } else if (result.error instanceof PolicyApprovalRequiredError) {
    console.log('  blocked: approval required (' + result.error.decision.policyId + ')');
  } else if (result.error instanceof PolicyDeniedError) {
    console.log('  blocked: denied (' + result.error.decision.policyId + ')');
  }
  console.log('');
}

await scenario('1. oracle -> database.migrate -> development (policy allow)', 'oracle', 'development');
await scenario('2. jakiro -> mesma tool, mesmo recurso (nenhuma policy compativel)', 'jakiro', 'development');
await scenario('3. oracle -> database.migrate -> production (approval-required)', 'oracle', 'production');
