import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadSquadAgentDefinition } from '../adapters/squad-agent.js';

// Regressao: o separador do frontmatter tem que ser \s* de verdade. Com o
// backslash perdido o padrao vira ':s*', que come os 's' iniciais do valor.
test('valores do frontmatter que comecam com "s" colado no dois-pontos sobrevivem', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'spectree-squad-agent-'));
  try {
    const markdownPath = path.join(dir, 'agent.md');
    writeFileSync(markdownPath, '---\nname:sentinel\ndescription:ssh guard\n---\n\ncorpo\n');
    const definition = loadSquadAgentDefinition(markdownPath);
    assert.equal(definition.id, 'sentinel');
    assert.equal(definition.metadata.description, 'ssh guard');
    assert.equal(definition.instructions, 'corpo');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
