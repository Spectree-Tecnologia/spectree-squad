import { readFileSync, readdirSync, appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { policyEngineFromDocument } from '../spectree-runtime/adapters/policy-document.js';

/**
 * Guard PreToolUse (itens 4A+4B+4C da sintonia Squad/Runtime): a matriz
 * de autoridade aplicada em execucao. O hook NAO decide nada sozinho —
 * detecta a operacao (comando Bash, ou edicao de artefato via
 * Edit/Write) e pergunta ao PolicyEngine real, carregado do MESMO
 * squad.policies.json que os testes travam.
 *
 * 4B/4.5: dentro de um subagente o payload traz `agent_type` — o
 * principal real. Agente do squad reconhecido -> default deny vale.
 * `agent_type` AUSENTE e a thread principal (Invoker/Founder) -> modo
 * 4A, so policies universais. PRESENTE mas fora do squad -> fail closed.
 *
 * 4C: Edit/Write tambem sao governados. Conteudo novo que escreve
 * `status: approved|done|in-progress` num artefato de docs/ e uma
 * operacao de artifact-status — subagente que tenta aprovar cai no
 * default deny (so a thread principal, onde vive o Invoker, passa).
 * E principal com superficie de edicao FECHADA na matriz (declarou
 * policy de artifact-edit, caso do Keeper) so edita o que ela concede.
 *
 * 4.6: detector de `gh` (capability github) e resource de branch lido de
 * .git/HEAD — leitura de arquivo, jamais execucao de comando. Toda
 * decisao (deny/ask) e registrada em ~/.claude/spectree/
 * policy-decisions.jsonl sob projecao R10: policyId, efeito, principal,
 * capability, operation e resource — NUNCA o comando bruto, que carrega
 * segredo.
 *
 * Regra de honestidade: o guard NUNCA responde "allow" — so "deny",
 * "ask" (gate do Founder na UI) ou silencio. Allow do engine vira
 * passagem sem decisao: o fluxo normal de permissao e a ultima palavra.
 * O hook e somente-leitura: le stdin, imprime JSON, nunca executa nada.
 */

// Adapter oficial (Fase 4.5): o MESMO caminho de carga que o runtime,
// os exemplos e os testes usam — uma autoridade, mesma decisao.
const { policies: POLICIES, engine } = policyEngineFromDocument(
  new URL('../squad.policies.json', import.meta.url),
);

/** Principais reconhecidos: os agentes que o plugin embarca. */
const KNOWN_AGENTS = new Set(
  readdirSync(new URL('../agents/', import.meta.url))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, '')),
);

/**
 * Principais com superficie de edicao fechada: quem declara policy de
 * artifact-edit na matriz so edita o que ela concede. Quem nao declara
 * segue livre — mesma semantica do whitelist tools: declarar e fechar.
 */
const CLOSED_EDIT_PRINCIPALS = new Set(
  POLICIES.filter((p) => (p.capability ?? p.capabilities) === 'artifact-edit')
    .flatMap((p) => [p.principal ?? p.principals ?? []].flat()),
);

/**
 * Regra da Fase 4.5: agent_type AUSENTE e a thread principal — la vivem
 * o Invoker e o Founder, e vale o modo 4A (so policies universais).
 * agent_type PRESENTE mas fora do squad e principal desconhecido:
 * fail closed — o default deny da matriz age.
 */
function principalFrom(agentType) {
  if (typeof agentType !== 'string' || agentType.length === 0) return null; // thread principal
  const base = agentType.split(':').pop();
  return { id: base, known: KNOWN_AGENTS.has(base) };
}

// Principal de fallback (modo 4A): policies com principal nao casam com
// ele, e o default-deny do engine e ignorado — so decidem as universais.
const UNKNOWN_PRINCIPAL = { id: 'bash-session' };

/** Divide o comando em segmentos por encadeadores de shell. */
function segments(command) {
  return String(command).split(/\|\||&&|;|\|/).map((s) => s.trim()).filter(Boolean);
}

/** Tokeniza descolando aspas de borda ("git -> git), contra wrappers. */
function tokenize(segment) {
  return segment.split(/\s+/).map((t) => t.replace(/^["']+|["']+$/g, '')).filter(Boolean);
}

const isProtectedRef = (token) =>
  ['main', 'master'].includes(token) ||
  /(^|:)(refs\/heads\/)?(main|master)$/.test(token);

// flags globais do git que carregam argumento — pular o par inteiro ao
// procurar o subcomando (git -C path push ...)
const GIT_VALUE_FLAGS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);

function gitSubcommand(tokens) {
  for (let i = tokens.indexOf('git') + 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (GIT_VALUE_FLAGS.has(token)) { i++; continue; }
    if (token.startsWith('-')) continue;
    return token;
  }
  return null;
}

// operacoes do gh que a matriz governa (capability github)
const GH_OPERATIONS = {
  pr: 'pr', release: 'release', label: 'label', run: 'ci', workflow: 'ci', cache: 'ci',
};

function detectGitHub(tokens) {
  const sub = tokens.slice(tokens.indexOf('gh') + 1).find((t) => !t.startsWith('-'));
  const operation = GH_OPERATIONS[sub];
  if (!operation) return null; // gh auth, gh repo view, ... nao sao governados
  return { capability: 'github', operation };
}

function detectGit(tokens) {
  const sub = gitSubcommand(tokens);
  if (sub === 'push') {
    const args = tokens.slice(tokens.indexOf('push') + 1);
    if (args.some((t) => ['--force', '-f', '--force-with-lease'].includes(t))) {
      return { capability: 'git', operation: 'force-push' };
    }
    if (args.includes('--delete') || args.some((t) => /^:[^\s:]/.test(t))) {
      return { capability: 'git', operation: 'delete-remote-branch' };
    }
    if (args.some(isProtectedRef)) {
      return { capability: 'git', operation: 'push', resource: { type: 'git', id: 'refs/heads/main' } };
    }
    return { capability: 'git', operation: 'push' };
  }
  if (sub === 'commit' || sub === 'merge') {
    // resource preenchido pelo chamador com a branch corrente (4.6):
    // commit direto na main tem de cair no no-direct-push-main
    return { capability: 'git', operation: sub, needsCurrentRef: true };
  }
  // criacao de branch: git branch <nome>, checkout -b, switch -c
  if (sub === 'branch' && tokens.slice(tokens.indexOf('branch') + 1).some((t) => !t.startsWith('-'))) {
    return { capability: 'git', operation: 'branch' };
  }
  if ((sub === 'checkout' && tokens.includes('-b')) || (sub === 'switch' && tokens.includes('-c'))) {
    return { capability: 'git', operation: 'branch' };
  }
  return null; // leitura (log, diff, status, ...) nao e governada
}

/**
 * Detecta operacao governada num segmento Bash. Conservador: falso
 * negativo antes de falso positivo — o que nao casar segue o fluxo
 * normal de permissao.
 */
function detectBash(segment) {
  const tokens = tokenize(segment);
  if (tokens.includes('gh')) return detectGitHub(tokens);
  if (tokens.includes('git')) return detectGit(tokens);
  if (/\b(psql|mysql|mariadb|sqlite3)\b/.test(segment)) {
    const destructive = /\b(drop\s+(table|database|schema|index)|truncate)\b/i.test(segment);
    return { capability: 'database', operation: destructive ? 'destructive-migration' : 'query' };
  }
  if (tokens[0] === 'rm' || (tokens.includes('rm') && tokens.indexOf('rm') < 3)) {
    const flags = tokens.filter((t) => /^-[a-zA-Z]+$/.test(t)).join('');
    const recursiveForce =
      (flags.includes('r') || flags.includes('R')) && flags.includes('f') ||
      (tokens.includes('--recursive') && tokens.includes('--force'));
    if (recursiveForce) {
      const targets = tokens.slice(tokens.indexOf('rm') + 1).filter((t) => !t.startsWith('-'));
      const escapes = targets.some(
        (t) => t === '/' || t === '/*' || t === '~' || t.startsWith('~/') ||
          t === '$HOME' || t.startsWith('..') || /^[A-Za-z]:[\\/]/.test(t) || t.startsWith('/'),
      );
      if (escapes) {
        return {
          capability: 'filesystem',
          operation: 'recursive-delete',
          resource: { type: 'filesystem', id: 'outside-workspace' },
        };
      }
    }
  }
  return null;
}

/**
 * Ref da branch corrente lida de .git/HEAD — LEITURA de arquivo, nunca
 * execucao de comando (o guard permanece read-only). Sobe da cwd ate
 * achar o .git; detached HEAD ou ausencia devolve null.
 */
function currentRef(cwd) {
  let dir = typeof cwd === 'string' && cwd.length > 0 ? path.resolve(cwd) : null;
  while (dir) {
    try {
      const head = readFileSync(path.join(dir, '.git', 'HEAD'), 'utf8').trim();
      const match = head.match(/^ref:\s*(refs\/heads\/.+)$/);
      return match ? match[1] : null;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }
  return null;
}

/** Caminho em forma posix; recorta a partir de docs/ quando existir. */
function docsRelative(filePath) {
  const posix = String(filePath).split('\\').join('/');
  const match = posix.match(/(?:^|\/)(docs\/.+)$/);
  return { posix, docs: match ? match[1] : null };
}

const STATUS_OPS = { approved: 'approve', done: 'done', 'in-progress': 'in-progress' };

/**
 * Deteccoes para Edit/Write (4C). Devolve a lista de operacoes
 * governadas encontradas — status primeiro, escopo depois.
 */
function detectFileTool(payload, principal) {
  const input = payload.tool_input ?? {};
  const { posix, docs } = docsRelative(input.file_path ?? '');
  const detections = [];
  // spoofing de status: conteudo novo setando status governado em docs/
  const text = String(input.new_string ?? input.content ?? '');
  const statusMatch = docs && text.match(/^status:[ \t]*(approved|done|in-progress)\b/m);
  if (statusMatch) {
    detections.push({
      capability: 'artifact-status',
      operation: STATUS_OPS[statusMatch[1]],
      resource: { type: 'artifact-status', id: docs },
    });
  }
  // superficie de edicao fechada (Keeper): toda edicao e governada
  if (principal && CLOSED_EDIT_PRINCIPALS.has(principal.id)) {
    detections.push({
      capability: 'artifact-edit',
      operation: 'edit',
      resource: { type: 'artifact-edit', id: docs ?? posix },
    });
  }
  return detections;
}

/**
 * Trilha de decisao (4.6). Uma linha JSON por decisao efetiva (deny ou
 * ask) — silencio nao e decisao e nao entra. Projecao R10: o comando
 * bruto NUNCA e registrado; so o que a Policy julgou. Falha de escrita
 * jamais afeta a decisao: auditoria quebrada nao pode virar bloqueio.
 */
function audit(entry) {
  try {
    const dir = path.join(homedir(), '.claude', 'spectree');
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, 'policy-decisions.jsonl'), JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // trilha e observabilidade, nao autoridade
  }
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return; // input ilegivel: sem decisao, fluxo normal segue
  }
  const toolName = payload.tool_name;
  let detections = [];
  if (toolName === 'Bash') {
    const command = payload.tool_input?.command;
    if (typeof command !== 'string') return;
    detections = segments(command).map(detectBash).filter(Boolean);
  } else if (toolName === 'Edit' || toolName === 'Write') {
    detections = detectFileTool(payload, principalFrom(payload.agent_type));
  } else {
    return;
  }
  if (detections.length === 0) return;

  const principal = principalFrom(payload.agent_type);
  for (const detected of detections) {
    let resource = detected.resource;
    if (detected.needsCurrentRef && !resource) {
      const ref = currentRef(payload.cwd);
      if (ref) resource = { type: 'git', id: ref };
    }
    const decision = engine.decide({
      principal: principal ?? UNKNOWN_PRINCIPAL,
      tool: { id: detected.capability + '.' + detected.operation, capability: detected.capability },
      operation: detected.operation,
      resource,
    });
    if (decision.effect === 'allow') continue; // passagem, nunca "allow" explicito
    // thread principal (4A): default-deny nao e acionavel daqui.
    // Principal DESCONHECIDO nao entra aqui: fail closed (Fase 4.5).
    if (principal === null && decision.policyId === 'default-deny') continue;
    const permissionDecision = decision.effect === 'deny' ? 'deny' : 'ask';
    audit({
      at: new Date().toISOString(),
      decision: permissionDecision,
      policyId: decision.policyId,
      principal: principal ? principal.id : null,
      principalKnown: principal ? principal.known : null,
      capability: detected.capability,
      operation: detected.operation,
      resource: resource ? resource.type + '/' + resource.id : null,
      tool: toolName,
      cwd: typeof payload.cwd === 'string' ? payload.cwd : null,
      sessionId: typeof payload.session_id === 'string' ? payload.session_id : null,
    });
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision,
        permissionDecisionReason:
          (permissionDecision === 'deny'
            ? 'Bloqueado pela matriz de autoridade do squad: '
            : 'Gate do Founder pela matriz de autoridade do squad: ') +
          decision.reason + ' [squad.policies.json]',
      },
    }));
    return;
  }
}

main();
