import { SessionError, SessionStateError } from '../errors.js';

/**
 * Resultado de uma execucao (spec secao 6).
 * @typedef {object} AgentResult
 * @property {'completed'|'failed'|'cancelled'} status
 * @property {*} [output]
 * @property {Error} [error]
 */

/**
 * O coracao de execucao (spec secao 7): entrega contexto ao Agent, media
 * toda solicitacao de ferramenta, detecta conclusao, falha e
 * cancelamento, e emite os eventos de lifecycle. Executa UM Agent por
 * vez — orquestrar um Squad inteiro pertence à camada futura de
 * Orchestration (spec secao 8). Não conhece ferramentas concretas
 * (INV-003) nem nomes de agentes do Squad (INV-007).
 */
export class AgentLoop {
  #toolRuntime;
  #bus;

  constructor({ toolRuntime, eventBus }) {
    this.#toolRuntime = toolRuntime;
    this.#bus = eventBus;
  }

  /**
   * @param {import('../agent/agent.js').Agent} agent
   * @param {import('../session/session.js').Session} session
   * @returns {Promise<AgentResult>}
   */
  async run(agent, session) {
    if (session.state === 'created') session.start();
    if (session.state !== 'running') throw new SessionStateError(session.state, 'running');

    const meta = { sessionId: session.id, agentId: agent.id };
    const context = {
      session,
      mission: session.mission,
      runtime: {
        // ACT: a unica porta do Agent para ferramentas. O gate de
        // cancelamento vive aqui — apos cancel(), nenhuma nova Tool
        // inicia (spec secao 36).
        requestTool: async (toolId, input) => {
          if (session.isCancelled) {
            throw new SessionError(
              'session ' + session.id + ' is cancelled: no new tool execution',
            );
          }
          return this.#toolRuntime.execute({ toolId, input }, { session, agentId: agent.id });
        },
        emit: (type, payload) => this.#bus.publish(type, { ...meta, payload }),
      },
    };

    this.#bus.publish('agent.started', { ...meta, payload: { mission: session.mission } });
    try {
      const output = await agent.run(context);
      if (session.isCancelled) {
        // Cancelado durante a execucao: nenhum "completed" e emitido (spec 23).
        return { status: 'cancelled' };
      }
      this.#bus.publish('agent.completed', { ...meta, payload: { output } });
      session.complete(output);
      return { status: 'completed', output };
    } catch (error) {
      if (session.isCancelled) {
        return { status: 'cancelled' };
      }
      // Cascata da spec secao 23: tool.failed ja foi emitido pelo
      // ToolRuntime; aqui seguem agent.failed e session.failed.
      this.#bus.publish('agent.failed', {
        ...meta,
        payload: { error: String(error?.message ?? error) },
      });
      session.fail(error);
      return { status: 'failed', error };
    }
  }
}
