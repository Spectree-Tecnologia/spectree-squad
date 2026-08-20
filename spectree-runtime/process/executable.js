import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { ProcessExecutableNotFoundError, ProcessConfigurationError } from '../errors.js';

/**
 * Resolucao de executavel (spec Fase 6, secoes 16-19, 75-79).
 *
 * Duas rotas, nenhuma delas shell:
 *   - caminho absoluto: canonicalizado (realpath) e verificado (secao 17);
 *   - nome simples: resolvido atraves do PATH CONTROLADO — o PATH do
 *     ambiente ja composto pelo Runtime, nunca um override vindo do
 *     input (secao 76: o Agent nao redefine a execucao por
 *     PATH=/arbitrario). Nada de varrer o filesystem (secao 18).
 *
 * O resultado e um snapshot (secao 78): o executavel resolvido na
 * autorizacao e EXATAMENTE o executado — nenhuma substituicao entre
 * autorizar e executar (secao 79, INV-609).
 */

const WINDOWS_EXTENSIONS = Object.freeze(['.exe', '.cmd', '.bat', '.com']);

function isExecutableFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * @param {string} command  argv[0]
 * @param {string} controlledPath  o PATH do ambiente composto pelo Runtime
 * @param {string} [platform]
 * @returns {{ path: string, source: 'absolute'|'path' }}
 */
export function resolveExecutable(command, controlledPath, platform = process.platform) {
  if (typeof command !== 'string' || command.length === 0) {
    throw new ProcessConfigurationError('executable command must be a non-empty string');
  }
  const windows = platform === 'win32';

  if (path.isAbsolute(command)) {
    if (!existsSync(command) || !isExecutableFile(command)) {
      throw new ProcessExecutableNotFoundError(command);
    }
    return { path: realpathSync(command), source: 'absolute' };
  }

  // caminho relativo com separador (./tool, sub/dir/bin) nao entra: ou e
  // absoluto e verificavel, ou e nome simples resolvido pelo PATH
  if (command.includes('/') || command.includes('\\')) {
    throw new ProcessConfigurationError(
      "executable must be an absolute path or a bare command name, got: '" + command + "'",
    );
  }

  const directories = String(controlledPath ?? '').split(path.delimiter).filter(Boolean);
  const candidates = windows && !WINDOWS_EXTENSIONS.some((ext) => command.toLowerCase().endsWith(ext))
    ? WINDOWS_EXTENSIONS.map((ext) => command + ext)
    : [command];
  for (const directory of directories) {
    for (const candidate of candidates) {
      const full = path.join(directory, candidate);
      if (isExecutableFile(full)) {
        return { path: realpathSync(full), source: 'path' };
      }
    }
  }
  throw new ProcessExecutableNotFoundError(command);
}
