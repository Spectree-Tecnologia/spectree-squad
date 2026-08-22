---
status: in-review
owner: TechLeader
depends_on: F1 Runtime Core (docs/spec/RUNTIME-F01-runtime-core.md)
---

# Spectree Runtime v2 — F02 Policy Engine + Capability Contract

> Transcrição da especificação normativa da Fase 2, produzida no harness de
> planejamento do Founder (declarado na fonte: `Status: APPROVED FOR
> IMPLEMENTATION`, `Owner: TechLeader`). O texto é o do documento fonte, sem
> correção, melhoria ou complemento. O texto commitado é o contrato real (ver
> `docs/spec/README.md`).
>
> **Duas fontes; esta é a que vale.** A primeira versão deste arquivo nasceu de
> uma exportação achatada do documento original — o transporte dissolveu blocos
> de código em prosa e em listas, e a marcação foi reconstruída por inferência.
> A versão atual vem do documento colado íntegro pelo Founder no chat em
> 2026-08-21, com a marcação original preservada, transportada e verificada
> seção a seção: 75 seções contíguas de 1 a 75, `INV-201` a `INV-215` presentes
> e únicos, 400 linhas de cerca contra 292 na versão achatada.
>
> **A perda medida: marcação no corpo, conteúdo na cauda.** Nas seções 1 a 75,
> nenhuma linha de texto se perdeu na exportação achatada — o dano foi
> exclusivamente de marcação: blocos rebaixados a prosa ou a bullets, a matriz
> de decisão da §71 achatada em lista, as enumerações ordenadas das §24, §27 e
> §28 rebaixadas, e cinco títulos inferidos que a fonte não tem (`### DENY`,
> `### APPROVAL`, `### ALLOW` na §46; `### Antes`, `### Depois` na §74).
> Nenhum `INV-` e nenhuma seção mudou de sentido. Fora do corpo numerado,
> porém, faltava **conteúdo**: a seção `Review do TechLeader — REQUEST
> CHANGES`, com o pacote de correção que define `R9`, `R10` e `R11`, não
> existia neste arquivo.
>
> **Onde o review vive, e por quê.** Fica aqui, ao final e fora da numeração
> normativa. O `docs/spec/README.md` declara `TechLeader Review` como etapa do
> processo da fase, e esta é a rodada de correção que emendou este contrato
> antes do merge — não é uma decisão tomada fora do documento. `R9`, `R10` e
> `R11` são load-bearing: o código os cita pelo identificador
> (`spectree-runtime/tools/tool-runtime.js`,
> `spectree-runtime/providers/local/filesystem-provider.js`,
> `spectree-runtime/approval/approval-manager.js`, `hooks/guard.mjs`), e as
> specs F03, F04 e F07 e o `ADR-04` derivam deles. Das regras `R1` a `R14`
> citadas no código, só o `R8` tinha definição em disco (§4, P-007); estas três
> são as primeiras órfãs a ganhar a sua. Qualquer outro endereço — ADR próprio
> ou arquivo de review separado — poria a definição de `R9` onde nem o
> comentário do código nem as specs irmãs apontam. O review não é corpo
> normativo: é o registro da rodada que mudou o corpo.
>
> **Contradição registrada, não resolvida: `R9` contra a §22.** A §22 cria o
> seam como `resolveResource(request, context)`. O `R9` manda remover
> `request.resource` como autoridade e resolver o recurso a partir da
> Tool/Capability — e é o `R9` que o Runtime implementa:
> `spectree-runtime/tools/tool-runtime.js` traz `#resolveResource(tool, input)`
> com o comentário "Nunca do request (R9)", e
> `spectree-runtime/tests/review-r9-r11.test.js` prova que um `request.resource`
> forjado é ignorado e que o Agent não transforma `production` em
> `development`. A assinatura que a §22 nomeia não existe no Runtime. A §7
> **não** está em contradição: o `resource` continua dentro do
> `AuthorizationContext` exatamente como o código o monta — o `R9` mudou de
> onde o valor vem, não se ele existe. O `INV-214` já dizia "quando a Tool o
> declarar" e sobrevive intacto ao `R9`. O corpo é do Founder e não foi
> reescrito: a contradição fica registrada aqui, restrita a uma assinatura na
> §22.
>
> **A cauda chega truncada.** O trecho do review começa em "Mas é uma correção
> pequena..." — o achado que precede essa frase não veio no que o Founder
> colou. O que existe foi transportado como está; completar não é ato de
> transcrição.
>
> Divergência deliberada de forma em relação à `RUNTIME-F01`: os `INV-` desta
> fase aparecem como a fonte os traz (linha do identificador, linha do texto),
> sem o bullet em negrito que a versão achatada inferiu. Identificadores e
> sentenças são os mesmos, byte a byte.
>
> `status:` rebaixado a `in-review` nesta edição: substituir o corpo pelo texto
> fiel à fonte íntegra e acrescentar uma seção ausente é emenda substantiva
> (ADR-10, decisão 5).
>
> **A procedência, descida do cabeçalho para o corpo** (decisão 13 da
> `docs/adr/ADR-10-repository-memory-system.md`: o cabeçalho carrega o que o
> git não sabe, e nada além; *quando* o Founder aprovou é pergunta do
> `git log`). Os campos `updated:` e `approved:` saíram deste cabeçalho, e o
> que eles registravam fica aqui: aprovação em 2026-08-19, pelo merge do
> **PR #9** em `main` — squash `c55d5e6`, tag `v0.17.0`; e transcrição do texto
> para este repositório em 2026-08-21, com equivalência de conteúdo medida
> linha a linha — a transcrição restaurou marcação, não alterou conteúdo, e é
> por isso que o `updated:` registrava a data do **conteúdo**, não a do
> arquivo. Junto com o campo morreria a ressalva que mais importa aqui: aquela
> equivalência **deixou de valer para este arquivo**, porque houve conteúdo
> acrescentado (a seção de review, acima) — e por isso a aprovação de
> 2026-08-19 não cobre o que está agora neste texto. O commit e a tag o
> `git log` sabe; o ato de transcrição, a equivalência medida e o alcance da
> aprovação, não — eles descem em vez de sumir.

- Implementador: Agente Opus 5
- Baseline: Spectree Runtime v2 — Fase 1 congelada
- Versão atual de referência: v0.16.0
- Objetivo: transformar autorização de ferramenta em enforcement do Runtime e estabelecer a primeira fronteira formal entre Policy, Capability e Tool Provider.

## 1. Contexto

A Fase 1 criou o Runtime Core com cinco primitivas:

```
Agent
AgentLoop
ToolRuntime
Session
EventBus
```

O ToolRuntime.execute(request, context) é hoje o choke point único através do qual um Agent solicita execução de ferramenta. O context já carrega session e agentId, e a documentação do Runtime identifica explicitamente esse ponto como o seam para uma futura Policy Engine.

O Squad continua sendo a autoridade sobre quem cada agente é. O Runtime passa agora a ser a autoridade sobre o que esse agente está autorizado a executar.

A Fase 2 deve estabelecer:

```
Agent
  ↓
AgentLoop
  ↓
ToolRuntime
  ↓
PolicyEngine
  ↓
Capability
  ↓
Provider / Tool
```

A regra central desta fase é:
Permissão deixa de ser uma instrução de prompt e passa a ser uma decisão executável do Runtime.

## 2. Objetivo da Fase

Implementar:

```
spectree-runtime/
├── policy/
│   ├── PolicyEngine
│   ├── Policy
│   ├── PolicyDecision
│   └── policy errors
│
└── capabilities/
    ├── Capability
    ├── CapabilityRegistry
    └── CapabilityResolver
```

e integrar a Policy ao ToolRuntime.execute() sem modificar o contrato das cinco primitivas congeladas da Fase 1.

A Fase 2 deve permitir responder, de forma determinística:

```
"Este agente pode executar esta operação sobre este recurso,
nesta sessão, neste contexto?"
```

A resposta deve ser uma decisão do Runtime:

```
allow
deny
approval-required
```

## 3. O que NÃO é objetivo desta fase

Não implementar ainda:

```
❌ Sandbox
❌ Orchestrator
❌ Dynamic Agent Selection
❌ LLM Provider
❌ SessionStore
❌ EventStore
❌ Git provider
❌ GitHub provider
❌ Database provider
❌ Browser provider
❌ MCP provider
❌ Network isolation
❌ Secret manager
❌ Distributed policy service
❌ UI de aprovação
❌ Dashboard
❌ Policy editor
```

A Fase 2 deve criar apenas os contratos e o enforcement local.

## 4. Princípios normativos

### P-001 — Default Deny

Se nenhuma regra aplicável autorizar uma operação:

```
DENY
```

Nunca:

```
ALLOW
```

por ausência de regra.

### P-002 — Policy precede execução

A ordem obrigatória é:

```
resolve tool
    ↓
validate input
    ↓
build authorization context
    ↓
PolicyEngine.decide()
    ↓
ALLOW?
   ├── não → bloquear
   └── sim → executar
```

A Tool nunca inicia execução antes da decisão da Policy.

### P-003 — Policy não executa Tool

A Policy responde:

```
allow
deny
approval-required
```

Ela não executa:

```
filesystem
shell
git
database
browser
```

### P-004 — Tool não decide autorização

A Tool não pode possuir lógica como:

```
if (agent === "oracle") ...
```

ou:

```
if (session.role === "admin") ...
```

Essa responsabilidade pertence à Policy.

### P-005 — Persona não é autorização

O nome do agente:

```
Oracle
Jakiro
Disruptor
Keeper
```

não constitui autoridade por si só.
A identidade pode ser input da Policy, mas não pode ser implicitamente interpretada como permissão.

### P-006 — Capability não é Policy

Capability representa:

```
o que o Runtime sabe executar.
```

Policy representa:

```
quem pode executar o quê.
```

Não misturar os dois conceitos.

### P-007 — Teste estrutural de autoridade

Sempre que um contrato expuser uma superfície limitada de autoridade, essa superfície deverá possuir teste por:

```
Object.keys(actual)
```

ou equivalente estrutural.
Não aceitar apenas testes como:

```
expect(context.emit).toBeUndefined()
```

O padrão R8 da Fase 1 é obrigatório.

## 5. Modelo conceitual

A Fase 2 estabelece quatro conceitos:

```
Principal
   ↓
AuthorizationContext
   ↓
PolicyEngine
   ↓
PolicyDecision
```

e:

```
Capability
   ↓
Capability implementation/provider
```

A relação entre eles:

```
                         Agent
                           │
                           ▼
                   AuthorizationContext
                           │
                           ▼
                    PolicyEngine
                           │
                ┌──────────┴──────────┐
                │                     │
             ALLOW                DENY / APPROVAL
                │
                ▼
           Capability
                │
                ▼
             Provider
```

## 6. Principal

Criar uma abstração mínima para representar o ator que solicita a execução.
O Runtime deve identificar o principal por:

```
principal.id
```

Neste estágio, o Agent é o principal.
Exemplo:

```
principal:
  type: agent
  id: jakiro
```

Não criar ainda usuários, grupos ou roles complexos.
O contrato deve, contudo, permitir futuros tipos:

```
agent
human
service
system
```

sem reescrever o PolicyEngine.

## 7. AuthorizationContext

Criar um objeto explícito para a decisão.
Modelo mínimo:

```
AuthorizationContext
    principal
    session
    tool
    operation
    input
    resource
```

Exemplo:

```
{
  principal: {
    type: 'agent',
    id: 'oracle'
  },
  session: {
    id: 'sess_123'
  },
  tool: {
    id: 'database.query'
  },
  operation: 'execute',
  input: {
    query: '...'
  },
  resource: {
    type: 'database',
    id: 'production'
  }
}
```

## 8. Regra importante sobre input

O input pode ser usado pela Policy.
Porém, a Policy deve receber apenas o mínimo necessário para a decisão.
O Runtime não deve assumir que todo input de Tool é seguro para ser replicado em logs/eventos.
A Policy deve operar sobre o contexto de autorização.
A projeção de eventos continua sendo responsabilidade do seam criado na Fase 1.

## 9. Operation

A Fase 2 deve separar:

```
Tool ID
```

de:

```
Operation
```

Exemplo:

```
toolId:
filesystem
operation:
read
```

ou:

```
toolId:
git
operation:
push
```

ou:

```
toolId:
database
operation:
migration
```

Por enquanto, ToolRuntime continuará compatível com o contrato da Fase 1.
Quando não houver uma operação explícita no request, utilizar:

```
operation = execute
```

como default.
Isso evita quebrar o AgentLoop atual.

## 10. Resource

Capability e Policy precisam de um conceito de recurso.
Um recurso deve ser identificável por:

```
resource.type
resource.id
```

Exemplos conceituais:

```
filesystem / workspace
filesystem / arbitrary-path
database / development
database / production
git / repository
github / repository
browser / current-page
```

Não implementar os providers acima agora.
Criar apenas o contrato.

## 11. Policy

Uma Policy é uma regra declarativa.
Modelo:

```
Policy
    id
    effect
    principals
    operations
    resources
    tools
    priority?
```

Onde:

```
effect:
  allow
  deny
  approval-required
```

Uma Policy não executa código da Tool.

## 12. PolicyDecision

O PolicyEngine deve retornar uma decisão explícita.
Modelo mínimo:

```
PolicyDecision
    effect
    policyId?
    reason
```

Exemplo:

```
{
  effect: 'allow',
  policyId: 'policy-oracle-db',
  reason: 'agent oracle is authorized to execute database operations'
}
```

Deny:

```
{
  effect: 'deny',
  policyId: 'default-deny',
  reason: 'no policy grants this operation'
}
```

Approval:

```
{
  effect: 'approval-required',
  policyId: 'production-migration',
  reason: 'production migration requires human approval'
}
```

## 13. Policy precedence

A avaliação deve ser determinística.
Nesta fase utilizar:

```
explicit deny
    >
approval-required
    >
explicit allow
    >
default deny
```

Portanto:

```
DENY sempre vence ALLOW.
```

Exemplo:

```
Policy A → allow database.*
Policy B → deny database.production
```

Resultado:

```
database.production → DENY
```

Não implementar negociação ou heurística.

## 14. Priority

A implementação pode suportar priority, mas isso não deve substituir a regra de segurança:

```
deny > approval-required > allow
```

Priority pode resolver empate ou seleção de regra, mas não pode transformar um deny explícito em allow.

## 15. Default Deny

Se:

```
nenhuma policy corresponde
```

o resultado obrigatório é:

```
{
  effect: 'deny'
}
```

Esse teste deve existir explicitamente.

## 16. PolicyEngine

Contrato mínimo:

```
PolicyEngine
    decide(context) -> PolicyDecision
```

Opcionalmente:

```
PolicyEngine
    addPolicy(policy)
    removePolicy(id)
    listPolicies()
```

A implementação da Fase 2 pode utilizar um registry em memória.
Não implementar persistência.

## 17. PolicyRegistry

Criar um registry separado da avaliação.
Conceito:

```
PolicyRegistry
      ↓
Policies
      ↓
PolicyEngine
```

Isso evita misturar:

```
storage/configuration
```

com:

```
authorization logic
```

No futuro o registry poderá ser alimentado por:

```
config file
database
remote policy provider
```

sem alterar o PolicyEngine.

## 18. Capability

Criar a abstração:

```
Capability
```

Capability descreve uma capacidade operacional que o Runtime pode oferecer.
Modelo mínimo:

```
Capability
    id
    name
    description
    operations
```

Exemplo:

```
Capability:
  id: filesystem
  operations:
    - read
    - write
    - delete
```

Capability não contém autorização.

## 19. CapabilityRegistry

Criar:

```
CapabilityRegistry
```

para registrar capabilities disponíveis.
API conceitual:

```
register(capability)
resolve(id)
has(id)
list()
```

O registry deve rejeitar IDs duplicados.

## 20. Capability ≠ Tool

Manter explícita a diferença.
Capability:

```
filesystem
```

Tools:

```
filesystem.read
filesystem.write
```

ou:

Capability:

```
database
```

Tools:

```
database.query
database.migrate
database.seed
```

Uma Capability representa uma família de capacidade.
Uma Tool representa uma operação executável concreta.

## 21. Tool → Capability

Toda Tool deve poder declarar:

```
capability
```

Exemplo:

```
{
  id: 'database.migrate',
  capability: 'database',
  ...
}
```

O campo pode ser opcional inicialmente para compatibilidade.
Se a Tool não declarar Capability:

```
capability = tool.id
```

como fallback temporário.
Isso permitirá migrar progressivamente as Tools existentes.

## 22. Resource Resolver

Não construir um sistema complexo de resolução de recursos nesta fase.
Criar apenas um seam:

```
resolveResource(request, context)
```

que produza:

```
resource.type
resource.id
```

A primeira implementação pode utilizar metadata declarada pela Tool.
Não inferir recursos complexos a partir de strings arbitrárias.

## 23. Integração com ToolRuntime

O contrato existente deve continuar sendo:

```
execute(request, context)
```

como definido na Fase 1.
A evolução será internamente:

```
execute()
   │
   ├── resolve tool
   ├── validate input
   ├── build authorization context
   ├── policy.decide()
   │
   ├── DENY → reject
   ├── APPROVAL → reject com ApprovalRequired
   │
   └── ALLOW
         ↓
       execute tool
```

## 24. Ordem exata de execução

O algoritmo mínimo deve ser:

```
1. receber request
2. resolver Tool
3. validar input
4. construir AuthorizationContext
5. resolver Capability
6. resolver Resource
7. PolicyEngine.decide(context)
8. publicar decisão de policy
9. se deny → bloquear
10. se approval-required → bloquear
11. se allow → emitir tool.started
12. executar Tool
13. emitir tool.completed
```

A execução física deve ser impossível antes da decisão.

## 25. Eventos da Policy

Adicionar:

```
policy.evaluated
policy.denied
policy.approval-required
```

Não é necessário publicar policy.allowed separadamente caso:

```
policy.evaluated
```

já carregue:

```
effect=allow
```

Preferência:

```
policy.evaluated
```

para todas as decisões.
E adicionalmente:

```
policy.denied
policy.approval-required
```

para decisões que interrompem execução.

## 26. Event payload

Os eventos de Policy devem conter:

```
sessionId
agentId
policyId?
effect
toolId
operation
resource
reason
```

Nunca publicar automaticamente:

```
input completo
credentials
secrets
tool output
```

O Runtime deve manter a separação de projeção criada na Fase 1.

## 27. Approval Required

A Fase 2 não implementará aprovação humana.
Quando a Policy retornar:

```
approval-required
```

o ToolRuntime deve:

```
1. publicar policy.evaluated
2. publicar policy.approval-required
3. NÃO executar a Tool
4. retornar/lançar erro tipado
```

Criar:

```
PolicyApprovalRequiredError
```

Esse erro será consumido numa fase futura pelo Founder Gate / Approval Service.

## 28. Denied

Quando a Policy retornar:

```
deny
```

o ToolRuntime deve:

```
1. publicar policy.evaluated
2. publicar policy.denied
3. NÃO executar a Tool
4. lançar PolicyDeniedError
```

O ToolRuntime não deve transformar um deny em tool.started.

## 29. Estado do Runtime após deny

Uma decisão deny:

```
não inicia a Tool
```

mas pode falhar a execução do Agent normalmente.
Ou seja:

```
Agent
  ↓
requestTool()
  ↓
PolicyDeniedError
```

O Agent pode:

```
catch
```

e decidir como continuar.
A Policy controla autorização.
O Agent continua responsável por comportamento.

## 30. Estado do Runtime após approval-required

A execução deve ser interrompida exatamente antes da Tool.
Não iniciar:

```
tool.started
```

O futuro Orchestrator/Approval Layer poderá decidir se a operação será retomada.
Não implementar retry/resume nesta fase.

## 31. Regra de lifecycle

Para uma Tool negada:

```
tool.requested
policy.evaluated
policy.denied
```

e:

```
❌ tool.started
❌ tool.completed
```

Para approval:

```
tool.requested
policy.evaluated
policy.approval-required
```

e:

```
❌ tool.started
❌ tool.completed
```

Para allow:

```
tool.requested
policy.evaluated
tool.started
tool.completed
```

## 32. Compatibilidade com o EventBus

O EventBus da Fase 1 permanece congelado.
Não alterar:

```
publish
subscribe
unsubscribe
```

A Policy apenas passa a utilizá-lo como consumidor/publicador de eventos.
A abstração existente continua suficiente para o runtime atual.

## 33. Surface of Authority

Este é um requisito crítico.
O Agent não deve receber:

```
policyEngine
policyRegistry
capabilityRegistry
eventBus
toolRuntime
```

O Agent continua recebendo somente:

```
session
mission
runtime.requestTool
```

A Fase 2 não altera a superfície do Agent.
Deve existir teste estrutural equivalente a:

```
assert.deepEqual(
  Object.keys(context.runtime),
  ['requestTool']
);
```

Nenhuma nova capacidade de autorização será exposta ao Agent.

## 34. Policy Engine não pode ser chamado pelo Agent

O fluxo obrigatório é:

```
Agent
  ↓
requestTool
  ↓
AgentLoop
  ↓
ToolRuntime
  ↓
PolicyEngine
```

Nunca:

```
Agent
  ↓
PolicyEngine
```

Isso evita que o próprio Agent consulte ou manipule a camada de autoridade.

## 35. Policy Context Immutability

A implementação deve tratar o AuthorizationContext como snapshot da decisão.
A Policy não deve modificar:

```
session
agent
tool
input
```

O PolicyEngine recebe contexto e retorna decisão.
Não possui efeitos colaterais de execução.

## 36. Determinismo

Dado o mesmo:

```
policies
+
AuthorizationContext
```

o PolicyEngine deve retornar a mesma decisão.
Não usar:

```
LLM
randomness
current time
network
external API
```

para decidir autorização.

## 37. Policy Matching

A primeira implementação deve ser simples.
Uma Policy poderá corresponder por:

```
principal.id
tool.id
capability.id
operation
resource.type
resource.id
```

Suporte parcial é aceitável.
Por exemplo:

```
resources: ["database/*"]
```

pode ser suportado por glob simples.
Não implementar:

```
CEL
OPA
Rego
ABAC completo
RBAC completo
IAM DSL
```

nesta fase.

## 38. Match semantics

Para uma policy corresponder:

```
principal
+
tool
+
operation
+
resource
```

precisam satisfazer seus critérios declarados.
Campos omitidos significam:

```
wildcard
```

Exemplo:

```
tool: database.*
principal: oracle
```

significa qualquer ferramenta Database para Oracle.
Mas:

```
principal: oracle
resource: production
```

não significa automaticamente:

```
allow
```

Se a operação não estiver coberta, aplica-se a decisão final conforme o conjunto de policies.

## 39. Explicit Deny

Exemplo:

```
id: deny-oracle-production
effect: deny
principal:
  id: oracle
resource:
  id: production
```

Isso deve bloquear mesmo que exista:

```
allow-oracle-database
```

para o mesmo contexto.

## 40. Exemplo de política allow

```
id: oracle-database
effect: allow
principal:
  id: oracle
capability:
  id: database
operation:
  - query
  - migration
resource:
  id: development
```

Resultado:

```
oracle + database.migration + development
→ allow
```

Mas:

```
oracle + database.migration + production
→ deny
```

por ausência de allow.

## 41. Exemplo de approval

```
id: production-migration
effect: approval-required
capability:
  id: database
operation:
  - migration
resource:
  id: production
```

Resultado:

```
database.migration + production
→ approval-required
```

A Tool não executa.

## 42. Política específica do Spectree não deve ser hardcoded

Não colocar no código:

```
if (agent === 'oracle') allow();
```

Nunca.
O Runtime deve conseguir carregar as policies.
Uma configuração inicial pode ser:

```
spectree-runtime/policy/
```

ou outro caminho coerente com o repositório.
A fonte de configuração deve ser desacoplada da implementação do PolicyEngine.

## 43. Compatibilidade com o Squad atual

O objetivo desta fase é permitir que as autoridades que hoje existem como convenções:

```
Oracle → banco
Disruptor → Git/infra
Keeper → QA
```

comecem a ser representadas como policies.
Não é obrigatório migrar todas imediatamente.
Como prova de conceito, implementar pelo menos:

```
Oracle → database migration
```

ou equivalente que possa ser representado de forma totalmente local, sem provider externo real.

## 44. Critério de prova

Precisamos provar:

```
agent authorized
    ↓
tool executes
```

e:

```
agent unauthorized
    ↓
tool does NOT execute
```

e:

```
approval required
    ↓
tool does NOT execute
```

## 45. Testes obrigatórios — PolicyEngine

Criar testes para:

Policy matching

* principal match;
* tool match;
* capability match;
* operation match;
* resource match;
* wildcard;
* ausência de match.

Decision

* allow;
* deny;
* approval-required;
* default deny.

Precedence

* deny vence allow;
* approval-required vence allow;
* allow funciona quando nenhuma restrição superior existe.

Determinism

* Mesmo contexto → mesma decisão.

## 46. Testes obrigatórios — ToolRuntime

Criar testes provando:

DENY

```
Tool.execute()
```

não é chamado.

APPROVAL

```
Tool.execute()
```

não é chamado.

ALLOW

```
Tool.execute()
```

é chamado exatamente uma vez.

## 47. Teste de lifecycle de Policy

Para deny:

```
tool.requested
policy.evaluated
policy.denied
```

Nunca:

```
tool.started
tool.completed
```

Para approval:

```
tool.requested
policy.evaluated
policy.approval-required
```

Nunca:

```
tool.started
tool.completed
```

Para allow:

```
tool.requested
policy.evaluated
tool.started
tool.completed
```

## 48. Teste estrutural de autoridade

Obrigatório:

```
Agent context
    ↓
Object.keys()
    ↓
['session', 'mission', 'runtime']
```

e:

```
Object.keys(context.runtime)
    ↓
['requestTool']
```

Isso deve continuar passando após a Fase 2.
Qualquer tentativa futura de adicionar:

```
policy
capabilities
eventBus
```

ao Agent Context deverá quebrar o teste.

## 49. Teste de bypass

Criar um teste de arquitetura:

```
Agent
  ↓
requestTool
  ↓
ToolRuntime
  ↓
PolicyEngine
```

Provar que não existe uma rota pública alternativa:

```
Agent → Tool
Agent → Capability
Agent → Policy
```

A superfície disponível ao Agent é somente:

```
requestTool
```

## 50. Teste de isolamento

Criar duas Sessions:

```
oracle/session-A
jakiro/session-B
```

com policy diferentes.
Exemplo:

```
oracle → database → allow
jakiro → database → deny
```

Executar em paralelo.
Provar:

```
A executes
B does not
```

Sem vazamento de contexto entre Sessions.

## 51. Teste de composição

Criar pelo menos duas Tool definitions com mesma Capability:

```
database.query
database.migrate
```

e provar que uma mesma Policy pode autorizar:

```
capability = database
operation = query
```

sem automaticamente autorizar:

```
migration
```

quando a operação não estiver coberta.
Isso prova a separação:

```
Capability
≠
Operation
```

## 52. Capability Registry

Testar:

```
register
resolve
has
list
duplicate id
```

Sem persistência.

## 53. Migration safety

As Tools existentes da Fase 1 não devem ser quebradas.
Se uma Tool não tiver:

```
capability
```

ela deve continuar podendo ser executada somente quando uma Policy explícita compatível a permitir.
Não usar:

```
capability missing → allow
```

Isso violaria Default Deny.

## 54. Compatibilidade de API

O código que hoje faz:

```
toolRuntime.execute(request, context)
```

deve continuar funcionando.
A assinatura pública não deve ser quebrada.
A adição do PolicyEngine deve ocorrer via:

```
constructor dependency
```

ou outro mecanismo compatível.

## 55. Configuração sem Policy

Para testes de infraestrutura do próprio Runtime, pode existir um PolicyEngine padrão com:

```
default deny
```

Não criar um:

```
allow all
```

global para "facilitar desenvolvimento".
Para testes que precisam permitir determinada Tool, usar policy explícita:

```
allow-test-tool
```

## 56. Erros

Adicionar pelo menos:

```
PolicyError
PolicyDeniedError
PolicyApprovalRequiredError
PolicyConfigurationError
```

Erros devem ser diferenciáveis.
Não usar:

```
Error("not allowed")
```

genérico para todas as situações.

## 57. Logging

Não introduzir logger global nesta fase.
Eventos do EventBus são a observabilidade canônica.
O futuro logger poderá consumir:

```
policy.evaluated
policy.denied
policy.approval-required
```

## 58. Redaction

A Fase 2 deve preservar o seam da Fase 1:

```
projectEventPayload
```

Não remover.
Não duplicar um segundo sistema de redaction dentro da Policy.
Policy pode decidir autorização.
Projection decide o que é publicado.
São responsabilidades diferentes.

## 59. Imutabilidade da Policy

Após ser registrada, uma Policy não deve ser mutada silenciosamente.
Preferência:

```
register
remove
replace
```

em vez de modificar o objeto já registrado.
Isso facilita auditoria futura.

## 60. Policy IDs

Todo Policy deve ter:

```
id
```

único.
O PolicyEngine deve retornar esse id na decisão quando uma regra explícita tiver sido responsável pelo resultado.
Isso será necessário futuramente para:

```
audit
replay
explainability
```

## 61. Explainability

Toda decisão deve possuir:

```
reason
```

O objetivo não é uma explicação gerada por LLM.
Deve ser uma explicação determinística.
Exemplo:

```
"No policy grants agent jakiro permission to execute database.migration on production"
```

ou:

```
"Policy oracle-development explicitly allows database.migration on development"
```

## 62. Policy auditability

Uma decisão deve permitir reconstruir:

```
quem
o quê
qual operação
qual recurso
qual policy
qual resultado
por quê
```

Não é necessário persistir isso ainda.
O EventBus deve tornar esses dados observáveis.

## 63. Segurança por construção

O desenho deve garantir:

```
sem policy
→ sem execução
```

e não:

```
sem policy
→ tentar executar
→ verificar depois
```

A autorização deve acontecer antes da execução física.

## 64. Relação com Sandbox futuro

O PolicyEngine da Fase 2 não é sandbox.
Policy responde:

```
"pode?"
```

Sandbox responderá:

```
"mesmo que possa, em qual ambiente e com quais limites pode executar?"
```

Portanto:

```
Policy
   ↓
Sandbox
   ↓
Provider
```

é uma evolução futura válida.
Não fundir as duas responsabilidades agora.

## 65. Relação com Founder Approval

A Fase 2 introduz:

```
approval-required
```

mas não implementa a aprovação.
Futuro:

```
Policy
  ↓
approval-required
  ↓
Founder Gate
  ↓
approved
  ↓
resume/retry
```

O mecanismo de resume pertence a uma fase futura.

## 66. Definition of Done

A Fase 2 só pode ser declarada DONE quando:

* PolicyEngine existir.
* PolicyRegistry existir.
* PolicyDecision existir.
* AuthorizationContext existir.
* Capability existir.
* CapabilityRegistry existir.
* ToolRuntime.execute() passar obrigatoriamente pela Policy.
* default deny estiver implementado.
* deny explícito estiver implementado.
* approval-required estiver implementado.
* allow estiver implementado.
* deny superar allow.
* approval-required superar allow.
* Policy não executar Tool.
* Tool não decidir autorização.
* Agent não enxergar PolicyEngine.
* Agent não enxergar CapabilityRegistry.
* superfície estrutural do Agent permanecer inalterada.
* eventos de Policy existirem.
* Tool não iniciar quando deny.
* Tool não iniciar quando approval-required.
* Tool iniciar quando allow.
* Resource estiver representado no contexto.
* Operation estiver representada no contexto.
* Tool puder declarar Capability.
* Tools legadas continuarem compatíveis.
* duas Sessions puderem executar policies diferentes simultaneamente.
* todos os testes passarem.
* claude plugin validate . --strict passar.
* exemplo executável continuar funcionando.
* documentação arquitetural for atualizada.
* nenhuma funcionalidade de Fase 3 tiver sido incorporada.

## 67. Definition of Architecture Done

Além dos testes, o TechLeader só aprovará a arquitetura se for demonstrado:

```
Agent
   ↓
requestTool()
   ↓
ToolRuntime
   ↓
PolicyEngine
   ↓
Capability
   ↓
Tool
```

e se for possível substituir:

```
PolicyRegistry in-memory
```

futuramente por outra fonte sem alterar:

```
Agent
AgentLoop
ToolRuntime
```

Da mesma forma:

```
CapabilityRegistry
```

deve poder receber providers futuros sem conhecer:

```
Agent
PolicyEngine
Session
```

## 68. Exemplo mínimo obrigatório

Criar um cenário executável:

```
Agent: oracle
```

Tool:

```
database.migrate
```

Capability:

```
database
```

Resource:

```
development
```

Policy:

```
oracle
+
database
+
migration
+
development
→ allow
```

Resultado:

```
tool executes
```

Segundo cenário:

```
Agent: jakiro
mesma Tool
mesmo recurso
```

sem policy compatível.
Resultado:

```
DENY
Tool.execute() nunca chamado
```

Terceiro cenário:

```
database.migrate
production
```

com:

```
approval-required
```

Resultado:

```
Tool.execute() nunca chamado
```

Esses três cenários constituem a prova mínima da Fase 2.

## 69. Documentação obrigatória

Criar/atualizar:

```
docs/architecture/SPECTREE-RUNTIME.md
```

adicionando:

```
Policy Model
Authorization Context
Policy Decision
Policy Precedence
Capability Model
Tool → Capability
Policy Events
Default Deny
Approval Required
Extension Points
```

Também criar um ADR somente se houver uma decisão arquitetural irreversível ou trade-off relevante.
Não criar ADR apenas para aumentar documentação.

## 70. Handoff obrigatório do Opus 5

O handoff deve conter:

```
## Implementation
arquivos criados/modificados

## Policy model
diagrama

## Capability model
diagrama

## Enforcement point
onde Policy entra no ToolRuntime

## Decision matrix
allow / deny / approval-required

## Event sequence
allow / deny / approval

## Tests
comando + resultado

## Compatibility
provas do Runtime Fase 1

## Authority surface
prova estrutural

## Known limitations
limitações reais

## Scope verification
confirmação explícita de que Sandbox,
Orchestrator, LLM Provider e persistence
não foram implementados
```

## 71. Matriz de decisão obrigatória

| Contexto | Resultado |
|---|---|
| Policy allow, sem deny | allow |
| Policy deny + allow | deny |
| Policy approval + allow | approval-required |
| Nenhuma policy | deny |
| Tool inexistente | ToolNotFoundError |
| Input inválido | ToolValidationError |
| Policy inválida | PolicyConfigurationError |

## 72. Invariantes da Fase 2

INV-201
Nenhuma Tool executa antes de PolicyDecision.

INV-202
Ausência de Policy nunca concede acesso.

INV-203
deny sempre vence allow.

INV-204
approval-required nunca inicia Tool.

INV-205
PolicyEngine nunca executa Tool.

INV-206
Tool nunca decide sua própria autorização.

INV-207
Agent não recebe acesso ao PolicyEngine.

INV-208
Agent não recebe acesso ao CapabilityRegistry.

INV-209
A superfície do Agent Context permanece estruturalmente travada.

INV-210
Policy decision é determinística.

INV-211
Policy não modifica o contexto de autorização.

INV-212
Capability não implica autorização.

INV-213
Operation deve fazer parte da decisão.

INV-214
Resource deve fazer parte da decisão quando a Tool o declarar.

INV-215
Todos os eventos de Policy carregam Session/Agent quando disponíveis.

## 73. Fluxo final da Fase 2

O Runtime evolui de:

```
Agent
   ↓
AgentLoop
   ↓
ToolRuntime
   ↓
Tool
```

para:

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
                   AuthorizationContext
                           │
                           ▼
                     PolicyEngine
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
            ALLOW         DENY      APPROVAL
              │            │            │
              ▼            ▼            ▼
        Capability      blocked      blocked
              │
              ▼
           Provider
              │
              ▼
             Tool
```

## 74. Resultado estratégico

Ao final da Fase 2, o Spectree deverá ter realizado uma mudança arquitetural fundamental:

Antes

```
Agent
  ↓
"Sou o Oracle, portanto posso mexer no banco."
```

Depois

```
Agent
  ↓
requestTool()
  ↓
Runtime
  ↓
"Principal Oracle"
  +
"Capability Database"
  +
"Operation Migration"
  +
"Resource Development"
  ↓
Policy Decision
  ↓
ALLOW
  ↓
Tool
```

A autoridade deixa de estar na persona.
Ela passa a estar no Runtime.

## 75. Regra de fechamento

A Fase 2 não será considerada bem-sucedida porque "tem um PolicyEngine".
Ela será bem-sucedida quando pudermos demonstrar experimentalmente:

```
Mesmo Agent
+
Mesma Tool
+
Mesmo Runtime
```

produz:

```
ALLOW
```

em um contexto autorizado e:

```
DENY
```

em um contexto não autorizado,
sem modificar o Agent, a Tool ou o AgentLoop.

Essa é a prova de que o Spectree deixou de depender de convenção de prompt para governar execução.

> Fora da numeração normativa: registro da rodada de review que emendou o
> contrato desta fase, transcrito da fonte. Ver o bloco de proveniência no
> topo — inclusive quanto ao trecho que a fonte traz truncado.

## Review do TechLeader — REQUEST CHANGES

Mas é uma correção pequena comparada ao ganho arquitetural do PR.

Pacote de correção que eu mandaria ao Opus:

```
R9 — Resource authority
1. remover request.resource como autoridade de autorização
2. resolver resource a partir da Tool/Capability
3. garantir que Policy veja o recurso efetivamente executado
4. adicionar teste de resource spoofing
5. provar que o agent não consegue transformar production em development

R10 — Safe event projection
1. default projector não publica input
2. preservar seam customizado
3. adicionar teste de ausência de secret/input no evento default

R11 — Capability semantics
1. adicionar teste documentando que CapabilityRegistry é catálogo
2. não transformar registry em gate nesta fase
3. registrar explicitamente como requisito da fase de Providers
```

Depois:

```
npm test
→ esperado >57 verdes

npm run example:policy
→ 3 cenários

claude plugin validate . --strict
→ green

resource spoof test
→ green
```

### Conclusão do TechLeader

O Opus acertou o desenho central da Fase 2.
A transformação já aconteceu:

Antes

```
Agent
  ↓
Tool
```

para:

Agora

```
Agent
  ↓
ToolRuntime
  ↓
AuthorizationContext
  ↓
PolicyEngine
  ↓
Decision
  ↓
Tool
```

Isso é uma evolução arquitetural real e não apenas uma nova biblioteca. O PR também demonstra que a superfície do Agent continua travada, que o EventBus permanece congelado e que nenhum agente do Squad precisou ser modificado.

Mas eu não vou aprovar enquanto o chamador puder influenciar o recurso que a própria Policy usa para autorizar a operação.

Esse é exatamente o tipo de bug que parece pequeno em um exemplo de teste e se torna crítico quando colocarmos:

```
Supabase
GitHub
Cloud Run
produção
segredos
infraestrutura
```

atrás dessas Tools.

Corrigido o R9, eu reavalio o PR para aprovação.
