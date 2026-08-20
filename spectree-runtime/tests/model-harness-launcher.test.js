import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ClaudeModelHarnessLauncher,
  classifyClaudeAuthProbe,
} from '../harness/claude-launcher.js';
import { modelHarnessLauncherContract } from '../harness/model-harness.js';
import { ProcessConfigurationError } from '../errors.js';

/** Adapter concreto do Claude (spec F9, INV-903, secoes 28-30, 33, 39). */

test('launch: argv explicito com os literais do adapter, nunca shell (secoes 3, 77)', () => {
  const launcher = new ClaudeModelHarnessLauncher();
  const input = modelHarnessLauncherContract(launcher, { request: { mission: 'diga oi', cwd: '.' } });
  assert.deepEqual([...input.argv], ['claude', '-p', 'diga oi', '--output-format', 'json']);
  assert.equal(input.stdin.mode, 'ignore');
  assert.equal(input.stdout.mode, 'collect');
  assert.equal(input.stderr.mode, 'collect');
  assert.ok(Object.isFrozen(input.argv));
});

test('nenhum ambiente e copiado do host; adicionais sao declaracao explicita (secoes 28-30)', () => {
  const bare = new ClaudeModelHarnessLauncher().launch({ mission: 'm' });
  assert.deepEqual([...bare.allowedEnvironmentKeys], [], 'nada implicito porque o harness e Claude');
  assert.equal(bare.env, undefined, 'zero overrides implicitos');
  const declared = new ClaudeModelHarnessLauncher({
    allowedEnvironmentKeys: ['ANTHROPIC_BASE_URL'],
  }).launch({ mission: 'm' });
  assert.deepEqual([...declared.allowedEnvironmentKeys], ['ANTHROPIC_BASE_URL']);
});

test('orcamentos: output acima do default e explicito; lifetime e pedido, nao teto (secoes 33, 38-39)', () => {
  const plain = new ClaudeModelHarnessLauncher().launch({ mission: 'm' });
  assert.equal(plain.stdout.maxBytes, undefined, 'default de 1 MiB fica com o OutputCollector');
  assert.equal(plain.maxLifetimeMs, undefined, 'sem timeout hard-coded no adapter (secao 38)');
  const budgeted = new ClaudeModelHarnessLauncher({ maxOutputBytes: 4 * 1024 * 1024, maxLifetimeMs: 60_000 })
    .launch({ mission: 'm' });
  assert.equal(budgeted.stdout.maxBytes, 4 * 1024 * 1024);
  assert.equal(budgeted.maxLifetimeMs, 60_000);
});

test('mission obrigatoria e cliPath validado', () => {
  assert.throws(() => new ClaudeModelHarnessLauncher().launch({}), ProcessConfigurationError);
  assert.throws(() => new ClaudeModelHarnessLauncher({ cliPath: '' }), ProcessConfigurationError);
});

test('classificacao de auth probe: tres vereditos, sem UNKNOWN silencioso (secoes 18-19, 80)', () => {
  const ok = classifyClaudeAuthProbe({
    outcome: { exitCode: 0, timedOut: false },
    stdoutText: '{"result":"hello"}',
  });
  assert.equal(ok.verdict, 'auth-ok');

  const insufficient = classifyClaudeAuthProbe({
    outcome: { exitCode: 1, timedOut: false },
    stderrText: 'Please log in with your credentials',
  });
  assert.equal(insufficient.verdict, 'auth-insufficient');

  // sem sinal classificavel = falha do RUNNER, nunca auth-insufficient
  const garbage = classifyClaudeAuthProbe({
    outcome: { exitCode: 3, timedOut: false },
    stdoutText: '???', stderrText: 'segfault',
  });
  assert.equal(garbage.verdict, 'runner-failure');

  const timeout = classifyClaudeAuthProbe({ outcome: { exitCode: null, timedOut: true } });
  assert.equal(timeout.verdict, 'runner-failure');

  const missing = classifyClaudeAuthProbe({});
  assert.equal(missing.verdict, 'runner-failure');
});
