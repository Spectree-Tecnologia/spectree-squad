import { readFileSync } from 'node:fs';
import { PolicyConfigurationError } from '../errors.js';
import { PolicyRegistry } from '../policy/policy-registry.js';
import { PolicyEngine } from '../policy/policy-engine.js';

/**
 * Adapter oficial de documento de policies (Fase 4.5): o caminho unico
 * pelo qual um arquivo JSON de policies vira PolicyRegistry/PolicyEngine.
 * Todo consumidor — guard, runtime, testes, exemplos — passa por aqui,
 * para que a mesma matriz produza a MESMA decisao em todos.
 *
 * Como no squad-agent.js, o arquivo e dado de entrada, nunca dependencia
 * (INV-007): o runtime continua sem conhecer nomes do Squad. A validacao
 * de forma de cada policy e do PolicyRegistry (normalizacao da Fase 2);
 * aqui so se valida que o documento e legivel e e uma lista nao vazia.
 */

/** Le e valida o documento; erro de leitura/forma e de configuracao. */
export function loadPolicyDocument(source) {
  let raw;
  try {
    raw = readFileSync(source, 'utf8');
  } catch (error) {
    throw new PolicyConfigurationError(
      'cannot read policy document ' + String(source) + ': ' + (error?.message ?? error),
    );
  }
  let document;
  try {
    document = JSON.parse(raw);
  } catch (error) {
    throw new PolicyConfigurationError(
      'policy document ' + String(source) + ' is not valid JSON: ' + (error?.message ?? error),
    );
  }
  if (!Array.isArray(document) || document.length === 0) {
    throw new PolicyConfigurationError(
      'policy document ' + String(source) + ' must be a non-empty array of policies',
    );
  }
  return document;
}

/**
 * Escopo de projeto (Fase 4.8). Policy sem `project` e GLOBAL: vale onde
 * quer que o squad rode. Policy com `project` (string ou lista) so vale
 * nos projetos nomeados — porque projetos tem regimes de governanca
 * legitimamente diferentes, e a matriz nao pode promover a convencao de
 * um deles a lei universal.
 *
 * Consumidor que nao sabe em qual projeto esta recebe SO as globais: uma
 * policy escopada nunca vaza para fora do escopo, nem para conceder nem
 * para negar. Filtrar aqui — no caminho unico de carga da Fase 4.5 —
 * garante que guard, runtime e testes apliquem o MESMO escopo; espalhar
 * a filtragem pelos consumidores traria de volta a divergencia que a
 * 4.5 eliminou.
 */
export function policyAppliesToProject(policy, project) {
  const scope = policy?.project ?? policy?.projects;
  if (scope === undefined || scope === null) return true;
  const scoped = Array.isArray(scope) ? scope : [scope];
  if (scoped.length === 0) return true;
  return typeof project === 'string' && project.length > 0 && scoped.includes(project);
}

/**
 * Documento -> {policies, registry, engine} prontos, ja filtrados pelo
 * escopo. O registry pode ser injetado em
 * createRuntime({ policyRegistry }); o engine decide isolado (guard e
 * testes). Uma unica construcao, nenhuma copia da matriz.
 *
 * `document` devolve a matriz inteira, sem filtro — para quem precisa
 * auditar o que existe, nao o que se aplica aqui.
 */
export function policyEngineFromDocument(source, options = {}) {
  const document = loadPolicyDocument(source);
  const project = typeof options.project === 'string' && options.project.length > 0
    ? options.project
    : null;
  const policies = document.filter((policy) => policyAppliesToProject(policy, project));
  const registry = new PolicyRegistry();
  registry.registerMany(policies);
  return { policies, document, project, registry, engine: new PolicyEngine({ registry }) };
}
