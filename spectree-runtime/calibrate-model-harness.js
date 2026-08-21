/**
 * Credential Calibration — operacao DELIBERADA do Founder (spec F9,
 * secoes 9-13, 18-25, 70):
 *
 *   node spectree-runtime/calibrate-model-harness.js [candidates.json]
 *
 * NAO roda em npm test, NAO roda em apply(), NAO roda em CI. Usa o CLI
 * real do Claude, a credencial real e possivelmente a quota real
 * (secao 20). O resultado e uma PROPOSTA (secao 23): o record impresso
 * (sem segredo, sem caminho absoluto) e o que o Founder aprova e commita
 * como configuracao; os bindings fisicos ficam em configuracao de host.
 *
 * candidates.json (opcional; escada NORMATIVA da secao 12 — degrau mais
 * estreito primeiro, diretorio so depois dos estreitos falharem):
 *   [{ "resourceId": "claude/auth",
 *      "physicalPath": "/home/user/.claude/.credentials.json",
 *      "granularity": "file" }]
 * granularity: 'file' | 'file-set' | 'directory' — DERIVADA do disco:
 * caminho inexistente e recusado; diretorio exige 'directory';
 * 'directory' nunca e o primeiro degrau. Ordem violada = erro.
 * Sem arquivo: somente PROFILE-0 e sondado.
 */
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { LinuxPhysicalSandboxProvider } from './sandbox/providers/linux-physical/linux-physical-sandbox-provider.js';
import { createSandboxPolicy } from './sandbox/sandbox-policy.js';
import { ClaudeModelHarnessLauncher, classifyClaudeAuthProbe } from './harness/claude-launcher.js';
import { runCredentialCalibration } from './harness/credential-calibration.js';

if (process.platform !== 'linux') {
  console.log('calibracao exige Linux/WSL2 com backend fisico — expected unavailable em ' + process.platform);
  process.exit(0);
}

const provider = new LinuxPhysicalSandboxProvider({
  tempRoot: mkdtempSync(path.join(tmpdir(), 'spectree-cal-temp-')),
});
const verdict = await provider.probe();
if (!verdict.usable) {
  console.log('confined harness unavailable: ' + (verdict.reason ?? 'no usable backend'));
  console.log(JSON.stringify(verdict.attempts, null, 2));
  process.exit(1);
}

const candidates = process.argv[2]
  ? JSON.parse(readFileSync(process.argv[2], 'utf8'))
  : [];
const launcher = new ClaudeModelHarnessLauncher({ maxLifetimeMs: 120_000 });

const report = await runCredentialCalibration({
  adapterId: launcher.launcherId + '@' + launcher.version,
  outputMode: launcher.outputContract,
  candidates,
  homePath: homedir(),
  async runCandidate(candidate) {
    // mundo descartavel por candidato — nunca o workspace real
    const root = mkdtempSync(path.join(tmpdir(), 'spectree-cal-'));
    const workspaceRoot = path.join(root, 'workspace');
    mkdirSync(workspaceRoot, { recursive: true });
    try {
      const policy = createSandboxPolicy({
        mode: 'workspace-write',
        workspaceRoot,
        requiredEnforcement: 'full',
        declaredResources: candidate
          ? [{ resourceId: 'credential/' + candidate.resourceId, physicalPath: candidate.physicalPath, mode: 'read' }]
          : [],
      });
      const handle = await provider.apply(policy, { sessionId: 'calibration' });
      try {
        const input = launcher.launch({ mission: 'Reply with a single word: ready', cwd: '.' });
        const confined = handle.confineProcess({ argv: [...input.argv], cwd: workspaceRoot });
        const probe = await new Promise((resolve) => {
          const child = spawn(confined.argv[0], confined.argv.slice(1), {
            cwd: workspaceRoot,
            env: { PATH: process.env.PATH ?? '', HOME: homedir(), TERM: 'dumb' },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let stdout = '';
          let stderr = '';
          let timedOut = false;
          const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 120_000);
          child.stdout.on('data', (c) => { stdout += String(c); });
          child.stderr.on('data', (c) => { stderr += String(c); });
          child.once('error', () => { clearTimeout(timer); resolve({ outcome: null }); });
          child.once('close', (exitCode) => {
            clearTimeout(timer);
            resolve({ outcome: { exitCode, timedOut }, stdoutText: stdout, stderrText: stderr });
          });
        });
        return classifyClaudeAuthProbe(probe);
      } finally {
        await handle.dispose();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
});

console.log(JSON.stringify(report, null, 2));
if (report.approved) {
  console.log('\nResultado ' + (report.approved.profile === 'PROFILE-0' ? 'A' : 'B') +
    ' — leve este record para aprovacao do Founder e commite a configuracao (secao 22).');
} else {
  console.log('\nNenhum candidato aprovado ate aqui. Se a lista esta esgotada, o');
  console.log('resultado e C: confined harness unavailable — e isso e uma entrega');
  console.log('valida (secoes 24-25), nunca uma razao para montar o HOME (INV-906).');
}
