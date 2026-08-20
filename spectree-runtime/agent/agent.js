import { AgentError } from '../errors.js';

/**
 * Identidade + instrucao + configuracao (spec secao 6).
 * @typedef {object} AgentDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} instructions
 * @property {object} [metadata]
 */

/**
 * Contexto entregue pelo AgentLoop a cada execucao (spec secao 6).
 * @typedef {object} AgentContext
 * @property {import('../session/session.js').Session} session
 * @property {string} mission
 * @property {object} runtime
 * @property {(toolId: string, input?: object) => Promise<object>} runtime.requestTool
 */

/**
 * Unidade executavel do Spectree Runtime (spec secao 5). Não representa
 * Lina, Jakiro nem modelo algum — é a abstracao que qualquer um deles
 * pode habitar. Capacidades (filesystem, shell, git, browser, MCP) nunca
 * são implementadas aqui: chegam pelo ToolRuntime, via
 * context.runtime.requestTool (INV-001).
 *
 * O seam de LLM (spec secao 26) é este: uma futura subclasse LlmAgent
 * conversa com um Model provider dentro de run() — AgentLoop,
 * ToolRuntime, Session e EventBus não mudam.
 */
export class Agent {
  constructor(definition) {
    for (const field of ['id', 'name', 'instructions']) {
      if (typeof definition?.[field] !== 'string' || definition[field].length === 0) {
        throw new AgentError('agent definition is missing required field: ' + field);
      }
    }
    this.definition = Object.freeze({ metadata: {}, ...definition });
  }

  get id() {
    return this.definition.id;
  }

  /**
   * Executa a missao. Subclasses implementam o corpo; o valor de retorno
   * vira AgentResult.output, e lançar sinaliza falha. O ciclo
   * THINK -> ACT -> OBSERVE acontece aqui: pensar é o codigo do agente,
   * agir é requestTool, observar é o resultado awaited.
   * @param {AgentContext} context
   * @returns {Promise<*>}
   */
  async run(context) { // eslint-disable-line no-unused-vars
    throw new AgentError('agent ' + this.id + ' does not implement run()');
  }
}
