import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createResourceRef,
  resourceUri,
  canonicalFilesystemPath,
  filesystemResource,
  createWorkspaceRef,
} from '../effects/resource-ref.js';
import { canonicalExecutableName } from '../providers/local/subprocess-provider.js';
import { EffectResolutionError } from '../errors.js';

/** Resource Model da F8 (spec secoes 6-9, 35-38). */

test('ResourceRef: type e id obrigatorios; URI canonica derivada (secao 6)', () => {
  const ref = createResourceRef({ type: 'filesystem', id: 'workspace/a.txt' });
  assert.ok(Object.isFrozen(ref));
  assert.equal(resourceUri(ref), 'filesystem://workspace/a.txt');
  assert.throws(() => createResourceRef({ type: '', id: 'x' }), EffectResolutionError);
  assert.throws(() => createResourceRef({ type: 'filesystem' }), EffectResolutionError);
});

test('canonicalizacao: separadores, ponto, aliases convergem (secoes 7, 36)', () => {
  // aliases da MESMA identidade (secao 36): sem strings equivalentes
  // autorizadas de forma independente
  const BS = String.fromCharCode(92);
  for (const alias of ['./src/a.js', 'src/a.js', 'src/./a.js', 'docs/../src/a.js', 'src' + BS + 'a.js']) {
    assert.equal(canonicalFilesystemPath(alias), 'workspace/src/a.js', alias);
  }
  assert.equal(canonicalFilesystemPath('.'), 'workspace');
});

test('traversal e absoluto viram outside-workspace — e nenhuma policy de workspace casa (secoes 7, 38)', () => {
  const BS = String.fromCharCode(92);
  for (const escape of ['../fora', '..', '../../etc/passwd', '/etc/passwd', 'C:' + BS + 'Windows', 'src/../../fora', '']) {
    assert.equal(canonicalFilesystemPath(escape), 'outside-workspace', JSON.stringify(escape));
  }
  assert.equal(filesystemResource('../fora').id, 'outside-workspace');
  assert.equal(resourceUri(filesystemResource('a.txt')), 'filesystem://workspace/a.txt');
});

test('identidade de executavel: canonica, sem plataforma (secao 25)', () => {
  const BS = String.fromCharCode(92);
  assert.equal(canonicalExecutableName('/usr/bin/node'), 'node');
  assert.equal(canonicalExecutableName('C:' + BS + 'nodejs' + BS + 'node.EXE'), 'node');
  assert.equal(canonicalExecutableName('py.cmd'), 'py');
  assert.equal(canonicalExecutableName('nodexe'), 'nodexe', 'extensao so cai com ponto');
  assert.equal(canonicalExecutableName(''), null);
  assert.equal(canonicalExecutableName(undefined), null);
});

test('WorkspaceRef: identidade estavel, root resolvida (secao 8)', () => {
  const ref = createWorkspaceRef({ root: '.' });
  assert.ok(Object.isFrozen(ref));
  assert.equal(ref.id, 'workspace');
  assert.notEqual(ref.root, '.', 'root e resolvida, nao relativa');
  assert.throws(() => createWorkspaceRef({}), EffectResolutionError);
});
