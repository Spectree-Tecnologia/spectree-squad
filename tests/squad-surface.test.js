import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Superficie de autoridade do Squad, travada por igualdade estrita (R8
 * aplicado a camada de plugin). O frontmatter `tools:` e `skills:` dos
 * agentes e a UNICA superficie onde o Claude Code aplica autoridade de
 * verdade — este teste falha se autoridade entrar OU sair em silencio:
 * um PR que da Write ao Keeper ou Bash ao Zeus quebra a suite, nunca
 * passa despercebido. Nunca checagem de ausencia; sempre a lista exata.
 */

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PLAYWRIGHT_TOOLS = [
  'navigate', 'navigate_back', 'snapshot', 'take_screenshot', 'click',
  'type', 'fill_form', 'press_key', 'hover', 'select_option', 'drag',
  'drop', 'wait_for', 'find', 'evaluate', 'console_messages',
  'network_requests', 'resize', 'tabs', 'close',
].map((name) => 'mcp__playwright__browser_' + name);

const DEVTOOLS_TOOLS = [
  'new_page', 'navigate_page', 'list_pages', 'select_page', 'close_page',
  'click', 'fill', 'press_key', 'wait_for', 'resize_page', 'emulate',
  'lighthouse_audit', 'performance_start_trace', 'performance_stop_trace',
  'performance_analyze_insight', 'take_heapsnapshot',
  'list_network_requests', 'get_network_request', 'list_console_messages',
].map((name) => 'mcp__chrome-devtools__' + name);

const READ_WRITE = ['Read', 'Write', 'Edit', 'Glob', 'Grep'];

/**
 * A matriz de autoridade esperada. Mudanca legitima de autoridade edita
 * ESTE arquivo junto do agente, no mesmo PR — e o diff conta a historia.
 */
const EXPECTED = {
  lina: { tools: READ_WRITE, skills: ['spectree-artifacts'] },
  lion: { tools: READ_WRITE, skills: ['spectree-artifacts'] },
  rubick: { tools: READ_WRITE, skills: ['spectree-artifacts', 'spectree-testing'] },
  zeus: { tools: READ_WRITE, skills: ['spectree-artifacts'] },
  oracle: { tools: [...READ_WRITE, 'Bash'], skills: ['spectree-artifacts'] },
  disruptor: { tools: [...READ_WRITE, 'Bash'], skills: ['spectree-artifacts', 'spectree-wizard'] },
  jakiro: {
    tools: [...READ_WRITE, 'Bash', ...PLAYWRIGHT_TOOLS, ...DEVTOOLS_TOOLS],
    skills: ['spectree-artifacts', 'spectree-testing', 'spectree-browser', 'spectree-diagnostics'],
  },
  // Keeper valida, nao conserta: sem Write — e a ausencia e travada pela
  // lista exata, nao por um assert de ausencia.
  'keeper-of-the-light': {
    tools: ['Read', 'Edit', 'Glob', 'Grep', 'Bash', ...PLAYWRIGHT_TOOLS, ...DEVTOOLS_TOOLS],
    skills: ['spectree-artifacts', 'spectree-testing', 'spectree-browser', 'spectree-diagnostics'],
  },
};

function frontmatter(file) {
  const raw = readFileSync(file, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, file + ' sem frontmatter');
  return match[1];
}

function parseAgent(file) {
  const fm = frontmatter(file);
  const line = (name) => {
    const m = fm.match(new RegExp('^' + name + ':[ \\t]*(.*)$', 'm'));
    return m ? m[1].trim() : null;
  };
  return {
    name: line('name'),
    tools: (line('tools') ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    skills: [...fm.matchAll(/^[ \t]+-[ \t]+(\S+)[ \t]*$/gm)].map((m) => m[1]),
  };
}

test('agents/ contem exatamente os agentes esperados, nem mais nem menos', () => {
  const files = readdirSync(path.join(REPO, 'agents')).filter((f) => f.endsWith('.md'));
  assert.deepEqual(
    files.map((f) => f.replace(/\.md$/, '')).sort(),
    Object.keys(EXPECTED).sort(),
  );
});

for (const [agentId, expected] of Object.entries(EXPECTED)) {
  test('superficie exata de ' + agentId + ': tools e skills por igualdade estrita', () => {
    const parsed = parseAgent(path.join(REPO, 'agents', agentId + '.md'));
    assert.equal(parsed.name, agentId, 'frontmatter name deve bater com o arquivo');
    assert.deepEqual(parsed.tools, expected.tools);
    assert.deepEqual(parsed.skills, expected.skills);
  });
}

test('toda skill declarada existe, e toda skill do plugin e declarada por alguem', () => {
  const declared = new Set(Object.values(EXPECTED).flatMap((e) => e.skills));
  for (const skill of declared) {
    assert.ok(
      existsSync(path.join(REPO, 'skills', skill, 'SKILL.md')),
      'skill declarada sem SKILL.md: ' + skill,
    );
  }
  const onDisk = readdirSync(path.join(REPO, 'skills'));
  // skill que nenhum agente carrega e autoridade morta ou vazamento de escopo
  assert.deepEqual(onDisk.sort(), [...declared].sort());
});

test('a tabela do Invoker referencia exatamente os agentes existentes', () => {
  const raw = readFileSync(path.join(REPO, 'commands', 'techleader.md'), 'utf8');
  const referenced = [...raw.matchAll(/spectree-squad:([a-z-]+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(referenced)].sort(), Object.keys(EXPECTED).sort());
});
