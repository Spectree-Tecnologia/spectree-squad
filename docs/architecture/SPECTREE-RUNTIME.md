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

## Fase 4.5 — Policy Integration & Principal Hardening

Fase pequena, sem tocar o Core. Fecha o último desalinhamento entre as
camadas: a matriz de autoridade do squad (`squad.policies.json`, raiz do
repo) passa a ter UM caminho de carga — o adapter oficial
`adapters/policy-document.js` (`loadPolicyDocument` /
`policyEngineFromDocument`) — consumido por Guard (hook PreToolUse),
Runtime (`createRuntime({ policyRegistry })`, demonstrado no
`example-policy.js`) e Tests. O teste de integração
(`tests/squad-policy-integration.test.js`) prova a MESMA decisão, com o
mesmo policyId, nos três consumidores para os quatro efeitos canônicos
(allow, default deny, deny explícito, approval-required), e trava por
igualdade estrita que existe exatamente uma matriz no repo (a cópia de
exemplo `spectree.policies.json` foi eliminada).

Regra de principal endurecida no guard: `agent_type` AUSENTE é a thread
principal — contexto do Invoker/Founder, modo 4A (só policies
universais); `agent_type` PRESENTE mas fora do squad é principal
desconhecido — fail closed, o default deny age. Como sempre: o arquivo é
dado de entrada do adapter, nunca dependência — INV-007 preservada.

## Fase 4.6 — Reachability & Audit

Fase pequena, sem tocar o Core, nascida da primeira devolutiva de campo
da v0.25.0. O Invoker observou que a policy `invoker-artifact-approval`
tinha `principal: invoker` — nome que nao existe entre os oito agentes,
logo inalcancavel por `agent_type`. A varredura mostrou que o padrao
tinha irmaos: a capability `github` nao tinha detector no guard (`gh pr
merge` passava para qualquer agente) e `no-direct-push-main` nunca
recebia resource na operacao `commit` (commit direto na main passava).

Correcoes: detector de `gh` por operacao (pr/release/ci governados;
auth/repo/api nao), e o resource de `commit`/`merge` derivado da branch
corrente lida de `.git/HEAD` — LEITURA de arquivo, jamais execucao de
comando; o guard permanece read-only. `merge` entrou no deny da main,
fechando o ciclo: nada muta a main localmente, e o caminho sancionado
(`gh pr merge`) e capability `github`, intocada.

Trilha de decisao: cada `deny`/`ask` vira uma linha JSON em
`~/.claude/spectree/policy-decisions.jsonl` sob projecao R10 — policyId,
efeito, principal, capability, operation, resource, cwd e sessao;
NUNCA o comando bruto, que carrega segredo. Silencio nao e decisao e nao
entra. Falha de escrita nunca afeta a decisao: auditoria e
observabilidade, nao autoridade. E a correcao factual que a fase
registrou: o guard e um processo separado por invocacao e nunca toca o
EventBus — persistir o bus daria zero visibilidade sobre ele.

O fecho e `tests/squad-policy-reachability.test.js`: cada policy declara
quem a alcanca, e a declaracao e PROVADA executando o guard de verdade.
Policy runtime-only e legitima, mas tem de justificar por escrito por
que o guard nao a alcanca. Policy nova sem declaracao quebra a suite —
R8 aplicado a matriz: autoridade decorativa deixa de ser invisivel.

## Fase 4.7 — Push Target & Audit Outcome

Segunda devolutiva de campo, sobre a trilha da 4.6. O Invoker observou
que `resource` vinha nulo justamente em `force-push` — a operacao que
mais precisa de alvo — e que uma linha `ask` registra a pergunta sem
nunca registrar a resposta.

O primeiro achado escondia dois buracos de policy. O guard identificava
push na main varrendo os argumentos atras do token "main"; entao
`git push` puro estando na main passava em SILENCIO (nenhum token
"main" no comando), e `git push --force origin main` caia so no
`destructive-git-founder-gate` (ask) em vez do deny — a forma mais
destrutiva tinha o tratamento mais fraco. Correcao: o guard RESOLVE o
alvo (destino do refspec `src:dst`, ou a branch corrente quando nao ha
refspec) e anexa como resource; quem decide e a policy. `force-push` e
`delete-remote-branch` entraram nas operacoes de `no-direct-push-main`,
e deny vence approval-required por precedencia — force-push fora da main
segue sendo gate. Limite declarado: com `push.default = matching` ou
`remote.<nome>.push` configurado o alvo pode nao ser a branch corrente;
o guard nao le configuracao de git — falso negativo, nunca falso
positivo.

Trilha: cada linha ganha `toolUseId` e `outcome`. `deny` e `final` (o
desfecho e a propria decisao); `ask` e `pending` e diz isso de si mesmo.
O desfecho chega como linha `executed` do modo PostToolUse — evento que
so dispara quando a tool EXECUTOU — correlacionada pelo mesmo
`toolUseId`. Ausencia de `executed` significa que nao executou; a trilha
nao adivinha se foi negativa do Founder, cancelamento ou sessao
encerrada, e nao finge saber.

Falso positivo conhecido, encontrado durante esta propria fase: o guard
le o comando como texto, entao comando FALADO dentro de conteudo de
arquivo (heredoc, string de teste, documentacao) e detectado como se
fosse executado. Escrever um teste sobre push na main foi bloqueado pelo
proprio guard. Contorno: escrever o arquivo por ferramenta de escrita,
nao por heredoc. Correcao adiada de proposito — ignorar corpo de heredoc
abriria a porta para `bash <<EOF ... EOF`, que executa de verdade.

## Fase 4.8 — Escopo de projeto e detector de Supabase

A analise do projeto canario mostrou que a matriz promovia a convencao de
UM projeto a lei universal. O `squad.policies.json` vive no plugin,
instalado em escopo user, e valia em todo repo aberto — mas os projetos
tem regimes de governanca legitimamente diferentes: aqui e branch+PR
sempre; no canario, artefato de planejamento e `scripts/` vao direto na
main, e push na main publica em producao. Com a 4.6 e 4.7 o canario
ficaria sem mecanismo de publicacao.

Escopo: policy sem `project` e GLOBAL; policy com `project` (string ou
lista) so vale nos projetos nomeados. A identidade do projeto e o
basename da raiz do repo derivada da cwd — leitura de `.git`, nunca
execucao. A filtragem mora no ADAPTER, que e o caminho unico de carga
desde a 4.5: guard, runtime e testes aplicam o mesmo escopo por
construcao. Espalhar a filtragem pelos consumidores traria de volta a
divergencia que a 4.5 eliminou.

Consumidor que nao sabe em qual projeto esta recebe SO as globais. Uma
policy escopada nunca vaza para fora do escopo — nem para conceder (que
seria escalacao) nem para negar (que seria bloqueio alheio). Nenhum
agente alcanca a matriz: ela continua dentro do plugin, e nao existe
arquivo local de policy que um agente pudesse escrever para se
autorizar.

Unica policy escopada nesta fase: `no-direct-push-main`, em
`spectree-squad`. As demais seguem globais — autoridade de papel (banco e
do Oracle, git e do Disruptor) e gate de operacao destrutiva valem onde
quer que o squad rode.

Detector de Supabase: sem ele a autoridade exclusiva do Oracle nao valia
em projeto que nao usa `psql`. `supabase db push` aplica schema no
projeto vinculado (producao) e passava para qualquer agente. Agora `db
push`/`db reset`/`migration new` sao capability `database`, operacao
`migration`; leitura (`db diff`, `db dump`, `migration list`) e ciclo de
vida local (`start`, `status`) seguem livres. Limite declarado: o guard
nao le o conteudo dos arquivos de migration, entao nao distingue aditiva
de destrutiva — a regra "destrutiva passa pelo Founder" continua sendo
verificacao humana naquele projeto, nao enforcement.

## Fase 5 — Sandbox Runtime

Ate aqui o runtime respondia "o Agent pode fazer isso?". A partir do
`LocalFilesystemProvider`, porem, um `ALLOW filesystem.write` significava
acesso ao filesystem do host limitado apenas pelas invariantes do
proprio Provider — autorizacao e isolamento fisico eram a mesma coisa,
e nao sao. O Sandbox e a segunda fronteira:

```
Policy  ->  "pode?"
Sandbox ->  "dentro de quais limites fisicos?"
```

### O modelo

`SandboxPolicy` descreve o ambiente de UMA execucao: modo, roots
legiveis e graváveis (canonicalizadas por realpath, mesmo principio do
R12), temp, rede e ambiente. Congelada por execucao. `ExecutionBoundary`
traduz o modo em limites por dimensao — filesystem implementado nesta
fase; rede, processo e ambiente declarados como `unsupported`, porque
declarar e honesto e fingir nao e. A Fase 6 deu consequencia a essa
declaracao no eixo de processo: `unsupported` nao e so um rotulo, e um
veto — ver "Honestidade operacional (R14)".

Tres modos: `read-only` (le no workspace, nao escreve), `workspace-write`
(le e escreve dentro das roots declaradas) e `danger-full-access` (o
Sandbox nao acrescenta fronteira — o que NAO e bypass de Policy,
Approval ou invariante de Provider).

### As pecas

`SandboxProvider` restringe; o `CapabilityProvider` executa — nunca o
mesmo objeto. `SandboxProviderRegistry` registra backends validando
plataforma, capabilities e enforcement declarados. `SandboxResolver`
escolhe o backend capaz, ou falha fechado. `SandboxProfileResolver`
decide o modo efetivo pela camada MAIS RESTRITIVA entre Runtime,
Capability e o pedido da Tool: uma Tool pode restringir a si mesma,
jamais ampliar. Operacao nao classificada no perfil nao executa — e
assim que uma Tool mutante nova nao aparece sem fronteira.

### Enforcement honesto

`full`, `partial` e `none` sao estados explicitos. O primeiro backend,
`LocalFilesystemSandboxProvider`, declara **partial** — a verificacao
acontece em JavaScript, dentro do processo do runtime: impede o Provider
de sair do workspace, nao impede o processo de faze-lo por outro
caminho. Chamar isso de `full` seria mentira; `full` fica reservado para
isolamento de kernel (Landlock no Linux, Restricted Token no Windows).
Pedir `full` a um backend `partial` resulta em `SandboxUnavailableError`
— nunca downgrade silencioso.

O contrato `sandboxProviderContract` e o portao: todo backend futuro
passa por ele, e ele reprova quem alega mais do que entrega. Durante a
propria fase o contrato pegou uma incoerencia no backend de teste do
Spectree, que aceitava pedido de `full` declarando `none`.

### Ordem e ciclo de vida

```
tool.requested -> policy.evaluated -> sandbox.requested -> sandbox.applied
  -> tool.started -> provider.started -> provider.completed -> tool.completed
  -> sandbox.released
```

Policy e Approval vem ANTES do Sandbox: ambiente nao se monta para
operacao que nunca foi autorizada. O Sandbox vem antes de qualquer sinal
de execucao fisica: quando ele recusa, `tool.started` e
`provider.started` nao acontecem. O cleanup roda em `finally` —
sucesso, falha ou excecao — e falha de cleanup vira
`sandbox.cleanup.failed`, sem falsificar o resultado da operacao
principal.

Os eventos carregam modo, enforcement e providerId; nunca roots,
ambiente ou credencial.

### Classificacao de execucao (R13)

O efeito fisico nao muda de natureza por a tool carregar o proprio
`execute()`. Tool self-provided declara `execution: 'physical'` — e passa
pela MESMA fronteira de Sandbox da rota provider-backed, recebendo o
handle no contexto — ou `execution: 'pure'` — sem efeito fisico,
explicitamente fora da fronteira, com a decisao registrada e nunca
implicita. Em runtime com sandbox configurado, tool self-provided sem
classificacao nao entra no registry (fail closed, fail early — mesma
filosofia da operacao nao classificada no perfil). Runtime sem sandbox
configurado segue aceitando tools legadas, como nas Fases 1-4.

### Taxonomia

`SandboxDeniedError` nao e `PolicyDeniedError`. O primeiro diz "esta
autorizado, mas o ambiente fisico nao permite"; o segundo, "nao esta
autorizado". A distincao e diagnostica e normativa.

### Escalonamento

`SandboxEscalationRequest` existe como SEAM: representa o pedido de uma
fronteira mais ampla, com escopo de invocacao unica. Nada o executa
automaticamente — nao existe "sandbox negou, tenta de novo com mais
privilegio". Quando uma fase futura o ligar ao Founder Gate, deve compor
com o ApprovalManager existente, nunca duplicar Approval.

### Matriz de plataforma

| Plataforma | Backend | Enforcement |
|---|---|---|
| qualquer | `local-filesystem-sandbox` | partial |
| linux | Landlock | reservado |
| win32 | Restricted Token / ACL | reservado |
| darwin | — | reservado |

Reservado significa reservado: o Registry responde indisponivel em vez
de oferecer isolamento falso.

## Fase 6 — Process/Subprocess Capability

O primeiro consumidor critico do Sandbox: execucao governada de
processos externos.

```
Agent -> ToolRuntime -> Policy -> Approval -> Capability process
      -> Sandbox -> LocalSubprocessProvider -> OS Process
```

### Regra de ouro

O Spectree nunca executa uma STRING de comando. Executa um processo com
`argv` explicito (`argv[0]` = executavel, o resto = argumentos
literais), num execution world conhecido, dentro de um Sandbox
conhecido, sob uma Policy conhecida. Nao existe `shell: true`; nao
existem operadores de shell no Provider (INV-606/622). Um futuro
ShellProvider consumira a capability `process` pedindo
`argv: ['/bin/bash', ...]` — e sera governado como qualquer processo.

### Honestidade operacional (R14)

**Sem enforcement fisico + modo que promete confinement = nao executar.**

Um modo restritivo (`read-only`, `workspace-write`) e uma PROMESSA de
limite fisico. O `LocalFilesystemSandboxProvider` entrega `partial`:
verificacao em JavaScript dentro do Runtime — o que impede o Provider de
sair do workspace, mas nao alcanca um processo filho, que nao roda o
nosso codigo. Enquanto nenhum backend confinar processo de verdade,
cumprir a promessa e impossivel; entao o Runtime nao executa, em vez de
executar mentindo.

Consequencia pratica: para rodar um processo hoje, o operador classifica
`process.spawn` como `danger-full-access` — o modo que nao promete
confinement nenhum. A execucao nao confinada vira escolha explicita e
auditavel (o proprio filho recebe `SPECTREE_SANDBOX=danger-full-access`),
nunca efeito colateral silencioso de um modo que diz "workspace". Um
runtime com teto `workspace-write` simplesmente nao pare processo — e o
perfil que acompanha o runtime nem classifica `process`, entao a postura
de fabrica e fechada.

A regra vive em UM lugar (`executionBoundaryFor`, eixo `process`), que
devolve `{ allowSpawn, enforcement, denialReason }`. O Provider obedece,
nao reinterpreta, e a recusa e `SandboxDeniedError` — nao erro de
Provider: a operacao estava autorizada; o ambiente e que nao pode
cumprir o limite. Esse e tambem o seam do backend fisico futuro
(Landlock, job object, container): ele constroi o boundary do handle com
`processEnforcement: 'full'` e o mesmo calculo libera spawn sob modo
restritivo, sem tocar no Agent nem no Provider de processo. `partial`
nao conta — so `full` e fisico.

### O contrato

`ProcessSpawnSpec`: argv, cwd EXPLICITO (nunca herdado de
`process.cwd()`), stdio explicito por stream (`stdin`:
ignore|pipe|data; `stdout`/`stderr`: pipe|inherit|collect), env de
overrides, `graceMs` limitado e `AbortSignal` opcional. Nenhum default
silencioso de stdio.

O cwd, workspace-relativo, vira o resource canonico que a Policy julga
(`workspace`, `workspace/<path>` ou `outside-workspace` — que morre na
Policy antes de qualquer spawn). Resource, boundary do Sandbox e cwd
fisico nao podem divergir; e filesystem + process compartilham o MESMO
execution world (INV-630) — arquivo criado pelo processo e lido pelo
LocalFilesystemProvider sem traducao.

### Ambiente

O filho NUNCA herda o ambiente do host por inteiro: base minima por
allowlist, scrub do namespace `SPECTREE_*` herdado (fatos do Runtime
nao sao confiaveis vindos do host), overrides explicitos do spec — que
nao podem invadir o namespace — e por ultimo as variaveis gerenciadas
(`SPECTREE_SESSION_ID`, `SPECTREE_AGENT_ID`, ...), escritas pelo
Runtime como unica fonte legitima. Credencial do host fica fora por
construcao.

### Executavel

Absoluto: canonicalizado e verificado. Nome simples: resolvido pelo
PATH CONTROLADO do ambiente ja composto — o input nao redefine o PATH
da resolucao. O resolvido na autorizacao e exatamente o executado.

### Handle e lifecycle

`spawn()` nao bloqueia: devolve um ProcessHandle (pid, done, stdout,
stderr, stdin, terminate — superficie travada) que e seam INTERNO para
consumidores futuros (shell, terminal); a Tool `process.spawn` aguarda
o outcome e devolve fatos: exitCode, signal, duracao, saida coletada.
`exitCode != 0` e OUTCOME, nunca ProcessError (INV-621) — quem decide o
que significa e a Tool.

`terminate()` e a unica API de encerramento: graceful -> graceMs ->
forcado, em ARVORE (posix: process group; win32: taskkill /T) — best
effort declarado, nunca inflado. Idempotente; `done` resolve com os
fatos finais. Saida e coletada com `maxBytes` obrigatorio
(`truncated = true` quando estoura — o texto nunca finge ser completo)
e spill opcional, ele proprio limitado.

### Posse e lifecycle de Session

Todo processo pertence a uma Session (ProcessRegistry, do Runtime):
Session A nao alcanca processo de B (ProcessOwnershipError, INV-617);
`session.cancelled` termina os processos vivos da Session
(INV-618); `runtime.shutdown()` encerra o que restou. Processo
encerrado sai do registry.

### Gate unico

A capability `process` declara `providerOnly`: tool self-provided com
`execute()` proprio e recusada pelo ToolRuntime — nao existe terceira
rota entre o Agent e o spawn (INV-624). O gate e generico no Core (a
capability declara; o Core nao conhece 'process' pelo nome).

### Eventos

`process.requested/resolved/started/exited/terminated` sob projecao
segura: identidade do executavel e contagem de argumentos — nunca argv
bruto (pode carregar segredo), stdin, env ou saida completa.

## Fase 7 — Linux Physical Sandbox

O primeiro backend em que o sistema operacional participa da enforcement
boundary: o R14 encontra o `processEnforcement: 'full'` que o seam
esperava.

```
SandboxResolver -> LinuxPhysicalSandboxProvider
                        |-- BubblewrapBackend   (preferencial)
                        `-- LandlockBackend     (fallback, seam formal)
```

### Probe funcional e a autoridade (INV-724)

`which bwrap` nao prova nada. Antes de qualquer `full`, o provider
executa um processo confinado num mundo DESCARTAVEL e verifica o
contrato do modo: allowed read passa, outside read falha, write conforme
o modo — com timeout, sem rede, sem credencial, e destruindo tudo
depois. `enforcement` comeca `'none'` e so vira `'full'` depois do probe
(secao 14: full e fato, nao configuracao). Probe reprovado nao some: a
razao de cada backend fica em `verdict.attempts` e viaja no
`SandboxUnavailableError` quando o chain esgota — nunca fallback
unconfined (INV-726).

### Bubblewrap: fora nao e negado, fora NAO EXISTE

O backend monta explicitamente o que o processo pode ver: roots de
sistema read-only (`/usr`, `/etc`, symlinks merged-usr recriados),
`/proc` e `/dev` proprios, o workspace (`ro-bind` em read-only, `bind`
em workspace-write), o temp privado da invocation — e NADA mais. Ler
fora do workspace falha porque o caminho nao existe no namespace; a
escrita em read-only morre no kernel (`EROFS`), nao em JavaScript.
Symlink, hard-link e rename atravessando a fronteira morrem pelo mesmo
motivo, e filhos e netos herdam o namespace: a arvore inteira nasce
dentro da boundary (INV-713) — nao existe pos-confinamento (INV-714).

### A porta generica: confineProcess

O SandboxHandle ganhou `confineProcess({argv, cwd})` -> `{argv, backendId}`:
launcher prefixado, `--`, argv original INTACTO (secao 26). O
LocalSubprocessProvider usa a porta sem saber o que ha por tras — nenhum
`if linux`/`if bwrap` fora de `sandbox/providers/linux-physical/`
(INV-702/703/730). Backends que nao confinam processo expoem a porta
como `null` na mesma superficie R8 (agora com `sandboxInstanceId` por
invocation):

```
['mode','enforcement','providerId','sandboxInstanceId','boundary',
 'sessionTemp','assertPathAllowed','confineProcess','dispose']
```

### Policy por invocation (INV-708)

Nenhum modo global no provider: cada `apply()` recebe a policy da
chamada, instancia propria (`sandboxInstanceId`) e temp privado por
Session/invocation — Sessions concorrentes rodam read-only e
workspace-write ao mesmo tempo, e o temp de A e invisivel para o
processo de B.

### Landlock: seam formal

O LandlockBackend participa do chain com locate controlado (nunca um
helper achado por acaso no PATH, secao 56) e forma de invocacao travada
por teste. O launcher nativo que ele exige nao acompanha esta fase: sem
helper, `unusable` com razao. Quando existir, a ABI do kernel decide o
enforcement — ABI incompleta = `partial`, e profile exigindo `full`
rejeita em vez de degradar (INV-711).

### WSL2 e host, nao sandbox (INV-723)

No ambiente de desenvolvimento do Founder (Windows + WSL2), o Runtime
roda DENTRO do Linux e o confinement e do bubblewrap dentro dele — o
WSL2 nao e security boundary. `diagnostics()` detecta WSL (interop env /
assinatura do kernel) para troubleshooting, sem dado pessoal. No kernel
WSL atual o Landlock nao esta habilitado — exatamente o caso em que o
chain cai para bubblewrap (secao 96).

### O resultado estrategico

Antes: `workspace-write + process.spawn -> SandboxDeniedError` (R14).
Agora, onde o Linux prova a garantia: `workspace-write -> sandbox fisico
-> processo confinado` — sem `danger-full-access`. O teste de arquitetura
mostra o kernel negando: dentro do workspace read/write/delete passam;
fora, read, write, delete, rename, symlink e hard-link falham — e o neto
do processo continua confinado.

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
