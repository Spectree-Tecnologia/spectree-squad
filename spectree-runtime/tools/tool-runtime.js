import {
  PolicyApprovalRequiredError,
  PolicyConfigurationError,
  PolicyDeniedError,
  ToolError,
  ToolNotFoundError,
  ToolValidationError,
} from '../errors.js';

/**
 * Contrato de Tool (spec secao 10):
 * @typedef {object} Tool
 * @property {string} id            ex.: "filesystem.read"
 * @property {string} name
 * @property {string} description
 * @property {object} [inputSchema] subconjunto minimo de JSON Schema
 * @property {(input: object, context: {sessionId?: string, agentId?: string}) => Promise<*>} execute
 */

/**
 * Resultado devolvido ao AgentLoop:
 * @typedef {object} ToolResult
 * @property {true} ok
 * @property {string} toolId
 * @property {*} output
 */

/**
 * Valida o input contra um subconjunto minimo de JSON Schema:
 * type/properties/required. Validador completo é extension point — o
 * contrato (inputSchema + ToolValidationError) não muda.
 * @returns {string[]} problemas encontrados; vazio = valido
 */
function validateInput(schema, input) {
  if (!schema) return [];
  const issues = [];
  if (schema.type === 'object') {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return ['expected object input, got ' + (Array.isArray(input) ? 'array' : typeof input)];
    }
    for (const key of schema.required ?? []) {
      if (!(key in input)) issues.push('missing required property: ' + key);
    }
    for (const [key, property] of Object.entries(schema.properties ?? {})) {
      if (key in input && property.type && !matchesType(property.type, input[key])) {
        issues.push('property ' + key + ': expected ' + property.type);
      }
    }
  }
  return issues;
}

function matchesType(type, value) {
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number';
    case 'boolean': return typeof value === 'boolean';
    case 'array': return Array.isArray(value);
    case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
    default: return true;
  }
}

/**
 * A unica porta pela qual um Agent acessa ferramentas (spec secao 9,
 * INV-001). `execute(request, context)` é o choke point arquitetural: um
 * futuro PolicyEngine decide aqui, antes da execucao, com o contexto que
 * já chega — session e agentId (spec secao 12). Um futuro timeout entra
 * no mesmo ponto (spec secao 37).
 */
/**
 * Projecao default e SEGURA (R10): publica apenas toolId - e a mensagem
 * de erro em tool.failed. Input e output NUNCA saem no bus por default;
 * um projector customizado (o seam da Fase 1) pode optar por publicar
 * mais, e essa escolha fica explicita no codigo de quem montou o runtime.
 * @param {{phase: string, toolId: string, input?: object, output?: *, error?: string}} view
 */
const defaultProjection = ({ phase, toolId, error }) =>
  phase === 'failed' ? { toolId, error } : { toolId };

export class ToolRuntime {
  #tools = new Map();
  #bus;
  #policyEngine;
  #projectEventPayload;

  /**
   * @param {object} options
   * @param {import('../events/event-bus.js').EventBus} options.eventBus
   * @param {typeof identityProjection} [options.projectEventPayload]
   *   Seam entre o payload da Tool e o payload do Event (R7): o que a tool
   *   recebe/devolve nao precisa ser o que o bus publica. E aqui que uma
   *   futura camada de redacao ou de observabilidade decide o que aparece
   *   em tool.requested/completed/failed - sem tocar Tool nem AgentLoop.
   *   Recebe {phase: 'requested'|'started'|'completed'|'failed', toolId,
   *   input?, output?, error?} e devolve o payload publicado.
   */
  constructor({ eventBus, policyEngine, projectEventPayload = defaultProjection }) {
    if (!policyEngine || typeof policyEngine.decide !== 'function') {
      // Sem policy nao ha execucao (secao 63): um ToolRuntime sem engine
      // seria uma rota permanente de bypass, entao ele nao pode existir.
      throw new PolicyConfigurationError('ToolRuntime requires a policyEngine');
    }
    this.#bus = eventBus;
    this.#policyEngine = policyEngine;
    this.#projectEventPayload = projectEventPayload;
  }

  /** Registra uma Tool; id duplicado é erro. */
  register(tool) {
    for (const field of ['id', 'name', 'description', 'execute']) {
      if (!tool?.[field]) throw new ToolError('tool is missing required field: ' + field);
    }
    if (typeof tool.execute !== 'function') {
      throw new ToolError('tool ' + tool.id + ': execute must be a function');
    }
    if (this.#tools.has(tool.id)) {
      throw new ToolError('tool already registered: ' + tool.id);
    }
    this.#tools.set(tool.id, tool);
  }

  /**
   * Seam de resolucao de recurso (secao 22): o resource vem SOMENTE da
   * metadata da Tool - estatica ({type, id} ou "type/id") ou funcao do
   * mesmo input que a Tool vai executar. Nunca do request (R9): o
   * chamador nao escolhe o recurso contra o qual e autorizado, entao a
   * Policy decide sobre o recurso efetivamente executado.
   */
  #resolveResource(tool, input) {
    const declared =
      typeof tool.resource === 'function' ? tool.resource(input) : tool.resource;
    if (!declared) return null;
    if (typeof declared === 'string') {
      const slash = declared.indexOf('/');
      return slash === -1
        ? { type: null, id: declared }
        : { type: declared.slice(0, slash), id: declared.slice(slash + 1) };
    }
    return { type: declared.type ?? null, id: declared.id ?? null };
  }

  has(toolId) {
    return this.#tools.has(toolId);
  }

  list() {
    return [...this.#tools.keys()];
  }

  /**
   * resolve -> valida -> executa -> captura -> emite eventos (spec 11).
   * Em erro, emite tool.failed e relança o erro tipado — a cascata
   * tool.failed -> agent.failed -> session.failed pertence ao AgentLoop.
   * A Tool recebe apenas o contexto necessario (INV-002).
   * @returns {Promise<ToolResult>}
   */
  async execute(request, context = {}) {
    const { toolId, input = {} } = request;
    const meta = { sessionId: context.session?.id, agentId: context.agentId };
    this.#bus.publish('tool.requested', {
      ...meta,
      payload: this.#projectEventPayload({ phase: 'requested', toolId, input }),
    });

    // Ordem obrigatoria (secao 24): resolve -> valida -> autoriza ->
    // executa. Erros de resolucao/validacao precedem a Policy (secao 71).
    let tool;
    try {
      tool = this.#tools.get(toolId);
      if (!tool) throw new ToolNotFoundError(toolId);
      const issues = validateInput(tool.inputSchema, input);
      if (issues.length > 0) throw new ToolValidationError(toolId, issues);
    } catch (error) {
      this.#bus.publish('tool.failed', {
        ...meta,
        payload: this.#projectEventPayload({
          phase: 'failed',
          toolId,
          error: String(error?.message ?? error),
        }),
      });
      throw error;
    }

    // AuthorizationContext (secao 7): snapshot imutavel da decisao.
    const operation = request.operation ?? tool.operation ?? 'execute';
    const capability = tool.capability ?? tool.id; // fallback de migracao (secao 21)
    const resource = this.#resolveResource(tool, input);
    const authorization = Object.freeze({
      principal: Object.freeze({ type: 'agent', id: context.agentId ?? null }),
      session: Object.freeze({ id: context.session?.id ?? null }),
      tool: Object.freeze({ id: tool.id, capability }),
      operation,
      input,
      resource: resource ? Object.freeze(resource) : null,
    });
    const decision = this.#policyEngine.decide(authorization);
    const policyPayload = {
      policyId: decision.policyId ?? null,
      effect: decision.effect,
      toolId: tool.id,
      operation,
      resource: resource ? (resource.type ?? '?') + '/' + (resource.id ?? '?') : null,
      reason: decision.reason,
    };
    this.#bus.publish('policy.evaluated', { ...meta, payload: policyPayload });
    if (decision.effect === 'deny') {
      this.#bus.publish('policy.denied', { ...meta, payload: policyPayload });
      throw new PolicyDeniedError(decision);
    }
    if (decision.effect === 'approval-required') {
      this.#bus.publish('policy.approval-required', { ...meta, payload: policyPayload });
      throw new PolicyApprovalRequiredError(decision);
    }

    try {
      this.#bus.publish('tool.started', {
        ...meta,
        payload: this.#projectEventPayload({ phase: 'started', toolId }),
      });
      const output = await tool.execute(input, {
        sessionId: context.session?.id,
        agentId: context.agentId,
      });
      this.#bus.publish('tool.completed', {
        ...meta,
        payload: this.#projectEventPayload({ phase: 'completed', toolId, output }),
      });
      return { ok: true, toolId, output };
    } catch (error) {
      this.#bus.publish('tool.failed', {
        ...meta,
        payload: this.#projectEventPayload({
          phase: 'failed',
          toolId,
          error: String(error?.message ?? error),
        }),
      });
      throw error;
    }
  }
}
