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

// Executor autorizado (spec Fase 3, secao 43): registrado aqui na
// construcao e adquirivel UMA unica vez — o wiring do createRuntime o
// entrega ao ApprovalManager, cujo resume() sempre revalida a Policy
// antes de chamar (INV-318). Nao existe executeWithoutPolicy na
// superficie publica (secao 44), e nada disto alcanca o Agent (R8).
const AUTHORIZED_EXECUTORS = new WeakMap();

export function acquireAuthorizedExecutor(toolRuntime) {
  const executor = AUTHORIZED_EXECUTORS.get(toolRuntime);
  if (!executor) {
    throw new ToolError('authorized executor already acquired or unavailable');
  }
  AUTHORIZED_EXECUTORS.delete(toolRuntime);
  return executor;
}

export class ToolRuntime {
  #tools = new Map();
  #bus;
  #policyEngine;
  #projectEventPayload;
  #onApprovalRequired;

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
  constructor({ eventBus, policyEngine, projectEventPayload = defaultProjection, onApprovalRequired = null }) {
    if (!policyEngine || typeof policyEngine.decide !== 'function') {
      // Sem policy nao ha execucao (secao 63): um ToolRuntime sem engine
      // seria uma rota permanente de bypass, entao ele nao pode existir.
      throw new PolicyConfigurationError('ToolRuntime requires a policyEngine');
    }
    this.#bus = eventBus;
    this.#policyEngine = policyEngine;
    this.#projectEventPayload = projectEventPayload;
    this.#onApprovalRequired = onApprovalRequired;
    AUTHORIZED_EXECUTORS.set(this, (invocation) => this.#runAuthorized(invocation));
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

  /**
   * Dry-run de autorizacao (Fase 3): resolve, valida e decide SEM emitir
   * evento e SEM executar. E o que o ApprovalManager usa para revalidar
   * um resume (secao 42) — e o que uma UI futura usaria para responder
   * "o que aconteceria?". Nao ha efeito colateral algum.
   */
  authorize(request, context = {}) {
    const { toolId, input = {} } = request;
    const tool = this.#tools.get(toolId);
    if (!tool) throw new ToolNotFoundError(toolId);
    const issues = validateInput(tool.inputSchema, input);
    if (issues.length > 0) throw new ToolValidationError(toolId, issues);
    const authorization = this.#buildAuthorization(tool, input, request, context);
    return { authorization, decision: this.#policyEngine.decide(authorization) };
  }

  #buildAuthorization(tool, input, request, context) {
    const operation = request.operation ?? tool.operation ?? 'execute';
    const capability = tool.capability ?? tool.id;
    const resource = this.#resolveResource(tool, input);
    return Object.freeze({
      principal: Object.freeze({ type: 'agent', id: context.agentId ?? null }),
      session: Object.freeze({ id: context.session?.id ?? null }),
      tool: Object.freeze({ id: tool.id, capability }),
      operation,
      input,
      resource: resource ? Object.freeze(resource) : null,
    });
  }

  /** Pipeline fisico de execucao: started -> execute -> completed/failed. */
  async #runTool(tool, input, meta) {
    try {
      this.#bus.publish('tool.started', {
        ...meta,
        payload: this.#projectEventPayload({ phase: 'started', toolId: tool.id }),
      });
      const output = await tool.execute(input, {
        sessionId: meta.sessionId,
        agentId: meta.agentId,
      });
      this.#bus.publish('tool.completed', {
        ...meta,
        payload: this.#projectEventPayload({ phase: 'completed', toolId: tool.id, output }),
      });
      return { ok: true, toolId: tool.id, output };
    } catch (error) {
      this.#bus.publish('tool.failed', {
        ...meta,
        payload: this.#projectEventPayload({
          phase: 'failed',
          toolId: tool.id,
          error: String(error?.message ?? error),
        }),
      });
      throw error;
    }
  }

  /** Caminho do resume: so alcancavel via acquireAuthorizedExecutor. */
  async #runAuthorized({ toolId, input, sessionId, agentId }) {
    const tool = this.#tools.get(toolId);
    if (!tool) throw new ToolNotFoundError(toolId);
    return this.#runTool(tool, input ?? {}, { sessionId, agentId });
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
    const authorization = this.#buildAuthorization(tool, input, request, context);
    const decision = this.#policyEngine.decide(authorization);
    const resource = authorization.resource;
    const policyPayload = {
      policyId: decision.policyId ?? null,
      effect: decision.effect,
      toolId: tool.id,
      operation: authorization.operation,
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
      const error = new PolicyApprovalRequiredError(decision);
      // Fase 3: a invocation bloqueada vira um pedido formal de decisao
      // humana (secao 5). O snapshot vai ao ApprovalManager; o input fica
      // no estado privado do store, nunca em evento.
      if (this.#onApprovalRequired) {
        const approval = await this.#onApprovalRequired(
          {
            sessionId: context.session?.id ?? null,
            agentId: context.agentId ?? null,
            toolId: tool.id,
            capability: authorization.tool.capability,
            operation: authorization.operation,
            resource: policyPayload.resource,
            input,
          },
          { policyId: decision.policyId ?? null, reason: decision.reason },
        );
        error.approvalId = approval?.approvalId ?? null;
      }
      throw error;
    }

    return this.#runTool(tool, input, meta);
  }
}
