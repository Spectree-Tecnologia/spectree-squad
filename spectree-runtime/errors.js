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
