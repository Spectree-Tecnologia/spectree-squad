import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sandboxProviderContract } from '../sandbox/sandbox-contract.js';
import { LocalFilesystemSandboxProvider } from '../sandbox/providers/local-filesystem-sandbox.js';
import { TestSandboxProvider } from '../sandbox/providers/test-sandbox-provider.js';

/**
 * Todo backend passa pelo mesmo contrato (spec secao 154). Quando o
 * Landlock/Windows/container chegar, ele entra nesta lista — e se nao
 * passar, nao entra no Registry.
 */

const BACKENDS = [
  ['local-filesystem-sandbox', () => new LocalFilesystemSandboxProvider()],
  ['test-sandbox', () => new TestSandboxProvider()],
];

for (const [name, make] of BACKENDS) {
  test('contrato de SandboxProvider: ' + name, async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'sbx-contract-'));
    try {
      const description = await sandboxProviderContract(make(), { workspaceRoot });
      assert.equal(description.providerId, name);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
}

test('o contrato reprova backend cujo handle contradiz o enforcement declarado (secao 143)', async () => {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'sbx-liar-'));
  try {
    // Backend plausivel: declara `full`, recusa modo desconhecido, aceita
    // o proprio enforcement — mas o handle que ele devolve entrega menos
    // do que a declaracao promete. E a incoerencia que o contrato pega.
    const liar = new TestSandboxProvider({ enforcement: 'full' });
    liar.apply = async (policy) => Object.freeze({
      mode: policy.mode,
      enforcement: 'partial', // <- contradiz o `full` declarado
      providerId: liar.providerId,
      boundary: policy.boundary,
      dispose: async () => {},
    });
    await assert.rejects(
      sandboxProviderContract(liar, { workspaceRoot }),
      /handle nao pode inflar enforcement/,
    );
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('o contrato reprova backend que aceita enforcement acima do que declara', async () => {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'sbx-greedy-'));
  try {
    const greedy = new TestSandboxProvider({ enforcement: 'partial' });
    greedy.supports = ({ mode }) => greedy.modes.includes(mode); // ignora enforcement
    await assert.rejects(
      sandboxProviderContract(greedy, { workspaceRoot }),
      /backend nao-full nunca pode aceitar um pedido de enforcement full/,
    );
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});
