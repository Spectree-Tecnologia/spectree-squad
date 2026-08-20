import { readFileSync, readdirSync } from 'node:fs';
import { PolicyRegistry } from '../spectree-runtime/policy/policy-registry.js';
import { PolicyEngine } from '../spectree-runtime/policy/policy-engine.js';

/**
 * Guard PreToolUse (itens 4A+4B da sintonia Squad/Runtime): a matriz de
 * autoridade aplicada em execucao. O hook NAO decide nada sozinho —
 * detecta a operacao no comando Bash e pergunta ao PolicyEngine real,
 * carregado do MESMO squad.policies.json que os testes travam.
 *
 * 4B: quando o hook dispara dentro de um subagente, o payload traz
 * `agent_type` (doc de hooks, common input fields) — o principal real.
 * Agente do squad reconhecido -> o engine decide com ele: default deny
 * vale (Jakiro rodando psql e negado; Oracle passa). `agent_type`
 * ausente (thread principal) ou desconhecido -> modo 4A: so agem as
 * policies sem principal, que valem para qualquer um.
 *
 * Regra de honestidade: o guard NUNCA responde "allow" — so "deny",
 * "ask" (gate do Founder na UI) ou silencio. Allow do engine vira
 * passagem sem decisao: o fluxo normal de permissao continua sendo a
 * ultima palavra, e o hook jamais amplia autoridade.
 *
 * O hook e somente-leitura: le stdin, imprime JSON. Nunca executa nada.
 */

const POLICIES = JSON.parse(
  readFileSync(new URL('../squad.policies.json', import.meta.url), 'utf8'),
);

/** Principais reconhecidos: os agentes que o plugin embarca. */
const KNOWN_AGENTS = new Set(
  readdirSync(new URL('../agents/', import.meta.url))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, '')),
);

/**
 * agent_type -> principal do squad, ou null. Aceita "jakiro" e
 * "spectree-squad:jakiro" (namespace de plugin); desconhecido e null —
 * nunca adivinhar principal.
 */
function principalFrom(agentType) {
  if (typeof agentType !== 'string' || agentType.length === 0) return null;
  const base = agentType.split(':').pop();
  return KNOWN_AGENTS.has(base) ? { id: base } : null;
}

// Principal de fallback (modo 4A): policies com principal nao casam com
// ele, e o default-deny do engine e ignorado — so decidem as universais.
const UNKNOWN_PRINCIPAL = { id: 'bash-session' };

/** Divide o comando em segmentos por encadeadores de shell. */
function segments(command) {
  return String(command).split(/\|\||&&|;|\|/).map((s) => s.trim()).filter(Boolean);
}

const isProtectedRef = (token) =>
  ['main', 'master'].includes(token) ||
  /(^|:)(refs\/heads\/)?(main|master)$/.test(token);

function detectGit(tokens) {
  const sub = tokens.slice(tokens.indexOf('git') + 1).find((t) => !t.startsWith('-'));
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
    return { capability: 'git', operation: sub };
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
 * Detecta operacao governada num segmento -> {capability, operation,
 * resource?} ou null. Conservador: falso negativo antes de falso
 * positivo — o que nao casar segue o fluxo normal de permissao.
 */
function detect(segment) {
  const tokens = segment.split(/\s+/);
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

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return; // input ilegivel: sem decisao, fluxo normal segue
  }
  if (payload.tool_name !== 'Bash') return;
  const command = payload.tool_input?.command;
  if (typeof command !== 'string') return;

  const principal = principalFrom(payload.agent_type);
  const registry = new PolicyRegistry();
  registry.registerMany(POLICIES);
  const engine = new PolicyEngine({ registry });

  for (const segment of segments(command)) {
    const detected = detect(segment);
    if (!detected) continue;
    const decision = engine.decide({
      principal: principal ?? UNKNOWN_PRINCIPAL,
      tool: { id: detected.capability + '.' + detected.operation, capability: detected.capability },
      operation: detected.operation,
      resource: detected.resource,
    });
    if (decision.effect === 'allow') continue; // passagem, nunca "allow" explicito
    // modo 4A (principal desconhecido): default-deny nao e acionavel daqui
    if (principal === null && decision.policyId === 'default-deny') continue;
    const permissionDecision = decision.effect === 'deny' ? 'deny' : 'ask';
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
