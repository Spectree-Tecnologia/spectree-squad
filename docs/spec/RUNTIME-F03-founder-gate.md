---
status: approved
owner: TechLeader
updated: 2026-08-19
approved: 2026-08-19 (merge do PR #10 em `main`: squash `85ad4bc`, tag `v0.18.0`. Texto transcrito para este repositorio em 2026-08-21, com equivalencia de conteudo medida linha a linha — a transcricao restaurou marcacao, nao alterou conteudo, e por isso `updated:` registra a data do conteudo e nao a do arquivo)
depends_on: F1 Runtime Core, F2 Policy Engine
---

# Spectree Runtime v2 — Fase 3: Founder Gate / Approval Runtime

> Transcrição da especificação normativa da Fase 3, produzida no harness de
> planejamento do Founder (owner declarado na fonte: TechLeader). Esta versão
> restaura a marcação markdown perdida no transporte; o texto é o do documento
> fonte, sem correção, melhoria ou complemento. O texto commitado é o contrato
> real (ver `docs/spec/README.md`).
>
> Aprovação a derivar: a Fase 3 embarcou em `main` no PR #10 — squash
> `85ad4bc`, tag `v0.18.0`, em 2026-08-19. A data está no git; o flip de
> `status:` e o preenchimento de `approved:` são ato do Invoker.
>
> `updated:` registra a data do conteúdo, não a do arquivo: a transcrição foi
> feita em 2026-08-21 com equivalência medida linha a linha — restaurou
> marcação, não alterou conteúdo.
>
> Regra de transcrição: cada linha não vazia da fonte vira exatamente uma linha
> deste arquivo, com no máximo um prefixo. Por isso a matriz da seção 93 aparece
> como lista agrupada (estado atual / operação / resultado) e não como tabela —
> juntar três linhas em uma quebraria a equivalência medida.

- Status: APPROVED FOR IMPLEMENTATION
- Owner: TechLeader
- Implementador: Agente Opus 5
- Baseline: Spectree Runtime v2 — Fases 1 e 2 congeladas
- Versão de referência: v0.17.0
- Fase: 3 — Founder Gate / Approval Runtime

## 1. Objetivo

A Fase 2 criou a decisão:

- ALLOW
- DENY
- APPROVAL_REQUIRED

O fluxo atual para approval-required termina aqui:

```
Agent
  ↓
ToolRuntime
  ↓
PolicyEngine
  ↓
approval-required
  ↓
Tool bloqueada
```

A Fase 3 deve criar o mecanismo de runtime para transformar:

```
approval-required
```

em um pedido formal de decisão humana, permitindo posteriormente:

```
APPROVE
     ↓
RESUME
     ↓
EXECUTE
```

ou:

```
DENY
     ↓
REJECT
     ↓
EXECUTION ENDS
```

O objetivo não é criar uma UI.

O objetivo é criar o protocolo e o estado de aprovação no Runtime.

## 2. Decisão arquitetural

A aprovação humana passa a ser uma entidade explícita do Runtime.

Criar:

```
spectree-runtime/
├── approval/
│   ├── approval-request
│   ├── approval-manager
│   ├── approval-decision
│   ├── approval-store
│   └── approval-errors
```

A arquitetura passa a:

```
                         Agent
                           │
                           ▼
                      AgentLoop
                           │
                           ▼
                      ToolRuntime
                           │
                           ▼
                     PolicyEngine
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
              ALLOW               APPROVAL
                │                     │
                ▼                     ▼
          Capability            ApprovalManager
                                      │
                                      ▼
                                Founder Gate
                                      │
                           ┌──────────┴──────────┐
                           ▼                     ▼
                        APPROVE                DENY
                           │                     │
                           ▼                     ▼
                        RESUME                 REJECT
                           │
                           ▼
                        Tool
```

## 3. Princípio fundamental

A aprovação humana não deve executar a Tool diretamente.

O Founder decide:

"autorizar esta execução"

O Runtime decide:

"como e quando essa execução será retomada"

Portanto:

```
Founder
  ↓
ApprovalDecision
  ↓
ApprovalManager
  ↓
ToolRuntime
  ↓
Tool
```

Nunca:

```
Founder
  ↓
Tool.execute()
```

## 4. O que NÃO implementar

A Fase 3 não deve implementar:

- ❌ Web UI
- ❌ TUI
- ❌ Dashboard
- ❌ Slack integration
- ❌ WhatsApp integration
- ❌ Email approval
- ❌ GitHub approval UI
- ❌ OAuth
- ❌ User identity provider
- ❌ Database persistence
- ❌ Redis
- ❌ Kafka
- ❌ Distributed approval service
- ❌ Sandbox
- ❌ Capability providers reais
- ❌ Orchestrator
- ❌ LLM provider

O Runtime deve permitir que esses componentes sejam adicionados posteriormente.

## 5. Problema que a Fase 3 resolve

Hoje:

```
tool.requested
    ↓
policy.evaluated
    ↓
policy.approval-required
    ↓
PolicyApprovalRequiredError
```

Depois da Fase 3:

```
tool.requested
    ↓
policy.evaluated
    ↓
policy.approval-required
    ↓
approval.requested
    ↓
[PAUSED]
    ↓
Founder Decision
    │
    ├── APPROVE
    │      ↓
    │   approval.approved
    │      ↓
    │   resume
    │      ↓
    │   tool.started
    │      ↓
    │   tool.completed
    │
    └── DENY
           ↓
        approval.denied
           ↓
        execution ends
```

## 6. ApprovalRequest

Criar a entidade:

```
ApprovalRequest
```

Responsabilidade:

representar uma solicitação específica de autorização humana para uma operação bloqueada pela Policy.

Campos mínimos:

```
sessionId
agentId
toolId
capabilityId?
operation
resource
policyId?
reason
requestedAt
status
```

## 7. Approval ID

Cada pedido deve ter:

```
approvalId
```

único e imutável.

O approvalId será o identificador de correlação de todo o ciclo.

Eventos posteriores devem poder ser correlacionados:

```
approval.requested
approval.approved
approval.denied
approval.expired
approval.cancelled
approval.resumed
```

## 8. Approval Lifecycle

Estados mínimos:

- pending
- approved
- denied
- expired
- cancelled
- resumed

Lifecycle permitido:

```
pending
   ├── approved
   ├── denied
   ├── expired
   └── cancelled

approved
   └── resumed
```

Estados terminais:

- denied
- expired
- cancelled
- resumed

Depois de terminal:

nenhuma nova decisão

## 9. Regra de decisão única

Um ApprovalRequest pode receber uma única decisão efetiva.

Exemplo:

```
pending
   ↓
approved
```

qualquer tentativa posterior de:

```
deny
```

deve falhar com:

```
ApprovalStateError
```

Não existe:

```
approved → denied
```

## 10. ApprovalDecision

Criar:

```
ApprovalDecision
```

Campos mínimos:

```
approvalId
decision
decidedAt
decidedBy
reason?
```

Decisões:

- approve
- deny

Não criar:

- maybe
- later
- partial

nesta fase.

## 11. decidedBy

A decisão humana precisa possuir identidade conceitual.

Modelo mínimo:

```
decidedBy:
  type
  id
```

Exemplo:

```
{
  type: 'founder',
  id: 'founder'
}
```

Não implementar ainda autenticação.

O campo existe para:

- audit
- correlation
- future identity provider

## 12. Founder Gate

Criar uma abstração conceitual:

```
FounderGate
```

Mas o Gate não deve ser uma UI.

Ele é o contrato entre:

```
ApprovalManager
```

e o mecanismo externo de decisão humana.

Contrato mínimo:

```
requestApproval(approvalRequest)
```

e:

```
submitDecision(approvalId, decision)
```

Pode ser implementado inicialmente por um InMemoryFounderGate.

## 13. ApprovalManager

O ApprovalManager será o componente central da Fase 3.

Responsabilidades:

- criar ApprovalRequest;
- registrar pedido;
- publicar evento;
- receber decisão;
- validar lifecycle;
- persistir estado através de ApprovalStore;
- emitir eventos;
- sinalizar o mecanismo de resume.

Não executar Tool diretamente.

## 14. ApprovalStore

Criar:

```
ApprovalStore
```

Primeira implementação:

```
InMemoryApprovalStore
```

Responsabilidades:

- create
- get
- update

Não implementar banco.

O contrato precisa permitir futuramente:

- PostgresApprovalStore
- RedisApprovalStore
- SupabaseApprovalStore

sem modificar o ApprovalManager.

## 15. ApprovalStore ≠ SessionStore

Não misturar:

```
ApprovalStore
```

com:

```
SessionStore
```

Uma Session pode conter várias ApprovalRequests.

Exemplo:

```
Session
 ├── approval-001
 ├── approval-002
 └── approval-003
```

## 16. Relação entre Session e Approval

A ApprovalRequest pertence a uma Session:

```
approval.sessionId
```

Ela não substitui a Session.

Durante pending, a Session pode assumir um estado de espera.

## 17. Session lifecycle

A Fase 1 possui:

- created
- running
- completed
- failed
- cancelled

Não alterar esses cinco estados.

Para representar espera por aprovação, não criar um sexto estado permanente chamado waiting-approval.

Em vez disso, o runtime deve usar uma condição operacional externa:

```
Session = running
Approval = pending
```

ou, se a implementação necessitar de pausa explícita, isso deve ser representado por um status de execução interno, não por uma nova Session state.

A razão é preservar o contrato congelado da Fase 1.

## 18. Approval como suspensão de Tool Invocation

A Fase 3 não deve suspender o Agent inteiro.

Ela suspende:

uma Tool Invocation

Exemplo:

```
Agent
 ↓
requestTool(database.migrate)
 ↓
Policy
 ↓
approval-required
 ↓
ApprovalRequest pending
```

O AgentLoop pode:

retornar um resultado de suspensão

em vez de permanecer bloqueado indefinidamente.

## 19. Novo conceito: PendingToolInvocation

Criar uma representação:

```
PendingToolInvocation
```

Ela deve guardar o suficiente para retomar exatamente aquela operação:

```
approvalId
sessionId
agentId
toolId
input
context reference
createdAt
```

Não guardar o objeto Tool diretamente se isso impedir serialização futura.

A intenção é que posteriormente seja possível persistir:

"o que estava aguardando aprovação"

## 20. Regra de segurança do Resume

O resume deve revalidar a autorização.

Fluxo:

```
Approval approved
       ↓
rebuild AuthorizationContext
       ↓
PolicyEngine.decide()
       ↓
ALLOW?
```

Não assumir:

```
approval approved
→ execute blindly
```

Essa é uma regra crítica.

A Policy pode ter mudado entre:

```
approval requested
```

e:

```
approval approved
```

## 21. Policy Revalidation

Na retomada:

```
ALLOW
    ↓
execute

DENY
    ↓
do not execute
```

Se a Policy mudou para:

```
approval-required
```

não reutilizar automaticamente a aprovação anterior.

Criar um novo ciclo ou erro tipado de revalidação.

Preferência desta fase:

```
PolicyRevalidationError
```

e a execução permanece bloqueada.

Não criar loops automáticos.

## 22. Approval expiration

A Fase 3 deve definir a semântica de expiração, mas não precisa de scheduler distribuído.

Cada ApprovalRequest pode possuir:

```
expiresAt?
```

Se não existir:

sem expiração

Para esta fase, o Store pode detectar expiração no momento da leitura/decisão.

Exemplo:

```
pending + now > expiresAt
→ expired
```

Não implementar worker de background.

## 23. Approval cancellation

Se a Session for cancelada:

```
Session.cancel()
```

todas as ApprovalRequests pending associadas podem ser marcadas:

```
cancelled
```

O runtime não pode retomar uma Approval cancelada.

## 24. Regra de concorrência

Duas decisões concorrentes sobre o mesmo ApprovalRequest:

- approve
- deny

devem resultar em exatamente uma vencedora.

A operação deve ser atomicamente protegida pelo ApprovalStore.

Mesmo o InMemoryApprovalStore deve implementar essa garantia logicamente.

Não é necessário lock distribuído ainda.

## 25. Founder Gate e Agent

O Agent não pode:

- approve
- deny

de sua própria ApprovalRequest.

O Approval API não deve ser exposto no:

```
AgentContext
```

O Founder Gate é externo ao Agent.

## 26. Authority Surface

A regra R8 continua obrigatória.

O AgentContext deve continuar contendo somente:

```
session
mission
runtime.requestTool
```

Não adicionar:

- approvalManager
- approvalStore
- founderGate
- approvalRequest

O teste estrutural deve continuar falhando se isso acontecer.

## 27. Eventos

Adicionar os seguintes eventos mínimos:

```
approval.requested
approval.approved
approval.denied
approval.expired
approval.cancelled
approval.resumed
```

Não adicionar ainda:

```
approval.notification.sent
approval.ui.opened
approval.webhook.received
```

Esses pertencem a integrations futuras.

## 28. Evento approval.requested

Payload seguro:

```
approvalId
sessionId
agentId
toolId
capabilityId?
operation
resource
policyId?
reason
expiresAt?
```

Não publicar:

- input
- output
- credentials
- tokens
- secrets

A mesma regra de projeção segura da Fase 2 continua válida.

## 29. Evento approval.approved

Payload:

```
approvalId
sessionId
agentId
decidedBy
decidedAt
reason?
```

## 30. Evento approval.denied

Payload equivalente:

```
approvalId
sessionId
agentId
decidedBy
decidedAt
reason?
```

## 31. Evento approval.resumed

Esse evento significa:

o Runtime reabriu a execução suspensa após aprovação e revalidação.

Payload:

```
approvalId
sessionId
agentId
toolId
resumedAt
```

Não significa que a Tool concluiu.

A sequência correta ainda será:

```
approval.resumed
tool.started
tool.completed
```

## 32. Approval event ordering

Para aprovação:

```
tool.requested
policy.evaluated
policy.approval-required
approval.requested
approval.approved
approval.resumed
tool.started
tool.completed
```

Para rejeição:

```
tool.requested
policy.evaluated
policy.approval-required
approval.requested
approval.denied
```

Nunca:

```
tool.started
tool.completed
```

depois de approval.denied.

## 33. Approval expiration sequence

```
tool.requested
policy.evaluated
policy.approval-required
approval.requested
approval.expired
```

Sem:

```
approval.resumed
tool.started
tool.completed
```

## 34. Cancellation sequence

Se a Session for cancelada enquanto existe approval:

```
approval.requested
session.cancelled
approval.cancelled
```

A ordem entre:

```
session.cancelled
approval.cancelled
```

deve ser definida pelo implementador e documentada.

Mas:

```
approval.cancelled
```

precisa ocorrer antes de qualquer tentativa de resume.

## 35. Approval request snapshot

Um ApprovalRequest deve representar um snapshot da decisão solicitada.

Não referenciar diretamente um objeto mutável da Tool.

Guardar:

```
toolId
capabilityId
operation
resource
policyId
reason
```

de forma imutável.

## 36. Input para Resume

O Runtime deve preservar o input necessário para execução.

Porém:

```
input
```

não deve ser colocado no evento público.

Ele pertence ao estado privado do PendingToolInvocation/ApprovalStore.

Esse estado poderá conter dados sensíveis.

## 37. Secret handling

Não criar secret vault agora.

Mas:

```
Approval event
```

nunca deve transportar o input bruto.

A implementação deve manter:

```
private invocation state
```

separado de:

```
public event projection
```

## 38. ApprovalManager API

Contrato mínimo:

```
request(invocation, decisionContext)
approve(approvalId, actor, reason?)
deny(approvalId, actor, reason?)
cancel(approvalId)
expire(approvalId)
resume(approvalId)
get(approvalId)
```

As APIs devem respeitar o state machine.

## 39. request()

Ao criar:

```
ApprovalRequest
```

o Manager deve:

- criar ID;
- congelar snapshot;
- registrar no Store;
- publicar approval.requested;
- retornar referência ao pending operation.

Não executar Tool.

## 40. approve()

Fluxo:

```
get approval
    ↓
verify pending
    ↓
apply approved
    ↓
store atomically
    ↓
publish approval.approved
```

Não executar Tool diretamente nesta função.

A retomada ocorrerá pelo mecanismo explicitamente definido em resume().

## 41. deny()

Fluxo:

```
get
 ↓
verify pending
 ↓
mark denied
 ↓
store
 ↓
publish approval.denied
```

Nunca chamar Tool.

## 42. resume()

Fluxo obrigatório:

```
get approval
 ↓
verify approved
 ↓
load PendingToolInvocation
 ↓
rebuild context
 ↓
PolicyEngine.decide()
 ↓
ALLOW?
 ├── no → PolicyRevalidationError
 └── yes
       ↓
approval.resumed
       ↓
ToolRuntime.execute approved path
       ↓
tool.started
       ↓
tool.completed
```

Não permitir que resume() pule a Policy.

## 43. Evitar recursão

Cuidado arquitetural:

```
ToolRuntime.execute()
   ↓
Policy approval
   ↓
ApprovalManager.resume()
   ↓
ToolRuntime.execute()
   ↓
Policy approval
```

pode gerar loop.

O implementador deve introduzir um conceito interno de:

```
approved invocation
```

mas sem criar um bypass público.

Uma opção aceitável:

```
ToolRuntime.executeAuthorized(invocation)
```

método privado/internal-only, chamado apenas após revalidação:

```
Policy == allow
```

Esse método nunca deve ser exposto ao Agent.

## 44. Regra de bypass

É proibido criar:

```
ToolRuntime.executeWithoutPolicy()
```

ou:

```
ToolRuntime.executeUnsafe()
```

ou equivalentes.

Mesmo o caminho de resume precisa passar por Policy.

## 45. ApprovalStore consistency

O Store deve impedir:

```
pending → approved
pending → denied
```

simultaneamente.

Uma operação que perca a corrida deve receber:

```
ApprovalStateError
```

e não sobrescrever a decisão vencedora.

## 46. Idempotência

approve() deve ser idempotente apenas no sentido seguro:

```
approved + approve same decision
```

pode retornar o estado existente.

Mas:

```
approved + deny
```

deve falhar.

Da mesma maneira:

```
denied + deny
```

pode ser tratado como idempotência opcional.

Documentar a decisão.

## 47. Approval expiration race

Se:

```
approve()
```

e:

```
expire()
```

ocorrerem simultaneamente, uma única transição deve vencer.

Depois de:

```
approved
```

expire() não pode transformar em expired.

## 48. Approval cancellation race

Se:

```
approve()
```

e:

```
session.cancel()
```

concorrem, a operação que alterar o estado primeiro vence.

Se cancelled vencer:

não resume.

Se approved vencer antes:

resume ainda precisa verificar Session cancellation

antes da execução.

Session cancellation sempre deve ter autoridade final sobre execução.

## 49. Founder Gate interface

Criar uma abstração para integração futura:

```
FounderGate
```

Mas o Runtime não deve assumir onde a decisão humana acontece.

Possíveis futuros consumidores:

- Invoker CLI
- ChatGPT
- TUI
- Web UI
- Slack
- WhatsApp
- Dashboard

Todos conversariam com o mesmo ApprovalManager.

## 50. InMemoryFounderGate

Para testes:

```
InMemoryFounderGate
```

pode expor:

```
approve(approvalId)
deny(approvalId)
```

Não simular uma "pessoa" via LLM.

A aprovação dos testes precisa ser determinística.

## 51. Founder Gate ≠ Founder identity

Não assumir:

```
decidedBy.id === "founder"
```

como regra de segurança permanente.

Nesta fase o identificador é metadata.

A autenticação/autorização do decisor será responsabilidade futura.

## 52. Security boundary

A aprovação é um security boundary.

Logo:

```
approvalId
```

deve estar vinculado a:

```
sessionId
toolId
operation
resource
```

O decisor não pode dizer simplesmente:

```
approve
```

para uma operação diferente.

O ApprovalRequest já é o objeto que define exatamente o que está sendo aprovado.

## 53. No approval substitution

Uma ApprovalRequest não pode ser usada para autorizar outra operação.

Exemplo:

```
approval A:
database.query development
```

não pode ser utilizada para:

```
database.migrate production
```

O PendingToolInvocation deve estar vinculado ao approvalId.

## 54. Revalidation de resource

Durante resume:

```
resource
```

deve ser reconstruído novamente através da mesma regra da Fase 2:

```
Tool metadata
+
same input
```

Não utilizar:

```
resource
```

recebido externamente no momento do resume.

Isso preserva o anti-spoofing R9.

## 55. Revalidation de input

A retomada deve executar usando o input original do PendingToolInvocation.

Não permitir que o Founder envie um novo input como parte de:

```
approve
```

A decisão humana autoriza:

a operação específica solicitada

Não altera a operação.

## 56. Approval UI independence

O ApprovalManager não deve produzir:

- HTML
- JSON específico de UI
- terminal formatting

Ele deve produzir entidades e eventos do Runtime.

## 57. Observabilidade

Os eventos devem permitir reconstruir:

- quem solicitou
- o quê
- qual política exigiu aprovação
- qual recurso
- quando
- quem decidiu
- qual decisão
- se foi retomado

Isso é necessário para futura auditoria.

## 58. Event sequence — cenário completo

Teste principal:

```
tool.requested
policy.evaluated
policy.approval-required
approval.requested
approval.approved
approval.resumed
tool.started
tool.completed
```

A igualdade dessa sequência deve ser verificada.

## 59. Cenário de deny

```
tool.requested
policy.evaluated
policy.approval-required
approval.requested
approval.denied
```

Provar:

```
Tool.execute() === 0
```

## 60. Cenário de expiry

```
tool.requested
policy.evaluated
policy.approval-required
approval.requested
approval.expired
```

Provar:

```
Tool.execute() === 0
```

## 61. Cenário de cancellation

```
tool.requested
policy.evaluated
policy.approval-required
approval.requested
session.cancelled
approval.cancelled
```

Provar:

```
resume() → rejected
Tool.execute() === 0
```

## 62. Cenário de policy revalidation failure

Inicialmente:

```
approval-required
```

Founder:

```
approve
```

Antes do resume, policy muda para:

```
deny
```

Resultado:

```
approval.approved
PolicyRevalidationError
Tool.execute() === 0
```

Nenhum:

```
tool.started
```

deve acontecer.

## 63. Cenário de approval replay

Após:

```
approval.denied
```

tentar:

```
resume(approvalId)
```

deve falhar.

Após:

```
approval.resumed
```

tentar novamente:

```
resume(approvalId)
```

deve falhar ou ser explicitamente idempotente sem reexecutar a Tool.

Preferência:

```
ApprovalStateError
```

para evitar execução duplicada.

## 64. Teste de superfície do Agent

Continuar exigindo:

```
Object.keys(context)
  === ['mission', 'runtime', 'session']

Object.keys(context.runtime)
  === ['requestTool']
```

A presença de Founder Gate não pode alterar isso.

## 65. Teste de bypass

Criar teste que confirme que não existem no AgentContext:

- approve
- deny
- requestApproval
- approvalManager
- founderGate

A superfície continua exatamente a mesma.

## 66. Teste de aprovação concorrente

Duas chamadas:

```
approve(A)
deny(A)
```

devem produzir apenas uma transição válida.

Verificar:

um único evento terminal

e nenhuma execução duplicada.

## 67. Teste de resume único

Depois de aprovação:

```
resume()
```

executa a Tool uma vez.

Segunda chamada:

```
resume()
```

não executa novamente.

## 68. Teste de segredo

Repetir o padrão da Fase 2:

```
input:
  apiKey = super-secret
```

Verificar que:

```
approval.requested
```

não contém:

```
super-secret
```

O evento deve expor apenas metadata segura.

## 69. Teste de resource spoofing durante approval

Criar:

```
Tool actual resource:
production

request.resource:
development
```

A ApprovalRequest deve capturar:

```
production
```

Nunca:

```
development
```

## 70. Teste de snapshot

Depois de criar ApprovalRequest:

alterar Tool metadata

não pode alterar retroativamente:

```
approval.resource
approval.toolId
approval.operation
```

O pedido é snapshot imutável.

## 71. Teste de session isolation

Criar:

```
Session A → approval A
Session B → approval B
```

Executar decisões intercaladas.

Provar:

```
A não pode resumir B
B não pode resumir A
```

## 72. Tipos de erro

Adicionar pelo menos:

- ApprovalError
- ApprovalStateError
- ApprovalNotFoundError
- ApprovalExpiredError
- PolicyRevalidationError

Evitar erros genéricos.

## 73. ApprovalNotFound

Qualquer:

- approve
- deny
- resume
- cancel

para ID inexistente deve gerar:

```
ApprovalNotFoundError
```

e nenhum evento de aprovação.

## 74. Expired approval

Se uma Approval estiver expirada:

```
approve()
```

deve falhar.

O Runtime não deve permitir ressuscitar:

```
expired → approved
```

## 75. Cancelled approval

Da mesma forma:

```
cancelled → approved
```

não permitido.

## 76. ApprovalStore API

Contrato mínimo:

```
create(request)
get(id)
transition(id, expectedState, nextState, metadata)
```

A operação transition() deve ser preferida a:

```
update(object)
```

porque força a validação da máquina de estados.

## 77. Estado privado vs estado público

Separar:

```
ApprovalRecord
```

de:

```
ApprovalEventProjection
```

O Record pode conter:

```
pending invocation
input
```

mas o Event Projection não.

Isso preserva a arquitetura de redaction da Fase 2.

## 78. Persistence seam

O ApprovalStore deve ser injetável:

```
ApprovalManager(store)
```

O Manager não deve importar diretamente uma implementação concreta.

## 79. FounderGate injection

Também injetável:

```
ApprovalManager(
  store,
  founderGate,
  eventBus
)
```

A implementação pode usar:

```
InMemoryFounderGate
```

nos testes.

## 80. No polling obrigatório

O Runtime não precisa implementar:

```
while pending:
  check approval
```

A aprovação deve ser orientada por evento/comando.

Isso evita loops ativos e prepara futura integração distribuída.

## 81. Resume mechanism

O ApprovalManager deve possuir um seam para:

```
resume(approvalId)
```

mas não precisa manter threads bloqueadas.

A implementação pode retornar:

```
ApprovalPending
```

ao AgentLoop e encerrar a tentativa atual.

Quando o Founder aprovar, o controlador externo poderá chamar:

```
resume(approvalId)
```

## 82. Runtime não espera indefinidamente

Não fazer:

```
await human decision forever
```

no AgentLoop.

Essa decisão é importante para futuro runtime distribuído.

O AgentLoop deve conseguir liberar o processo atual.

## 83. Session restart readiness

Mesmo sem persistência nesta fase, o desenho deve permitir:

```
process stopped
↓
ApprovalStore restored
↓
resume(approvalId)
```

Isso não precisa ser demonstrado com banco.

Mas o contrato não pode depender de closure ou Promise mantida eternamente na memória.

## 84. No hidden Promise

Não implementar:

```
new Promise(resolve => pendingApprovals.set(id, resolve))
```

como único mecanismo de Approval.

Isso impediria persistência futura e reinício de processo.

A decisão precisa ser representada por estado explícito.

## 85. Relation to future EventStore

Os eventos:

```
approval.requested
approval.approved
approval.denied
approval.expired
approval.cancelled
approval.resumed
```

devem ser suficientes para reconstruir o lifecycle de aprovação posteriormente.

A Fase 3 não implementa EventStore.

## 86. Relation to future UI

Uma UI futura deverá conseguir:

- listar pending approvals
- mostrar contexto seguro
- approve
- deny

apenas consumindo:

- ApprovalManager
- ApprovalStore
- EventBus

Não deverá precisar falar com ToolRuntime diretamente.

## 87. Founder Gate authorization

Não implementar autorização do decisor ainda.

Mas registrar o seam:

```
FounderGate.authorizeDecision(actor, approval)
```

poderá existir no futuro.

Na Fase 3:

```
InMemoryFounderGate
```

pode aceitar qualquer actor de teste explicitamente fornecido.

## 88. Rule: human decision is not policy

Uma aprovação humana não altera a Policy.

Exemplo:

```
Policy = approval-required
Founder = approve
```

significa:

"uma exceção operacional foi autorizada"

Não significa:

"Policy agora virou allow"

A Policy continua sendo a fonte de autorização normativa.

## 89. Rule: approval is scoped

Uma aprovação vale apenas para:

uma ApprovalRequest

não para:

- agente
- tool
- capability
- resource

genericamente.

Nunca implementar:

```
approve("oracle", "database")
```

como autorização permanente.

## 90. Rule: no approval inheritance

Uma aprovação não deve ser herdada por:

- nova Session
- novo Agent
- nova Tool invocation

Cada operação de risco deve ter seu próprio ApprovalRequest.

## 91. Definition of Done

A Fase 3 só poderá ser declarada DONE quando:

- ApprovalRequest existir.
- ApprovalDecision existir.
- ApprovalManager existir.
- ApprovalStore existir.
- InMemoryApprovalStore existir.
- FounderGate existir como seam.
- InMemoryFounderGate existir para testes.
- Approval state machine estiver implementada.
- apenas uma decisão efetiva for aceita.
- approval-required criar ApprovalRequest.
- Tool não executar enquanto pending.
- approve não executar Tool diretamente.
- deny impedir execução.
- resume revalidar Policy.
- resume revalidar Session cancellation.
- resource ser recalculado através da Tool.
- input original ser utilizado na retomada.
- nenhuma nova entrada ser fornecida pelo Founder.
- eventos de Approval existirem.
- eventos não conterem input/output sensíveis.
- dois Approvals puderem coexistir.
- concorrência de decisão ser protegida.
- replay de approve não executar duas vezes.
- approval cancelado não poder ser retomado.
- approval expirado não poder ser retomado.
- AgentContext permanecer estruturalmente idêntico.
- Fases 1 e 2 permanecerem compatíveis.
- npm test passar.
- claude plugin validate . --strict passar.
- exemplo executável demonstrar approve/deny/resume.
- documentação arquitetural atualizada.
- nenhuma UI ou provider real for introduzido.

## 92. Definition of Architecture Done

A arquitetura estará pronta quando conseguirmos provar:

```
Policy
 ↓
approval-required
 ↓
ApprovalRequest
 ↓
Founder approve
 ↓
Policy revalidation
 ↓
ALLOW
 ↓
Tool execution
```

e:

```
Policy
 ↓
approval-required
 ↓
Founder deny
 ↓
NO EXECUTION
```

e:

```
Policy
 ↓
approval-required
 ↓
approval approved
 ↓
Policy changed
 ↓
DENY
 ↓
NO EXECUTION
```

O terceiro teste é obrigatório porque comprova que a aprovação humana não é um bypass da Policy Engine.

## 93. Matriz de transições

- Estado atual
  Operação
  Resultado
- pending
  approve
  approved
- pending
  deny
  denied
- pending
  expire
  expired
- pending
  cancel
  cancelled
- approved
  resume
  resumed
- approved
  approve
  idempotente ou estado existente
- approved
  deny
  ApprovalStateError
- denied
  resume
  ApprovalStateError
- expired
  approve
  ApprovalStateError
- cancelled
  approve
  ApprovalStateError
- resumed
  resume
  ApprovalStateError

## 94. Invariantes da Fase 3

- **INV-301**
  ApprovalRequest representa exatamente uma Tool Invocation bloqueada.

- **INV-302**
  Uma ApprovalRequest possui uma única decisão efetiva.

- **INV-303**
  Approve nunca executa Tool diretamente.

- **INV-304**
  Deny nunca executa Tool.

- **INV-305**
  Resume sempre revalida Policy.

- **INV-306**
  Resume sempre verifica Session cancellation.

- **INV-307**
  Resume utiliza o input original.

- **INV-308**
  Resume recalcula Resource usando a Tool e o input original.

- **INV-309**
  Founder não pode alterar Tool, input ou resource através da decisão.

- **INV-310**
  Approval não altera Policy.

- **INV-311**
  Approval não concede permissão permanente.

- **INV-312**
  Approval não é herdado por outra execução.

- **INV-313**
  Agent não possui acesso ao ApprovalManager.

- **INV-314**
  Agent não possui acesso ao FounderGate.

- **INV-315**
  Approval events não carregam dados secretos.

- **INV-316**
  Uma decisão concorrente não pode produzir dois estados vencedores.

- **INV-317**
  Uma Tool pode ser executada no máximo uma vez por PendingToolInvocation aprovada.

- **INV-318**
  Nenhum caminho de resume pode contornar PolicyEngine.

- **INV-319**
  A Session state machine da Fase 1 permanece inalterada.

- **INV-320**
  A superfície de autoridade do Agent permanece estruturalmente congelada.

## 95. Exemplo mínimo obrigatório

Criar um exemplo:

```
Agent:
oracle

Tool:
database.migrate

Resource:
database/production

Policy:
approval-required
```

Executar:

```
requestTool()
```

Resultado:

```
ApprovalRequest pending
Tool.execute() = 0
```

Founder:

```
approve()
```

Runtime:

```
revalidate policy
→ allow
resume
→ tool.started
→ tool.completed
```

Segundo cenário:

```
Founder deny
```

Resultado:

```
Tool.execute() = 0
```

Terceiro cenário:

```
Founder approve
Policy changed to deny
```

Resultado:

```
PolicyRevalidationError
Tool.execute() = 0
```

## 96. Handoff obrigatório

O Opus 5 deverá entregar:

```
## Implementation

arquivos criados/modificados

## Approval State Machine

diagrama

## Approval Lifecycle

diagrama

## Founder Gate

contrato + implementação de teste

## Resume

fluxo completo

## Policy Revalidation

prova

## Event Sequence

approve / deny / expire / cancel

## Concurrency

resultado dos testes

## Security

resource + input + event projection

## Authority Surface

teste estrutural

## Tests

comando + resultado

## Known Limitations

limitações reais

## Scope Verification

confirmar ausência de UI,
providers, sandbox e persistence externa
```

## 97. Regra de ouro da Fase 3

A aprovação humana nunca deve criar uma segunda autoridade de execução.

Existe apenas uma autoridade normativa:

```
PolicyEngine
```

O Founder Gate fornece:

decisão humana

E o Runtime combina as duas:

```
Policy
+
Human Approval
=
Authorized Invocation
```

Mas apenas quando:

```
Policy revalidation == ALLOW
```

## 98. Resultado estratégico

Ao final da Fase 3, o Spectree terá:

```
SQUAD
  ↓
identidade

RUNTIME CORE
  ↓
execução

POLICY
  ↓
autoridade normativa

FOUNDER GATE
  ↓
autoridade humana excepcional

CAPABILITY
  ↓
capacidade operacional

PROVIDER
  ↓
execução física futura
```

O fluxo completo passará a ser:

```
                Agent
                  │
                  ▼
             ToolRuntime
                  │
                  ▼
              Policy
                  │
        ┌─────────┴─────────┐
        │                   │
      ALLOW             APPROVAL
        │                   │
        ▼                   ▼
   Capability         ApprovalRequest
        │                   │
        │              Founder Decision
        │                   │
        │          ┌────────┴────────┐
        │          ▼                 ▼
        │       APPROVE             DENY
        │          │                 │
        │          ▼                 ▼
        │    Policy Revalidation   STOP
        │          │
        └──────────┤
                   ▼
              Capability
                   │
                   ▼
                Provider
```

A propriedade fundamental desta fase é:

o Founder pode autorizar a execução de uma operação específica, mas nunca bypassar o Runtime.

Essa é a fundação necessária antes de colocarmos ferramentas reais de infraestrutura atrás do Spectree.
