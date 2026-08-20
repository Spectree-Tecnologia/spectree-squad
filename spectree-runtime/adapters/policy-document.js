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
 * Documento -> {policies, registry, engine} prontos. O registry pode ser
 * injetado em createRuntime({ policyRegistry }); o engine decide isolado
 * (guard e testes). Uma unica construcao, nenhuma copia da matriz.
 */
export function policyEngineFromDocument(source) {
  const policies = loadPolicyDocument(source);
  const registry = new PolicyRegistry();
  registry.registerMany(policies);
  return { policies, registry, engine: new PolicyEngine({ registry }) };
}
