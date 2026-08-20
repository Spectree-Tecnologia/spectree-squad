import { realpathSync, existsSync } from 'node:fs';
import path from 'node:path';
import { SandboxConfigurationError } from '../errors.js';

/**
 * Credential Calibration (spec F9, secoes 9-13, 18-25, 80, E3):
 * operacao DELIBERADA do Founder — nunca gate de apply(), nunca parte do
 * caminho normal de execucao, nunca requisito de npm test (secao 70).
 *
 * O probe produz PROPOSTA, nao autoridade (secao 23): o resultado
 * aprovado vira configuracao declarada (secao 22), que o EffectResolver
 * transforma em efeito, a Policy decide, o Founder aprova e SO ENTAO o
 * Sandbox monta.
 */

export const CALIBRATION_VERDICTS = Object.freeze(['auth-ok', 'auth-insufficient', 'runner-failure']);

/** PROFILE-0 (secao 11): nenhum credential resource. */
export const PROFILE_0 = null;

function validateCandidate(candidate, index, homePath) {
  const label = 'candidate[' + index + ']';
  if (typeof candidate?.resourceId !== 'string' || candidate.resourceId.length === 0) {
    throw new SandboxConfigurationError(label + ' requires a canonical resourceId (secao 13)');
  }
  if (candidate.resourceId.startsWith('/') || /^[A-Za-z]:/.test(candidate.resourceId)) {
    throw new SandboxConfigurationError(
      label + ' resourceId must be a canonical identity, never a host path (secao 13)',
    );
  }
  if (typeof candidate.physicalPath !== 'string' || candidate.physicalPath.length === 0) {
    throw new SandboxConfigurationError(label + ' requires a physicalPath');
  }
  if (homePath) {
    const physical = existsSync(candidate.physicalPath)
      ? realpathSync(candidate.physicalPath)
      : path.resolve(candidate.physicalPath);
    const home = existsSync(homePath) ? realpathSync(homePath) : path.resolve(homePath);
    if (physical === home) {
      // INV-906 / criterio 13: o HOME inteiro NUNCA e candidato. Se so o
      // HOME inteiro autentica, o resultado e C — nao uma ampliacao.
      throw new SandboxConfigurationError(
        label + ': the entire HOME is never a credential candidate (INV-906) — ' +
        'if only full HOME authenticates, the result is C: confined harness unavailable',
      );
    }
  }
}

/**
 * Motor de calibracao progressiva (secoes 10-12): PROFILE-0 primeiro,
 * depois cada candidato UM POR VEZ, parando no primeiro auth-ok. Nenhuma
 * etapa amplia automaticamente o candidato (candidate N + HOME e
 * proibido como fallback).
 *
 * @param {object} options
 * @param {string} options.adapterId identidade do adapter (secao 73)
 * @param {string} [options.outputMode]
 * @param {Array<{resourceId: string, physicalPath: string}>} options.candidates
 * @param {(candidate: object|null) => Promise<{verdict: string, reason?: string}>}
 *   options.runCandidate executa o cenario calibrado com o candidato
 *   montado (null = PROFILE-0) e devolve o veredito classificado
 * @param {string|null} [options.homePath] HOME fisico do host, para o
 *   veto do INV-906
 * @param {() => string} [options.now]
 */
export async function runCredentialCalibration({
  adapterId,
  outputMode = 'json',
  candidates = [],
  runCandidate,
  homePath = null,
  now = () => new Date().toISOString(),
} = {}) {
  if (typeof adapterId !== 'string' || adapterId.length === 0) {
    throw new SandboxConfigurationError('calibration requires the adapter identity (secao 73)');
  }
  if (typeof runCandidate !== 'function') {
    throw new SandboxConfigurationError('calibration requires a runCandidate executor');
  }
  candidates.forEach((candidate, index) => validateCandidate(candidate, index, homePath));

  const results = [];
  let approved = null;
  for (const candidate of [PROFILE_0, ...candidates]) {
    const identity = candidate === PROFILE_0 ? 'PROFILE-0' : candidate.resourceId;
    let verdict = 'runner-failure';
    let reason = null;
    try {
      const outcome = await runCandidate(candidate);
      if (outcome && CALIBRATION_VERDICTS.includes(outcome.verdict)) {
        verdict = outcome.verdict;
        reason = outcome.reason ?? null;
      } else {
        // secao 80: sem classificacao segura nao existe UNKNOWN
        // silencioso — e RUNNER-FAILURE
        reason = 'unclassifiable probe outcome';
      }
    } catch (error) {
      reason = 'probe execution failed: ' + (error?.message ?? error);
    }
    // R8 do record (secao 83): identidade canonica, veredito e razao —
    // NUNCA physicalPath, secret, token ou environment
    results.push(Object.freeze({ candidate: identity, verdict, reason }));
    if (verdict === 'auth-ok') {
      approved = candidate === PROFILE_0
        ? Object.freeze({ resourceId: null, profile: 'PROFILE-0' })
        : Object.freeze({ resourceId: candidate.resourceId, profile: 'declared-resource' });
      break;
    }
  }

  return Object.freeze({
    adapterId,
    outputMode,
    probedAt: now(),
    results: Object.freeze(results),
    approved,
  });
}
