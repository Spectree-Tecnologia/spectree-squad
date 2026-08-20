/**
 * Prova minima da Fase 2, atualizada na Fase 4.5:
 *   node spectree-runtime/example-policy.js
 *
 * Mesmo Agent + mesma Tool + mesmo Runtime produzem ALLOW, DENY ou
 * APPROVAL-REQUIRED conforme o contexto, sem modificar Agent, Tool ou
 * AgentLoop. As policies chegam da MATRIZ OFICIAL do squad
 * (squad.policies.json), pelo adapter oficial — o mesmo arquivo e o
 * mesmo caminho de carga que o guard PreToolUse e os testes usam.
 * Uma autoridade, mesma decisao em todo consumidor.
 */
import {
  createRuntime,
  policyEngineFromDocument,
  Agent,
  PolicyDeniedError,
  PolicyApprovalRequiredError,
} from './index.js';

const MATRIX = new URL('../squad.policies.json', import.meta.url);

class DatabaseAgent extends Agent {
  async run(context) {
    const result = await context.runtime.requestTool(context.mission, { target: 'app' });
    return result.output;
  }
}

function build() {
  const { registry } = policyEngineFromDocument(MATRIX);
  const runtime = createRuntime({ policyRegistry: registry });
  runtime.capabilityRegistry.register({
    id: 'database',
    name: 'Database',
    description: 'familia de operacoes de banco de dados',
    operations: ['query', 'migration', 'destructive-migration'],
  });
  runtime.toolRuntime.register({
    id: 'database.migrate',
    name: 'Database Migrate',
    description: 'aplica migrations no banco',
    capability: 'database',
    operation: 'migration',
    execute: async ({ target }) => 'migrated ' + target,
  });
  runtime.toolRuntime.register({
    id: 'database.drop',
    name: 'Database Drop',
    description: 'operacao destrutiva de banco',
    capability: 'database',
    operation: 'destructive-migration',
    execute: async ({ target }) => 'dropped ' + target,
  });
  return runtime;
}

async function scenario(label, agentId, toolId) {
  const runtime = build();
  runtime.eventBus.subscribe('policy.evaluated', (event) =>
    console.log('  policy.evaluated -> ' + event.payload.effect + ' (' + event.payload.policyId + ')'),
  );
  const agent = new DatabaseAgent({ id: agentId, name: agentId, instructions: 'operate the database' });
  const session = runtime.createSession({ agentId, mission: toolId });
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

await scenario('1. oracle -> database.migrate (allow nominal da matriz)', 'oracle', 'database.migrate');
await scenario('2. jakiro -> mesma tool (default deny: banco nao e dele)', 'jakiro', 'database.migrate');
await scenario('3. oracle -> database.drop (gate do Founder vence o allow)', 'oracle', 'database.drop');
