import assert from 'node:assert/strict';
import { ProcessConfigurationError } from '../errors.js';
import {
  canonicalProcessWorld,
  canonicalExecutableName,
} from '../providers/local/subprocess-provider.js';

/**
 * Governed Model Harness (spec F9, secoes 1-2, 7, 57, 116): o harness de
 * modelo E UM PROCESSO — nao um tipo especial de Agent. Este modulo e o
 * lado generico do contrato: a tool provider-backed que leva a execucao
 * pelo pipeline inteiro (EffectResolver -> Policy -> Founder Gate ->
 * Sandbox -> LocalSubprocessProvider) e o runner que aplica o launcher.
 *
 * NENHUM literal de CLI concreto vive aqui (INV-901): launchers
 * especificos sao adapters (ver os arquivos *-launcher.js deste diretorio).
 */

/**
 * Tool `model-harness.run` (secoes 7, 57-58): mesma forma de input do
 * process.spawn — argv explicito, nunca shell string — com um
 * EffectResolver que declara, ALEM dos efeitos de spawn, os recursos de
 * credencial da calibracao aprovada. E o unico ponto em que a
 * configuracao de credencial entra no modelo: como efeito
 * `filesystem.read(credential/...)` (secao 14), que a Policy decide e o
 * Founder aprova ANTES de qualquer mount (secao 58).
 *
 * @param {object} options
 * @param {object|null} options.calibration configuracao declarada da
 *   calibracao aprovada (secao 22): { adapterId, resources: [{resourceId}] }.
 *   null = PROFILE-0 (nenhum recurso de credencial).
 */
export function createModelHarnessTool({ calibration = null } = {}) {
  const credentialResources = (calibration?.resources ?? []).map((resource) => {
    if (typeof resource?.resourceId !== 'string' || resource.resourceId.length === 0) {
      throw new ProcessConfigurationError('calibration resource requires a canonical resourceId');
    }
    // identidade canonica (secao 13): nunca um caminho absoluto do host
    if (resource.resourceId.startsWith('/') || /^[A-Za-z]:/.test(resource.resourceId)) {
      throw new ProcessConfigurationError(
        'calibration resourceId must be a canonical identity, not a host path',
      );
    }
    return resource.resourceId;
  });

  return {
    id: 'model-harness.run',
    name: 'Model Harness',
    description: 'Executa um harness de modelo como processo governado',
    capability: 'process',
    operation: 'spawn',
    execution: 'physical',
    inputSchema: {
      type: 'object',
      required: ['argv', 'cwd', 'stdin', 'stdout', 'stderr'],
      properties: {
        argv: { type: 'array' },
        cwd: { type: 'string' },
      },
    },
    resource: (input) => ({ type: 'process', id: canonicalProcessWorld(input.cwd) }),
    resolveEffects(input) {
      const executable = canonicalExecutableName(input?.argv?.[0]);
      if (!executable) {
        return { completeness: 'incomplete', reason: 'harness executable identity cannot be determined' };
      }
      return [
        {
          kind: 'process',
          operation: 'spawn',
          resource: { type: 'process', id: canonicalProcessWorld(input.cwd) },
        },
        {
          kind: 'process',
          operation: 'spawn',
          resource: { type: 'process', id: 'executable/' + executable },
        },
        // secao 14: credencial e filesystem.read sobre resource type
        // 'credential' — NUNCA um effectKind novo (secao 15)
        ...credentialResources.map((resourceId) => ({
          kind: 'filesystem',
          operation: 'read',
          resource: { type: 'credential', id: resourceId },
        })),
      ];
    },
  };
}

/**
 * Contrato de ModelHarnessLauncher (secoes 3, 81, 113): valida que um
 * launcher e um adapter legitimo do seam — identidade, versao e um
 * launch() que produz um spawn input estruturado, sem shell string e
 * sem copiar ambiente do host.
 */
export function modelHarnessLauncherContract(launcher, { request } = {}) {
  assert.equal(typeof launcher.launcherId, 'string', 'launcherId');
  assert.ok(launcher.launcherId.length > 0);
  assert.equal(typeof launcher.version, 'string', 'version (secao 73)');
  assert.equal(typeof launcher.launch, 'function', 'launch (INV-902)');
  const input = launcher.launch(request ?? { mission: 'contract probe', cwd: '.' });
  assert.ok(Object.isFrozen(input), 'spawn input congelado');
  // secao 113: argv[], nunca shell command string
  assert.ok(Array.isArray(input.argv) && input.argv.length >= 1, 'argv explicito');
  assert.ok(input.argv.every((a) => typeof a === 'string' && a.length > 0), 'argv de strings');
  assert.equal(input.command, undefined, 'nenhuma shell string no contrato (secao 77)');
  assert.equal(input.shell, undefined, 'nenhum shell no contrato (secao 77)');
  assert.equal(typeof input.cwd, 'string', 'cwd explicito (secao 7)');
  for (const stream of ['stdin', 'stdout', 'stderr']) {
    assert.ok(input[stream]?.mode, stream + ' explicito (secao 7)');
  }
  // secao 29: ambiente adicional so por declaracao, nunca copia do host
  if (input.env !== undefined) {
    assert.ok(!Object.keys(input.env).some((k) => k.startsWith('SPECTREE_')),
      'SPECTREE_* e do Runtime (secao 31)');
  }
  return input;
}

/**
 * Executa um harness atraves do pipeline governado (secao 2):
 * launcher.launch(request) -> tool model-harness.run -> ToolRuntime.
 * O resultado cru do processo e entregue ao adapter de output do
 * launcher (parse/validacao) — nunca repassado sem validacao quando o
 * formato declarado e estruturado (secao 67).
 */
export async function runModelHarness({ toolRuntime, launcher, request, context, parseOutput }) {
  const input = modelHarnessLauncherContract(launcher, { request });
  const result = await toolRuntime.execute({ toolId: 'model-harness.run', input }, context);
  return parseOutput ? parseOutput(result.output) : result;
}
