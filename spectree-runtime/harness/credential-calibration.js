import { realpathSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { SandboxConfigurationError } from '../errors.js';
import { assertBindablePhysicalPath } from '../sandbox/sandbox-policy.js';

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

/** Degraus da escada, do mais estreito ao mais largo (Item 2a, #29). */
export const CANDIDATE_GRANULARITIES = Object.freeze(['file', 'file-set', 'directory']);

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
  // Item 2a (#29): cada candidato declara o DEGRAU. Um binding de
  // diretorio alcanca tudo sob ele — e outra coisa que um arquivo, e o
  // record precisa dizer qual dos dois foi aprovado.
  if (!CANDIDATE_GRANULARITIES.includes(candidate.granularity)) {
    throw new SandboxConfigurationError(
      label + " requires granularity ('" + CANDIDATE_GRANULARITIES.join("' | '") + "')",
    );
  }
  // Follow-up F9: o MESMO piso do binding (sandbox-policy), aplicado na
  // proposta — igual-ou-ancestral do HOME, raiz do filesystem e raiz de
  // sistema morrem aqui tambem. Se so o HOME inteiro autentica, o
  // resultado e C — nunca uma ampliacao (INV-906). O veto de identidade
  // vem ANTES da existencia: HOME inexistente continua sendo HOME.
  const physical = existsSync(candidate.physicalPath)
    ? realpathSync(candidate.physicalPath)
    : path.resolve(candidate.physicalPath);
  assertBindablePhysicalPath(physical, { homePath, label });
  // Giro 3 (#29): a granularity e DERIVADA do disco, nao um rotulo
  // enumerado — a regra sobre uma propriedade do disco se deriva do
  // disco. Caminho inexistente nao autentica nada: recusado, e com isso
  // a verificacao e TOTAL, nao condicional.
  if (!existsSync(physical)) {
    throw new SandboxConfigurationError(
      label + ': physicalPath does not exist — a credential path that does not exist authenticates nothing',
    );
  }
  const isDirectory = statSync(physical).isDirectory();
  if (isDirectory && candidate.granularity !== 'directory') {
    throw new SandboxConfigurationError(
      label + ": the path IS a directory — granularity must be 'directory' (derived from disk, " +
      "not declared); a directory bind never enters a narrower rung",
    );
  }
  if (!isDirectory && candidate.granularity === 'directory') {
    throw new SandboxConfigurationError(
      label + ": the path is NOT a directory — granularity must be 'file' or 'file-set'",
    );
  }
}

/**
 * A escada e NORMA, nao convencao (Item 2a, #29): degrau mais estreito
 * primeiro — diretorio inteiro so depois de os degraus estreitos
 * falharem. Ordem violada e erro de configuracao, nunca reordenacao
 * silenciosa.
 */
function assertLadderOrder(candidates) {
  let broadest = -1;
  for (let i = 0; i < candidates.length; i++) {
    const rank = CANDIDATE_GRANULARITIES.indexOf(candidates[i].granularity);
    if (rank < broadest) {
      throw new SandboxConfigurationError(
        'candidate[' + i + "] ('" + candidates[i].granularity + "') cannot come after a broader " +
        'candidate — the ladder goes narrowest first (file -> file-set -> directory)',
      );
    }
    broadest = Math.max(broadest, rank);
  }
  // Giro 3 (#29): 'directory' NUNCA e o primeiro degrau tentado — a
  // secao 12 diz "somente depois de os degraus estreitos falharem", e a
  // escada e a EVIDENCIA de que o estreito nao bastou. Analogo mecanico
  // do PROFILE-0-primeiro, que ja e imposto por construcao.
  if (candidates.length > 0 && candidates[0].granularity === 'directory') {
    throw new SandboxConfigurationError(
      "candidate[0] cannot be 'directory': at least one narrower rung must be tried first — " +
      'the record must show that the narrow rung failed (secao 12)',
    );
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
  // Item 1 (#29), simetria com o binding: com candidatos presentes, HOME
  // irresoluvel significa que o veto INV-906 nao pode ser aplicado — e
  // isso e recusa, nunca um piso que silenciosamente nao vale
  if (candidates.length > 0 && !homePath) {
    throw new SandboxConfigurationError(
      'calibration with candidates requires a resolvable homePath: the INV-906 floor ' +
      'cannot be applied, so the run is refused (fail closed)',
    );
  }
  candidates.forEach((candidate, index) => validateCandidate(candidate, index, homePath));
  assertLadderOrder(candidates);

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
    // R8 do record (secao 83): identidade canonica, DEGRAU, veredito e
    // razao — NUNCA physicalPath, secret, token ou environment
    const granularity = candidate === PROFILE_0 ? 'none' : candidate.granularity;
    results.push(Object.freeze({ candidate: identity, granularity, verdict, reason }));
    if (verdict === 'auth-ok') {
      // Item 2a (#29): o record registra QUAL degrau foi aprovado
      approved = candidate === PROFILE_0
        ? Object.freeze({ resourceId: null, granularity: 'none', profile: 'PROFILE-0' })
        : Object.freeze({ resourceId: candidate.resourceId, granularity, profile: 'declared-resource' });
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
