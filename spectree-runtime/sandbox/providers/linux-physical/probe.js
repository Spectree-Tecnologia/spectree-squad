import { spawn as nodeSpawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Functional probe (spec Fase 7, secoes 15-19, 71-77): a AUTORIDADE
 * sobre disponibilidade de backend (INV-724). `which bwrap` nao prova
 * nada — o executavel pode existir e nao funcionar neste host. O probe
 * cria um mundo descartavel, executa um processo confinado de verdade e
 * verifica que o comportamento corresponde ao contrato do modo:
 *
 *   allowed read   -> permitido
 *   outside read   -> negado
 *   workspace write-> permitido so em workspace-write
 *
 * Nunca roda sobre o workspace real (secao 71); nao depende de rede,
 * DNS ou credencial (secoes 75-76); e sempre destroi o probe-root.
 */

export const PROBE_SENTINEL = 'SPECTREE_PROBE:';

/**
 * Distincao da secao 58: o filho do probe SEMPRE imprime o sentinel,
 * mesmo quando os efeitos sao negados — exit code e stdout sem sentinel
 * significam falha do RUNNER, nunca veredito de enforcement.
 */
function probeChildScript({ allowedFile, outsideFile, writeFile }) {
  return (
    "const fs = require('fs');" +
    'const r = { read: false, outsideRead: false, write: false };' +
    'try { fs.readFileSync(' + JSON.stringify(allowedFile) + ", 'utf8'); r.read = true; } catch {}" +
    'try { fs.readFileSync(' + JSON.stringify(outsideFile) + ", 'utf8'); r.outsideRead = true; } catch {}" +
    'try { fs.writeFileSync(' + JSON.stringify(writeFile) + ", 'x'); r.write = true; } catch {}" +
    "process.stdout.write('" + PROBE_SENTINEL + "' + JSON.stringify(r));"
  );
}

/**
 * Executa um probe funcional para UM modo contra UM backend.
 *
 * @returns {{usable: boolean, backendId: string, mode: string, reason: string|null}}
 */
export async function functionalProbe(backend, {
  mode,
  spawnImpl = nodeSpawn,
  nodePath = process.execPath,
  probeTimeoutMs = 5000,
  tmpRoot = tmpdir(),
} = {}) {
  const result = (usable, reason = null) =>
    Object.freeze({ usable, backendId: backend.backendId, mode, reason });

  // mundo descartavel (secoes 71-72): nunca o workspace do Founder
  const probeRoot = mkdtempSync(path.join(tmpRoot, 'spectree-probe-'));
  try {
    const workspaceRoot = path.join(probeRoot, 'workspace');
    const outsideDir = path.join(probeRoot, 'outside');
    mkdirSync(workspaceRoot, { recursive: true });
    mkdirSync(outsideDir, { recursive: true });
    const allowedFile = path.join(workspaceRoot, 'allowed.txt');
    const outsideFile = path.join(outsideDir, 'secret.txt');
    const writeFile = path.join(workspaceRoot, 'probe-write.txt');
    writeFileSync(allowedFile, 'allowed', 'utf8');
    writeFileSync(outsideFile, 'secret', 'utf8');

    const script = probeChildScript({ allowedFile, outsideFile, writeFile });
    let argv;
    try {
      argv = backend.buildConfinedArgv({
        argv: [nodePath, '-e', script],
        cwd: workspaceRoot,
        mode,
        workspaceRoot,
        sessionTemp: null,
      });
    } catch (error) {
      return result(false, 'backend cannot build confined argv: ' + (error?.message ?? error));
    }

    const observed = await runProbeProcess(argv, { spawnImpl, probeTimeoutMs });
    if (!observed.ok) return result(false, observed.reason);

    // expectativa do contrato do modo (secoes 16, 30-31)
    const expected = {
      read: true,
      outsideRead: false,
      write: mode === 'workspace-write',
    };
    const mismatches = Object.keys(expected)
      .filter((key) => observed.effects[key] !== expected[key])
      .map((key) => key + ': expected ' + expected[key] + ', got ' + observed.effects[key]);
    if (mismatches.length > 0) {
      return result(false, 'enforcement mismatch under ' + mode + ' — ' + mismatches.join('; '));
    }
    return result(true);
  } finally {
    rmSync(probeRoot, { recursive: true, force: true });
  }
}

/**
 * Roda o processo do probe com timeout (secao 18): probe pendurado nao
 * pode bloquear o Runtime inteiro.
 */
function runProbeProcess(argv, { spawnImpl, probeTimeoutMs }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnImpl(argv[0], argv.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ ok: false, reason: 'runner spawn failed: ' + (error?.message ?? error) });
      return;
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      settle({ ok: false, reason: 'probe timeout after ' + probeTimeoutMs + 'ms' });
    }, probeTimeoutMs);
    child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', (error) => {
      settle({ ok: false, reason: 'runner failed to start: ' + (error?.message ?? error) });
    });
    child.once('close', (exitCode) => {
      const at = stdout.indexOf(PROBE_SENTINEL);
      if (at < 0) {
        // secao 58: sem sentinel = falha do RUNNER, nao veredito do filho
        settle({
          ok: false,
          reason: 'runner failure (no probe sentinel; exit ' + exitCode + ')' +
            (stderr ? ': ' + stderr.trim().slice(0, 200) : ''),
        });
        return;
      }
      try {
        const effects = JSON.parse(stdout.slice(at + PROBE_SENTINEL.length));
        settle({ ok: true, effects });
      } catch {
        settle({ ok: false, reason: 'runner produced malformed probe report' });
      }
    });
  });
}
