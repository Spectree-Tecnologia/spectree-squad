import { readFileSync } from 'node:fs';

/**
 * Adapta um agente do Squad (markdown com frontmatter) para uma
 * AgentDefinition do runtime — prova de conceito da spec secao 39. O
 * runtime continua sem conhecer nomes do Squad (INV-007): aqui o
 * markdown é dado de entrada, nunca dependencia. Nenhum agente precisa
 * ser alterado.
 * @returns {import('../agent/agent.js').AgentDefinition}
 */
export function loadSquadAgentDefinition(markdownPath) {
  const raw = readFileSync(markdownPath, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error('no frontmatter found in ' + markdownPath);
  const frontmatter = match[1];
  const body = match[2];
  const field = (name) => {
    const m = frontmatter.match(new RegExp('^' + name + ':\s*(.+)$', 'm'));
    return m ? m[1].trim() : undefined;
  };
  const id = field('name');
  if (!id) throw new Error('frontmatter in ' + markdownPath + ' has no "name" field');
  return {
    id,
    name: id,
    instructions: body.trim(),
    metadata: { description: field('description') ?? null, source: markdownPath },
  };
}
