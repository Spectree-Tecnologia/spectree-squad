# Spectree Runtime — Fases 1 a 4: Core + Policy + Founder Gate + Providers

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

## Autorizacao (Fase 2)

A regra central: **permissao deixa de ser instrucao de prompt e passa a
ser decisao executavel do Runtime.** O fluxo:

```
Agent -> requestTool -> AgentLoop -> ToolRuntime
  -> AuthorizationContext -> PolicyEngine -> PolicyDecision
       ALLOW -> tool executa
       DENY / APPROVAL-REQUIRED -> bloqueado antes de tool.started
```

### Policy model

`Policy { id, effect: allow|deny|approval-required, principal?, tool?,
capability?, operation?, resource?, priority? }` — campos aceitam
singular ou plural, string ou lista; campo omitido e wildcard; glob
simples com `*`. Registrada, a policy e congelada: mudar e `replace`,
nunca mutacao. `PolicyRegistry` separa configuracao de avaliacao — pode
ser alimentado por JSON (ver `policy/spectree.policies.json` +
`example-policy.js`) e, no futuro, por arquivo/banco/servico remoto sem
tocar o engine.

### AuthorizationContext

Snapshot imutavel construido pelo ToolRuntime apos resolver e validar:
`{ principal {type, id}, session {id}, tool {id, capability}, operation,
input, resource {type, id}|null }`. `operation` default e `execute`;
`capability` default e `tool.id` (fallback de migracao); `resource` vem
**somente** da metadata da tool — estatica ou funcao do mesmo input que a
tool executa (o resource-resolver seam). Nunca do request: o chamador nao
escolhe o recurso contra o qual e autorizado, entao a Policy decide sobre
o recurso efetivamente executado (R9). O engine recebe contexto e devolve decisao, sem efeito colateral.

### PolicyDecision e precedencia

`{ effect, policyId, reason }` com reason deterministica (nunca LLM).
Precedencia fixa: **explicit deny > approval-required > explicit allow >
default deny**. `priority` desempata a selecao dentro do mesmo efeito e
nunca inverte a precedencia. Ausencia de regra = deny (`default-deny`).

### Eventos de policy

`policy.evaluated` para toda decisao; `policy.denied` e
`policy.approval-required` quando a execucao e interrompida. Payload:
`{ policyId, effect, toolId, operation, resource, reason }` — nunca
input, output ou segredo. Lifecycle resultante:

```
allow:    tool.requested -> policy.evaluated -> tool.started -> tool.completed
deny:     tool.requested -> policy.evaluated -> policy.denied
approval: tool.requested -> policy.evaluated -> policy.approval-required
```

Deny e approval lancam `PolicyDeniedError` / `PolicyApprovalRequiredError`
— o Agent pode dar catch e decidir comportamento; a autorizacao continua
sendo do runtime (secao 29 da spec).

### Capability model

`Capability { id, name, description, operations }` descreve o que o
runtime **sabe** executar; nunca quem pode (INV-212). Uma Capability e
uma familia (`database`); uma Tool e uma operacao concreta
(`database.migrate`). `CapabilityRegistry` e o catalogo onde providers
futuros se registram sem conhecer Agent, PolicyEngine ou Session.

### Default deny por construcao

`ToolRuntime` exige um `policyEngine` no construtor (ADR-02): um runtime
sem engine seria uma rota permanente de bypass. `createRuntime()` nasce
com registry vazio — que nega tudo. Teste que precisa executar registra
policy explicita; nao existe allow-all de conveniencia.

## Aprovacao humana (Fase 3)

`approval-required` deixa de ser um beco: vira um pedido formal de decisao
humana, com estado explicito no runtime.

```
requestTool -> policy approval-required -> ApprovalRequest (pending)
  Founder approve -> resume() -> REVALIDA policy -> approved->resumed
    -> tool.started -> tool.completed
  Founder deny -> denied (terminal, zero execucao)
```

### Approval state machine

`pending -> approved | denied | expired | cancelled` e
`approved -> resumed`. Estados terminais nao transitam; decisao e unica —
a segunda decisao concorrente recebe `ApprovalStateError` do
compare-and-set do `ApprovalStore` (secoes 24, 45). Idempotencia segura:
repetir a decisao vencedora devolve o estado, sem evento novo.

### Resume: aprovacao nao e bypass (secao 97)

`resume()` verifica `approved`, verifica cancelamento da Session, e
**revalida a Policy com o input original** — resource recalculado pela
regra R9, nada vindo do Founder (INV-305/307/308/309). A exigencia esta
satisfeita quando a decisao vigente e `allow`, ou `approval-required` do
MESMO `policyId` aprovado; policy nova ou `deny` -> `PolicyRevalidationError`
e a approval permanece `approved` (retry e do operador; nada automatico).
So entao o consumo atomico `approved -> resumed` libera a execucao unica
(INV-317), via executor autorizado de aquisicao unica
(`acquireAuthorizedExecutor`) — nao existe `executeWithoutPolicy` (secao 44).

### Estado privado vs projecao publica (secao 77)

O record no `ApprovalStore` guarda a `PendingToolInvocation` — incluindo o
input, possivelmente sensivel. A visao publica (`ApprovalManager.get`,
`FounderGate.pending()`) e os eventos carregam apenas metadata segura:
`approvalId, toolId, capabilityId, operation, resource, policyId, reason,
expiresAt`. Nunca input, output ou segredo (secoes 28, 36-37, 68).

### Cancelamento e expiracao

Session cancelada cancela as approvals `pending` dela em cascata sincrona
(sem janela para um `approve()` escapar) e barra o resume das ja
aprovadas — a Session tem autoridade final (secao 48). Efeito observavel
documentado (secao 34): no stream, `approval.cancelled` aparece antes de
`session.cancelled` por reentrancia do publish. Expiracao e preguicosa
(secao 22): detectada na leitura/decisao via clock injetavel; sem worker.

### FounderGate

O contrato entre o manager e o mecanismo externo de decisao
(`requestApproval` / `submitDecision`). `InMemoryFounderGate` atende os
testes; Invoker CLI, TUI, Web, Slack futuros falam com o MESMO
ApprovalManager (secao 49). Sem promise escondida (secao 84): a decisao e
estado explicito no store — um processo reiniciado com o store restaurado
consegue `resume(approvalId)` (secao 83).

## Capabilities e Providers (Fase 4)

```
Tool         = operacao solicitavel        (filesystem.read)
Capability   = contrato do que se sabe fazer (filesystem: read|write|delete)
Provider     = como se faz de verdade      (local-filesystem)
```

A Tool nao conhece o Provider (INV-403); o Provider nao conhece a Policy
(INV-414); o Agent nao conhece nenhum dos dois (INV-404). O
`CapabilityResolver` liga as pontas: Tool -> Capability -> Provider, um
erro tipado por degrau (matriz da secao 154).

### O catalogo virou gate (secao 58)

A semantica da Fase 2 — CapabilityRegistry informativo — terminou. Toda
tool, inclusive a legada com fallback `capability = tool.id`, so executa
com a capability registrada (INV-421). O gate roda DEPOIS do allow da
Policy (preferencia da spec, secao 108), o que tambem garante que com
`approval-required` nem capability nem Provider sao resolvidos (secao 84).

### Dois modos de execucao

Tool com `execute()` proprio e **self-provided** (legado, caminho de
migracao). Tool sem `execute()` e **provider-backed**: o Provider default
da capability executa, resolvido fresco a cada execucao e a cada resume
(secao 86). Lifecycle congelado por teste:

```
allow:  tool.requested -> policy.evaluated -> tool.started
        -> provider.started -> provider.completed -> tool.completed
falha:  ... -> provider.started -> provider.failed -> tool.failed
```

### Superficie do Provider (secoes 22-23)

`execute(request, context)`: request congelado `{operation, input,
resource}`; context congelado com exatamente
`[sessionId, agentId, capabilityId, operation, resource, metadata]` —
travado por igualdade estrutural (padrao R8). Nunca PolicyEngine,
ToolRuntime, EventBus ou ApprovalManager. O resource e o autorizado pela
Policy (INV-415); `provider.completed` publica metadata tecnica
(providerId, capabilityId, operation, resource, durationMs), nunca o
output (INV-419).

### LocalFilesystemProvider

O primeiro Provider real. Recebe somente `workspaceRoot` injetado — nada
de process.env ou cwd (INV-417). Stateless. Invariantes fisicas proprias
(secao 47), validas mesmo com Policy allow: boundary FISICO do workspace
— o realpath do ancestral existente mais profundo precisa continuar dentro
do realpath do root (R12), fechando o escape por diretorio pai
symlinkado —, recusa de symlink no alvo, recusa de deletar a raiz, e
verificacao
resource<->path (secao 139). Resource canonico:
`filesystem://workspace/<posix-normalizado>` — path que escapa vira
`outside-workspace`, que nenhuma policy de `workspace/*` casa: o
traversal morre primeiro na Policy e de novo no Provider (defense in
depth).

## Extension points

| Futuro | Onde entra | O que muda |
|---|---|---|
| Redação em eventos | `projectEventPayload` no construtor do ToolRuntime — o que a tool vê é separado do que o bus publica | nada nos demais |
| PolicyRegistry externo | fonte de policies (arquivo, banco, serviço) alimenta o registry | Agent, AgentLoop e ToolRuntime intactos |
| Approval UI (CLI/TUI/Web/Slack) | consome `ApprovalManager` + `FounderGate` + eventos `approval.*` | nunca fala com ToolRuntime (secao 86) |
| ApprovalStore persistente | Postgres/Redis/Supabase implementam create/get/transition | ApprovalManager intacto (secao 14) |
| Identidade do decisor | seam `FounderGate.authorizeDecision(actor, approval)` (secao 87) | decidedBy hoje e metadata de audit (secao 51) |
| Sandbox | entre Capability e Provider ("em qual ambiente, com quais limites fisicos?") — recomendacao da spec Fase 4 secao 104 | boundary de execucao, nao de autorizacao |
| Providers futuros (git, db, browser, MCP) | registram-se no CapabilityProviderRegistry sob o mesmo contrato + providerContract de teste | Tool, Capability e Policy intactos quando a semantica se mantem (secao 98) |
| AbortSignal / timeout de Provider | o contexto de execucao do Provider e o seam (secao 65) | cancelamento cooperativo da Fase 3 permanece |
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
- A projeção default de eventos de tool é segura (R10): publica apenas
  `toolId` (e a mensagem de erro em `tool.failed`). Input e output nunca
  saem no bus sem um `projectEventPayload` customizado que opte por isso.
  Eventos de policy já nascem sem input/output por contrato.
- Agente que nao trata `PolicyApprovalRequiredError` falha a propria
  session; a approval permanece acionavel e o resume executa fora do loop
  do agente — o re-entry gracioso pertence ao Orchestrator futuro.
- `resumed` e terminal: falha de revalidacao deixa a approval `approved`
  para retry do operador, mas apos executar nao ha re-execucao.
- Matching de policy é glob simples — sem CEL, OPA, RBAC/ABAC completos,
  por decisão de fase (spec §37).
- Um Provider default por capability; multi-provider routing, failover e
  selecao dinamica pertencem a fases futuras (secao 53).
- Cancelamento de operacao de Provider em voo e cooperativo — o seam de
  AbortSignal existe no contexto, o LocalFilesystemProvider nao o usa.
- Session vive em memória; replay/persistência é fase posterior.
