/**
 * Erros do Spectree Runtime — um tipo por categoria de falha (spec §35),
 * para o consumidor distinguir o que aconteceu sem inspecionar mensagens.
 */
export class RuntimeError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = this.constructor.name;
  }
}

export class AgentError extends RuntimeError {}

export class ToolError extends RuntimeError {}

export class ToolNotFoundError extends ToolError {
  constructor(toolId) {
    super(`tool not found: ${toolId}`);
    this.toolId = toolId;
  }
}

export class ToolValidationError extends ToolError {
  constructor(toolId, issues) {
    super(`invalid input for tool ${toolId}: ${issues.join('; ')}`);
    this.toolId = toolId;
    this.issues = issues;
  }
}

export class SessionError extends RuntimeError {}

export class SessionStateError extends SessionError {
  constructor(from, to) {
    super(`invalid session transition: ${from} -> ${to}`);
    this.from = from;
    this.to = to;
  }
}

export class PolicyError extends RuntimeError {}

export class PolicyDeniedError extends PolicyError {
  constructor(decision) {
    super('policy denied: ' + decision.reason);
    this.decision = decision;
  }
}

export class PolicyApprovalRequiredError extends PolicyError {
  constructor(decision) {
    super('approval required: ' + decision.reason);
    this.decision = decision;
  }
}

export class PolicyConfigurationError extends PolicyError {}

// ---- Fase 8: Execution Effects (secoes 67-70) -----------------------

export class EffectError extends RuntimeError {}

/** O Runtime nao conseguiu determinar com seguranca o efeito necessario
 * (secao 68) — NAO significa que a Policy negou. Fail closed (INV-805). */
export class EffectResolutionError extends EffectError {}

/**
 * O conjunto de efeitos foi resolvido mas nao autorizado (secao 69).
 * Estende PolicyDeniedError deliberadamente: um deny composto E uma
 * negacao de Policy — o detalhe tipado existente e preservado, com o
 * conjunto anexado.
 */
export class EffectAuthorizationError extends PolicyDeniedError {
  constructor(decision, { effectSetFingerprint = null, deniedEffect = null } = {}) {
    super(decision);
    this.effectSetFingerprint = effectSetFingerprint;
    this.deniedEffect = deniedEffect;
  }
}

/** O conjunto de efeitos no resume nao corresponde a autorizacao
 * original (secoes 20, 50, 70). A approval permanece approved. */
export class EffectRevalidationError extends EffectError {
  constructor({ approvalId, approvedFingerprint, currentFingerprint }) {
    super(
      'effect revalidation blocked resume: approved fingerprint ' +
      String(approvedFingerprint).slice(0, 12) + '... does not match current ' +
      String(currentFingerprint).slice(0, 12) + '...',
    );
    this.approvalId = approvalId;
    this.approvedFingerprint = approvedFingerprint;
    this.currentFingerprint = currentFingerprint;
  }
}

export class CapabilityError extends RuntimeError {}

export class CapabilityNotFoundError extends CapabilityError {
  constructor(capabilityId) {
    super('capability not registered: ' + capabilityId);
    this.capabilityId = capabilityId;
  }
}

export class UnsupportedCapabilityOperationError extends CapabilityError {
  constructor(capabilityId, operation) {
    super("capability '" + capabilityId + "' does not support operation '" + operation + "'");
    this.capabilityId = capabilityId;
    this.operation = operation;
  }
}

export class CapabilityProviderError extends CapabilityError {}

export class CapabilityProviderNotFoundError extends CapabilityProviderError {
  constructor(capabilityId) {
    super('no provider registered for capability: ' + capabilityId);
    this.capabilityId = capabilityId;
  }
}

export class ProviderOperationNotSupportedError extends CapabilityProviderError {
  constructor(providerId, operation) {
    super("provider '" + providerId + "' does not support operation '" + operation + "'");
    this.providerId = providerId;
    this.operation = operation;
  }
}

export class ProviderExecutionError extends CapabilityProviderError {
  constructor(code, message, options) {
    super(message, options);
    this.code = code;
  }
}

/**
 * Taxonomia de Sandbox (spec Fase 5, secao 151). A distincao entre
 * SandboxDeniedError e PolicyDeniedError e diagnostica e normativa
 * (secao 31): a Policy diz que NAO ESTA AUTORIZADO; o Sandbox diz que
 * ESTA autorizado em principio, mas o ambiente fisico nao permite.
 */
export class SandboxError extends RuntimeError {}

export class SandboxConfigurationError extends SandboxError {}

/** Nenhum backend consegue garantir o boundary pedido (secoes 19, 32). */
export class SandboxUnavailableError extends SandboxError {}

/** O boundary existe e recusa a operacao (secoes 58, 73). */
export class SandboxDeniedError extends SandboxError {
  constructor(message, details = {}) {
    super(message);
    // explicacao sem vazar segredo ou path sensivel (secao 73)
    this.boundary = details.boundary ?? null;
    this.requiredMode = details.requiredMode ?? null;
    this.capabilityId = details.capabilityId ?? null;
    this.operation = details.operation ?? null;
  }
}

/** Capability sem fronteira correspondente no backend (secao 152). */
export class SandboxCapabilityError extends SandboxError {}

/** Falha ao desmontar; observavel, nunca escondida (secao 66). */
export class SandboxCleanupError extends SandboxError {
  constructor(message, options = {}) {
    super(message);
    this.cause = options.cause;
  }
}

/** Seam de escalonamento (secoes 30, 74): existe, nao executa sozinho. */
export class SandboxEscalationRequiredError extends SandboxError {
  constructor(message, request) {
    super(message);
    this.request = request;
  }
}

/**
 * Taxonomia de Process (spec Fase 6, secoes 111/169). A distincao central
 * (secao 112, INV-621): exitCode != 0 e um OUTCOME de execucao — a Tool
 * decide o que significa —, nunca um ProcessError. ProcessError e falha
 * do RUNTIME em cumprir o proprio contrato.
 */
export class ProcessError extends RuntimeError {}

export class ProcessConfigurationError extends ProcessError {}

export class ProcessExecutableNotFoundError extends ProcessError {
  constructor(command) {
    super('executable not found: ' + command);
    this.command = command;
  }
}

export class ProcessCwdError extends ProcessError {}

/** O processo nunca iniciou (secao 43). Distinto de exit != 0. */
export class ProcessSpawnError extends ProcessError {
  constructor(message, options = {}) {
    super(message);
    this.cause = options.cause;
  }
}

export class ProcessOutputLimitError extends ProcessError {}

export class ProcessTerminationError extends ProcessError {}

/** Session tentando controlar processo de outra Session (INV-617). */
export class ProcessOwnershipError extends ProcessError {}

/** Falha da fronteira durante preparo do processo (secao 115). */
export class ProcessSandboxError extends ProcessError {}

export class ApprovalError extends RuntimeError {}

export class ApprovalNotFoundError extends ApprovalError {
  constructor(approvalId) {
    super('approval not found: ' + approvalId);
    this.approvalId = approvalId;
  }
}

export class ApprovalStateError extends ApprovalError {
  constructor(from, to, approvalId) {
    super("invalid approval transition: '" + from + "' -> '" + to + "'" +
      (approvalId ? ' (' + approvalId + ')' : ''));
    this.from = from;
    this.to = to;
    this.approvalId = approvalId;
  }
}

export class ApprovalExpiredError extends ApprovalStateError {
  constructor(approvalId) {
    super('expired', 'decided', approvalId);
    this.message = 'approval expired: ' + approvalId;
  }
}

export class PolicyRevalidationError extends PolicyError {
  constructor(decision, approvalId) {
    super('policy revalidation blocked resume: ' + decision.reason);
    this.decision = decision;
    this.approvalId = approvalId;
  }
}
