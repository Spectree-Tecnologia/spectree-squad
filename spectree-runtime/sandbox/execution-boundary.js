/**
 * ExecutionBoundary (spec Fase 5, secao 54): a descricao declarativa do
 * ambiente fisico em que uma execucao pode acontecer. Cinco dimensoes no
 * modelo; a Fase 5 implementa APENAS filesystem — as demais existem como
 * contrato para que o Process/Subprocess Provider futuro nasca dentro da
 * mesma fronteira, sem alterar o Agent (secoes 52-53, 146).
 *
 * O boundary nao autoriza nada (INV-501). Ele descreve limites; a
 * autoridade e da Policy.
 */

/** Ordem de restritividade: indice menor = mais restrito (secao 55). */
export const SANDBOX_MODES = Object.freeze(['read-only', 'workspace-write', 'danger-full-access']);

/** Niveis de enforcement declarados pelo backend (secao 18). */
export const ENFORCEMENT_LEVELS = Object.freeze(['none', 'partial', 'full']);

/** Quanto maior, mais permissivo. Usado para o teto da secao 134. */
export function modeRank(mode) {
  const rank = SANDBOX_MODES.indexOf(mode);
  if (rank < 0) throw new TypeError('unknown sandbox mode: ' + String(mode));
  return rank;
}

/** Quanto maior, mais forte. `full` >= `partial` >= `none` (secao 125). */
export function enforcementRank(level) {
  const rank = ENFORCEMENT_LEVELS.indexOf(level);
  if (rank < 0) throw new TypeError('unknown enforcement level: ' + String(level));
  return rank;
}

/** O mais restritivo entre dois modos — nunca o mais permissivo (secao 137). */
export const mostRestrictiveMode = (a, b) => (modeRank(a) <= modeRank(b) ? a : b);

/** Valores aceitos no eixo de processo: os niveis + a ausencia de backend. */
const PROCESS_ENFORCEMENT = Object.freeze(['unsupported', ...ENFORCEMENT_LEVELS]);

/**
 * Eixo de processo — R14, honestidade operacional.
 *
 * A regra: **sem enforcement fisico + modo que promete confinement = nao
 * executar.** Um modo restritivo (`read-only`, `workspace-write`) e uma
 * PROMESSA de limite fisico. Enquanto nenhum backend souber confinar um
 * processo do SO, cumprir a promessa e impossivel — entao o Runtime nao
 * executa, em vez de executar mentindo. Quem precisa de processo hoje
 * declara `danger-full-access`, que nao promete confinement nenhum: a
 * execucao nao confinada passa a ser uma escolha explicita e auditavel,
 * nunca um efeito colateral silencioso de um modo que diz "workspace".
 *
 * `partial` NAO conta como fisico aqui: verificacao em JavaScript dentro
 * do Runtime nao alcanca um processo filho, que nao roda o nosso codigo.
 * So `full` (kernel-level: Landlock, job object, container) libera spawn
 * sob modo restritivo — e este e exatamente o seam do backend futuro: ele
 * declara `processEnforcement: 'full'` e o mesmo calculo abre o spawn,
 * sem tocar no Agent nem no Provider de processo.
 */
function processAxis(mode, processEnforcement) {
  if (!PROCESS_ENFORCEMENT.includes(processEnforcement)) {
    throw new TypeError('unknown process enforcement: ' + String(processEnforcement));
  }
  const promisesConfinement = mode !== 'danger-full-access';
  // read-only nao pare processo em nenhuma hipotese (secao 34 F6)
  const allowSpawn = mode === 'read-only'
    ? false
    : !promisesConfinement || processEnforcement === 'full';
  return Object.freeze({
    allowSpawn,
    enforcement: processEnforcement,
    // por que nao — fonte unica da razao, consumida pelo Provider
    denialReason: allowSpawn
      ? null
      : (mode === 'read-only' ? 'mode-forbids-spawn' : 'unenforced-confinement'),
  });
}

/**
 * Boundary de cada modo (secao 55). `filesystem.write` e `filesystem.read`
 * assumem tres valores: 'none' (nada), 'workspace' (so as roots
 * declaradas) e 'unrestricted' (o Sandbox nao acrescenta fronteira —
 * secao 11: isso NAO e bypass de Policy nem de Provider).
 *
 * network/environment ficam fechados em todos os modos nesta fase: o
 * backend declara `unsupported` em vez de fingir isolamento (secoes
 * 50-51). O eixo de processo segue o R14 (ver `processAxis`); um
 * SandboxProvider que confine processo de verdade constroi o boundary do
 * seu handle passando `processEnforcement`.
 */
export function executionBoundaryFor(mode, { processEnforcement = 'unsupported' } = {}) {
  const filesystem = {
    'read-only': { read: 'workspace', write: 'none' },
    'workspace-write': { read: 'workspace', write: 'workspace' },
    'danger-full-access': { read: 'unrestricted', write: 'unrestricted' },
  }[mode];
  if (!filesystem) throw new TypeError('unknown sandbox mode: ' + String(mode));
  return Object.freeze({
    filesystem: Object.freeze({ ...filesystem }),
    // rede e ambiente: declarados, nao implementados (secoes 50-52)
    network: Object.freeze({ enabled: false, enforcement: 'unsupported' }),
    process: processAxis(mode, processEnforcement),
    environment: Object.freeze({ inherit: false, enforcement: 'unsupported' }),
  });
}
