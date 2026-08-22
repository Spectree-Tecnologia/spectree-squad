---
status: in-review
owner: TechLeader
updated: 2026-08-21
approved: 2026-08-19 (merge do PR #8 em `main`: squash `0cdb168`, tag `v0.16.0`, 2026-08-19 22:25 -03. Texto transcrito para este repositorio em 2026-08-21, com equivalencia de conteudo medida linha a linha — a transcricao restaurou marcacao, nao alterou conteudo, e por isso `updated:` registra a data do conteudo e nao a do arquivo)
depends_on: -
---

# Spectree Runtime v2 — F01 Runtime Core

> Transcrição da especificação normativa da Fase 1, produzida no harness de
> planejamento do Founder (declarado na fonte: `Status: APPROVED`,
> `Owner: TechLeader`). O texto é o do documento fonte, sem correção, melhoria
> ou complemento. O texto commitado é o contrato real (ver
> `docs/spec/README.md`).
>
> **Duas fontes; esta é a que vale.** A primeira versão deste arquivo nasceu de
> uma exportação achatada do documento original — o transporte dissolveu 21 dos
> 86 blocos de código em listas e prosa, e a marcação foi reconstruída por
> inferência. A versão atual vem do documento colado íntegro pelo Founder no
> chat em 2026-08-21, com a marcação original preservada, transportada e
> verificada seção a seção: 47 seções contíguas de 1 a 47, `INV-001` a
> `INV-010` presentes e únicos, 86 blocos de código.
>
> A reconciliação entre as duas versões foi medida linha a linha: **nenhuma
> linha de texto se perdeu na exportação achatada.** Os 21 blocos dissolvidos
> preservaram seu conteúdo integralmente; o dano foi exclusivamente de
> marcação — identificadores literais rebaixados a prosa ou a bullets, e cinco
> enumerações ordenadas (§5.1, §7, §11, §15, §46) rebaixadas a bullets sem
> número. Nenhum `INV-` e nenhuma seção mudou de sentido.
>
> Aprovação a derivar (ADR-10, decisão 10 item 6): a Fase 1 embarcou no merge
> de `feat/runtime-core-phase-1` em `main` — squash `0cdb168`, tag `v0.16.0`,
> em 2026-08-19 (reflog: `pull --ff-only origin main` às 22:25 -03, entre os
> commits `0d5b3c3` e `ca59952` da branch da fase). A data está no git; o flip
> de `status:` e o preenchimento de `approved:` são ato do Invoker.
>
> `status:` rebaixado a `in-review` nesta edição: substituir o corpo pelo texto
> fiel à fonte íntegra é emenda substantiva (ADR-10, decisão 5).

- Implementador: Agente Opus 5
- Repositório: Spectree-Tecnologia/spectree-squad
- Fase: 1 — Runtime
- Objetivo: criar o núcleo de execução do Spectree Runtime v2 sem quebrar o Squad atual.

## 1. Objetivo da Fase

Criar a primeira camada de runtime do Spectree:

```
spectree-runtime/
├── Agent
├── AgentLoop
├── ToolRuntime
├── Session
└── EventBus
```

O objetivo não é criar ainda:

- Policy Engine
- Sandbox
- Dynamic Orchestrator
- Plugin System
- Capability Providers
- Persistence externa
- UI
- MCP Server
- execução distribuída

Esses componentes pertencem a fases posteriores.

A Fase 1 deve estabelecer apenas os contratos fundamentais de execução sobre os quais essas capacidades poderão ser construídas.

## 2. Princípio arquitetural

O runtime deve ser independente da persona dos agentes do Squad.

Hoje temos:

```
Invoker
Lina
Lion
Rubick
Zeus
Oracle
Jakiro
Keeper
Disruptor
```

Esses agentes continuam existindo.

Porém, o runtime não deve conhecer nenhum deles pelo nome.

O runtime deve conhecer apenas:

```
Agent
AgentLoop
ToolRuntime
Session
EventBus
```

Portanto:

```
                    Spectree Squad
                         │
                         ▼
                 Agent Definition
                         │
                         ▼
                 Spectree Runtime
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
      Agent           Session          Tools
        │                │                │
        └────────────────┼────────────────┘
                         ▼
                      Events
```

A regra fundamental é:

Squad define quem o agente é. Runtime define como um agente executa.

## 3. Regra de compatibilidade

A implementação desta fase NÃO pode exigir a reescrita dos agentes atuais.

O estado atual do Squad deve continuar funcional.

A Fase 1 deve ser construída de maneira incremental:

```
Squad atual
    │
    ├── continua funcionando
    │
    └── pode começar a consumir
             │
             ▼
      spectree-runtime
```

Não é permitido transformar esta fase em uma migração completa do Squad.

## 4. Estrutura esperada

O Agente Opus 5 deve primeiro inspecionar a estrutura atual do repositório e adaptar o caminho abaixo à linguagem/arquitetura existente.

A estrutura lógica esperada é:

```
spectree-runtime/
├── agent/
│   ├── Agent
│   └── types
│
├── loop/
│   ├── AgentLoop
│   └── types
│
├── tools/
│   ├── ToolRuntime
│   ├── Tool
│   └── types
│
├── session/
│   ├── Session
│   └── types
│
├── events/
│   ├── EventBus
│   ├── Event
│   └── types
│
├── index
└── tests/
```

A estrutura física pode mudar conforme a stack existente.

Os contratos conceituais são obrigatórios.

## 5. Responsabilidade de cada componente

### 5.1 Agent

Agent representa uma unidade executável do Spectree Runtime.

Ele NÃO deve representar:

- Lina
- Jakiro
- Oracle
- Claude Code
- Claude
- um modelo específico
- uma ferramenta

Ele representa a abstração:

```
Agent = identidade + instrução + configuração + execução
```

Responsabilidades:

1. possuir identidade;
2. receber uma missão;
3. possuir contexto de execução;
4. acessar ferramentas através do ToolRuntime;
5. publicar eventos;
6. produzir resultado;
7. respeitar o ciclo de vida definido pelo AgentLoop.

O Agent não deve implementar diretamente:

- filesystem;
- shell;
- Git;
- GitHub;
- banco;
- Playwright;
- MCP.

Essas capacidades pertencem ao ToolRuntime.

## 6. Contrato mínimo de Agent

O contrato deve permitir algo conceitualmente equivalente a:

```
AgentDefinition
    id
    name
    instructions
    metadata
```

e:

```
AgentContext
    session
    mission
    runtime
```

O agente deve conseguir executar:

```
run(context) -> AgentResult
```

O AgentResult deve permitir distinguir pelo menos:

```
completed
failed
cancelled
```

Não criar neste momento estados complexos de workflow.

## 7. AgentLoop

AgentLoop é o coração de execução.

Ele implementa o ciclo:

```
THINK
  ↓
ACT
  ↓
OBSERVE
  ↓
THINK
  ↓
ACT
  ↓
...
```

O loop não deve conhecer a implementação específica de um agente.

Responsabilidade:

1. iniciar execução;
2. entregar contexto ao Agent;
3. processar solicitações de ferramenta;
4. aguardar resultados;
5. continuar o ciclo;
6. detectar conclusão;
7. detectar falha;
8. detectar cancelamento;
9. emitir eventos de lifecycle.

## 8. Limite do AgentLoop

O AgentLoop NÃO deve ser um workflow engine.

Não implementar nesta fase:

```
Lina → Lion → Rubick → Zeus
```

Isso pertence à camada de Orchestration.

O loop executa:

```
um Agent
```

e não:

```
um Squad inteiro
```

Esta distinção é obrigatória.

## 9. ToolRuntime

ToolRuntime é a única porta pela qual o Agent acessa ferramentas.

O princípio é:

```
Agent
  ↓
ToolRuntime
  ↓
Tool
  ↓
resultado
```

Nunca:

```
Agent
  ↓
Bash diretamente
```

ou:

```
Agent
  ↓
filesystem diretamente
```

ou:

```
Agent
  ↓
MCP diretamente
```

## 10. Contrato de Tool

Uma Tool deve possuir pelo menos:

```
id
name
description
inputSchema
execute(input, context)
```

Exemplo conceitual:

```
Tool:
    id: filesystem.read
    name: Read File
    description: Reads a file
    inputSchema: ...
    execute(...)
```

A implementação concreta pode ser diferente.

O contrato deve permitir posteriormente adicionar:

```
filesystem
shell
git
github
database
browser
mcp
```

sem modificar o Agent.

## 11. ToolRuntime responsibilities

O ToolRuntime deve:

1. registrar ferramentas;
2. localizar ferramenta pelo ID;
3. validar input;
4. executar ferramenta;
5. capturar resultado;
6. capturar erro;
7. emitir eventos;
8. devolver resultado ao AgentLoop.

Fluxo:

```
Agent
  │
  │ tool request
  ▼
ToolRuntime
  │
  ├── resolve tool
  ├── validate input
  ├── execute
  ├── capture result
  └── emit events
  │
  ▼
ToolResult
  │
  ▼
AgentLoop
```

## 12. ToolRuntime NÃO deve implementar Policy Engine

Importante.

Não criar ainda:

```
can(agent, tool, operation)
```

como sistema completo de autorização.

Porém, o contrato deve ser desenhado para que isso possa ser introduzido depois.

Exemplo:

```
ToolRuntime.execute(request, context)
```

deve possuir contexto suficiente para uma futura camada:

```
PolicyEngine
      ↓
ToolRuntime
```

Não antecipar a implementação da Policy Engine nesta fase.

## 13. Session

Session representa uma execução do runtime.

Ela é diferente dos artefatos de projeto.

O Squad atual usa:

```
docs/
```

como estado de projeto e memória compartilhada.

Isso permanece.

A Session representa:

```
uma execução concreta do runtime
```

Exemplo:

```
session_id = sess_01J...
agent_id   = jakiro
mission    = "Implementar STORY-001"
status     = running
```

## 14. Session lifecycle

A Session deve possuir lifecycle mínimo:

```
created
   ↓
running
   ↓
completed
```

ou:

```
running
   ↓
failed
```

ou:

```
running
   ↓
cancelled
```

Estados mínimos:

```
created
running
completed
failed
cancelled
```

Não adicionar estados arbitrários nesta fase.

## 15. Session responsibilities

A Session deve:

1. possuir ID único;
2. possuir timestamps;
3. identificar Agent;
4. guardar missão;
5. manter estado de lifecycle;
6. possuir referência ao contexto;
7. associar eventos à execução.

A Session não deve ser responsável por:

- workflow;
- Git;
- banco;
- arquivos do projeto;
- aprovação humana;
- política de segurança.

## 16. Session ≠ Project State

Esta distinção é obrigatória.

```
Project State
    ↓
docs/
PRD
EPIC
STORY
ADR
DESIGN
LESSONS
```

é o estado do projeto.

Enquanto:

```
Session
    ↓
uma execução específica
```

é estado de runtime.

Exemplo:

```
Projeto:
STORY-001 = in-progress

Session:
sess_123
agent = jakiro
started_at = ...
status = running
```

O runtime não deve tentar substituir o SSOT existente do Squad.

## 17. EventBus

EventBus é o mecanismo de comunicação observável do runtime.

Os componentes não devem depender diretamente uns dos outros para comunicar lifecycle.

Exemplo:

```
Agent
  │
  ▼
EventBus
  │
  ├── Session
  ├── Logger
  ├── Observer
  ├── UI futura
  └── Audit futura
```

## 18. Event model

Todo evento deve possuir envelope consistente.

Modelo conceitual:

```
Event
    id
    type
    timestamp
    sessionId
    agentId?
    payload
```

O id deve ser único.

O timestamp deve ser gerado pelo runtime.

sessionId deve acompanhar eventos de execução.

agentId deve existir quando o evento estiver associado a um Agent.

## 19. Eventos mínimos

Implementar pelo menos:

```
session.created
session.started
session.completed
session.failed
session.cancelled

agent.started
agent.completed
agent.failed

tool.requested
tool.started
tool.completed
tool.failed
```

Não criar dezenas de eventos nesta fase.

Esses eventos são suficientes para provar o lifecycle básico.

## 20. EventBus API mínima

Deve existir conceito equivalente a:

```
publish(event)
subscribe(eventType, handler)
unsubscribe(...)
```

O EventBus deve suportar múltiplos consumidores.

Exemplo:

```
EventBus
   │
   ├── Logger
   ├── Session observer
   └── Test observer
```

Um subscriber não pode impedir que outros subscribers recebam eventos.

Falha de observer deve ser isolada do runtime.

## 21. EventBus não é Message Queue

Não implementar nesta fase:

- Redis;
- RabbitMQ;
- Kafka;
- persistência distribuída;
- retry distribuído;
- consumer groups;
- delivery guarantees distribuídas.

O primeiro EventBus pode ser in-process.

O contrato, porém, deve permitir substituição futura.

## 22. Relação entre os cinco componentes

O desenho mínimo é:

```
                    ┌──────────────┐
                    │    Agent     │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  AgentLoop   │
                    └──────┬───────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      ┌──────────────┐            ┌──────────────┐
      │ ToolRuntime  │            │   Session    │
      └──────┬───────┘            └──────────────┘
             │
             ▼
          Tools

AgentLoop / ToolRuntime / Session
             │
             ▼
        ┌───────────┐
        │ EventBus  │
        └───────────┘
```

## 23. Fluxo de execução obrigatório

O Agente Opus 5 deve conseguir demonstrar o seguinte fluxo:

```
1. criar Session
2. publicar session.created
3. iniciar Session
4. publicar session.started
5. criar Agent
6. iniciar AgentLoop
7. publicar agent.started
8. Agent solicita Tool
9. ToolRuntime recebe request
10. publicar tool.requested
11. executar Tool
12. publicar tool.started
13. publicar tool.completed
14. devolver ToolResult
15. Agent continua
16. Agent conclui
17. publicar agent.completed
18. Session conclui
19. publicar session.completed
```

Em caso de erro:

```
tool.failed
     ↓
agent.failed
     ↓
session.failed
```

Em caso de cancelamento:

```
agent/session cancelled
```

sem produzir completed.

## 24. Invariantes

As seguintes regras são obrigatórias.

- **INV-001**
  Um Agent não executa Tool diretamente.

- **INV-002**
  Uma Tool não conhece o Agent que a chamou além do contexto necessário.

- **INV-003**
  O AgentLoop não conhece ferramentas concretas.

- **INV-004**
  A Session não conhece detalhes de implementação de Tools.

- **INV-005**
  O EventBus não contém lógica de negócio.

- **INV-006**
  Nenhum componente pode depender de Claude Code.

- **INV-007**
  Nenhum componente do runtime pode depender do nome de um agente do Squad.

- **INV-008**
  Nenhum componente da Fase 1 pode exigir banco externo.

- **INV-009**
  Nenhum componente da Fase 1 pode exigir infraestrutura cloud.

- **INV-010**
  A execução deve ser testável sem chamar um LLM real.

## 25. Dependency rule

A direção das dependências deve ser:

```
Agent
  ↓
AgentLoop
  ↓
ToolRuntime

Session
  ↑
AgentLoop

EventBus
  ↑
todos os componentes
```

Porém, os componentes devem depender de interfaces/contratos, não de implementações concretas.

Evitar:

```
Agent → Claude API
Agent → Bash
Agent → Playwright
Agent → Git
```

Preferir:

```
Agent → LLM interface futura
Agent → ToolRuntime
Agent → EventBus
```

## 26. LLM Provider

Não implementar um provider de Claude nesta fase.

O runtime deve apenas deixar o seam arquitetural preparado.

Por exemplo:

```
Agent
   ↓
Model/LLM interface
```

mas a implementação concreta pode ficar para uma fase posterior.

O motivo é impedir que:

```
Spectree Runtime
```

se torne:

```
Claude Runtime
```

O Runtime deve ser model-agnostic.

## 27. Testabilidade

Esta é uma exigência crítica.

O runtime deve funcionar em testes sem:

- Claude API;
- OpenAI API;
- DeepSeek API;
- MCP externo;
- GitHub;
- filesystem real, quando desnecessário.

Criar fake/mock implementations para:

```
Agent
Tool
ToolRuntime
EventBus
Session
```

quando necessário.

## 28. Testes obrigatórios

O Opus 5 deve criar testes unitários para:

Agent

- criação;
- execução;
- resultado de sucesso;
- falha;
- cancelamento.

AgentLoop

- execução simples;
- múltiplas iterações;
- tool request;
- tool result;
- tool failure;
- agent failure;
- cancellation.

ToolRuntime

- registro;
- lookup;
- input válido;
- input inválido;
- execução;
- erro;
- tool inexistente.

Session

- lifecycle válido;
- transições inválidas;
- IDs;
- timestamps;
- conclusão;
- falha;
- cancelamento.

EventBus

- publish;
- subscribe;
- unsubscribe;
- múltiplos subscribers;
- isolamento de erro de subscriber;
- ordem dos eventos.

## 29. Teste de integração obrigatório

Criar pelo menos um teste:

```
FakeAgent
    ↓
AgentLoop
    ↓
FakeToolRuntime
    ↓
FakeTool
    ↓
EventBus
    ↓
Session
```

O teste deve provar o lifecycle completo.

O resultado esperado deve ser algo equivalente a:

```
session.created
session.started
agent.started
tool.requested
tool.started
tool.completed
agent.completed
session.completed
```

Esse teste é a primeira prova de que o Spectree Runtime existe de fato.

## 30. Teste de falha

Criar cenário:

```
Agent
 ↓
ToolRuntime
 ↓
Tool
 ↓
ERROR
```

Esperado:

```
tool.requested
tool.started
tool.failed
agent.failed
session.failed
```

Nenhum:

```
tool.completed
agent.completed
session.completed
```

pode ser emitido depois da falha.

## 31. Teste de isolamento

Criar duas Sessions simultâneas:

```
sess-A
sess-B
```

com Agents diferentes.

Provar que:

```
eventos de A ≠ eventos de B
```

e que nenhuma Session recebe estado da outra.

Esse teste é obrigatório porque prepara o runtime para execução paralela futura.

## 32. Concorrência

A Fase 1 não precisa implementar execução distribuída.

Mas o design não pode assumir:

```
global currentSession
```

ou qualquer estado singleton que impeça múltiplas Sessions.

O runtime deve ser multi-session safe.

## 33. Persistência

Não implementar banco nesta fase.

A Session pode inicialmente existir em memória.

Porém:

```
Session
Event
EventBus
```

devem possuir contratos que permitam adicionar posteriormente:

```
SessionStore
EventStore
```

sem alterar o AgentLoop.

## 34. Observabilidade

O runtime deve emitir eventos suficientes para permitir posteriormente:

```
TUI
CLI
logs
audit
metrics
session replay
```

Não implementar essas interfaces agora.

O EventBus é o seam.

## 35. Erros

Criar tipos/classes de erro claros.

No mínimo:

```
AgentError
ToolError
ToolNotFoundError
ToolValidationError
SessionError
SessionStateError
RuntimeError
```

Não utilizar apenas:

```
throw new Error("something went wrong")
```

para todos os casos.

O consumidor precisa conseguir distinguir categorias de falha.

## 36. Cancellation

O runtime deve suportar cancellation desde a Fase 1.

A implementação pode usar o mecanismo idiomático da linguagem escolhida.

O importante é que:

```
Session.cancel()
```

ou equivalente seja capaz de sinalizar o AgentLoop.

Após cancelamento:

```
no new tool execution
```

deve ser iniciado.

O estado final deve ser:

```
cancelled
```

## 37. Timeouts

Não criar um sistema complexo de timeout nesta fase.

Porém, Tool execution deve possuir um ponto arquitetural onde futuramente possa existir:

```
timeout
```

O runtime não deve ficar arquiteturalmente preso a Tools infinitas.

## 38. Não fazer nesta fase

O Agente Opus 5 está explicitamente proibido de expandir o escopo para:

```
❌ Policy Engine
❌ Sandbox
❌ Dynamic Planner
❌ Workflow Engine
❌ Plugin Marketplace
❌ MCP Server
❌ Git integration
❌ GitHub integration
❌ Database integration
❌ Browser integration
❌ Cloud execution
❌ Distributed EventBus
❌ Redis
❌ Kafka
❌ UI/TUI
❌ Dashboard
❌ Cost tracking
❌ Agent memory/RAG
❌ Vector database
```

Esses itens poderão consumir os contratos criados nesta fase posteriormente.

## 39. Integração com o Squad atual

Ao terminar, o Opus 5 deve demonstrar como um agente atual poderia ser adaptado.

Não é necessário migrar todos.

Escolher um agente simples como prova de conceito.

O teste deve demonstrar:

```
Agent atual
    ↓
Spectree Runtime
    ↓
AgentLoop
    ↓
ToolRuntime
    ↓
EventBus
```

O agente escolhido não pode exigir alteração estrutural nos demais agentes.

## 40. Critério de arquitetura

O runtime será considerado arquiteturalmente correto somente se for possível criar:

```
Agent A
Agent B
```

com ferramentas diferentes:

```
Agent A → Tool A
Agent B → Tool B
```

sem modificar:

```
AgentLoop
Session
EventBus
```

## 41. Definition of Done

A Fase 1 somente será considerada DONE quando:

- spectree-runtime/ existir.
- Agent estiver implementado.
- AgentLoop estiver implementado.
- ToolRuntime estiver implementado.
- Session estiver implementada.
- EventBus estiver implementado.
- os cinco componentes possuírem contratos claros.
- o runtime não depender de Claude Code.
- o runtime não depender de um LLM real para testes.
- existir teste de integração completo.
- existir teste de falha.
- existir teste de cancellation.
- existir teste com duas Sessions simultâneas.
- existir documentação da arquitetura.
- existir exemplo mínimo de uso.
- todos os testes estiverem verdes.
- nenhuma funcionalidade fora do escopo tiver sido adicionada.

## 42. Critério de qualidade

Não aceitar implementação apenas porque:

```
"funciona no exemplo"
```

O objetivo da Fase 1 é criar fundação, não demo.

O Opus 5 deve priorizar:

```
contracts
+
separation of concerns
+
testability
+
extensibility
+
small surface area
```

sobre quantidade de funcionalidades.

## 43. Entregáveis obrigatórios do Opus 5

Ao finalizar a implementação, o agente deve entregar:

A. Código

```
spectree-runtime/
```

B. Testes

Testes unitários + integração.

C. Architecture Document

```
docs/architecture/SPECTREE-RUNTIME.md
```

Contendo:

```
responsabilidades
dependências
lifecycle
event model
tool model
session model
extension points
```

D. Decision Record

Criar ADR somente se houver uma decisão arquitetural realmente irreversível ou com trade-off significativo.

Não criar ADR artificial.

E. Runtime Example

Um exemplo mínimo executável:

```
FakeAgent
    ↓
AgentLoop
    ↓
FakeTool
    ↓
Session
    ↓
EventBus
```

F. Handoff

O handoff deve informar:

```
Implemented
Tests
Architecture
Known limitations
Next extension points
```

## 44. Handoff obrigatório

O Opus 5 não deve simplesmente responder:

"Fase 1 concluída."

Deve apresentar evidência.

Formato mínimo:

```
## Implementation

[arquivos principais]

## Tests

[comando]
[resultado]

## Runtime lifecycle

[diagrama]

## Event sequence

[sequência observada]

## Integration proof

[agente usado]

## Known limitations

[limitações reais]

## Scope verification

[confirmar que não implementou Fase 2]
```

## 45. Regra de ouro para o Opus 5

Não transforme o Spectree Runtime em um framework completo nesta fase.

O objetivo é criar o microkernel inicial.

Cinco primitivas:

```
Agent
AgentLoop
ToolRuntime
Session
EventBus
```

Devem ser pequenas, independentes e extensíveis.

A arquitetura futura:

```
                   SPECTREE OS
                       │
             ┌─────────┴─────────┐
             │                   │
       Engineering OS       Runtime Core
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
               Agent          Session         Tools
                 │               │               │
                 └───────────────┼───────────────┘
                                 │
                              Events
                                 │
                         Future phases:
                         Policy
                         Sandbox
                         Orchestrator
                         Capabilities
```

deve ser possível sem reescrever estes cinco componentes.

## 46. Validação final do TechLeader

Antes de declarar a fase concluída, o Opus 5 deve responder objetivamente:

1. O Agent pode existir sem conhecer Claude Code?
2. O AgentLoop pode executar qualquer Agent compatível?
3. O ToolRuntime pode receber qualquer Tool compatível?
4. Uma Session é independente do projeto e de outras Sessions?
5. O EventBus permite observar toda a execução?
6. O runtime pode ser testado sem API externa?
7. Um segundo LLM provider poderá ser adicionado sem alterar AgentLoop?
8. Um futuro Policy Engine poderá ficar entre Agent e ToolRuntime?
9. Um futuro persistent EventStore poderá substituir o EventBus in-memory sem alterar os consumidores?
10. O Squad atual continua funcionando?

Se qualquer resposta for não, a Fase 1 não está pronta.

## 47. Resultado esperado

Ao final desta fase, devemos sair de:

```
Claude Code
   ↓
Squad
   ↓
Agentes
   ↓
Tools
```

para:

```
Claude Code / Squad
        ↓
Spectree Runtime
        ↓
 ┌──────┼────────┬──────────┐
 ▼      ▼        ▼          ▼
Agent  Session  Tools     Events
  │      │        │          │
  └──────┴────────┴──────────┘
             │
             ▼
          AgentLoop
```

O ganho desta fase não é "mais funcionalidades".

O ganho é criar uma fronteira arquitetural real entre o Squad e o mecanismo de execução.

Essa fronteira é a fundação do Spectree Runtime v2.
