import {
  PolicyApprovalRequiredError,
  PolicyConfigurationError,
  PolicyDeniedError,
  ToolError,
  ToolNotFoundError,
  ToolValidationError,
  ProviderExecutionError,
  SandboxError,
  SandboxDeniedError,
  SandboxConfigurationError,
  CapabilityError,
} from '../errors.js';
import {
  EffectResolutionError,
  EffectAuthorizationError,
} from '../errors.js';
import { releaseSandbox } from '../sandbox/sandbox-resolver.js';
import { describeSandboxPolicy } from '../sandbox/sandbox-policy.js';
import { EffectResolver } from '../effects/effect-resolver.js';
import { resourceUri } from '../effects/resource-ref.js';

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
  #capabilityResolver;
  #sandboxResolver;
  #sandboxProfileResolver;
  #projectEventPayload;
  #onApprovalRequired;
  #effectResolver = new EffectResolver();

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
  constructor({
    eventBus,
    policyEngine,
    capabilityResolver,
    sandboxResolver = null,
    sandboxProfileResolver = null,
    projectEventPayload = defaultProjection,
    onApprovalRequired = null,
  }) {
    if (!policyEngine || typeof policyEngine.decide !== 'function') {
      // Sem policy nao ha execucao (secao 63): um ToolRuntime sem engine
      // seria uma rota permanente de bypass, entao ele nao pode existir.
      throw new PolicyConfigurationError('ToolRuntime requires a policyEngine');
    }
    if (!capabilityResolver) {
      // Gate da Fase 4 (INV-421): sem resolver nao ha execucao.
      throw new PolicyConfigurationError('ToolRuntime requires a capabilityResolver');
    }
    this.#bus = eventBus;
    this.#policyEngine = policyEngine;
    this.#capabilityResolver = capabilityResolver;
    // Fase 5: a fronteira de Sandbox e UNICA no runtime (INV-526) e vive
    // aqui, entre a autorizacao e a execucao fisica.
    this.#sandboxResolver = sandboxResolver;
    this.#sandboxProfileResolver = sandboxProfileResolver;
    this.#projectEventPayload = projectEventPayload;
    this.#onApprovalRequired = onApprovalRequired;
    AUTHORIZED_EXECUTORS.set(this, (invocation) => this.#runAuthorized(invocation));
  }

  /** Registra uma Tool; id duplicado é erro. */
  register(tool) {
    for (const field of ['id', 'name', 'description']) {
      if (!tool?.[field]) throw new ToolError('tool is missing required field: ' + field);
    }
    // Fase 4: execute e opcional — tool sem execute e provider-backed e o
    // Provider da capability dela realiza a operacao (secao 3).
    if (tool.execute !== undefined && typeof tool.execute !== 'function') {
      throw new ToolError('tool ' + tool.id + ': execute must be a function when present');
    }
    // R13: classificacao de execucao. Tool self-provided declara se e
    // 'pure' (sem efeito fisico — explicitamente fora do sandbox) ou
    // 'physical' (efeito fisico — sandbox obrigatorio). Provider-backed
    // e fisica por definicao e ja passa pela fronteira.
    if (tool.execution !== undefined && !['pure', 'physical'].includes(tool.execution)) {
      throw new ToolError(
        "tool " + tool.id + ": execution must be 'pure' or 'physical' when present",
      );
    }
    // Fail closed e fail early: com sandbox configurado, tool
    // self-provided SEM classificacao nao entra no registry — e a mesma
    // filosofia da secao 132 (nao classificada -> configuration-required).
    if (this.#sandboxProfileResolver && typeof tool.execute === 'function' && !tool.execution) {
      throw new SandboxConfigurationError(
        "tool " + tool.id + " is self-provided and unclassified: declare execution 'pure' " +
        "or 'physical' before it can register on a sandbox-enabled runtime",
      );
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
    // Fase 8 (secoes 20, 50): o dry-run tambem resolve efeitos — o
    // resume compara fingerprints e reavalia CADA efeito, sem eventos
    const plan = this.#resolveEffectPlan(tool, input, authorization);
    if (plan && plan.completeness !== 'complete') {
      throw new EffectResolutionError(
        "tool '" + tool.id + "' produced an incomplete effect plan on revalidation",
      );
    }
    const decision = plan
      ? this.#evaluateEffects(plan, authorization, {}, { emit: false }).decision
      : this.#policyEngine.decide(authorization);
    return { authorization, decision, effectPlan: plan };
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

  /**
   * Resolucao de efeitos (spec Fase 8, secoes 12, 44): antes da Policy,
   * o Runtime determina o ExecutionEffectSet da operacao. Tool sem rota
   * de resolucao segue o caminho legado single-resource das Fases 1-7
   * (secao 63) — capability no modelo F8 (effectKinds declarados) nao
   * pode regredir e falha fechado dentro do resolver.
   */
  #resolveEffectPlan(tool, input, authorization) {
    let capability = null;
    try {
      capability = this.#capabilityResolver.resolveCapability(tool, authorization.operation);
    } catch {
      capability = null; // gate de capability continua no dispatch (F4)
    }
    return this.#effectResolver.resolve({
      tool,
      capability,
      input,
      principal: authorization.principal,
      session: authorization.session,
      cwd: typeof input?.cwd === 'string' ? input.cwd : null,
    });
  }

  /**
   * Avaliacao por efeito + composicao (secoes 15-17, INV-804): a Policy
   * existente decide CADA efeito — capability de decisao = kind do
   * efeito, resource = resource do efeito. Qualquer DENY vence o
   * conjunto; APPROVAL vence ALLOW; nao existe autorizacao parcial.
   */
  #evaluateEffects(plan, authorization, meta, { emit = true } = {}) {
    const decisions = [];
    let deny = null;
    let approval = null;
    for (const effect of plan.effects) {
      const effectAuthorization = Object.freeze({
        principal: authorization.principal,
        session: authorization.session,
        // a capability que governa o efeito e o KIND dele: um spawn que
        // declara efeitos de filesystem e julgado pelas policies de
        // filesystem (secao 24)
        tool: Object.freeze({ id: authorization.tool.id, capability: effect.kind }),
        operation: effect.operation,
        input: authorization.input,
        resource: effect.resource,
      });
      const decision = this.#policyEngine.decide(effectAuthorization);
      decisions.push(Object.freeze({ effect, decision }));
      if (emit) {
        this.#bus.publish('effect.evaluated', {
          ...meta,
          payload: {
            effectSetFingerprint: plan.fingerprint,
            kind: effect.kind,
            operation: effect.operation,
            resource: resourceUri(effect.resource),
            policyId: decision.policyId ?? null,
            effect: decision.effect,
          },
        });
      }
      if (decision.effect === 'deny' && !deny) deny = decisions[decisions.length - 1];
      if (decision.effect === 'approval-required' && !approval) approval = decisions[decisions.length - 1];
    }
    let composed;
    if (deny) composed = deny.decision;
    else if (approval) composed = approval.decision;
    else if (decisions.length === 1) composed = decisions[0].decision;
    else {
      composed = Object.freeze({
        effect: 'allow',
        policyId: decisions[0].decision.policyId ?? null,
        reason: 'effect set allowed (' + decisions.length + ' effects)',
      });
    }
    return { decision: composed, decisions, denied: deny, approvalRequired: approval };
  }

  /** Pipeline fisico de execucao: started -> execute -> completed/failed. */
  /** Libera o sandbox e publica os eventos do ciclo (secoes 65-66). */
  async #releaseWithEvents(sandbox, meta, capabilityId, operation) {
    let cleanupError = null;
    await releaseSandbox(sandbox, (error) => { cleanupError = error; });
    this.#bus.publish('sandbox.released', {
      ...meta,
      payload: {
        capabilityId,
        operation,
        mode: sandbox.mode,
        enforcement: sandbox.enforcement,
        providerId: sandbox.providerId,
        cleanupFailed: cleanupError !== null,
      },
    });
    if (cleanupError) {
      this.#bus.publish('sandbox.cleanup.failed', {
        ...meta,
        payload: {
          capabilityId,
          providerId: sandbox.providerId,
          reason: String(cleanupError.message),
        },
      });
    }
  }

  /**
   * Rota self-provided (R13). Tool 'physical' passa pela MESMA fronteira
   * de Sandbox que a rota provider-backed — o efeito fisico nao muda de
   * natureza por a tool carregar o proprio execute(). Tool 'pure' e
   * explicitamente nao-sandboxed: sem efeito fisico, sem fronteira, e a
   * decisao esta declarada no registro, nunca implicita.
   */
  async #runTool(tool, input, meta, authorization, plan = null) {
    let sandbox = null;
    if (tool.execution === 'physical' && this.#sandboxProfileResolver && this.#sandboxResolver) {
      sandbox = await this.#applySandbox(tool, meta, authorization, plan);
    }
    try {
      this.#bus.publish('tool.started', {
        ...meta,
        payload: this.#projectEventPayload({ phase: 'started', toolId: tool.id }),
      });
      const output = await tool.execute(input, {
        sessionId: meta.sessionId,
        agentId: meta.agentId,
        // o handle so existe na rota physical; tool pure segue com o
        // contexto minimo de sempre (INV-002)
        ...(sandbox ? { sandbox } : {}),
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
    } finally {
      if (sandbox) {
        await this.#releaseWithEvents(sandbox, meta, authorization.tool.capability, authorization.operation);
      }
    }
  }

  /** Caminho do resume: so alcancavel via acquireAuthorizedExecutor. */
  async #runAuthorized({ toolId, input, sessionId, agentId }) {
    const tool = this.#tools.get(toolId);
    if (!tool) throw new ToolNotFoundError(toolId);
    const authorization = this.#buildAuthorization(tool, input ?? {}, {}, {
      agentId,
      session: { id: sessionId },
    });
    // o resume ja revalidou o conjunto; aqui o plano alimenta a
    // derivacao de boundary do Sandbox (secoes 28-31)
    const plan = this.#resolveEffectPlan(tool, input ?? {}, authorization);
    return this.#dispatch(tool, input ?? {}, { sessionId, agentId }, authorization, plan);
  }

  /**
   * Gate + despacho da Fase 4. O gate de capability roda DEPOIS do allow
   * da Policy (preferencia da spec, secao 108) e vale para toda tool —
   * inclusive a legada com fallback capability = tool.id (secao 59).
   * Tool com execute() proprio e self-provided (caminho de migracao);
   * tool sem execute() e provider-backed: o Provider e resolvido fresco a
   * cada execucao e a cada resume (secao 86).
   */
  async #dispatch(tool, input, meta, authorization, plan = null) {
    let provider = null;
    try {
      const capability = this.#capabilityResolver.resolveCapability(tool, authorization.operation);
      // Fase 6 (secoes 121/160, INV-624): capability que declara
      // providerOnly nao aceita tool self-provided — o Provider e o gate
      // unico da operacao fisica, e nao existe terceira rota. Generico:
      // o Core nao conhece 'process' pelo nome.
      if (typeof tool.execute === 'function' && capability.providerOnly === true) {
        throw new CapabilityError(
          "capability '" + capability.id + "' is provider-only: tool " + tool.id +
          ' cannot carry its own execute()',
        );
      }
      if (typeof tool.execute !== 'function') {
        provider = this.#capabilityResolver.resolveProvider(capability.id, authorization.operation);
      }
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
    if (!provider) return this.#runTool(tool, input, meta, authorization, plan);
    return this.#runProvider(provider, tool, input, meta, authorization, plan);
  }

  /**
   * Fronteira de Sandbox (spec Fase 5, secoes 60, 68-70). Roda DEPOIS da
   * Policy e da Approval (secoes 104, 113) e ANTES de qualquer execucao
   * fisica (INV-513). Sem profileResolver configurado nao ha sandbox: o
   * runtime segue como nas fases anteriores — o boundary so passa a ser
   * exigido quando alguem o configura, e ai falha fechado.
   *
   * @returns {Promise<object|null>} SandboxHandle ou null
   */
  async #applySandbox(tool, meta, authorization, plan = null) {
    if (!this.#sandboxProfileResolver || !this.#sandboxResolver) return null;
    const capabilityId = authorization.tool.capability;
    const operation = authorization.operation;
    this.#bus.publish('sandbox.requested', {
      ...meta,
      payload: { capabilityId, operation },
    });
    let resolved;
    let provider;
    try {
      // teto: Runtime > Capability > Tool (secoes 134, 137)
      // secoes 28-31: o Sandbox consome os efeitos AUTORIZADOS — o modo
      // necessario e derivado do conjunto, nunca ampliado por ele
      resolved = this.#sandboxProfileResolver.resolve({
        tool, capabilityId, operation, effects: plan?.effects ?? null,
      });
      provider = this.#sandboxResolver.resolve(resolved.policy, { capabilityId });
      this.#sandboxResolver.assertCapabilitySupported(provider, capabilityId, resolved.policy.mode);
    } catch (error) {
      // denied = autorizado, mas o ambiente recusa (secao 31)
      // unavailable/config = nao ha fronteira confiavel a aplicar
      const type = error instanceof SandboxDeniedError ? 'sandbox.denied' : 'sandbox.failed';
      this.#bus.publish(type, {
        ...meta,
        payload: {
          capabilityId,
          operation,
          reason: String(error?.message ?? error),
        },
      });
      throw error;
    }
    try {
      const context = Object.freeze({
        sessionId: meta.sessionId ?? null,
        agentId: meta.agentId ?? null,
        capabilityId,
        operation,
        resource: authorization.resource,
        sandboxMode: resolved.policy.mode,
        workspaceRoot: resolved.policy.workspaceRoot,
      });
      const handle = await provider.apply(resolved.policy, context);
      // projecao segura (secao 123): modo, enforcement e id — nunca roots,
      // ambiente ou credencial
      this.#bus.publish('sandbox.applied', {
        ...meta,
        payload: {
          capabilityId,
          operation,
          mode: handle.mode,
          enforcement: handle.enforcement,
          providerId: provider.providerId,
          // secao 67 (F7): identidade do backend fisico, sem internals
          backend: provider.describe(resolved.policy)?.backend ?? null,
          effectSetFingerprint: plan?.fingerprint ?? null,
          requested: resolved.requiredMode,
          policy: describeSandboxPolicy(resolved.policy),
        },
      });
      return handle;
    } catch (error) {
      this.#bus.publish('sandbox.failed', {
        ...meta,
        payload: { capabilityId, operation, reason: String(error?.message ?? error) },
      });
      throw error;
    }
  }

  /**
   * Execucao provider-backed. O Provider recebe a superficie minima
   * (secoes 22-23): request {operation, input, resource} + context com
   * exatamente sessionId/agentId/capabilityId/operation/resource/metadata
   * — nunca PolicyEngine, ToolRuntime, EventBus ou ApprovalManager
   * (INV-413/414). O resource e o autorizado pela Policy (INV-415).
   */
  async #runProvider(provider, tool, input, meta, authorization, plan = null) {
    const resource = authorization.resource;
    const resourceStr = resource ? (resource.type ?? '?') + '/' + (resource.id ?? '?') : null;
    const providerPayload = {
      providerId: provider.providerId,
      capabilityId: provider.capabilityId,
      operation: authorization.operation,
      resource: resourceStr,
    };
    // Sandbox ANTES de qualquer sinal de execucao (secoes 68-69): se o
    // boundary recusa, tool.started e provider.started nao acontecem.
    const sandbox = await this.#applySandbox(tool, meta, authorization, plan);
    this.#bus.publish('tool.started', {
      ...meta,
      payload: this.#projectEventPayload({ phase: 'started', toolId: tool.id }),
    });
    this.#bus.publish('provider.started', { ...meta, payload: providerPayload });
    const startedAt = Date.now();
    try {
      const request = Object.freeze({ operation: authorization.operation, input, resource });
      const context = Object.freeze({
        sessionId: meta.sessionId ?? null,
        agentId: meta.agentId ?? null,
        capabilityId: provider.capabilityId,
        operation: authorization.operation,
        resource,
        metadata: Object.freeze({}),
        // o Provider recebe o HANDLE, nunca o SandboxProvider (secao 63)
        sandbox,
      });
      const result = await provider.execute(request, context);
      // projecao segura (secao 36): metadata tecnica, nunca o output
      this.#bus.publish('provider.completed', {
        ...meta,
        payload: { ...providerPayload, durationMs: Date.now() - startedAt },
      });
      this.#bus.publish('tool.completed', {
        ...meta,
        payload: this.#projectEventPayload({ phase: 'completed', toolId: tool.id, output: result?.output }),
      });
      return { ok: true, toolId: tool.id, output: result?.output };
    } catch (error) {
      // secao 31 (F5): negacao de Sandbox NAO vira erro de Provider — nem
      // aqui. Um limite fisico recusado e decisao do ambiente e chega ao
      // chamador com o proprio tipo; rotula-la 'io-error' seria mentir
      // sobre o que aconteceu
      const wrapped = error instanceof ProviderExecutionError || error instanceof SandboxError
        ? error
        : new ProviderExecutionError(
            'io-error',
            'provider ' + provider.providerId + ' failed: ' + (error?.message ?? error),
            { cause: error },
          );
      this.#bus.publish('provider.failed', {
        ...meta,
        payload: { ...providerPayload, error: String(wrapped.message) },
      });
      this.#bus.publish('tool.failed', {
        ...meta,
        payload: this.#projectEventPayload({ phase: 'failed', toolId: tool.id, error: String(wrapped.message) }),
      });
      throw wrapped;
    } finally {
      // cleanup SEMPRE (secoes 65, 119-121): sucesso, falha ou excecao.
      // Falha de cleanup vira evento proprio e NAO falsifica o resultado
      // da operacao principal (secao 66).
      if (sandbox) {
        await this.#releaseWithEvents(sandbox, meta, provider.capabilityId, authorization.operation);
      }
    }
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

    // Fase 8 (secao 44): resolve effects ANTES da Policy. Falha de
    // resolucao e fail-closed (INV-805) e precede a decisao.
    let plan = null;
    let evaluation = null;
    try {
      plan = this.#resolveEffectPlan(tool, input, authorization);
      if (plan) {
        if (plan.completeness !== 'complete') {
          throw new EffectResolutionError(
            "tool '" + tool.id + "' produced an incomplete effect plan: " +
            (plan.reason ?? 'unknown effects') + ' — incomplete plans fail closed (secao 52)',
          );
        }
        this.#bus.publish('effect.resolved', {
          ...meta,
          payload: { effectSetFingerprint: plan.fingerprint, effectCount: plan.effects.length },
        });
      }
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

    if (plan) evaluation = this.#evaluateEffects(plan, authorization, meta);
    const decision = evaluation ? evaluation.decision : this.#policyEngine.decide(authorization);
    const resource = authorization.resource;
    const policyPayload = {
      policyId: decision.policyId ?? null,
      effect: decision.effect,
      toolId: tool.id,
      operation: authorization.operation,
      resource: resource ? (resource.type ?? '?') + '/' + (resource.id ?? '?') : null,
      reason: decision.reason,
      ...(plan ? { effectSetFingerprint: plan.fingerprint } : {}),
    };
    this.#bus.publish('policy.evaluated', { ...meta, payload: policyPayload });
    if (decision.effect === 'deny') {
      if (evaluation?.denied) {
        const denied = evaluation.denied.effect;
        this.#bus.publish('effect.denied', {
          ...meta,
          payload: {
            effectSetFingerprint: plan.fingerprint,
            kind: denied.kind,
            operation: denied.operation,
            resource: resourceUri(denied.resource),
            policyId: decision.policyId ?? null,
            reason: decision.reason,
          },
        });
      }
      this.#bus.publish('policy.denied', { ...meta, payload: policyPayload });
      // INV-804: um deny nega o conjunto inteiro — nada executa
      throw evaluation
        ? new EffectAuthorizationError(decision, {
            effectSetFingerprint: plan.fingerprint,
            deniedEffect: evaluation.denied
              ? {
                  kind: evaluation.denied.effect.kind,
                  operation: evaluation.denied.effect.operation,
                  resource: resourceUri(evaluation.denied.effect.resource),
                }
              : null,
          })
        : new PolicyDeniedError(decision);
    }
    if (decision.effect === 'approval-required') {
      if (evaluation?.approvalRequired) {
        const pending = evaluation.approvalRequired.effect;
        this.#bus.publish('effect.approval-required', {
          ...meta,
          payload: {
            effectSetFingerprint: plan.fingerprint,
            kind: pending.kind,
            operation: pending.operation,
            resource: resourceUri(pending.resource),
            policyId: decision.policyId ?? null,
            reason: decision.reason,
          },
        });
      }
      this.#bus.publish('policy.approval-required', { ...meta, payload: policyPayload });
      const error = new PolicyApprovalRequiredError(decision);
      if (plan) error.effectSetFingerprint = plan.fingerprint;
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
            // INV-807: a aprovacao pertence ao CONJUNTO de efeitos
            effectSetFingerprint: plan?.fingerprint ?? null,
            effects: plan
              ? plan.effects.map((effect) => Object.freeze({
                  kind: effect.kind,
                  operation: effect.operation,
                  resource: resourceUri(effect.resource),
                }))
              : null,
          },
          { policyId: decision.policyId ?? null, reason: decision.reason },
        );
        error.approvalId = approval?.approvalId ?? null;
      }
      throw error;
    }

    return this.#dispatch(tool, input, meta, authorization, plan);
  }
}
