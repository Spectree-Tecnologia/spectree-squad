import { readFileSync } from 'node:fs';
import { PolicyRegistry } from '../spectree-runtime/policy/policy-registry.js';
import { PolicyEngine } from '../spectree-runtime/policy/policy-engine.js';

/**
 * Guard PreToolUse (item 4A da sintonia Squad/Runtime): a deny-list
 * global da matriz de autoridade, aplicada em execucao. O hook NAO
 * decide nada sozinho — ele detecta a operacao no comando Bash e
 * pergunta ao PolicyEngine real, carregado do MESMO squad.policies.json
 * que os testes travam. So agem aqui as policies que valem para
 * qualquer principal (o hook nao sabe qual agente chamou — estagio 4B);
 * mapeamento: deny -> "deny", approval-required -> "ask" (o gate do
 * Founder na UI). Comando nao detectado passa sem decisao (exit 0):
 * o fluxo normal de permissao continua valendo.
 *
 * O hook e somente-leitura: le stdin, imprime JSON. Nunca executa nada.
 */

const POLICIES = JSON.parse(
  readFileSync(new URL('../squad.policies.json', import.meta.url), 'utf8'),
);

// Principal desconhecido de proposito: policies com principal nao casam,
// e o guard so age quando uma policy SEM principal decide — as que valem
// para todo o squad. O default-deny do engine nao e acionavel daqui.
const UNKNOWN_PRINCIPAL = { id: 'bash-session' };

/** Divide o comando em segmentos por encadeadores de shell. */
function segments(command) {
  return String(command).split(/\|\||&&|;|\|/).map((s) => s.trim()).filter(Boolean);
}

const isProtectedRef = (token) =>
  ['main', 'master'].includes(token) ||
  /(^|:)(refs\/heads\/)?(main|master)$/.test(token);

/**
 * Detecta operacao governada num segmento -> {capability, operation,
 * resource?} ou null. Conservador: falso negativo antes de falso
 * positivo — o que nao casar segue o fluxo normal de permissao.
 */
function detect(segment) {
  const tokens = segment.split(/\s+/);
  if (tokens.includes('git') && tokens.includes('push')) {
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
    return null;
  }
  if (/\b(psql|mysql|mariadb|sqlite3)\b/.test(segment) &&
      /\b(drop\s+(table|database|schema|index)|truncate)\b/i.test(segment)) {
    return { capability: 'database', operation: 'destructive-migration' };
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

  const registry = new PolicyRegistry();
  registry.registerMany(POLICIES);
  const engine = new PolicyEngine({ registry });

  for (const segment of segments(command)) {
    const detected = detect(segment);
    if (!detected) continue;
    const decision = engine.decide({
      principal: UNKNOWN_PRINCIPAL,
      tool: { id: detected.capability + '.' + detected.operation, capability: detected.capability },
      operation: detected.operation,
      resource: detected.resource,
    });
    if (decision.policyId === 'default-deny') continue; // policy com principal: 4B decide, nao o guard
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
