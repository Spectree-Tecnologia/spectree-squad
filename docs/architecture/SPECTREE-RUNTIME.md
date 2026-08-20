# Spectree Runtime — Fase 1: Runtime Core

Microkernel de execução do Spectree. Cinco primitivas, nenhum conhecimento
de persona: o Squad define quem o agente é; o runtime define como um agente
executa.

```
                    Spectree Squad
                         |
                         v
                 Agent Definition
                         |
                         v
                 Spectree Runtime
                         |
        +----------------+----------------+
        v                v                v
      Agent           Session          Tools
        |                |                |
        +----------------+----------------+
                         v
                      Events
```

## Stack

JavaScript ESM puro, zero dependências, contratos documentados em JSDoc,
testes com `node:test` (ver `docs/adr/ADR-01-plain-javascript-runtime.md`).
Rodar: `npm test` e `npm run example`. Requer Node 20+.

## Responsabilidades

| Componente | Arquivo | Responsabilidade | Não faz |
|---|---|---|---|
| `Agent` | `agent/agent.js` | identidade + instrução + execução (`run(context)`) | filesystem, shell, git, MCP, LLM |
| `AgentLoop` | `loop/agent-loop.js` | entrega contexto, media tool requests, detecta conclusão/falha/cancelamento, emite lifecycle | workflow multi-agente |
| `ToolRuntime` | `tools/tool-runtime.js` | registra, resolve, valida, executa, captura, emite | policy, sandbox, timeout |
| `Session` | `session/session.js` | uma execução: id, timestamps, missão, state machine | estado de projeto (`docs/` continua SSOT) |
| `EventBus` | `events/event-bus.js` | publish/subscribe observável, subscribers isolados | lógica de negócio, persistência, fila distribuída |

## Regra de dependência

```
Agent -> (context fornecido pelo) AgentLoop -> ToolRuntime
Session  <- AgentLoop
EventBus <- todos
```

Componentes dependem de contrato, nunca de implementação concreta. Nenhum
componente conhece Claude Code, um LLM, ou o nome de um agente do Squad
(INV-006/007).

## Lifecycle

```
Session:  created -> running -> completed | failed | cancelled
                  \-> cancelled (antes de iniciar)
```

Transição inválida lança `SessionStateError`. Estados finais não transitam.

Fluxo feliz (provado em `tests/integration.test.js`):

```
session.created -> session.started -> agent.started -> tool.requested
 -> tool.started -> tool.completed -> agent.completed -> session.completed
```

Falha: `tool.failed -> agent.failed -> session.failed`, e nenhum
`*.completed` depois. Cancelamento: `session.cancelled`, nenhuma nova tool
inicia (gate no `requestTool`), nenhum `*.completed` é emitido.

## Ciclo THINK / ACT / OBSERVE

O loop injeta `context.runtime.requestTool(toolId, input)` — a **única**
capacidade que o contexto expõe. O agente pensa (seu código), age
(`requestTool`) e observa (o resultado awaited), quantas iterações
precisar. O agente nunca vê o `ToolRuntime` (INV-001) **nem o EventBus**:
eventos de lifecycle são exclusividade de AgentLoop, ToolRuntime e Session
— um agente que pudesse publicar `agent.completed` falsificaria o próprio
juiz. O loop também valida a posse: `session.agentId` precisa ser o
`agent.id` recebido, ou a execução é recusada antes de qualquer evento.

## Contrato de cancelamento

Cooperativo, com três garantias verificadas em teste:

1. **Tool em voo termina** e emite seus eventos normalmente — `cancel()`
   não aborta execução corrente (o seam de abort é o mesmo choke point do
   timeout futuro).
2. **Nenhuma nova tool inicia**: o gate vive em `requestTool`, que lança
   `SessionError` após o cancel.
3. **Nenhum `agent.completed`/`session.completed` é emitido** depois do
   cancel, mesmo que `run()` resolva com valor.

## Event model

```
Event { id: evt_<uuid>, type, timestamp: ISO-8601, sessionId?, agentId?, payload }
```

Tipos da Fase 1: `session.{created,started,completed,failed,cancelled}`,
`agent.{started,completed,failed}`, `tool.{requested,started,completed,failed}`.
`subscribe('*')` observa tudo — é como logger, audit e UI futuros se
plugam. Falha de subscriber é engolida e reportada via
`onSubscriberError`; nunca alcança o runtime nem os demais subscribers.

## Tool model

```
Tool { id, name, description, inputSchema?, execute(input, {sessionId, agentId}) }
```

`inputSchema` aceita um subconjunto mínimo de JSON Schema
(`type/properties/required`, tipos primitivos). A tool recebe apenas
`sessionId` e `agentId` (INV-002).

## Session model

`Session` é estado de runtime — uma execução concreta, em memória. O
estado de projeto (PRD, stories, ADRs) continua em `docs/`, fora do
runtime. `session.cancel()` é o sinal cooperativo de cancelamento.

## Extension points

| Futuro | Onde entra | O que muda |
|---|---|---|
| PolicyEngine | dentro de `ToolRuntime.execute(request, context)` — único choke point; `context` já traz session e agentId | nada nos demais |
| Redação em eventos | `projectEventPayload` no construtor do ToolRuntime — o que a tool vê é separado do que o bus publica | nada nos demais |
| LLM provider | subclasse de `Agent` que fala com um Model provider em `run()` | nada nos demais |
| Timeout | mesmo choke point de `execute` | nada nos demais |
| SessionStore / EventStore | consumidores dependem só de `publish/subscribe`; um bus persistente implementa o mesmo contrato | nada no AgentLoop |
| Orchestrator | camada acima do loop, compondo N execuções | consome, não altera |

## Limitações conhecidas (deliberadas, Fase 1)

- Erro de tool falha a execução por padrão; um agente pode dar catch em
  `requestTool` e seguir, mas não há retry nem política.
- Cancelamento é cooperativo: barra a próxima tool, não aborta uma tool em
  execução (o seam de abort é o mesmo choke point do timeout).
- Validador de schema é subconjunto mínimo.
- Redação de segredo tem seam pronto, não implementação: por padrão o
  payload do evento espelha o da tool (`projectEventPayload` identidade).
- Session vive em memória; replay/persistência é fase posterior.
