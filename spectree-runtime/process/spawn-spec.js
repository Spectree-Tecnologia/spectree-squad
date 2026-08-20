import { ProcessConfigurationError } from '../errors.js';

/**
 * ProcessSpawnSpec (spec Fase 6, secoes 12-14, 47-48, 66-67).
 *
 * Regra de ouro (secao 6, INV-606): argv explicito, NUNCA uma string de
 * comando interpretada por shell. `argv[0]` e o executavel; o resto sao
 * argumentos literais. Nao existe `shell: true` (secao 15) — um futuro
 * ShellProvider pedira `process.spawn` com `argv: ['/bin/bash', ...]` e
 * sera governado como qualquer outro processo.
 *
 * STDIO explicito (secoes 47-48): nenhum default silencioso. Quem chama
 * declara o destino de cada stream.
 */

const STDIN_MODES = Object.freeze(['ignore', 'pipe', 'data']);
const STDOUT_MODES = Object.freeze(['pipe', 'inherit', 'collect']);

/** Teto do grace period (secao 66): positivo, finito, limitado. */
const MAX_GRACE_MS = 60_000;
const DEFAULT_GRACE_MS = 2_000;

/** Teto absoluto de coleta em memoria (secoes 50, 105). */
const MAX_COLLECT_BYTES = 16 * 1024 * 1024;
const DEFAULT_COLLECT_BYTES = 1024 * 1024;

function normalizeStream(value, label, modes) {
  const raw = typeof value === 'string' ? { mode: value } : value;
  if (!raw || typeof raw !== 'object' || !modes.includes(raw.mode)) {
    throw new ProcessConfigurationError(
      label + ' must declare an explicit mode (' + modes.join(' | ') + ')',
    );
  }
  const stream = { mode: raw.mode };
  if (raw.mode === 'data') {
    if (typeof raw.data !== 'string') {
      throw new ProcessConfigurationError("stdin mode 'data' requires a string `data`");
    }
    stream.data = raw.data;
  }
  if (raw.mode === 'collect') {
    const maxBytes = raw.maxBytes ?? DEFAULT_COLLECT_BYTES;
    if (!Number.isFinite(maxBytes) || maxBytes <= 0 || maxBytes > MAX_COLLECT_BYTES) {
      throw new ProcessConfigurationError(
        label + '.maxBytes must be a positive number up to ' + MAX_COLLECT_BYTES,
      );
    }
    stream.maxBytes = maxBytes;
    if (raw.spill) {
      // spill opcional e LIMITADO (secao 51): nunca arquivo sem teto
      const spillMax = raw.spill.maxBytes;
      if (!Number.isFinite(spillMax) || spillMax <= 0 || spillMax > 4 * MAX_COLLECT_BYTES) {
        throw new ProcessConfigurationError(label + '.spill.maxBytes must be bounded');
      }
      if (typeof raw.spill.dir !== 'string' || raw.spill.dir.length === 0) {
        throw new ProcessConfigurationError(label + '.spill.dir is required when spill is set');
      }
      stream.spill = Object.freeze({ dir: raw.spill.dir, maxBytes: spillMax });
    }
  }
  return Object.freeze(stream);
}

/**
 * Normaliza, valida e congela o spec. Erro de configuracao acontece
 * ANTES de qualquer efeito: process.start = 0 (secao 14).
 */
export function createProcessSpawnSpec(input) {
  if (!input || typeof input !== 'object') {
    throw new ProcessConfigurationError('spawn spec must be an object');
  }
  const { argv } = input;
  if (!Array.isArray(argv) || argv.length < 1 ||
      argv.some((a) => typeof a !== 'string' || a.length === 0)) {
    throw new ProcessConfigurationError(
      'argv must be a non-empty array of non-empty strings (argv[0] = executable)',
    );
  }
  if (typeof input.cwd !== 'string' || input.cwd.length === 0) {
    // cwd EXPLICITO (secao 26, INV-607): nunca herdado de process.cwd()
    throw new ProcessConfigurationError('cwd is required and must be explicit');
  }
  const graceMs = input.graceMs ?? DEFAULT_GRACE_MS;
  if (!Number.isFinite(graceMs) || graceMs <= 0 || graceMs > MAX_GRACE_MS) {
    throw new ProcessConfigurationError(
      'graceMs must be a positive finite number up to ' + MAX_GRACE_MS,
    );
  }
  if (input.env !== undefined && (typeof input.env !== 'object' || Array.isArray(input.env))) {
    throw new ProcessConfigurationError('env must be a plain object of explicit overrides');
  }
  if (input.signal !== undefined && typeof input.signal?.addEventListener !== 'function') {
    throw new ProcessConfigurationError('signal must be an AbortSignal when present');
  }
  return Object.freeze({
    argv: Object.freeze([...argv]),
    cwd: input.cwd,
    stdin: normalizeStream(input.stdin, 'stdin', STDIN_MODES),
    stdout: normalizeStream(input.stdout, 'stdout', STDOUT_MODES),
    stderr: normalizeStream(input.stderr, 'stderr', STDOUT_MODES),
    env: Object.freeze({ ...(input.env ?? {}) }),
    allowedEnvironmentKeys: Object.freeze([...(input.allowedEnvironmentKeys ?? [])]),
    graceMs,
    signal: input.signal ?? null,
  });
}

export { STDIN_MODES, STDOUT_MODES, MAX_GRACE_MS, DEFAULT_COLLECT_BYTES };
