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
 * 4.7: o alvo do push e RESOLVIDO (destino do refspec, ou a branch
 * corrente quando nao ha refspec) e vira resource — antes o guard
 * varria os argumentos atras do token "main", o que deixava passar
 * `git push` puro na main e rebaixava force-push na main de deny para
 * ask. Agora o guard detecta o alvo e a POLICY decide. A trilha ganha
 * `toolUseId` e `outcome`: deny e final, ask e pendente, e o modo
 * PostToolUse registra `executed` correlacionado pelo mesmo
 * `toolUseId` — a pergunta e a resposta viram um par auditavel.
 *
 * 4.8: escopo de projeto. A identidade do projeto e o basename da raiz
 * do repo da cwd; policy com `project` so vale la, policy sem `project`
 * vale em todo lugar. Fora de repo, so as globais. E detector de
 * `supabase`, para que a autoridade do Oracle valha em projeto que nao
 * usa psql.
 *
 * Regra de honestidade: o guard NUNCA responde "allow" — so "deny",
 * "ask" (gate do Founder na UI) ou silencio. Allow do engine vira
 * passagem sem decisao: o fluxo normal de permissao e a ultima palavra.
 * O hook e somente-leitura: le stdin, imprime JSON, nunca executa nada.
 */

// Adapter oficial (Fase 4.5): o MESMO caminho de carga que o runtime,
// os exemplos e os testes usam — uma autoridade, mesma decisao. A carga
// acontece dentro de main() porque o escopo de projeto (4.8) depende da
// cwd que chega no payload.
const MATRIX = new URL('../squad.policies.json', import.meta.url);

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
 * Calculado sobre as policies JA filtradas pelo escopo (4.8).
 */
function closedEditPrincipals(policies) {
  return new Set(
    policies.filter((p) => (p.capability ?? p.capabilities) === 'artifact-edit')
      .flatMap((p) => [p.principal ?? p.principals ?? []].flat()),
  );
}

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

// flags de `git push` que carregam valor separado — pular o par ao
// procurar os posicionais (remote e refspec)
const PUSH_VALUE_FLAGS = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);

/**
 * Ref de DESTINO de um `git push`, derivada do refspec (4.7). Em
 * `src:dst` o alvo e `dst` — derivar de .git/HEAD aqui estaria errado, e
 * e justamente o caminho que alguem usaria para escapar
 * (`git push origin main:refs/heads/outra` nao toca a main; ja
 * `git push origin HEAD:main` toca). Sem refspec, o alvo e a branch
 * corrente e quem resolve e o chamador (needsCurrentRef).
 *
 * Limite conhecido: com `push.default = matching` ou um
 * `remote.<nome>.push` configurado, o alvo pode nao ser a branch
 * corrente. O guard nao le configuracao de git — falso negativo, nunca
 * falso positivo.
 */
function pushTargetRef(args) {
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (PUSH_VALUE_FLAGS.has(token)) { i++; continue; }
    if (token.startsWith('-')) continue;
    positional.push(token);
  }
  const refspec = positional[1]; // positional[0] e o remote
  if (!refspec) return null;
  const parts = refspec.replace(/^\+/, '').split(':');
  const dst = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  // HEAD como destino nao e nome de branch: cai na branch corrente
  if (!dst || dst === 'HEAD') return null;
  return dst.startsWith('refs/') ? dst : 'refs/heads/' + dst;
}

/** Detecta a operacao de push e ANEXA o alvo; a policy e quem decide. */
function detectPush(args) {
  let operation = 'push';
  if (args.some((t) => ['--force', '-f', '--force-with-lease'].includes(t))) {
    operation = 'force-push';
  } else if (args.includes('--delete') || args.some((t) => /^:[^\s:]/.test(t))) {
    operation = 'delete-remote-branch';
  }
  const target = pushTargetRef(args);
  if (target) return { capability: 'git', operation, resource: { type: 'git', id: target } };
  return { capability: 'git', operation, needsCurrentRef: true };
}

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
    return detectPush(tokens.slice(tokens.indexOf('push') + 1));
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
 * Supabase (4.8): o ferramental de banco do canario. Sem este detector a
 * autoridade exclusiva do Oracle nao valia onde o projeto nao usa psql —
 * `supabase db push` aplica schema no projeto vinculado (producao) e
 * passava para qualquer agente.
 *
 * Limite declarado: o guard nao le o conteudo dos arquivos de migration,
 * entao nao distingue migration aditiva de destrutiva. `db push` e
 * governado como `migration`; a regra "destrutiva passa pelo Founder"
 * continua sendo verificacao humana, nao enforcement.
 */
function detectSupabase(tokens) {
  const rest = tokens.slice(tokens.indexOf('supabase') + 1).filter((t) => !t.startsWith('-'));
  const [group, sub] = rest;
  if (group === 'db') {
    // leitura de schema nao e governada
    if (['dump', 'diff', 'lint'].includes(sub)) return null;
    if (sub === 'push') {
      return { capability: 'database', operation: 'migration', resource: { type: 'database', id: 'production' } };
    }
    if (sub === 'reset') {
      return { capability: 'database', operation: 'migration', resource: { type: 'database', id: 'local' } };
    }
    return { capability: 'database', operation: 'migration' };
  }
  if (group === 'migration') {
    if (sub === 'list') return null; // leitura
    return { capability: 'database', operation: 'migration' };
  }
  return null; // login, start, stop, status, functions: nao governados
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
  if (tokens.includes('supabase')) return detectSupabase(tokens);
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
 * Contexto de git a partir da cwd — LEITURA de arquivo, nunca execucao
 * de comando (o guard permanece read-only). Sobe da cwd ate achar o
 * .git e devolve a raiz do repo, o nome do projeto (basename da raiz, a
 * identidade de escopo da 4.8) e a ref corrente. Fora de repo, tudo
 * null: sem projeto, so as policies globais se aplicam.
 */
function gitContext(cwd) {
  const none = { root: null, project: null, ref: null };
  let dir = typeof cwd === 'string' && cwd.length > 0 ? path.resolve(cwd) : null;
  while (dir) {
    try {
      const head = readFileSync(path.join(dir, '.git', 'HEAD'), 'utf8').trim();
      const match = head.match(/^ref:\s*(refs\/heads\/.+)$/);
      return { root: dir, project: path.basename(dir), ref: match ? match[1] : null };
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) return none;
      dir = parent;
    }
  }
  return none;
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
function detectFileTool(payload, principal, closedEdit) {
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
  if (principal && closedEdit.has(principal.id)) {
    detections.push({
      capability: 'artifact-edit',
      operation: 'edit',
      resource: { type: 'artifact-edit', id: docs ?? posix },
    });
  }
  return detections;
}

/**
 * Trilha de decisao (4.6, ampliada na 4.7). Uma linha JSON por decisao
 * efetiva — silencio nao e decisao e nao entra. Projecao R10: o comando
 * bruto NUNCA e registrado; so o que a Policy julgou. Falha de escrita
 * jamais afeta a decisao: auditoria quebrada nao pode virar bloqueio.
 *
 * `outcome` diz o que a linha vale: `final` (deny — o desfecho e a
 * propria decisao) ou `pending` (ask — a linha registra a PERGUNTA; o
 * guard e processo separado e nao ve a resposta da UI). O desfecho de um
 * `pending` chega como linha `executed` do modo PostToolUse, com o mesmo
 * `toolUseId`. Ausencia de `executed` significa que nao executou
 * (negado na UI, cancelado ou sessao encerrada) — a trilha nao adivinha
 * qual dos tres.
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
  // PostToolUse so dispara quando a tool EXECUTOU (4.7): e o desfecho de
  // um `ask` anterior. Nunca imprime decisao — apenas fecha o par.
  const isOutcome = payload.hook_event_name === 'PostToolUse';
  const toolName = payload.tool_name;
  // escopo de projeto (4.8): a identidade vem da raiz do repo da cwd
  const git = gitContext(payload.cwd);
  const { policies, engine } = policyEngineFromDocument(MATRIX, { project: git.project });
  const principal = principalFrom(payload.agent_type);
  let detections = [];
  if (toolName === 'Bash') {
    const command = payload.tool_input?.command;
    if (typeof command !== 'string') return;
    detections = segments(command).map(detectBash).filter(Boolean);
  } else if (toolName === 'Edit' || toolName === 'Write') {
    detections = detectFileTool(payload, principal, closedEditPrincipals(policies));
  } else {
    return;
  }
  if (detections.length === 0) return;

  for (const detected of detections) {
    let resource = detected.resource;
    if (detected.needsCurrentRef && !resource && git.ref) {
      resource = { type: 'git', id: git.ref };
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
    if (isOutcome) {
      // desfecho: so um `ask` gera par pendente; deny nunca executa
      if (decision.effect === 'approval-required') {
        audit({
          at: new Date().toISOString(),
          decision: 'executed',
          outcome: 'final',
          policyId: decision.policyId,
          principal: principal ? principal.id : null,
          principalKnown: principal ? principal.known : null,
          capability: detected.capability,
          operation: detected.operation,
          resource: resource ? resource.type + '/' + resource.id : null,
          tool: toolName,
          cwd: typeof payload.cwd === 'string' ? payload.cwd : null,
          sessionId: typeof payload.session_id === 'string' ? payload.session_id : null,
          toolUseId: typeof payload.tool_use_id === 'string' ? payload.tool_use_id : null,
        });
      }
      return;
    }
    audit({
      at: new Date().toISOString(),
      decision: permissionDecision,
      outcome: permissionDecision === 'deny' ? 'final' : 'pending',
      policyId: decision.policyId,
      principal: principal ? principal.id : null,
      principalKnown: principal ? principal.known : null,
      capability: detected.capability,
      operation: detected.operation,
      resource: resource ? resource.type + '/' + resource.id : null,
      tool: toolName,
      cwd: typeof payload.cwd === 'string' ? payload.cwd : null,
      sessionId: typeof payload.session_id === 'string' ? payload.session_id : null,
      toolUseId: typeof payload.tool_use_id === 'string' ? payload.tool_use_id : null,
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
