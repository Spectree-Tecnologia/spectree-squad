/**
 * Output contract do harness (spec F9, secoes 33-37, 67-69): o adapter
 * transforma a saida crua do processo num resultado NORMATIVO —
 * collect -> validate -> parse -> report. JSON potencialmente truncado
 * NUNCA vira resposta valida (secao 34); stderr e canal diagnostico,
 * nunca o documento (secao 69).
 *
 * Estados (secao 35): complete | structured-output-truncated |
 * structured-output-parse-failure | process-failure | timed-out.
 */
export function parseStructuredHarnessOutput(toolOutput) {
  const outcome = toolOutput?.outcome;
  if (!outcome) {
    return Object.freeze({ status: 'process-failure', reason: 'no process outcome' });
  }
  // secoes 41-42: timeout e fato do outcome, semanticamente distinto
  if (outcome.timedOut) {
    return Object.freeze({ status: 'timed-out', reason: 'maxLifetimeMs expired', outcome });
  }
  if (outcome.exitCode !== 0) {
    return Object.freeze({
      status: 'process-failure',
      reason: 'harness exited with code ' + outcome.exitCode +
        (outcome.signal ? ' (signal ' + outcome.signal + ')' : ''),
      outcome,
    });
  }
  const stdout = toolOutput.stdout;
  if (!stdout || typeof stdout.text !== 'string') {
    return Object.freeze({ status: 'process-failure', reason: 'no collected stdout', outcome });
  }
  // secao 34: truncated = true e FALHA de output estruturado, nunca
  // resposta parcial valida
  if (stdout.truncated) {
    return Object.freeze({
      status: 'structured-output-truncated',
      reason: 'structured output exceeded the declared budget — truncated JSON is not a partial answer',
      outcome,
    });
  }
  try {
    const document = JSON.parse(stdout.text);
    return Object.freeze({ status: 'complete', document, outcome });
  } catch {
    // secao 68: JSON invalido sob formato declarado = failure, nunca
    // "successful harness response"
    return Object.freeze({
      status: 'structured-output-parse-failure',
      reason: 'declared JSON output did not parse',
      outcome,
    });
  }
}
