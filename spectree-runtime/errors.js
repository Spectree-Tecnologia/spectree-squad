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

export class CapabilityError extends RuntimeError {}

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
