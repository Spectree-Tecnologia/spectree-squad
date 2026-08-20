import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStructuredHarnessOutput } from '../harness/harness-output.js';

/** Output contract (spec F9, secoes 33-37, 67-69, 107). */

const ok = { exitCode: 0, signal: null, timedOut: false };

test('resposta estruturada valida -> complete com documento', () => {
  const result = parseStructuredHarnessOutput({
    outcome: ok,
    stdout: { text: '{"result":"done","cost":1}', truncated: false },
    stderr: { text: 'debug noise', truncated: false },
  });
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.document, { result: 'done', cost: 1 });
});

test('secoes 34, 107: truncated=true e FALHA estruturada, nunca resposta parcial', () => {
  const result = parseStructuredHarnessOutput({
    outcome: ok,
    stdout: { text: '{"result":"do', truncated: true },
  });
  assert.equal(result.status, 'structured-output-truncated');
  assert.equal(result.document, undefined, 'JSON truncado nao vira documento');
});

test('secao 68: JSON invalido sob formato declarado = parse-failure', () => {
  const result = parseStructuredHarnessOutput({
    outcome: ok,
    stdout: { text: 'I am not JSON at all', truncated: false },
  });
  assert.equal(result.status, 'structured-output-parse-failure');
});

test('exit != 0 e process-failure — categorias nao se mascaram (secoes 35, 79)', () => {
  const result = parseStructuredHarnessOutput({
    outcome: { exitCode: 3, signal: null, timedOut: false },
    stdout: { text: '{"valid":"json"}', truncated: false },
  });
  assert.equal(result.status, 'process-failure');
  assert.match(result.reason, /code 3/);
});

test('secoes 41-42: timeout e estado proprio, vindo do FATO do outcome', () => {
  const result = parseStructuredHarnessOutput({
    outcome: { exitCode: null, signal: 'SIGKILL', timedOut: true },
    stdout: { text: '', truncated: false },
  });
  assert.equal(result.status, 'timed-out');
});

test('secao 69: stderr e diagnostico, nunca o documento', () => {
  const result = parseStructuredHarnessOutput({
    outcome: ok,
    stdout: { text: 'nope', truncated: false },
    stderr: { text: '{"looks":"structured"}', truncated: false },
  });
  assert.equal(result.status, 'structured-output-parse-failure',
    'JSON no stderr nao salva um stdout invalido');
});

test('sem stdout coletado = process-failure explicito', () => {
  assert.equal(parseStructuredHarnessOutput({ outcome: ok }).status, 'process-failure');
  assert.equal(parseStructuredHarnessOutput({}).status, 'process-failure');
});
