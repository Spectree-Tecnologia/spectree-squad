/**
 * Prova minima da Fase 3 (spec secao 95):
 *   node spectree-runtime/example-approval.js
 *
 * oracle -> database.migrate -> production, sob approval-required.
 * 1. Founder aprova  -> revalida policy -> resume -> tool executa
 * 2. Founder nega    -> Tool.execute() = 0
 * 3. Founder aprova, policy muda para deny -> PolicyRevalidationError
 */
import {
  createRuntime,
  PolicyApprovalRequiredError,
  PolicyRevalidationError,
} from './index.js';

function build() {
  const runtime = createRuntime();
  runtime.eventBus.subscribe('*', (event) => {
    if (event.type.startsWith('approval.') || event.type.startsWith('tool.')) {
      console.log('  ' + event.type);
    }
  });
  runtime.policyRegistry.register({
    id: 'production-migration-approval',
    effect: 'approval-required',
    capability: 'database',
    operations: ['migration'],
    resource: 'production',
  });
  const tool = {
    id: 'database.migrate',
    name: 'Database Migrate',
    description: 'aplica migrations no banco alvo',
    capability: 'database',
    operation: 'migration',
    resource: (input) => ({ type: 'database', id: input.target }),
    calls: 0,
    execute: async ({ target }) => {
      tool.calls += 1;
      return 'migrated ' + target;
    },
  };
  runtime.toolRuntime.register(tool);
  return { runtime, tool };
}

async function suspend(runtime) {
  try {
    await runtime.toolRuntime.execute(
      { toolId: 'database.migrate', input: { target: 'production' } },
      { agentId: 'oracle', session: { id: 'sess_demo' } },
    );
  } catch (error) {
    if (error instanceof PolicyApprovalRequiredError) return error.approvalId;
    throw error;
  }
}

console.log('1. Founder aprova -> revalidacao -> resume -> execucao');
{
  const { runtime, tool } = build();
  const approvalId = await suspend(runtime);
  runtime.founderGate.approve(approvalId);
  const result = await runtime.approvalManager.resume(approvalId);
  console.log('  result: ' + result.output + ' | Tool.execute() = ' + tool.calls + '\n');
}

console.log('2. Founder nega -> execucao nunca acontece');
{
  const { runtime, tool } = build();
  const approvalId = await suspend(runtime);
  runtime.founderGate.deny(approvalId, undefined, 'not during business hours');
  console.log('  status: ' + runtime.approvalManager.get(approvalId).status +
    ' | Tool.execute() = ' + tool.calls + '\n');
}

console.log('3. Founder aprova, mas a policy mudou para deny -> revalidacao bloqueia');
{
  const { runtime, tool } = build();
  const approvalId = await suspend(runtime);
  runtime.founderGate.approve(approvalId);
  runtime.policyRegistry.register({ id: 'freeze-production', effect: 'deny', resource: 'production' });
  try {
    await runtime.approvalManager.resume(approvalId);
  } catch (error) {
    if (error instanceof PolicyRevalidationError) {
      console.log('  blocked: ' + error.decision.reason);
    } else {
      throw error;
    }
  }
  console.log('  Tool.execute() = ' + tool.calls);
}
