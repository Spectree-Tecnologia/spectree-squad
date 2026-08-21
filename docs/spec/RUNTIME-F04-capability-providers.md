---
status: in-review
owner: TechLeader
updated: 2026-08-20
approved: - (o merge existe — PR #11, squash `d7a19c4`, tag `v0.19.0`, 2026-08-20 — mas a fonte transcrita chegou com perda de conteudo no transporte: as secoes 27 e 47 terminam em `Nao basta provar:` e `Precisamos provar:` sem nada depois, e a 27 e onde o INV-415 se apoia. Escopo: a Fase 4 original apenas; as continuacoes 4.5 a 4.8, PRs #19 a #23, nao tem contrato normativo. Aguarda reexport da fonte.)
depends_on: F1 Runtime Core (docs/spec/RUNTIME-F01-runtime-core.md), F2 Policy Engine, F3 Founder Gate — baseline declarado na fonte: "Fases 1, 2 e 3 congeladas"
---

# Spectree Runtime v2 — F04 Capability Providers

> Transcrição da especificação normativa da Fase 4, produzida no harness de
> planejamento do Founder (owner declarado na fonte: TechLeader). Esta versão
> restaura a marcação markdown perdida no transporte; o texto é o do documento
> fonte, sem correção, melhoria ou complemento. O texto commitado é o contrato
> real (ver `docs/spec/README.md`).
>
> Aprovação a derivar: a Fase 4 embarcou em `main` no PR #11 — squash
> `d7a19c4`, tag `v0.19.0`, em 2026-08-20. A data está no git; o flip de
> `status:` e o preenchimento de `approved:` são ato do Invoker.
>
> Escopo da fonte: este documento cobre apenas a Fase 4 original. As
> continuações 4.5 a 4.8 (PRs #19 a #23) não aparecem no texto fonte.

- Implementador: Agente Opus 5
- Baseline: Spectree Runtime v2 — Fases 1, 2 e 3 congeladas
- Fase: 4 — Capability Providers
- Objetivo: transformar Capability de catálogo abstrato em capacidade operacional real através de Providers, preservando Policy, Founder Approval e os contratos do Runtime Core.

## 1. Contexto

As fases anteriores estabeleceram quatro camadas distintas:

```
SQUAD
  ↓
identidade do agente

RUNTIME CORE
  ↓
execução, sessão, eventos

POLICY
  ↓
autorização normativa

FOUNDER GATE
  ↓
autorização humana excepcional
```

A Fase 4 adiciona:

```
CAPABILITY
  ↓
contrato operacional

PROVIDER
  ↓
implementação física
```

O fluxo passa a ser:

```
Agent
  ↓
ToolRuntime
  ↓
Policy
  ├── deny
  ├── approval
  └── allow
          ↓
      Capability
          ↓
       Provider
          ↓
      mundo real
```

## 2. Objetivo

Implementar uma abstração real de Provider para que o Runtime possa executar capabilities através de implementações concretas.

A Fase 4 deve provar que:

```
mesma Tool
+
mesma Policy
+
mesma Capability
```

pode utilizar Providers diferentes sem modificar:

- Agent
- AgentLoop
- ToolRuntime
- PolicyEngine
- ApprovalManager

## 3. Princípio fundamental

A separação normativa é:

```
Tool
= operação solicitável

Capability
= contrato do que o Runtime sabe fazer

Provider
= como essa capacidade é efetivamente realizada
```

Exemplo:

```
Tool:
filesystem.read
        ↓
Capability:
filesystem
        ↓
Provider:
LocalFilesystemProvider
```

Outro Provider futuro:

```
filesystem
        ↓
SandboxFilesystemProvider
```

A Tool não deve saber qual Provider executará a operação.

## 4. Não confundir Capability com Tool

Capability:

```
filesystem
```

Tool:

```
filesystem.read
filesystem.write
filesystem.delete
```

Capability define:

operações suportadas

Tool define:

qual operação foi solicitada

Provider define:

como aquela operação é executada

## 5. Arquitetura da Fase 4

Criar:

```
spectree-runtime/
├── capabilities/
│   ├── capability.js
│   ├── capability-registry.js
│   ├── capability-provider.js
│   ├── capability-provider-registry.js
│   └── capability-resolver.js
│
├── providers/
│   ├── local/
│   │   └── filesystem-provider.js
│   └── ...
```

A estrutura física pode ser adaptada à implementação, mas os contratos conceituais são obrigatórios.

## 6. Arquitetura final

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
                │                     │
              DENY                 ALLOW
                │                     │
                │                     ▼
                │              CapabilityRegistry
                │                     │
                │                     ▼
                │             CapabilityResolver
                │                     │
                │                     ▼
                │            ProviderRegistry
                │                     │
                │                     ▼
                │                  Provider
                │                     │
                │                     ▼
                │             execução física
                │
                └────── stop
```

Approval continua sendo uma etapa anterior ao Provider:

```
Policy
  ↓
approval-required
  ↓
Founder Gate
  ↓
Policy Revalidation
  ↓
ALLOW
  ↓
Capability
  ↓
Provider
```

## 7. Regra absoluta de autoridade

O Provider não substitui a Policy.

Nunca permitir:

```
Agent
 ↓
Provider
```

nem:

```
Tool
 ↓
Provider
```

ignorando:

```
ToolRuntime
 ↓
Policy
```

Todo acesso físico ao recurso deve passar pelo fluxo do Runtime.

## 8. Capability Contract

Uma Capability deve possuir:

```
Capability
    id
    name
    description
    operations
    version?
```

Exemplo:

```
{
  id: 'filesystem',
  name: 'Filesystem',
  description: 'Workspace file operations',
  operations: [
    'read',
    'write',
    'delete'
  ]
}
```

## 9. Capability como contrato

A Capability não deve conter:

- filesystem path
- database connection
- HTTP client
- shell
- credentials

Ela define apenas o contrato.

O Provider possui os recursos concretos.

## 10. CapabilityProvider

Criar uma interface conceitual:

```
CapabilityProvider
    capabilityId
    providerId
    version
    operations
    execute(request, context)
```

O Provider deve declarar:

qual capability implementa

e:

quais operações suporta

## 11. Provider ≠ Tool

Exemplo:

```
Tool:
filesystem.read
```

pode ser executada por:

```
LocalFilesystemProvider
```

ou futuramente:

```
SandboxFilesystemProvider
RemoteFilesystemProvider
```

A Tool não deve mudar.

## 12. ProviderRegistry

Criar:

```
CapabilityProviderRegistry
```

Responsabilidades:

```
register(provider)
resolve(capabilityId, selector?)
has(...)
list(...)
```

O Registry deve rejeitar:

- provider inexistente
- capability inexistente
- operação não suportada
- ID duplicado

## 13. Capability ↔ Provider

Um Provider pode implementar apenas uma Capability.

Preferência:

```
provider.capabilityId
```

exatamente um.

Não criar um Provider monolítico:

```
EverythingProvider
```

que execute:

- filesystem
- git
- database
- browser
- cloud

Isso destruiria a separação das capabilities.

## 14. Provider Operations

O Provider deve declarar operações suportadas.

Exemplo:

```
LocalFilesystemProvider
    capability: filesystem

    operations:
      read
      write
      delete
```

Se a Tool solicita:

```
filesystem.copy
```

mas o Provider não declara:

```
copy
```

o Runtime deve rejeitar antes da execução física.

## 15. Novo Gate: Capability Registry

Na Fase 2 deixamos registrado que:

```
Tool.capability
```

ainda não precisava existir no CapabilityRegistry.

Isso muda na Fase 4.

A partir desta fase:

uma Tool que declara uma Capability não registrada não pode executar.

O catálogo deixa de ser apenas informativo.

Ele passa a ser parte do contrato de runtime.

## 16. Capability validation

Antes de executar:

```
Tool
  ↓
capabilityId
```

validar:

```
CapabilityRegistry.has(capabilityId)
```

Se não:

```
CapabilityNotFoundError
```

e:

```
Provider.execute() = 0
```

## 17. Operation validation

Depois:

```
Capability.operations.includes(operation)
```

Se não:

```
UnsupportedCapabilityOperationError
```

A Tool não executa.

## 18. Provider validation

Depois:

```
ProviderRegistry.resolve(capability)
```

Se nenhum Provider existir:

```
CapabilityProviderNotFoundError
```

Nenhuma execução física.

## 19. Provider operation validation

O Provider precisa suportar a operação:

```
provider.operations.includes(operation)
```

Se não:

```
ProviderOperationNotSupportedError
```

Nenhuma execução.

## 20. Ordem completa do ToolRuntime

O fluxo da Fase 4 será:

1. resolve Tool
2. validate Tool input
3. resolve Capability
4. validate Capability exists
5. validate Operation
6. resolve Resource
7. build AuthorizationContext
8. PolicyEngine.decide()
9. deny → stop
10. approval → Founder Gate
11. revalidation
12. resolve Provider
13. validate Provider supports operation
14. provider.execute()
15. emit result

A Policy continua antes da execução física.

## 21. Regra de segurança

Não criar:

```
Provider.execute()
```

antes de:

```
Policy == allow
```

O Provider deve assumir:

o Runtime já autorizou a operação.

Mas o Provider não deve possuir um caminho público que contorne o Runtime.

## 22. Provider Context

O Provider deve receber um contexto próprio:

```
ProviderExecutionContext
    sessionId
    agentId
    capabilityId
    operation
    resource
    metadata
```

Não entregar ao Provider:

- AgentContext
- PolicyEngine
- ApprovalManager
- FounderGate
- EventBus

O Provider precisa apenas da informação necessária para executar.

## 23. Provider Authority Surface

Aplicar novamente o padrão R8.

O Provider deve receber uma superfície mínima e explicitamente testada.

Exemplo:

```
Object.keys(providerContext)
```

deve conter somente:

```
[
  'sessionId',
  'agentId',
  'capabilityId',
  'operation',
  'resource',
  'metadata'
]
```

A lista exata pode variar conforme necessidade real, mas deve ser congelada por teste.

Não aceitar:

```
...rest
```

como superfície implícita.

## 24. Provider não recebe Policy

Nunca:

```
providerContext.policy
```

Isso evitaria a descentralização da autorização.

O Provider executa.

O Runtime autoriza.

## 25. Provider não recebe ToolRuntime

Nunca:

```
providerContext.toolRuntime
```

Evita recursão e bypass.

## 26. Resource Binding

O Provider deve receber o resource resolvido pelo Runtime.

Não:

```
request.resource
```

diretamente.

A regra R9 permanece intacta:

```
Tool metadata
+
original input
        ↓
actual resource
```

O Provider recebe esse resultado.

## 27. Resource invariance

O teste deve provar:

```
Policy resource
==
Provider resource
==
resource actually executed
```

Essa é uma das invariantes mais importantes da Fase 4.

Não basta provar:

Precisamos provar:

## 28. Provider Execution Request

Criar um request interno:

```
ProviderExecutionRequest
    capabilityId
    operation
    input
    resource
```

Esse request é construído pelo Runtime.

Nunca aceitar um ProviderExecutionRequest vindo diretamente do Agent.

## 29. Provider result

O Provider deve retornar:

```
ProviderResult
    output
    metadata?
```

A camada ToolRuntime continua responsável por:

```
ToolResult
```

Provider não conhece:

```
tool.completed
```

## 30. Provider errors

Adicionar:

```
CapabilityError
CapabilityNotFoundError
UnsupportedCapabilityOperationError
CapabilityProviderError
CapabilityProviderNotFoundError
ProviderOperationNotSupportedError
ProviderExecutionError
```

Os erros físicos devem manter a causa original quando possível.

## 31. Error boundary

O Runtime deve diferenciar:

```
Policy error
```

de:

```
Capability error
```

e:

```
Provider error
```

Exemplo:

```
PolicyDeniedError
≠
CapabilityNotFoundError
≠
ProviderExecutionError
```

## 32. Provider errors não alteram Policy

Se:

```
Provider.execute()
→ failure
```

não transformar isso em:

```
Policy.denied
```

A autorização estava correta.

A execução falhou.

São eventos diferentes.

## 33. Event model

Adicionar:

```
capability.resolved
provider.resolved
provider.started
provider.completed
provider.failed
```

Não é necessário publicar tudo se a semântica tornar o EventBus excessivamente ruidoso.

Mas pelo menos:

```
provider.started
provider.completed
provider.failed
```

devem existir.

## 34. Event ordering

Para execução bem-sucedida:

```
tool.requested
policy.evaluated
tool.started
provider.started
provider.completed
tool.completed
```

Ou, se o desenho optar por capability.resolved/provider.resolved:

```
tool.requested
policy.evaluated
capability.resolved
provider.resolved
tool.started
provider.started
provider.completed
tool.completed
```

O implementador deve escolher uma única sequência e congelá-la por teste.

Minha preferência é:

```
capability.resolved
provider.resolved
```

serem eventos técnicos opcionais.

Lifecycle público mínimo:

```
tool.started
provider.started
provider.completed
tool.completed
```

## 35. Segurança dos eventos

Continuar a regra da Fase 2.

Não publicar automaticamente:

- input completo
- output completo
- credentials
- connection strings
- tokens
- filesystem contents
- database rows

Eventos devem carregar metadata segura.

O output completo pode continuar sendo mantido internamente para construção do ToolResult.

## 36. Provider output projection

O Provider pode produzir:

```
output
```

mas o EventBus deve receber:

```
safe projection
```

por exemplo:

```
{
  providerId,
  capabilityId,
  operation,
  resource,
  durationMs
}
```

e não necessariamente:

```
{
  output: fullDatabaseDump
}
```

## 37. First Provider

A Fase 4 precisa de pelo menos um Provider real.

Minha recomendação:

```
LocalFilesystemProvider
```

Motivos:

- determinístico
- local
- testável
- baixo acoplamento externo

E ele prepara diretamente o terreno para o Sandbox da Fase 5.

## 38. Filesystem Capability

Criar:

```
Capability:
filesystem
```

operações mínimas:

- read
- write
- delete

Não adicionar:

- chmod
- mount
- symlink
- execute

nesta fase.

## 39. Filesystem Resource

Resources:

```
filesystem://workspace<path>
```

ou equivalente normalizado.

O formato exato deve ser definido e documentado.

Não permitir path arbitrário sem normalização.

## 40. Path normalization

O Provider deve normalizar caminhos.

Rejeitar:

```
../outside-workspace
```

quando o resource estiver vinculado ao workspace.

Isso não é ainda Sandbox.

É apenas uma garantia básica do Provider.

## 41. Workspace root

O LocalFilesystemProvider precisa receber:

```
workspaceRoot
```

no momento da construção.

Nunca receber:

```
workspaceRoot
```

do Agent em cada chamada.

## 42. Path traversal

Implementar teste:

```
workspace
   └── project/
```

request:

```
../secret
```

resultado:

```
CapabilityExecutionError
```

e:

```
filesystem access = 0
```

## 43. Symlink

Na Fase 4, considerar symlink traversal.

Não confiar apenas na normalização textual do path.

O Provider deve impedir que um path dentro do workspace atravesse um symlink e saia do boundary configurado.

Se a implementação não suportar isso de maneira segura:

```
symlink access → deny
```

é aceitável.

Isso prepara o Sandbox, mas não o implementa.

## 44. Filesystem read

Request:

```
filesystem.read
```

input:

```
{
  path
}
```

Resource deve ser derivado:

```
filesystem://workspace<normalized-path>
```

O Provider recebe:

```
resource
+
path
```

consistente entre si.

## 45. Filesystem write

Request:

```
filesystem.write
```

input:

```
{
  path,
  content
}
```

Policy autoriza o resource.

Provider executa no mesmo resource.

Não permitir que:

```
content
```

determine implicitamente outro path.

## 46. Filesystem delete

Operação mais sensível.

Mesmo que a Policy permita:

```
filesystem.delete
```

o Provider deve rejeitar:

```
workspaceRoot
```

ou qualquer path que viole suas próprias invariantes.

Policy não elimina invariantes físicas do Provider.

## 47. Provider invariants

O Provider pode possuir invariantes físicas.

Exemplo:

```
Policy:
ALLOW filesystem.delete

Provider:
DENY deletion of workspace root
```

Isso não é conflito arquitetural.

Policy responde:

Provider responde:

## 48. Não confundir Provider com Sandbox

Provider:

```
filesystem root = workspace
```

é uma restrição de execução do Provider.

Sandbox futuro:

- filesystem
- network
- process
- syscalls
- environment

será uma camada de isolamento sistêmico.

A Fase 4 não deve construir Sandbox.

## 49. Provider configuration

Provider deve ser criado com configuração explícita.

Exemplo:

```
LocalFilesystemProvider({
  workspaceRoot
})
```

Não ler diretamente:

```
process.env.WORKSPACE
```

espalhado pelo código.

A configuração deve entrar por dependency injection.

## 50. Capability configuration

Capability Registry deve conter:

```
filesystem
```

e suas operações.

Provider Registry:

```
filesystem
→ LocalFilesystemProvider
```

Tool Registry:

```
filesystem.read
filesystem.write
filesystem.delete
```

Essas três camadas devem ser distintas.

## 51. Registry relationships

```
CapabilityRegistry
        │
        ▼
Capability
        │
        ▼
ProviderRegistry
        │
        ▼
Provider
        │
        ▼
Tool
```

Na prática, Tool depende da Capability:

```
Tool.capability = filesystem
```

e o Runtime resolve Provider.

## 52. Provider resolution

Para uma Tool:

```
filesystem.read
```

o Runtime deve:

```
tool.capability
    ↓
CapabilityRegistry
    ↓
ProviderRegistry
    ↓
LocalFilesystemProvider
```

Não fazer:

```
tool.providerClass
```

como mecanismo padrão.

Isso acoplaria a Tool ao Provider.

## 53. Provider selection

Nesta fase:

```
uma Capability
→ um Provider default
```

é suficiente.

Não implementar ainda:

- multi-provider routing
- load balancing
- health scoring
- dynamic provider selection
- regional routing
- failover

Mas o Registry deve permitir mais de um Provider futuramente.

## 54. Provider identity

Cada Provider possui:

```
providerId
version
capabilityId
```

Exemplo:

```
local-filesystem
1.0.0
filesystem
```

Não depender apenas do nome da classe.

## 55. Provider versioning

O contrato deve permitir:

```
provider.version
```

mas não implementar negociação complexa.

Se houver incompatibilidade:

```
ProviderConfigurationError
```

## 56. Provider registration validation

Ao registrar:

```
Provider
```

validar:

- capability existe
- operations ⊆ capability.operations
- providerId único

A partir desta fase, o gate Capability ↔ Registry é obrigatório.

## 57. Tool registration validation

Quando possível, validar:

```
Tool.capability
```

contra:

```
CapabilityRegistry
```

e:

```
Tool.operation
```

contra:

```
Capability.operations
```

Se o registry de Tool for atualmente simples, essa validação pode ocorrer no momento da resolução.

## 58. Não aceitar capability fantasma

A semântica da Fase 2:

```
unknown capability could still execute
```

termina aqui.

Agora:

```
unknown capability
→ blocked
```

Essa é uma mudança normativa da Fase 4.

## 59. Backward compatibility

Tools antigas podem não possuir:

```
capability
```

durante a migração.

Manter fallback:

```
capability = tool.id
```

apenas temporariamente.

Mas:

```
fallback capability
```

precisa estar registrada.

Caso contrário:

```
CapabilityNotFoundError
```

Essa regra impede que ferramentas legadas criem bypass.

## 60. Tool migration example

Antes:

```
Tool:
id = filesystem.read
capability = undefined
```

Fallback:

```
capability = filesystem.read
```

Registry deve ter:

```
Capability:
filesystem.read
```

ou a Tool deverá ser migrada para:

```
capability = filesystem
operation = read
```

Preferência:

```
filesystem + read
```

porque preserva a modelagem de Capability como família.

## 61. Provider lifecycle

Provider pode possuir:

```
initialize()
shutdown()
```

mas são opcionais.

Para LocalFilesystemProvider, não é obrigatório.

Não criar infraestrutura de lifecycle complexa.

## 62. Stateless provider

Preferência para Providers stateless.

Exemplo:

```
LocalFilesystemProvider
```

pode ter apenas:

```
workspaceRoot
```

e não manter:

```
currentAgent
currentSession
currentTool
```

em campos mutáveis.

Isso reduz vazamento entre Sessions.

## 63. Session isolation

Dois Agents executando:

```
filesystem.write
```

simultaneamente devem compartilhar apenas os recursos explicitamente compartilhados.

O Provider não deve ter:

```
global currentSession
```

ou:

```
global currentInput
```

## 64. Concurrent Provider use

Testar:

```
Session A → write A
Session B → write B
```

em paralelo.

Provar:

```
conteúdo A == esperado
conteúdo B == esperado
```

sem interleaving incorreto.

## 65. Provider timeout seam

Não implementar timeout complexo.

Mas o Provider contract deve permitir futuramente:

```
AbortSignal
```

ou mecanismo equivalente.

Não criar operação que fique arquiteturalmente impossível de cancelar.

## 66. Cancellation

A Fase 3 já definiu que cancelamento é cooperativo.

Para Provider:

```
Session.cancel()
```

deve impedir novas execuções.

Para operação em andamento:

```
Provider cancellation
```

é opcional nesta fase.

O Provider deve pelo menos poder receber um sinal de cancelamento no contexto, mesmo que o primeiro Provider não utilize isso ativamente.

## 67. Provider input validation

O Provider pode validar invariantes físicas além da validação feita pela Tool.

Exemplo:

```
Tool:
path string

Provider:
path resolved and inside workspace
```

Tool validation não substitui Provider validation.

## 68. Policy input validation

A Policy continua sendo avaliada antes do Provider.

Portanto, se o Provider modificar alguma interpretação do request, essa mudança não pode transformar:

```
authorized resource A
```

em:

```
executed resource B
```

O Provider deve respeitar o resource binding recebido.

## 69. Resource execution invariant

Adicionar teste:

```
authorization.resource === providerContext.resource
```

e:

```
providerContext.resource === actual executed resource
```

Para filesystem, verificar usando path real.

## 70. Event failure sequence

Quando Provider falhar:

```
tool.requested
policy.evaluated
tool.started
provider.started
provider.failed
tool.failed
```

Não emitir:

```
tool.completed
```

## 71. Provider exceptions

Se:

```
Provider.execute()
throw
```

o ToolRuntime deve encapsular:

```
ProviderExecutionError
```

mantendo a causa.

## 72. Provider success

Se:

```
Provider.execute()
→ output
```

ToolRuntime deve produzir:

```
ToolResult
```

e emitir:

```
provider.completed
tool.completed
```

## 73. Output projection

Testar:

```
Provider output = secret
```

e:

```
provider.completed payload
```

não deve conter o secret por padrão.

## 74. Capability events

Não usar eventos de Capability para substituir eventos de Tool.

O lifecycle da operação continua centrado em:

```
tool.*
```

Provider events servem para observabilidade técnica.

## 75. No Provider-to-Provider calls

Um Provider não deve chamar outro Provider diretamente.

Evitar:

```
FilesystemProvider
 ↓
GitProvider
```

Se uma operação precisar compor capabilities, isso pertence ao Orchestrator/Tool layer futuro.

## 76. No hidden side capabilities

Um Provider não pode declarar:

```
filesystem
```

mas executar internamente:

- shell
- network
- git

sem que essas capacidades estejam explicitamente modeladas.

A Capability deve refletir a superfície operacional real.

## 77. Provider discovery

Não implementar descoberta dinâmica automática.

Registrar explicitamente:

- CapabilityRegistry
- ProviderRegistry

no createRuntime().

Isso mantém a confiança arquitetural explícita.

## 78. Runtime wiring

O createRuntime() deve montar:

- CapabilityRegistry
- ProviderRegistry
- PolicyEngine
- ApprovalManager
- ToolRuntime

com dependency injection.

Uma dependência não deve ser descoberta magicamente via singleton global.

## 79. Dependency graph

```
CapabilityRegistry
        ↓
ProviderRegistry
        ↓
PolicyEngine
        ↓
ApprovalManager
        ↓
ToolRuntime
        ↓
AgentLoop
```

Nenhum singleton global.

## 80. Provider registration order

Ao inicializar Runtime:

1. register capabilities
2. validate capabilities
3. register providers
4. validate provider ↔ capability
5. register tools
6. validate tool ↔ capability
7. start runtime

Se qualquer validação falhar:

```
RuntimeConfigurationError
```

## 81. Boot failure

O Runtime não deve iniciar parcialmente.

Exemplo:

```
Capability filesystem registrada
Provider não encontrado
```

Resultado:

```
createRuntime() → failure
```

ou, se capabilities puderem existir sem provider, marcar explicitamente:

```
provider unavailable
```

Mas uma Tool que depende dela não pode executar.

Minha preferência:

```
Runtime bootstrap pode existir
Provider resolution falha somente quando utilizado
```

para manter futura extensibilidade dinâmica.

## 82. Provider unavailable

Se:

```
filesystem.read
```

é solicitado e não existe Provider:

```
CapabilityProviderNotFoundError
```

antes de:

```
provider.started
```

## 83. Policy vs Provider availability

Não criar Policy específica para dizer:

provider está disponível

São dimensões diferentes.

Resultado:

```
Policy = ALLOW
Provider = unavailable
→ erro de capability/provider.
```

Não:

```
PolicyDenied
```

## 84. Approval vs Provider availability

Se:

```
Policy = APPROVAL_REQUIRED
```

o Provider não deve ser resolvido nem iniciado antes da aprovação.

Isso evita:

```
approval pending
+
provider initialization
```

com efeitos colaterais.

## 85. Founder Gate preservation

O caminho após aprovação continua:

```
approval.resume()
 ↓
Policy revalidation
 ↓
Capability resolution
 ↓
Provider resolution
 ↓
Provider.execute()
```

Não alterar:

```
FounderGate
```

para executar Provider diretamente.

## 86. Resume provider resolution

Mesmo que o Provider usado originalmente fosse:

```
LocalFilesystemProvider
```

o resume() deve resolver novamente:

```
Capability
→ Provider
```

em vez de confiar cegamente em um objeto antigo.

Isso permite futura troca de Provider e valida configuração atual.

## 87. Provider snapshot

A ApprovalRequest pode guardar:

- capabilityId
- operation
- resource

mas não deve precisar guardar:

```
provider instance
```

O Provider é resolvido no momento de execução/resume.

## 88. Provider selection and approval

Se futuramente a seleção de Provider puder mudar o risco:

```
LocalProvider
vs
ProductionCloudProvider
```

essa informação deverá fazer parte do contexto da Policy.

Na Fase 4, com um único Provider por Capability, isso é trivial.

Não esconder essa dimensão dentro do Provider.

## 89. Capability metadata

Capability pode declarar:

```
risk?
destructive?
sideEffects?
```

Mas não é obrigatório nesta fase.

Não usar esses campos para autorização.

Policy continua sendo a autoridade.

## 90. Filesystem Provider — escopo

Implementar somente:

- read
- write
- delete

Testar:

- normal path
- nested path
- invalid path
- traversal
- symlink
- missing file
- permission failure
- concurrent access

Não implementar shell.

## 91. Filesystem read semantics

read deve:

- receber path
- normalizar
- validar boundary
- ler
- retornar conteúdo

Erro de arquivo inexistente:

```
ProviderExecutionError
```

com causa distinguível.

## 92. Filesystem write semantics

write deve:

- receber path
- normalizar
- validar boundary
- escrever

Não criar diretórios arbitrários fora do workspace.

## 93. Filesystem delete semantics

delete deve:

- normalizar
- validar boundary
- impedir root deletion
- executar

Não implementar recursive delete nesta fase.

Se houver suporte no futuro, deverá ser operação separada:

```
delete-tree
```

com Policy específica.

## 94. Provider resource canonicalization

O Resource deve possuir representação canônica.

Exemplo:

```
filesystem://workspace/src/index.js
```

Dois recursos semanticamente iguais devem produzir a mesma representação.

Isso ajuda:

- Policy
- Approval
- Audit

## 95. Resource comparison

Não comparar recursos apenas por strings arbitrárias quando houver normalização necessária.

Exemplo:

```
./src/a.js
src/a.js
```

devem resultar no mesmo resource canônico.

## 96. No accidental absolute path authorization

Uma Policy que permite:

```
filesystem://workspace/*
```

não deve autorizar:

```
file:///etc/...
```

O Resource Type deve ser considerado na comparação.

## 97. Capability identity

Use IDs estáveis:

```
filesystem
```

e não:

```
local-filesystem-v1
```

para identificar a Capability.

Provider identity é outra dimensão:

```
local-filesystem
```

## 98. Provider identity example

```
Capability:
filesystem

Provider:
local-filesystem

Tool:
filesystem.read
```

Essa separação deverá permitir posteriormente:

```
sandbox-filesystem
remote-filesystem
```

sem mudar:

- Tool
- Capability
- Policy

quando a semântica de acesso continuar compatível.

## 99. Provider contract test

Criar um conjunto de testes reutilizável para qualquer Provider:

```
providerContract(provider)
```

Verificando:

- capability identity
- operations
- context surface
- error normalization
- success result
- failure result

Future providers devem passar pelo mesmo contrato.

## 100. No real external provider beyond filesystem

A Fase 4 não deve implementar simultaneamente:

- Git
- GitHub
- Supabase
- Postgres
- Browser
- Cloud Run
- MCP

O primeiro Provider deve ser suficiente para provar a arquitetura.

Depois da arquitetura aprovada, Providers adicionais podem ser fases incrementais.

## 101. Git Provider

Não implementar em Fase 4 a menos que o filesystem provider esteja totalmente coberto e o implementador consiga fazê-lo sem ampliar o escopo.

A prioridade é:

Capability architecture

não:

quantidade de integrations

## 102. Database Provider

Não implementar.

Database envolve:

- credentials
- transactions
- network
- connection lifecycle
- production resources

e deve vir depois do Sandbox.

## 103. MCP Provider

Não implementar.

MCP será uma integração/protocol adapter futuro.

Não permitir que MCP vire um bypass do Provider Contract.

## 104. Sandbox preparation

A Fase 4 deve deixar explícito o seam:

```
Provider
   ↓
Sandbox execution context
```

mas sem implementar Sandbox.

No futuro:

```
Policy
 ↓
Sandbox
 ↓
Provider
```

ou:

```
Policy
 ↓
Provider
 ↓
Sandbox
```

deverá ser decidido numa fase própria.

Minha recomendação futura será:

```
Policy
 ↓
Capability
 ↓
Sandbox
 ↓
Provider
```

porque Sandbox é boundary de execução.

## 105. Testing strategy

Criar:

- unit tests
- contract tests
- integration tests
- security tests

Não confiar apenas no exemplo executável.

## 106. Testes obrigatórios — Registry

- CapabilityRegistry
  - register
  - resolve
  - duplicate
  - unknown
  - operation validation
  - immutability
- ProviderRegistry
  - register
  - resolve
  - duplicate
  - unknown
  - capability mismatch
  - operation mismatch

## 107. Testes obrigatórios — ToolRuntime

- Unknown capability
  - Tool.execute = 0
  - Provider.execute = 0
- Unknown provider
  - Provider.execute = 0
- Unsupported operation
  - Provider.execute = 0
- Allowed execution
  - Provider.execute = 1

## 108. Teste de Policy + Provider

Provar:

```
Policy DENY
```

resulta:

```
Capability resolution may occur
Provider execution = 0
```

Minha preferência é resolver Capability depois da Policy quando possível para reduzir exposição, mas isso deve ser coerente com a necessidade de construir AuthorizationContext.

O requisito obrigatório é:

Provider.execute nunca antes de Policy ALLOW.

## 109. Teste de Approval + Provider

```
Policy APPROVAL
→ approval.requested
→ Provider.execute = 0
```

Depois:

```
approve
→ revalidate
→ Provider.execute = 1
```

## 110. Teste de Policy revalidation + Provider

```
approve
↓
policy changed to deny
↓
resume
↓
Provider.execute = 0
```

Esse teste mantém a garantia da Fase 3.

## 111. Teste de resource consistency

Verificar:

```
authorization.resource
===
provider.resource
===
actual physical resource
```

Esse deve ser um teste de integração real para filesystem.

## 112. Teste de path traversal

Verificar:

```
../outside
```

resulta:

```
ProviderExecutionError
```

ou erro específico de boundary.

O arquivo fora do workspace deve permanecer intocado.

## 113. Teste de symlink escape

Criar:

```
workspace/link → outside
```

e tentar:

```
link/secret
```

Resultado:

```
DENIED
```

ou erro de boundary.

Nunca ler o arquivo externo.

## 114. Teste de secret projection

Criar Provider que retorna:

```
secret-output
```

e verificar:

```
provider.completed payload
```

não contém:

```
secret-output
```

por padrão.

## 115. Teste de concurrent providers

Executar:

```
Session A
Session B
```

contra o mesmo Provider.

Provar ausência de estado cruzado.

## 116. Teste de Provider isolation

Criar Provider com campo mutável propositalmente controlado e verificar que:

```
A state ≠ B state
```

Esse teste serve para impedir regressões que introduzam currentSession global.

## 117. Teste de provider failure

Provider lança erro.

Esperado:

```
provider.started
provider.failed
tool.failed
```

Nunca:

```
tool.completed
```

## 118. Teste de provider recovery

A próxima execução, em nova Tool Invocation, deve poder funcionar.

Um erro de Provider não deve deixar o Registry permanentemente contaminado.

## 119. Teste de duplicate execution

Garantir:

```
uma Tool Invocation
→ um Provider.execute
```

Inclusive após:

- Approval
- Resume

## 120. Teste de Provider bypass

Criar um teste arquitetural que demonstre:

```
Agent context
```

não possui:

- provider
- providerRegistry
- capabilityRegistry

O Agent continua com:

```
requestTool
```

somente.

## 121. Surface testing

Aplicar R8 também em:

```
ProviderExecutionContext
```

e:

```
CapabilityDefinition
```

quando houver superfície limitada.

## 122. Immutable Provider metadata

Depois de registrar:

```
Provider
```

metadata deve ser congelada.

Não permitir que uma Tool altere:

```
provider.capabilityId
provider.operations
provider.id
```

em runtime.

## 123. Immutable Capability metadata

Mesmo padrão das Policies.

Capability registrada:

```
frozen
```

Alterações devem ocorrer através de:

```
replace/unregister/register
```

não mutação silenciosa.

## 124. Provider lifecycle ownership

O Runtime é dono do lifecycle do Provider.

Não o Agent.

Não a Tool.

Não a Session.

## 125. Provider shutdown

Se Provider possuir recursos físicos:

- connection
- worker
- process

o Runtime deve ter seam para:

```
shutdown()
```

Não implementar worker/process no filesystem Provider.

## 126. Provider startup failure

Se um Provider futuro tiver initialization:

```
initialize()
```

falhar, o Runtime deverá poder identificar:

```
provider unavailable
```

sem mascarar como Policy denial.

## 127. No eager external connection

Mesmo em Providers futuros, não assumir que:

```
Runtime startup
```

deve abrir todas as conexões.

Preferir lazy initialization quando possível.

Não aplicar isso rigidamente ao filesystem.

## 128. Provider metadata

Metadata deve poder incluir:

- providerId
- version
- capabilityId
- operations

Não incluir segredos.

## 129. Capability metadata vs Provider metadata

Capability:

semântico

Provider:

operacional

Exemplo:

```
Capability:
filesystem

Provider:
local-filesystem
workspaceRoot=/repo
```

workspaceRoot é Provider configuration, não Capability metadata.

## 130. Runtime wiring example

Conceitualmente:

```
const capabilities = new CapabilityRegistry();

capabilities.register(filesystemCapability);

const providers = new CapabilityProviderRegistry();

providers.register(
  new LocalFilesystemProvider({
    workspaceRoot
  })
);

const runtime = createRuntime({
  capabilityRegistry: capabilities,
  providerRegistry: providers,
  ...
});
```

A Tool permanece:

```
{
  id: 'filesystem.read',
  capability: 'filesystem',
  operation: 'read'
}
```

## 131. Provider resolver

Criar:

```
CapabilityResolver
```

com responsabilidade:

```
Tool
 ↓
Capability
 ↓
Provider
```

Isso evita que ToolRuntime acumule toda a lógica de registry.

## 132. ToolRuntime responsibility after Fase 4

O ToolRuntime deve continuar coordenando:

- resolve
- authorize
- approve
- resolve capability/provider
- execute
- emit

mas não implementar diretamente:

```
filesystem.read()
```

## 133. ProviderResolver responsibility

ProviderResolver:

```
resolve(capabilityId, operation, resource)
```

retorna:

```
Provider
```

ou erro tipado.

Não executa.

## 134. CapabilityResolver responsibility

CapabilityResolver:

```
resolve(tool)
```

retorna:

```
Capability
```

Não executa.

## 135. No capability execution logic

Não implementar:

```
Capability.execute()
```

A execução concreta é Provider.

Capability é contrato.

## 136. Provider operation API

Preferência:

```
provider.execute({
  operation,
  input,
  resource,
  context
})
```

em vez de:

```
provider.read(...)
provider.write(...)
provider.delete(...)
```

Isso mantém um contrato uniforme.

Internamente o Provider pode despachar por operação.

## 137. Provider method security

Mesmo com:

```
operation='read'
```

o Provider deve validar que a operação pertence ao conjunto suportado.

Não confiar apenas no ProviderRegistry.

Defense in depth.

## 138. Provider context immutability

O contexto entregue ao Provider deve ser snapshot/frozen quando tecnicamente razoável.

O Provider não deve conseguir alterar:

- resource
- capabilityId
- agentId
- sessionId

para afetar auditoria.

## 139. Actual resource verification

Para filesystem, o Provider deve reconstruir ou verificar:

```
actual resolved path
```

contra:

```
resource
```

para garantir que o resource autorizado corresponde ao path físico.

## 140. Principle of least authority

Provider deve receber apenas:

```
workspaceRoot
```

para filesystem.

Não:

- process
- environment completo
- network client
- git client
- database client

se não precisar.

## 141. No ambient authority

Não deixar Provider usar diretamente:

- process.cwd()
- process.env
- global filesystem

como autoridade implícita.

Dependências devem ser injetadas.

## 142. Filesystem Provider — dependency injection

O Provider pode receber:

- fs adapter
- path adapter
- workspaceRoot

Isso facilita testes sem tocar filesystem real.

## 143. Real integration tests

Além dos fakes, o filesystem Provider deve possuir testes reais usando:

temporary directory

Não usar:

```
/home/user
```

ou paths do ambiente do desenvolvedor.

## 144. Cleanup

Testes do filesystem devem limpar todos os temporary directories.

Nenhum teste pode deixar arquivos fora da área temporária.

## 145. Determinism

Provider tests não podem depender de:

- machine hostname
- username
- current directory
- global environment

## 146. Runtime example

Criar:

```
example-provider.js
```

demonstrando:

```
oracle
 ↓
filesystem.write
 ↓
Policy allow
 ↓
Capability filesystem
 ↓
LocalFilesystemProvider
 ↓
arquivo criado
```

Depois:

```
filesystem.read
```

para provar round-trip real.

## 147. Approval example

Criar ou expandir exemplo:

```
filesystem.delete
production workspace
```

com:

```
approval-required
```

Founder:

```
approve
```

Policy revalidation:

```
allow
```

Provider:

```
delete
```

Isso prova a integração Fases 2 + 3 + 4.

## 148. Não usar produção real

Os exemplos nunca devem tocar:

- production server
- production database
- real infrastructure

O resource deve ser:

temporary test workspace

ou equivalente.

## 149. Capability provider contract test

Criar um helper:

```
testCapabilityProvider(provider, specification)
```

que permita futuros Providers serem verificados de forma uniforme.

## 150. Provider documentation

Atualizar:

```
docs/architecture/SPECTREE-RUNTIME.md
```

com:

- Capability
- Provider
- ProviderRegistry
- CapabilityResolver
- Resource binding
- Provider execution
- Error model
- Event model
- Filesystem Provider
- Future Sandbox seam

## 151. ADR

Criar ADR apenas se houver decisão arquitetural significativa.

Recomendo um ADR:

```
ADR-04-capability-provider-boundary.md
```

cobrindo:

- Capability ≠ Provider
- Provider ≠ Tool
- Policy ≠ Provider

e a decisão de tornar:

```
CapabilityRegistry
```

um gate real a partir da Fase 4.

## 152. Definition of Done

A Fase 4 só pode ser declarada DONE quando:

- Capability contract está formalizado.
- CapabilityRegistry continua funcionando.
- Provider contract existe.
- ProviderRegistry existe.
- CapabilityResolver existe.
- Tool → Capability está validado.
- Capability → Provider está validado.
- Capability desconhecida bloqueia execução.
- Operation desconhecida bloqueia execução.
- Provider inexistente bloqueia execução.
- Provider não suportando operação bloqueia execução.
- Policy continua sendo avaliada antes de Provider.
- Approval continua sendo respeitado.
- Resume continua revalidando Policy.
- Provider recebe somente contexto autorizado.
- Provider não recebe PolicyEngine.
- Provider não recebe ToolRuntime.
- Agent não recebe Provider.
- Agent authority surface permanece congelada.
- Resource anti-spoofing da Fase 2 permanece intacto.
- resource autorizado == resource do Provider.
- pelo menos um Provider real existe.
- LocalFilesystemProvider funciona.
- path traversal é bloqueado.
- symlink escape é bloqueado ou explicitamente recusado.
- Provider failure é normalizado.
- Provider output não vaza por eventos padrão.
- Providers concorrentes não compartilham estado indevidamente.
- Approval + Provider funciona.
- Policy revalidation + Provider funciona.
- testes unitários passam.
- testes de integração passam.
- testes de segurança passam.
- claude plugin validate . --strict passa.
- nenhum Provider de Git, DB, MCP ou Cloud foi introduzido.
- Sandbox não foi implementado.
- Orchestrator não foi implementado.

## 153. Definition of Architecture Done

Precisamos provar experimentalmente:

```
Agent
  ↓
Tool
  ↓
Policy
  ↓
Capability
  ↓
Provider
  ↓
recurso real
```

e que:

```
Tool
```

não conhece:

```
Provider implementation
```

e:

```
Provider
```

não conhece:

```
Policy implementation
```

e:

```
Agent
```

não conhece:

- CapabilityRegistry
- ProviderRegistry

## 154. Matriz obrigatória

- Situação
  Resultado
- Capability registrada + Provider registrado + Policy allow
  Executa
- Capability inexistente
  CapabilityNotFoundError
- Operation não suportada pela Capability
  UnsupportedCapabilityOperationError
- Provider inexistente
  CapabilityProviderNotFoundError
- Provider não suporta operation
  ProviderOperationNotSupportedError
- Policy deny
  Não chega ao Provider
- Approval pending
  Não chega ao Provider
- Approval denied
  Não chega ao Provider
- Approval approved + revalidation allow
  Executa
- Approval approved + revalidation deny
  Não executa
- Provider falha
  ProviderExecutionError
- Resource fora do boundary
  Provider rejeita

## 155. Invariantes da Fase 4

- **INV-401**
  Capability descreve o que o Runtime sabe fazer.

- **INV-402**
  Provider implementa Capability.

- **INV-403**
  Tool não conhece Provider.

- **INV-404**
  Agent não conhece Provider.

- **INV-405**
  Provider não autoriza sua própria execução.

- **INV-406**
  Policy continua sendo avaliada antes de execução física.

- **INV-407**
  Approval continua sendo obrigatório quando a Policy exigir.

- **INV-408**
  Resume continua revalidando Policy.

- **INV-409**
  Capability desconhecida não executa.

- **INV-410**
  Provider inexistente não executa.

- **INV-411**
  Provider não suportando operation não executa.

- **INV-412**
  Provider recebe apenas o contexto explicitamente autorizado.

- **INV-413**
  Provider não recebe acesso ao ToolRuntime.

- **INV-414**
  Provider não recebe acesso ao PolicyEngine.

- **INV-415**
  Resource do Provider é o mesmo resource autorizado.

- **INV-416**
  Provider não pode alterar o resource autorizado.

- **INV-417**
  Nenhum Provider usa autoridade ambiental implícita quando dependência explícita for suficiente.

- **INV-418**
  Providers não compartilham estado de Session implicitamente.

- **INV-419**
  Provider output bruto não é publicado por eventos padrão.

- **INV-420**
  A superfície de autoridade do Agent permanece estruturalmente congelada.

- **INV-421**
  CapabilityRegistry passa a ser gate obrigatório para execução.

- **INV-422**
  ProviderRegistry é a fonte de resolução de Providers.

- **INV-423**
  Não existe caminho Agent → Provider fora do ToolRuntime.

- **INV-424**
  Nenhum Provider introduz uma capability oculta.

- **INV-425**
  A Fase 4 não altera a Session state machine.

## 156. Handoff obrigatório do Opus 5

O handoff deve conter:

```
## Implementation

arquivos criados/modificados

## Capability Model

diagrama

## Provider Model

diagrama

## Resolution Flow

Tool → Capability → Provider

## Enforcement Flow

Policy → Approval → Capability → Provider

## Resource Binding

prova

## Provider Context

surface + teste estrutural

## First Provider

LocalFilesystemProvider

## Security

path traversal
symlink
resource binding
event projection

## Tests

comando + resultado

## Integration Proof

execução real em workspace temporário

## Compatibility

Fases 1, 2 e 3

## Known Limitations

limitações reais

## Scope Verification

confirmar ausência de Sandbox,
Git/DB/MCP/Cloud e Orchestrator
```

## 157. Regra de ouro da Fase 4

Provider é o braço do Runtime no mundo real, não o dono da autoridade.

A autoridade continua sendo:

```
Policy
+
Founder Approval
```

A capability define:

o que pode ser feito

e o Provider define:

como fazer.

## 158. Resultado estratégico

Ao final da Fase 4 teremos:

```
                    SPECTREE
                        │
       ┌────────────────┼─────────────────┐
       │                │                 │
     SQUAD            POLICY           FOUNDER
       │                │                 │
    "quem é"          "pode?"         "aprovo?"
       │                │                 │
       └────────────────┼─────────────────┘
                        │
                        ▼
                     RUNTIME
                        │
                        ▼
                   CAPABILITY
                        │
                        ▼
                    PROVIDER
                        │
                        ▼
                   REAL WORLD
```

E o primeiro ciclo operacional completo será:

```
Agent
 ↓
filesystem.write
 ↓
Policy
 ↓
[ALLOW]
 ↓
Capability: filesystem
 ↓
Provider: LocalFilesystemProvider
 ↓
workspace/src/file.js
```

Para uma operação de risco:

```
Agent
 ↓
filesystem.delete
 ↓
Policy
 ↓
[APPROVAL REQUIRED]
 ↓
Founder
 ↓
APPROVE
 ↓
Policy Revalidation
 ↓
Capability
 ↓
Provider
 ↓
workspace/file.js
```

Esse é o marco em que o Spectree Runtime passa de uma arquitetura que governa agentes para uma arquitetura que governa agentes capazes de alterar o mundo real.

Por isso, a Fase 4 deve permanecer pequena: um Capability contract sólido, um Provider contract sólido e um único Provider real — filesystem local — são suficientes para validar a arquitetura.

A próxima fronteira, depois disso, será a que realmente separará o Spectree de um executor comum: Sandbox, onde deixaremos de perguntar apenas “o Agent pode fazer?” e passaremos a responder também “em qual ambiente, com quais recursos e sob quais limites físicos essa execução pode ocorrer?”
