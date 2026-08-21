---
status: in-review
owner: TechLeader
depends_on: F1 Runtime Core, F2 Policy Engine, F3 Founder Gate, F4 Capability Providers, F4.5 Squad/Runtime Integration
---

# Spectree Runtime v2 — F05 Sandbox Runtime

> Transcrição da especificação normativa da Fase 5, produzida no harness de
> planejamento do Founder (declarado na fonte: `Status: SPECIFICATION`,
> `Owner: TechLeader`). O texto é o do documento fonte, sem correção, melhoria
> ou complemento. O texto commitado é o contrato real (ver
> `docs/spec/README.md`).
>
> **Duas fontes; esta é a que vale.** A primeira versão deste arquivo nasceu de
> uma exportação achatada do documento original — o transporte dissolveu blocos
> de código em prosa e em bullets, fundiu blocos vizinhos, cercou uma tabela
> que nunca foi cerca e deixou a cauda de fora. A versão atual vem do documento
> colado íntegro pelo Founder no chat, com a marcação original preservada,
> transportada e verificada seção a seção: 186 seções contíguas de 1 a 186,
> `INV-501` a `INV-530` presentes e únicos, 720 linhas de cerca — 360 blocos de
> código.
>
> **A conta da reconciliação fecha, e ela tem quatro parcelas.** 720 cercas na
> fonte contra 666 em disco: 54 linhas, 27 blocos de diferença líquida. Deles,
> **18 dissolveram** em prosa ou bullets (§1 três vezes, §4, §10, §27 duas
> vezes, §28, §60, §61, §73 duas vezes, §95, §102, §171, §183, §184, §186);
> **8 desapareceram em cinco fusões** — a §55 recebeu dois blocos como um,
> a §91 recebeu três, a §155 recebeu quatro, a §156 e a §163 receberam dois
> cada, sempre com os rótulos que viviam fora (`read-only`, `workspace-write`,
> `danger-full-access`, `SandboxPolicy`, `SandboxRegistry`, `SandboxResolver`,
> `SandboxHandle`, `Read-only`, `Workspace-write`, `Danger full access`,
> `requested:`, `backend:`) puxados para dentro da cerca; **2 nunca chegaram**,
> porque a seção de review não existia neste arquivo; e **1 foi fabricado** —
> a tabela da §181 virou cerca em disco, um bloco a mais que a fonte não tem.
> 360 − 18 − 8 − 2 + 1 = 333, exatamente os 666 ÷ 2 que estavam em disco.
> Fusão não é dissolução: na dissolução o bloco vira prosa e some do balanço;
> na fusão o texto continua cercado, mas dois blocos passam a contar como um.
>
> **As duas tabelas, dois veredictos diferentes.** A §91 nunca foi tabela na
> fonte — são três rótulos soltos e três cercas, e o achatamento os fundiu numa
> cerca só; restaurada como estava, sem nada fabricado. A §181 **é** tabela na
> fonte, com cabeçalho `Situação` / `Resultado`, e em disco chegou como cerca
> achatada: as duas células do cabeçalho passaram a ler como se fossem a
> primeira das doze linhas de resultado. É a mesma doença da §93 da F03 —
> texto fabricado por perda de estrutura, não texto perdido. A tabela está
> restaurada, e com ela some a cerca que não existia.
>
> **Esta fase traz review, e com ele o `R13`.** A cauda da fonte é
> `Review do TechLeader — PR #24 — REQUEST CHANGES`, que define `R13` —
> classificação de execução de Tool, Sandbox obrigatório para tools físicas
> self-provided, tools puras explicitamente não-sandboxed, testes das duas
> rotas. Ela fica aqui, ao final e fora da numeração normativa, pelo endereço
> que a F02 fixou: é a rodada de correção que emendou este contrato antes do
> merge, e o `R13` é load-bearing — o código o cita nove vezes
> (`spectree-runtime/tools/tool-runtime.js`,
> `spectree-runtime/tests/sandbox-classification.test.js`), e o `ADR-05`
> (decisão 8), o `docs/architecture/SPECTREE-RUNTIME.md` e a `RUNTIME-F06`
> derivam dele. Sem esta seção, o identificador que sete testes carregam no
> nome não teria definição em disco.
>
> Aprovação: a Fase 5 embarcou em `main` no PR #24 — squash `2841048`, tag
> `v0.29.0`, em 2026-08-20. A citação fica no corpo e não no cabeçalho (ADR-10,
> decisão 13) porque o `git log` **deste arquivo** não a contém: o merge
> aprovou a implementação da fase, e este arquivo só nasceu na transcrição de
> 2026-08-21.
>
> `status: in-review` nesta edição, e **não por rebaixamento** — a ADR-10
> (decisões 5 e 13) aboliu o rebaixamento e manda ler o `status:` da cópia em
> `main`. É a matriz de autoridade que obriga: escrever a linha
> `status: approved` é o ato `artifact-status.approve`, que nenhum agente tem,
> e o guard lê o byte, não o delta. Sob a lei nova, preservar um `approved` que
> já existia é indistinguível de concedê-lo.
>
> Convenção de transcrição: cada linha não vazia da fonte vira exatamente uma
> linha deste arquivo, com no máximo um prefixo. Linha em branco entre
> parágrafos é livre e foi acrescentada; dentro de bloco de código, não —
> o conteúdo cercado é verbatim.

- Implementador: Agente Opus 5
- Baseline: Spectree Runtime v2 — Fases 1, 2, 3, 4 e 4.5 congeladas
- Versão de referência: v0.25.0
- Fase: 5 — Sandbox Runtime

## 1. Contexto

O Spectree Runtime já possui:

```
Fase 1
Agent
AgentLoop
ToolRuntime
Session
EventBus

Fase 2
PolicyEngine
PolicyRegistry
CapabilityRegistry

Fase 3
ApprovalRequest
ApprovalManager
FounderGate
Resume
Policy revalidation

Fase 4
CapabilityProviderRegistry
CapabilityResolver
ProviderRegistry
LocalFilesystemProvider

Fase 4.5
squad.policies.json
Policy document adapter
Guard ↔ Runtime ↔ Tests
principal hardening
```

A Fase 4 adicionou o primeiro acesso físico real através de LocalFilesystemProvider.

A partir desse momento, precisamos separar claramente:

```
autorização
```

de:

```
isolamento físico.
```

A Policy pode dizer:

```
ALLOW filesystem.write
```

mas isso não deve significar:

```
acesso irrestrito ao filesystem do host.
```

O Sandbox introduz essa segunda fronteira.

## 2. Referência DeepSeek

O DeepSeek Harness usa um desenho de sandbox baseado em capability seams: ferramentas não precisam conhecer o mecanismo físico de isolamento; a execução é restrita por um componente de sandbox que pode utilizar mecanismos específicos da plataforma. No Linux, o harness utiliza Landlock; no Windows, Restricted Tokens e ACLs.

O DeepSeek também trabalha com diferentes níveis de isolamento, incluindo read-only, workspace-write e danger-full-access, e mantém uma trilha de escalonamento para operações que foram bloqueadas pelo sandbox.

O Spectree deve aproveitar esses princípios, mas adaptá-los à arquitetura já construída:

```
DeepSeek:
Tool
 ↓
Capability seam
 ↓
Sandbox
 ↓
Provider

Spectree:
Tool
 ↓
Policy
 ↓
Approval
 ↓
Capability
 ↓
Sandbox
 ↓
Provider
```

Essa distinção é normativa.

## 3. Objetivo da Fase

Criar o primeiro Sandbox Runtime do Spectree capaz de:

1. definir uma política de isolamento físico;
2. construir um contexto de sandbox para uma execução;
3. aplicar limites ao Provider;
4. suportar modos de sandbox;
5. detectar capacidades de enforcement da plataforma;
6. diferenciar full de partial enforcement;
7. preservar o contrato do Provider;
8. impedir bypass pelo Agent;
9. manter a Policy e o Founder Gate como autoridades superiores;
10. criar um seam para futuros sandboxes Linux/Windows/Container/Remote.

## 4. Não implementar

Nesta fase não implementar:

```
❌ Docker Runtime
❌ Kubernetes
❌ VM
❌ E2B
❌ Firecracker
❌ gVisor
❌ network proxy real
❌ seccomp
❌ AppArmor
❌ Windows kernel driver
❌ remote sandbox
❌ distributed sandbox
❌ GPU isolation
❌ CPU quotas reais
❌ memory quotas reais
❌ cgroup management completo
❌ subprocess/PTY completo
❌ shell provider completo
❌ Git provider
❌ Database provider
❌ MCP provider
❌ Orchestrator
❌ LLM provider
```

A primeira implementação deve provar a arquitetura com Filesystem Sandbox + Local Provider.

## 5. Princípio arquitetural

O Sandbox não é uma Capability.

Não é um Provider.

Não é uma Policy.

Não é um Founder Gate.

Ele é um execution boundary.

Modelo:

```
Policy
    ↓
Approval
    ↓
Capability
    ↓
Sandbox
    ↓
Provider
```

## 6. Conceito de Sandbox

Criar:

```
Sandbox
```

como abstração:

mecanismo que limita o ambiente físico no qual uma Capability Provider pode operar.

O Sandbox deve receber:

```
SandboxPolicy
```

e produzir:

```
SandboxExecutionContext
```

## 7. SandboxPolicy

Criar:

```
SandboxPolicy
```

com os campos mínimos:

```
mode
workspaceRoot
writableRoots
readableRoots
network
inheritEnvironment
tempDirectory
```

Nem todos precisam ser implementados fisicamente nesta fase.

O contrato deve existir.

## 8. Sandbox modes

Adotar inicialmente três modos, inspirados no desenho do DeepSeek:

```
read-only
workspace-write
danger-full-access
```

O significado no Spectree será ligeiramente diferente.

## 9. read-only

Significa:

```
filesystem write = DENY
```

O Provider pode:

```
read
```

mas não:

```
write
delete
rename
```

Acesso de rede permanece:

```
denied by default
```

até que exista enforcement explícito.

## 10. workspace-write

Significa:

```
read:
  workspace permitido

write:
  workspace permitido

delete:
  workspace permitido conforme Capability + Policy

outside workspace:
  denied
```

Não significa:

```
filesystem inteiro liberado
```

## 11. danger-full-access

Significa:

o Sandbox não adiciona um boundary de filesystem além das restrições do Provider e do SO.

Não significa:

```
Policy bypass
```

Nem significa:

```
Approval bypass
```

Nem significa:

```
Provider bypass
```

Portanto:

```
danger-full-access
```

não transforma:

```
ALLOW
```

em:

```
ALLOW EVERYTHING
```

## 12. Regra fundamental

Mesmo em:

```
danger-full-access
```

o fluxo continua:

```
Agent
 ↓
Policy
 ↓
Approval
 ↓
Capability
 ↓
Sandbox
 ↓
Provider
```

Nunca:

```
Agent
 ↓
danger-full-access
 ↓
Provider
```

## 13. SandboxProvider

Criar:

```
SandboxProvider
```

com responsabilidade de aplicar uma SandboxPolicy.

Contrato conceitual:

```
SandboxProvider
    id
    platform
    capabilities
    apply(policy, context)
    describe(policy)
```

## 14. SandboxProvider ≠ Provider

Exemplo:

```
Capability Provider:
LocalFilesystemProvider
```

Sandbox:

```
LocalFilesystemSandboxProvider
```

O primeiro executa.

O segundo restringe.

## 15. SandboxResolver

Criar:

```
SandboxResolver
```

responsável por:

```
SandboxPolicy
    ↓
SandboxProvider
```

O Runtime não deve conhecer:

```
Landlock
Windows ACL
Docker
container
VM
```

diretamente.

Esses detalhes pertencem ao Provider de Sandbox.

## 16. SandboxRegistry

Criar:

```
SandboxProviderRegistry
```

com:

```
register()
resolve()
list()
has()
```

O Registry deve rejeitar:

```
duplicate provider
unknown platform declaration
invalid capabilities
```

## 17. Sandbox capabilities

A implementação deve permitir declarar capacidades do Sandbox.

Exemplo:

```
filesystem-read-boundary
filesystem-write-boundary
network-boundary
process-boundary
environment-boundary
```

Não implementar todas agora.

A primeira implementação deverá declarar pelo menos:

```
filesystem-write-boundary
filesystem-read-boundary
```

## 18. Enforcement level

Inspirado no DeepSeek, o Sandbox deve informar se o isolamento obtido é:

```
full
partial
none
```

O DeepSeek distingue explicitamente enforcement full e partial, especialmente porque mecanismos diferentes de SO não oferecem exatamente a mesma garantia.

No Spectree:

```
full
```

significa:

a implementação garante o boundary declarado pelos testes e pelo backend.

```
partial
```

significa:

somente parte das restrições pode ser garantida.

```
none
```

significa:

nenhum isolamento físico foi aplicado.

## 19. Default enforcement

O Runtime deve falhar fechado quando um Sandbox obrigatório não consegue aplicar seu boundary.

Não permitir:

```
requested:
workspace-write

actual:
none
```

e continuar silenciosamente.

Resultado:

```
SandboxUnavailableError
```

## 20. Sandbox applicability

Nem toda execução precisa necessariamente de Sandbox.

A decisão deve ser determinada por:

```
Capability
+
SandboxPolicy
```

A Policy de autorização não deve ser responsável por definir detalhes físicos.

## 21. SandboxContext

Criar:

```
SandboxExecutionContext
```

com superfície mínima:

```
sessionId
agentId
capabilityId
operation
resource
sandboxMode
workspaceRoot
```

Aplicar o padrão R8.

Teste obrigatório:

```
Object.keys(context)
```

deve ser congelado.

## 22. Nunca expor Sandbox ao Agent

O Agent continua recebendo:

```
session
mission
runtime.requestTool
```

somente.

Não adicionar:

```
sandbox
sandboxMode
sandboxProvider
```

ao AgentContext.

## 23. Sandbox não é escolhido pelo Agent

O Agent não pode solicitar diretamente:

```
danger-full-access
```

através do input da Tool.

Exemplo proibido:

```
{
  "sandboxMode": "danger-full-access"
}
```

ser interpretado como autoridade.

O Sandbox deve vir do:

```
Runtime configuration
Policy-derived execution profile
Tool/Capability declaration
Founder-authorized context
```

conforme o desenho definido abaixo.

## 24. Sandbox Profile

Criar conceito:

```
SandboxProfile
```

que associa:

```
Capability
Operation
SandboxPolicy
```

Exemplo:

```
filesystem.read
→ read-only

filesystem.write
→ workspace-write
```

Não implementar automaticamente todas as combinações.

## 25. Default Sandbox Policy

A regra inicial:

```
read operations
→ read-only

write operations
→ workspace-write

delete operations
→ workspace-write
```

Não permitir:

```
danger-full-access
```

como default.

## 26. danger-full-access é explicitamente opt-in

Deve exigir configuração explícita.

Idealmente:

```
Provider/Sandbox profile
+
Policy
```

e, para operações de risco, Founder Approval.

Não permitir que uma Tool declare isso sozinha.

## 27. Relationship with Policy

Policy responde:

```
pode executar?
```

Sandbox responde:

```
em quais limites físicos?
```

Exemplo:

```
Policy:
ALLOW filesystem.write / workspace

Sandbox:
workspace-write

Provider:
escrever arquivo
```

## 28. Relationship with Approval

Approval pode autorizar uma operação que estava bloqueada pela Policy.

Mas Approval não deve automaticamente alterar:

```
SandboxPolicy
```

Exemplo:

```
Policy:
approval-required

Founder:
approve

Sandbox:
workspace-write
```

O Founder aprovou a operação.

Não aprovou:

```
acesso irrestrito ao host.
```

## 29. Explicit sandbox escalation

Se uma operação precisar de um Sandbox mais amplo que o atual:

```
workspace-write
```

para:

```
danger-full-access
```

isso deve gerar uma nova decisão de autoridade.

Nunca fazer:

```
sandbox denied
  ↓
automatically retry full-access
```

## 30. Escalation path

Inspirado no DeepSeek, existe um conceito de escalonamento: uma operação bloqueada pelo Sandbox pode solicitar autorização para uma execução de escopo mais amplo. O DeepSeek trata isso como uma rota explícita de approval + retry, não como fallback automático.

No Spectree:

```
Provider
 ↓
Sandbox DENY
 ↓
SandboxEscalationRequest
 ↓
Founder Gate
 ↓
APPROVE
 ↓
new SandboxPolicy
 ↓
revalidation
 ↓
retry once
```

Mas:

essa funcionalidade será apenas o seam nesta fase.

Não implementar um segundo ciclo completo de Approval agora.

## 31. Sandbox Denied ≠ Policy Denied

Erros devem ser diferentes:

```
PolicyDeniedError
```

significa:

não está autorizado.

Enquanto:

```
SandboxDeniedError
```

significa:

está autorizado em princípio, mas o ambiente físico atual não permite.

Isso é importante para diagnóstico.

## 32. SandboxUnavailable

Se o Runtime pedir:

```
workspace-write
```

e não houver backend capaz de garantir o boundary:

```
SandboxUnavailableError
```

Não degradar silenciosamente para:

```
danger-full-access
```

## 33. Platform capabilities

O SandboxProvider pode declarar:

```
platform:
linux
windows
macos
```

e:

```
enforcement:
full
partial
none
```

## 34. Linux

A referência DeepSeek utiliza Landlock no Linux para restrição de filesystem em nível de kernel.

Para o Spectree:

```
LinuxSandboxProvider
```

poderá futuramente utilizar:

```
Landlock
```

mas a Fase 5 não exige uma implementação completa de Landlock.

A primeira entrega deve possuir o contrato e um backend real mínimo.

## 35. Windows

O DeepSeek usa mecanismos baseados em Restricted Tokens e ACLs no Windows.

O Spectree deve criar o seam:

```
WindowsSandboxProvider
```

mas não precisa implementá-lo nesta fase.

É melhor ter:

```
unsupported / unavailable
```

do que uma falsa promessa de isolamento.

## 36. macOS

Não assumir equivalência com Linux.

Criar:

```
MacOSSandboxProvider
```

como futuro seam.

Não implementar uma falsa sandbox apenas para preencher a matriz de plataformas.

## 37. LocalFilesystemProvider integration

O LocalFilesystemProvider da Fase 4 possui seu próprio boundary de workspace e proteção física de path.

Isso permanece.

A Fase 5 deve adicionar:

```
Sandbox boundary
```

por cima:

```
Sandbox
 ↓
LocalFilesystemProvider
```

## 38. Defense in depth

A combinação deve ser:

```
Policy
   ↓
Approval
   ↓
Sandbox
   ↓
Provider invariants
```

Por exemplo:

```
Policy:
ALLOW write

Sandbox:
workspace only

Provider:
canonical path + physical boundary
```

Cada camada protege uma propriedade diferente.

## 39. Provider invariant remains mandatory

Mesmo com Sandbox ativo:

```
LocalFilesystemProvider
```

continua verificando:

```
resource ↔ physical path
```

O Sandbox não substitui R12.

## 40. Sandbox cannot widen Provider permissions

Sandbox:

```
danger-full-access
```

não deve permitir que o Provider ignore:

```
root deletion
resource mismatch
path validation
```

Provider invariants permanecem.

## 41. Sandbox filesystem roots

Definir:

```
readableRoots
writableRoots
```

como listas canônicas.

Exemplo:

```
readableRoots:
  workspace

writableRoots:
  workspace
  temp
```

## 42. Root canonicalization

Antes de aplicar a SandboxPolicy:

```
realpath(root)
```

deve ser calculado.

O mesmo princípio R12 deve ser usado:

```
logical root
      ↓
physical root
```

## 43. Symlink safety

Sandbox roots não devem ser definidos apenas lexicalmente.

Se:

```
workspaceRoot
```

contiver um symlink para fora:

```
workspace/link → /outside
```

o Sandbox deve trabalhar com o boundary físico.

## 44. Writable root safety

Uma writableRoot deve:

```
existir
ou
poder ser criada dentro de uma root já existente e validada
```

Não aceitar:

```
/../outside
```

ou equivalente.

## 45. Temporary directory

Inspirando-se no desenho do DeepSeek, o Sandbox pode possuir um temp privado por Session. O harness utiliza um diretório temporário privado em alguns backends para isolamento de sessão.

No Spectree:

```
session temp
```

deve ser opcional nesta fase.

Se implementado:

```
sessionId
 ↓
private temp root
```

## 46. Temp directory ownership

Nunca reutilizar:

```
global /tmp/spectree
```

como único diretório compartilhado entre Sessions quando contiver dados sensíveis ou executáveis.

Preferência:

```
.temp/sessions/<sessionId>
```

ou equivalente.

## 47. Session isolation

Duas Sessions:

```
A
B
```

não devem compartilhar automaticamente:

```
sandbox temp
environment
mutable state
```

A menos que isso seja explicitamente configurado.

## 48. Environment boundary

Adicionar conceito:

```
environmentPolicy
```

com:

```
inherit
allow
deny
```

Não implementar filtro completo nesta fase.

Mas o Sandbox Context não deve assumir:

```
process.env
```

inteiro.

## 49. Secrets

Nunca herdar automaticamente todas as variáveis de ambiente para operações sandboxed.

O default futuro deve ser:

```
minimal environment
```

Nesta fase:

```
inheritEnvironment = false
```

preferencialmente.

## 50. Network

Criar:

```
NetworkSandboxPolicy
```

com:

```
enabled
allowlist?
denylist?
```

Mas:

não implementar enforcement de rede nesta fase.

O backend pode declarar:

```
network:
unsupported
```

sem fingir isolamento.

## 51. Network default

Na Fase 5:

```
network access = denied / unavailable
```

por default para um sandbox que pretende ser restritivo.

Não adicionar suporte de rede apenas para facilitar npm install.

Esse problema deve ser resolvido por uma Capability/Policy/Provider explícita mais tarde.

## 52. Process boundary

Não implementar ainda o SubprocessProvider.

Mas criar o seam:

```
processPolicy
```

com conceitos futuros:

```
allowSpawn
allowedExecutables
maxProcesses
```

## 53. Shell

A Fase 5 não deve criar Shell Provider.

Mas o desenho do Sandbox deve nascer já preparado para:

```
shell capability
    ↓
subprocess provider
    ↓
sandbox process boundary
```

O DeepSeek mantém subprocesso como capability separada do filesystem e do Sandbox, o que é exatamente a separação que devemos conservar.

## 54. Execution boundary

Criar um conceito central:

```
ExecutionBoundary
```

que descreva:

```
filesystem
network
process
environment
resources
```

A Fase 5 implementará apenas:

```
filesystem
```

mas o modelo deve ser expansível.

## 55. SandboxMode e ExecutionBoundary

```
SandboxMode
    ↓
ExecutionBoundary
```

Exemplo:

```
read-only
    filesystem:
      read = workspace
      write = none
```

```
workspace-write
    filesystem:
      read = workspace
      write = workspace
```

## 56. Sandbox profile as data

Sandbox configuration deve ser declarativa.

Exemplo:

```
{
  "mode": "workspace-write",
  "filesystem": {
    "readRoots": ["workspace"],
    "writeRoots": ["workspace"]
  },
  "network": {
    "enabled": false
  }
}
```

Não hardcode os perfis dentro dos Providers.

## 57. Policy is still authoritative

Uma SandboxPolicy não concede capability.

Exemplo:

```
Sandbox:
workspace-write

Policy:
DENY filesystem.write
```

Resultado:

```
DENY
```

Sandbox nunca transforma deny em allow.

## 58. Sandbox may further restrict

Exemplo:

```
Policy:
ALLOW filesystem.write

Sandbox:
read-only
```

Resultado:

```
SandboxDeniedError
```

O resultado final é deny físico.

Isso é correto.

## 59. Effective execution permission

O Runtime deve pensar conceitualmente em:

```
AuthorizedByPolicy
AND
ApprovedWhenRequired
AND
AllowedBySandbox
AND
ProviderInvariant
```

Somente então:

```
execute
```

## 60. Order of enforcement

A ordem normativa:

```
1. resolve Tool
2. validate Tool
3. resolve Capability
4. build AuthorizationContext
5. Policy
6. Approval
7. resolve SandboxPolicy
8. apply Sandbox
9. resolve Provider
10. execute Provider
```

A sequência exata pode otimizar resolução sem alterar:

```
Policy before physical execution
Approval before physical execution
Sandbox before physical execution
```

## 61. No resource access during sandbox resolution

O SandboxProvider não deve tocar no recurso protegido apenas para "testar" a política.

Exemplo:

```
não abrir arquivo
não conectar banco
não iniciar shell
```

durante apply().

O Sandbox prepara o boundary.

## 62. Sandbox application

A API conceitual:

```
sandboxProvider.apply(policy, context)
```

deve retornar:

```
SandboxHandle
```

com:

```
mode
enforcement
boundary
dispose()
```

## 63. SandboxHandle

O Provider recebe apenas:

```
SandboxHandle
```

ou os mecanismos necessários.

Não recebe:

```
SandboxProvider
```

inteiro.

## 64. Sandbox lifetime

O Sandbox deve existir durante:

```
Provider execution
```

e ser liberado depois.

Fluxo:

```
apply
 ↓
execute
 ↓
cleanup
```

## 65. Cleanup obrigatório

Mesmo em caso de:

```
ProviderError
cancel
exception
```

o Sandbox deve ser desmontado/liberado.

## 66. Cleanup failure

Se cleanup falhar:

```
SandboxCleanupError
```

deve ser observável.

Não esconder.

Se a operação principal já terminou, o Runtime não deve falsificar o resultado como tool.failed se apenas o cleanup falhou.

O evento deve diferenciar:

```
tool.completed
sandbox.cleanup.failed
```

quando aplicável.

## 67. Sandbox event model

Adicionar:

```
sandbox.requested
sandbox.applied
sandbox.denied
sandbox.failed
sandbox.released
```

Não publicar detalhes sensíveis da configuração.

## 68. Event order

Execução permitida:

```
tool.requested
policy.evaluated
sandbox.requested
sandbox.applied
tool.started
provider.started
provider.completed
tool.completed
sandbox.released
```

Não é obrigatório expor:

```
provider.*
```

se o Runtime decidir manter esses eventos internos, mas a ordem do Sandbox deve ser determinística.

## 69. Sandbox denial

Se Sandbox bloquear:

```
tool.requested
policy.evaluated
sandbox.requested
sandbox.denied
```

e:

```
tool.started = 0
provider.started = 0
provider.execute = 0
```

## 70. Sandbox unavailable

Se o backend não consegue aplicar:

```
workspace-write
```

a sequência:

```
sandbox.requested
sandbox.failed
```

e zero execução física.

## 71. Default event projection

Não publicar:

```
environment variables
workspace contents
secret roots
kernel configuration
ACL details
```

em eventos.

## 72. Sandbox observation

Criar uma descrição segura:

```
SandboxDescription
    mode
    enforcement
    platform
    readableRoots (sanitized)
    writableRoots (sanitized)
    network
```

O Founder UI futuro poderá consumir isso.

## 73. Sandbox explanation

Quando bloqueado:

```
SandboxDeniedError
```

deve explicar:

```
qual boundary
qual recurso
qual operação
qual motivo
```

sem expor:

```
segredos
paths sensíveis desnecessários
environment
```

## 74. Escalation seam

Criar:

```
SandboxEscalationRequest
```

com:

```
currentPolicy
requestedPolicy
reason
sessionId
agentId
capabilityId
operation
resource
```

Não executar automaticamente.

## 75. Sandbox escalation ≠ Founder Approval implementation

O objeto apenas representa a solicitação.

O Founder Gate já existe.

Uma fase futura poderá compor:

```
Sandbox escalation
→ ApprovalManager
```

sem duplicar Approval.

## 76. One-time escalation

Uma eventual escalada deve ser:

```
one invocation
```

não:

```
permanent permission
```

Essa regra pode ser registrada no contrato mesmo sem implementação nesta fase.

## 77. No auto retry

Nunca:

```
sandbox denied
↓
retry dangerous
```

automaticamente.

## 78. Sandbox backend selection

A seleção pode usar:

```
platform
capability
mode
```

Exemplo:

```
Linux + workspace-write
→ LinuxSandboxProvider
```

Mas se o Provider não conseguir garantir:

```
→ SandboxUnavailableError
```

## 79. Platform fallback

Não fazer:

```
Linux sandbox unavailable
→ danger-full-access
```

O fallback default é:

```
fail closed
```

## 80. Partial enforcement

Um backend pode declarar:

```
enforcement = partial
```

Mas a decisão de aceitar partial deve ser configurável.

Para uma Capability de alto risco:

```
requiredEnforcement = full
```

pode ser exigido futuramente.

Não deixar isso como string perdida.

## 81. Required enforcement

Adicionar ao Sandbox profile:

```
requiredEnforcement:
  full
  partial
  none
```

Default para workspace-write:

```
full
```

se o backend alegar ser um Sandbox real.

## 82. Capability risk

Não tornar risk obrigatório na Capability.

Mas o contrato deve permitir:

```
capability.metadata.securityLevel
```

futuramente.

Isso poderá influenciar:

```
required sandbox
required approval
```

em fase futura.

## 83. Sandbox policy source

A política física não deve morar no AGENT.md.

Nem no prompt.

Ela deve ser configurável pelo Runtime:

```
sandbox policy document
```

## 84. Squad policy vs Sandbox policy

Não misturar os arquivos.

```
squad.policies.json
    = autorização

sandbox.policies.json
    = execução física
```

Se futuramente houver um único documento composto, ele deve manter namespaces claros.

## 85. Source of truth

O Squad continua sendo proprietário de:

```
agent identity
tool/skill surface
authorization policy
```

O Runtime é proprietário de:

```
sandbox execution profile
```

## 86. Teste de integração com Fase 4.5

O mesmo:

```
squad.policies.json
```

deve continuar alimentando:

```
PolicyEngine
```

e a Sandbox não deve duplicar essa matriz.

## 87. Teste de authority surface

Continuar garantindo:

```
AgentContext
    session
    mission
    runtime.requestTool
```

sem:

```
sandbox
sandboxProvider
sandboxPolicy
```

## 88. Teste de Provider surface

Provider deve continuar vendo:

```
sessionId
agentId
capabilityId
operation
resource
metadata
```

e eventualmente receber:

```
sandboxHandle
```

como capability limitada.

Não receber:

```
SandboxProviderRegistry
```

ou:

```
PolicyEngine
```

## 89. SandboxHandle surface

Aplicar R8 ao Handle.

Exemplo:

```
Object.keys(handle)
```

deve ser explicitamente definido.

Não permitir acesso ao mecanismo bruto do OS quando isso não for necessário.

## 90. First backend

A Fase 5 deve implementar primeiro:

```
LocalFilesystemSandbox
```

sobre:

```
LocalFilesystemProvider
```

A implementação deve provar:

```
read-only
workspace-write
```

Não precisa provar:

```
danger-full-access
```

como enforcement porque esse modo significa explicitamente ausência de restrição adicional.

## 91. LocalFilesystemSandbox behavior

read-only

```
read:
  workspace ✓

write:
  workspace ✗

delete:
  workspace ✗

outside:
  ✗
```

workspace-write

```
read:
  workspace ✓

write:
  workspace ✓

delete:
  workspace ✓

outside:
  ✗
```

danger-full-access

```
Sandbox boundary:
none
```

mas:

```
Policy + Provider invariants
```

continuam ativos.

## 92. Sandbox vs LocalFilesystemProvider

Mesmo em workspace-write:

```
Provider
```

continua garantindo:

```
real path boundary
resource matching
root protection
```

O Sandbox fornece:

```
ambient environment restriction
```

O Provider fornece:

```
operation-level invariant
```

## 93. Read-only enforcement

Para o primeiro backend, é permitido implementar read-only no Provider layer enquanto não existir um OS sandbox físico completo.

Mas isso deve ser classificado:

```
enforcement = partial
```

se a restrição não for fisicamente imposta fora do Provider.

Isso é importante.

Não chamar uma simples verificação em JavaScript de:

```
kernel-level sandbox
```

## 94. Workspace-write enforcement

Da mesma forma:

```
root checking
```

no Provider não é equivalente a:

```
Landlock
```

No primeiro backend:

```
Provider boundary
+
Sandbox policy
```

pode resultar em:

```
enforcement = partial
```

até existir um backend OS-level.

## 95. Linux first-class backend

A fase pode incluir um backend Linux que utilize:

```
Landlock
```

se o ambiente e a implementação permitirem.

Mas:

não inventar uma implementação pseudo-Landlock.

Se houver apenas uma proteção no Provider:

```
documentar como partial
```

## 96. Windows backend

Não implementar Restricted Token completo nesta fase.

O Registry deve poder responder:

```
windows
→ unavailable
```

sem quebrar o Runtime inteiro.

## 97. macOS backend

Mesma regra.

Sem backend real:

```
unavailable
```

não:

```
fake full
```

## 98. Sandbox capabilities matrix

Criar um mecanismo para perguntar:

```
provider.supports({
  mode,
  capability,
  requiredEnforcement
})
```

Exemplo:

```
LinuxSandboxProvider
  workspace-write
  full
  ✓
```

ou:

```
LocalFilesystemSandbox
  workspace-write
  partial
  ✓
```

se a política aceitar partial.

## 99. Sandbox negotiation

O Runtime pode fazer:

```
requested profile
   ↓
provider capabilities
   ↓
compatible?
```

Não tentar "aproximar" silenciosamente.

## 100. No silent downgrade

Proibido:

```
workspace-write
↓
backend supports read-only
↓
execute as read-only
```

A menos que a execução explicitamente aceite downgrade.

Default:

```
deny
```

## 101. Sandbox policy immutability

Assim como Policy e Approval snapshot:

```
SandboxPolicy
```

deve ser congelada por execução.

Não permitir alteração enquanto Provider está rodando.

## 102. Sandbox snapshot

Uma execução deve possuir:

```
sandboxPolicySnapshot
```

para permitir auditoria:

```
qual sandbox estava aplicado?
```

## 103. Resume

Se uma Approval for retomada:

```
Approval
 ↓
Policy revalidation
 ↓
SandboxPolicy reconstruction
 ↓
Sandbox apply
 ↓
Provider execute
```

O Sandbox não deve simplesmente reutilizar um handle antigo.

## 104. Approval + Sandbox

Se:

```
Policy = approval-required
```

não aplicar Sandbox físico ainda que isso fosse custoso.

A sequência deve ser:

```
Policy
→ Approval
→ Sandbox
```

para evitar inicializar ambientes para operações nunca autorizadas.

## 105. Sandbox + Provider resolution

Não resolver recursos físicos no Provider antes do Sandbox estar pronto.

A exceção é metadata puramente declarativa.

## 106. Session cancellation

Em:

```
Session.cancel()
```

o SandboxHandle deve ser liberado.

Se houver processos futuros:

```
sandbox cleanup
```

deve acompanhar o cancelamento.

## 107. Sandbox cleanup idempotency

Chamar:

```
dispose()
```

duas vezes não pode:

```
double free
```

nem produzir estado inconsistente.

## 108. Session isolation test

Criar duas Sessions:

```
A
B
```

com:

```
sandbox temp A
sandbox temp B
```

e provar que:

```
A cannot access B temp
B cannot access A temp
```

## 109. Boundary test

Testar:

```
workspace
outside
```

e:

```
workspace/link → outside
```

em conjunto com os testes R12 da Fase 4.

## 110. Read-only regression

Confirmar:

```
Policy allow
+
Capability filesystem
+
Provider available
+
Sandbox read-only
```

resulta em:

```
read ✓
write ✗
delete ✗
```

## 111. Workspace-write regression

Confirmar:

```
Policy allow
+
workspace-write
```

resulta:

```
read ✓
write ✓
delete ✓
outside ✗
```

## 112. Policy denial precedence

Confirmar:

```
Policy deny
+
Sandbox danger-full-access
```

resulta:

```
DENY
```

e zero Provider execution.

## 113. Approval denial

Confirmar:

```
Policy approval-required
Founder deny
Sandbox workspace-write
```

resulta:

```
zero Sandbox application
zero Provider execution
```

## 114. Approval success

Confirmar:

```
Policy approval-required
Founder approve
Policy revalidation allow
Sandbox workspace-write
Provider execute
```

## 115. Policy change

Confirmar:

```
approve
↓
policy changes deny
↓
resume
```

resulta:

```
no Sandbox apply
no Provider execute
```

## 116. Sandbox unavailable

Confirmar:

```
Policy allow
Capability available
Sandbox requested
Sandbox unavailable
```

resulta:

```
SandboxUnavailableError
Provider.execute = 0
```

## 117. Sandbox denied

Confirmar:

```
Policy allow
Sandbox denies
```

resulta:

```
SandboxDeniedError
Provider.execute = 0
```

## 118. Provider failure

Confirmar:

```
Policy allow
Sandbox applied
Provider fails
```

resulta:

```
provider.failed
tool.failed
sandbox.released
```

## 119. Cleanup after failure

Mesmo com:

```
ProviderExecutionError
```

o Sandbox deve ser liberado.

Testar explicitamente.

## 120. Cleanup after cancellation

Mesmo com:

```
Session.cancel()
```

o Sandbox deve ser liberado.

## 121. Cleanup after exception

Qualquer exception inesperada:

```
throw
```

deve passar por:

```
finally:
  sandbox.dispose()
```

ou equivalente seguro.

## 122. No leaked sandbox state

Após uma execução:

```
temp directory
handles
mounts
ACLs
```

não devem permanecer sem cleanup, dentro do que o backend suportar.

## 123. Sandbox audit events

Cada aplicação deverá produzir:

```
sandbox.applied
```

com:

```
mode
enforcement
providerId
```

não com:

```
raw OS credentials
ACL contents
environment
```

## 124. Enforcement reporting

O Runtime deve tornar explícito:

```
requested:
workspace-write

effective:
workspace-write

enforcement:
partial
```

ou:

```
requested:
workspace-write

effective:
workspace-write

enforcement:
full
```

Não ocultar diferenças entre pedido e enforcement.

## 125. Safety invariant

Se:

```
requestedEnforcement = full
```

e backend retorna:

```
partial
```

resultado:

```
SandboxUnavailableError
```

por default.

Não executar.

## 126. Explicit partial opt-in

Uma futura configuração pode permitir:

```
allowPartialEnforcement = true
```

Mas o default será:

```
false
```

## 127. Platform reporting

Sandbox description deve incluir:

```
platform
backend
version
enforcement
```

quando disponível.

## 128. Backend versioning

Cada backend deve possuir:

```
providerId
version
```

para diagnóstico.

## 129. No dependency on CLI environment

Sandbox Provider não deve assumir:

```
cwd
PATH
environment
```

como autoridade.

Configuração deve ser injetada.

## 130. Sandbox configuration source

Inicialmente:

```
createRuntime({
  sandboxProfile,
  sandboxProviderRegistry
})
```

via DI.

Não usar singleton.

## 131. No default danger-full-access

Se:

```
sandboxProfile = undefined
```

não assumir:

```
danger-full-access
```

A decisão deve ser:

```
safe default
```

Preferência:

```
read-only
```

para operações não mutantes.

Para Tool mutante sem perfil explícito:

```
SandboxConfigurationError
```

ou fallback documentado para workspace-write.

## 132. Recommendation for defaults

Minha recomendação:

```
filesystem.read
→ read-only

filesystem.write
→ workspace-write

filesystem.delete
→ workspace-write

destructive/unclassified
→ configuration-required
```

Isso impede que novas Tools mutantes surjam sem Sandbox profile.

## 133. Tool sandbox metadata

Tool pode declarar metadata:

```
sandbox:
  mode: workspace-write
```

Mas isso não deve ser autorização.

É apenas uma requisição declarativa de execução.

O Runtime ainda precisa validar:

```
Policy
Approval
```

e pode aplicar um perfil mais restritivo.

Uma Tool nunca pode forçar um perfil mais permissivo que o Runtime permitir.

## 134. Sandbox ceiling

Definir:

```
effectiveSandbox = min(
  runtimeMax,
  capabilityProfile,
  toolRequestedProfile
)
```

conceitualmente.

Não implementar algoritmo matemático literal; implementar uma resolução que assegure:

uma Tool pode pedir somente iguais ou menores privilégios que o máximo permitido pelo Runtime.

## 135. No sandbox widening by Tool

Proibido:

```
Tool says danger-full-access
```

e Runtime aceitar isso automaticamente.

## 136. Sandbox profile resolution

Criar:

```
SandboxProfileResolver
```

para:

```
Tool
Capability
Runtime configuration
```

→:

```
SandboxPolicy
```

## 137. Profile source precedence

Sugestão:

```
Runtime maximum restriction
    >
Capability profile
    >
Tool requested profile
```

A camada mais restritiva vence.

## 138. Founder approval cannot lower restrictions

Founder pode autorizar uma operação.

Não pode alterar arbitrariamente:

```
sandbox profile
```

por meio de um campo do ApprovalRequest.

Se houver necessidade de sandbox mais amplo:

```
separate escalation contract
```

## 139. Sandbox escalation later

A sequência futura:

```
sandbox.denied
 ↓
SandboxEscalationRequest
 ↓
Founder approval
 ↓
new SandboxProfile
 ↓
Policy revalidation
 ↓
Sandbox apply
 ↓
retry once
```

Não implementar o retry nesta fase.

## 140. No infinite retry

Mesmo futuramente:

```
maximum 1 escalation
```

por invocation.

## 141. Filesystem Provider remains first integration

A Fase 5 deve adaptar:

```
LocalFilesystemProvider
```

para receber:

```
SandboxHandle
```

ou a abstração equivalente.

Não reescrever o Provider de filesystem inteiro.

## 142. LocalFilesystemSandbox test backend

Criar um backend de teste:

```
TestSandboxProvider
```

que não simula segurança física.

Ele serve para:

```
lifecycle
policy
context
events
cleanup
```

Não marcar como full.

## 143. Real enforcement backend

Ao menos um backend real deverá ser demonstrado.

Se a implementação real de OS-level sandbox não puder ser feita nesta fase sem dependências perigosamente grandes, o Opus deve:

```
implementar o contrato
+
implementar provider restritivo local
+
declarar enforcement=partial
```

e documentar claramente que o backend kernel-level está reservado.

Nunca mascarar partial como full.

## 144. DeepSeek adaptation principle

O DeepSeek demonstra que:

```
Tool
```

não precisa conhecer:

```
Windows ACL
```

porque a capability seam troca o provider.

O Spectree deve fazer o mesmo:

```
LocalFilesystemProvider
        │
        ▼
SandboxProvider
        │
        ├── Linux
        ├── Windows
        └── future remote
```

Mas sem transformar o Provider em um plugin monolítico.

## 145. Subprocess preparation

O DeepSeek separa filesystem de subprocess runtime.

O Spectree deve manter essa separação.

A Fase 5 não deverá criar:

```
ShellProvider
```

apenas para ter uma demonstração mais chamativa.

O objetivo é construir a boundary.

## 146. Process sandbox future

Quando o Shell/Process Provider existir:

```
Sandbox
```

deverá poder restringir:

```
filesystem
network
environment
process tree
```

sem mudar o Agent.

## 147. Event compatibility

O EventBus da Fase 1 permanece congelado.

Sandbox apenas adiciona novos eventos.

Não alterar:

```
publish
subscribe
unsubscribe
```

## 148. Capability event separation

Não substituir:

```
provider.*
```

por:

```
sandbox.*
```

Os dois descrevem dimensões diferentes:

```
sandbox
= boundary

provider
= execution
```

## 149. Auditability

Uma execução deve ser capaz de reconstruir:

```
policy decision
approval
capability
sandbox mode
sandbox enforcement
provider
resource
result
```

Não é necessário persistir agora.

Eventos devem permitir isso.

## 150. Security labels

Sandbox decisions devem possuir:

```
sandboxMode
enforcement
providerId
```

para futura auditoria.

## 151. Error taxonomy

Adicionar:

```
SandboxError
SandboxConfigurationError
SandboxUnavailableError
SandboxDeniedError
SandboxCapabilityError
SandboxCleanupError
SandboxEscalationRequiredError
```

Erros tipados.

## 152. Capability mismatch

Se:

```
Capability:
filesystem

Sandbox:
supports filesystem = false
```

resultado:

```
SandboxCapabilityError
```

antes do Provider.

## 153. Sandbox provider mismatch

Se:

```
sandboxProvider:
linux

current platform:
windows
```

não executar.

Resultado:

```
SandboxUnavailableError
```

## 154. Contract tests

Criar:

```
sandboxProviderContract(provider)
```

testando:

```
describe
supports
apply
cleanup
enforcement
errors
```

Futuros Sandboxes deverão passar pelo mesmo contrato.

## 155. Unit tests

SandboxPolicy

```
defaults
normalization
immutability
invalid combinations
```

SandboxRegistry

```
registration
duplicate
resolution
unsupported provider
```

SandboxResolver

```
mode selection
provider selection
enforcement compatibility
```

SandboxHandle

```
lifecycle
cleanup
idempotency
```

## 156. Integration tests

Read-only

```
read = success
write = denied
delete = denied
```

Workspace-write

```
read = success
write = success
delete = success
outside = denied
```

Danger full access

Apenas provar que:

```
Sandbox boundary = none
```

sem afirmar segurança extra.

## 157. Security tests

Obrigatórios:

```
path traversal
parent symlink
junction
absolute path
outside write
outside read
root deletion
cross-session temp access
```

Os testes R12 da Fase 4 devem permanecer verdes.

## 158. Integration test: Policy

```
Policy deny
```

deve impedir Sandbox application.

## 159. Integration test: Approval

```
Approval pending
```

deve impedir Sandbox application.

## 160. Integration test: Approval resume

```
approve
revalidate
sandbox apply
provider execute
```

## 161. Integration test: Policy revalidation

```
approved
policy changed deny
```

deve resultar:

```
Sandbox apply = 0
Provider execute = 0
```

## 162. Integration test: cleanup

Para:

```
success
failure
cancel
```

verificar:

```
sandbox disposed = true
```

## 163. Integration test: enforcement mismatch

requested:

```
workspace-write/full
```

backend:

```
partial
```

resultado:

```
SandboxUnavailableError
```

## 164. Integration test: provider boundary

Provar:

```
Sandbox boundary
+
Provider boundary
```

não entram em conflito e ambos são necessários.

## 165. Teste de surface R8 — SandboxContext

Exigir:

```
Object.keys(context)
```

igual à lista definida.

## 166. Teste de surface R8 — SandboxHandle

Exigir:

```
Object.keys(handle)
```

igual à lista definida.

## 167. Teste de bypass

O Agent não consegue obter:

```
SandboxProvider
SandboxRegistry
SandboxHandle
SandboxPolicy
```

diretamente.

## 168. Teste de runtime wiring

createRuntime() deve receber:

```
sandboxProviderRegistry
sandboxProfileResolver
```

via DI.

Nenhum singleton global.

## 169. Default runtime behavior

Para runtime sem Sandbox provider:

```
read-only operation
```

pode funcionar apenas se o Provider possuir enforcement local equivalente e o profile permitir partial.

Para:

```
workspace-write/full
```

deve falhar fechado se não houver backend capaz.

## 170. Documentation

Atualizar:

```
docs/architecture/SPECTREE-RUNTIME.md
```

com:

```
Sandbox concept
SandboxPolicy
SandboxMode
ExecutionBoundary
SandboxProvider
SandboxRegistry
Enforcement levels
Filesystem sandbox
Platform strategy
Approval escalation seam
Provider interaction
Security invariants
```

## 171. ADR

Criar:

```
docs/adr/ADR-05-sandbox-execution-boundary.md
```

com as decisões:

```
Sandbox é camada separada de Policy.
Sandbox é camada separada de Provider.
Default fail-closed.
full/partial/none são estados explícitos.
danger-full-access não bypassa Policy.
sandbox escalation não é automatic retry.
primeiro backend é filesystem.
backend OS-specific será substituível.
```

## 172. Example

Criar:

```
spectree-runtime/example-sandbox.js
```

Demonstrar:

```
filesystem.read
    ↓
read-only
    ↓
success
```

e:

```
filesystem.write
    ↓
read-only
    ↓
SandboxDeniedError
```

Depois:

```
filesystem.write
    ↓
workspace-write
    ↓
success
```

## 173. Example com Policy

Demonstrar:

```
Agent
 ↓
Policy allow
 ↓
Sandbox workspace-write
 ↓
Capability filesystem
 ↓
Provider local-filesystem
 ↓
write
```

## 174. Example com Policy deny

Demonstrar:

```
Policy deny
 ↓
Sandbox nunca aplicado
 ↓
Provider nunca chamado
```

## 175. Example com Approval

Não é necessário um segundo Founder Gate dentro da Sandbox.

Usar o mecanismo existente:

```
Policy
 ↓
Approval
 ↓
Policy revalidation
 ↓
Sandbox
 ↓
Provider
```

## 176. Known limitations expected

É aceitável terminar a Fase 5 com:

```
Linux full enforcement
Windows unavailable
macOS unavailable
network unsupported
process sandbox unsupported
partial local filesystem enforcement
```

desde que isso seja explicitamente reportado.

É preferível:

```
honest partial
```

a:

```
fake full
```

## 177. Definition of Done

A Fase 5 só pode ser considerada DONE quando:

- SandboxPolicy existir.

- SandboxMode existir.

- SandboxProvider existir.

- SandboxRegistry existir.

- SandboxResolver existir.

- SandboxHandle existir.

- ExecutionBoundary existir.

- full/partial/none existir.

- default fail-closed existir.

- read-only existir.

- workspace-write existir.

- danger-full-access existir conceitualmente.

- Tool não puder escolher diretamente danger-full-access.

- Agent não puder acessar Sandbox.

- Policy continuar antes do Sandbox.

- Approval continuar antes do Sandbox.

- Sandbox continuar antes da execução física.

- Provider continuar depois do Sandbox.

- Provider invariants continuarem funcionando.

- Resource binding continuar intacto.

- Sandbox context possuir superfície travada por R8.

- Sandbox handle possuir superfície travada por R8.

- Sandbox cleanup for successful execution funcionar.

- Sandbox cleanup after failure funcionar.

- Sandbox cleanup after cancellation funcionar.

- um backend real existir.

- backend informar enforcement verdadeiro.

- não existir downgrade silencioso.

- path traversal continuar bloqueado.

- parent symlink/junction continuar bloqueado.

- outside resource continuar bloqueado.

- read-only impedir write/delete.

- workspace-write permitir somente roots declaradas.

- duas Sessions estiverem isoladas.

- Policy DENY impedir Sandbox application.

- Approval pending impedir Sandbox application.

- Policy revalidation DENY impedir Sandbox application.

- SandboxUnavailable impedir Provider execution.

- SandboxDenied impedir Provider execution.

- Sandbox não alterar a Session state machine.

- Fases 1–4.5 continuarem verdes.

- claude plugin validate . --strict passar.

- documentação atualizada.

- ADR-05 criado.

- nenhum Shell/DB/Git/MCP provider real introduzido.

- nenhum Orchestrator introduzido.

## 178. Definition of Architecture Done

A arquitetura estará concluída somente quando conseguirmos provar:

```
Policy
 ↓
Approval
 ↓
Capability
 ↓
Sandbox
 ↓
Provider
```

e que cada camada possui responsabilidade distinta.

Precisamos provar:

```
Policy deny
    → Sandbox não inicia

Approval pending
    → Sandbox não inicia

Sandbox deny
    → Provider não executa

Provider invariant
    → continua valendo com Sandbox

Policy allow + Sandbox allow
    → Provider executa

Policy allow + Sandbox partial
    → só executa se partial for explicitamente aceitável

Policy allow + Sandbox unavailable
    → fail closed
```

## 179. Invariantes da Fase 5

- **INV-501**
  Sandbox nunca concede autorização.

- **INV-502**
  Policy continua sendo autoridade normativa.

- **INV-503**
  Founder Approval continua sendo decisão humana, não sandbox bypass.

- **INV-504**
  Capability continua definindo o contrato operacional.

- **INV-505**
  Provider continua executando a operação física.

- **INV-506**
  Sandbox limita o ambiente físico da execução.

- **INV-507**
  Agent não controla SandboxPolicy.

- **INV-508**
  Tool não pode ampliar SandboxPolicy.

- **INV-509**
  Provider não pode ampliar SandboxPolicy.

- **INV-510**
  Ausência de enforcement obrigatório resulta em fail-closed.

- **INV-511**
  partial nunca é tratado como full.

- **INV-512**
  Não existe downgrade silencioso.

- **INV-513**
  Sandbox application ocorre antes da execução física.

- **INV-514**
  Sandbox cleanup ocorre sempre.

- **INV-515**
  Sandbox resource boundary é físico quando o backend declara full.

- **INV-516**
  Provider resource boundary continua válido.

- **INV-517**
  Resource autorizado deve continuar correspondente ao recurso executado.

- **INV-518**
  Sandbox não altera a Policy.

- **INV-519**
  Sandbox não altera Approval.

- **INV-520**
  Approval não altera silenciosamente Sandbox.

- **INV-521**
  Um Sandbox não pode ser reutilizado entre Sessions sem isolamento explícito.

- **INV-522**
  Agent nunca recebe SandboxProvider.

- **INV-523**
  Agent nunca recebe SandboxHandle.

- **INV-524**
  Sandbox context possui superfície estruturalmente travada.

- **INV-525**
  Sandbox handle possui superfície estruturalmente travada.

- **INV-526**
  No runtime existe uma única fronteira de aplicação de Sandbox.

- **INV-527**
  Não existe caminho Agent → Provider fora do ToolRuntime.

- **INV-528**
  Não existe caminho Agent → Sandbox fora do ToolRuntime.

- **INV-529**
  Sandbox escalation não executa automaticamente.

- **INV-530**
  Sandbox escalation não cria autorização permanente.

## 180. Handoff obrigatório do Opus 5

O handoff deve conter:

```
## Implementation
arquivos criados/modificados

## DeepSeek Adaptation
o que foi adotado
o que foi deliberadamente não adotado

## Sandbox Model
SandboxPolicy
SandboxMode
ExecutionBoundary

## Provider Model
SandboxProvider
Registry
Resolver

## Enforcement
full / partial / none

## Platform Matrix
Linux
Windows
macOS

## Security
workspace
symlink
junction
traversal
temp
environment

## Lifecycle
apply
execute
release

## Approval Integration
pending
approve
revalidate
sandbox

## Tests
comando + resultado

## Integration Proof
Policy
Approval
Capability
Sandbox
Provider

## Known Limitations
limitações reais

## Scope Verification
confirmar ausência de
Shell/DB/Git/MCP/Cloud/Orchestrator
```

## 181. Matriz final obrigatória

| Situação | Resultado |
|---|---|
| Policy deny | PolicyDeniedError |
| Approval pending | execução suspensa |
| Approval denied | stop |
| Policy revalidation deny | stop |
| Capability missing | CapabilityNotFoundError |
| Sandbox missing | SandboxUnavailableError |
| Sandbox denied | SandboxDeniedError |
| Sandbox partial + partial não permitido | SandboxUnavailableError |
| Sandbox full + policy allow | Provider pode executar |
| Provider invariant violation | Provider error |
| Provider success | Tool success |

## 182. Fluxo final da Fase 5

```
                         AGENT
                           │
                           ▼
                     AgentLoop
                           │
                           ▼
                     ToolRuntime
                           │
                           ▼
                      POLICY
                    /         \
                 DENY        APPROVAL
                   │            │
                  STOP       Founder
                                │
                         Policy Revalidation
                                │
                                ▼
                           CAPABILITY
                                │
                                ▼
                            SANDBOX
                         /      │      \
                    DENY      PARTIAL    FULL
                      │          │        │
                     STOP    policy?      ▼
                                  │     PROVIDER
                                  │        │
                                  └────►   EXECUTE
```

## 183. O que estamos copiando do DeepSeek

Estamos adotando os princípios que provaram ser úteis:

```
Capability seam
Sandbox provider abstraction
Platform-specific enforcement
Explicit sandbox modes
Full / partial enforcement
Restricted-by-default
Approval escalation seam
Filesystem + subprocess separation
```

O DeepSeek demonstra que essa arquitetura permite trocar o mecanismo de execução sem modificar as ferramentas consumidoras.

## 184. O que NÃO estamos copiando do DeepSeek

O Spectree não deve copiar:

```
Cordis
plugin framework inteiro
subprocess runtime inteiro
PTY
E2B
UI
remote API
session architecture deles
```

porque essas coisas pertencem a problemas que o Spectree já resolveu ou resolverá em outras fases.

## 185. Regra de ouro

Sandbox não existe para dizer se o Agent pode executar uma operação.

Isso já é responsabilidade da Policy.

Sandbox existe para garantir que, mesmo autorizado, o Agent só consiga executar dentro da fronteira física concedida.

Essa separação é a essência da Fase 5.

## 186. Resultado estratégico

Ao final da Fase 5, o Spectree deverá ter evoluído de:

```
Agent
 ↓
Policy
 ↓
Capability
 ↓
Provider
```

para:

```
Agent
 ↓
Policy
 ↓
Founder Approval
 ↓
Capability
 ↓
Sandbox
 ↓
Provider
 ↓
Physical Resource
```

A partir daí teremos, pela primeira vez, um Runtime que possui as cinco dimensões fundamentais:

```
IDENTITY
AUTHORIZATION
HUMAN OVERRIDE
CAPABILITY
EXECUTION BOUNDARY
```

O próximo grande marco depois dessa fase será o Process/Subprocess Capability, porque aí poderemos aplicar a arquitetura do DeepSeek à execução de comandos e, finalmente, responder a um dos problemas mais difíceis do Agent Runtime:

```
"o agente pode executar este comando?"
```

não apenas em termos de Policy, mas:

```
"qual processo pode nascer,
com qual filesystem,
qual rede,
qual ambiente,
qual árvore de processos
e qual limite de vida?"
```

Esse será o passo seguinte depois que o Sandbox estiver sólido.

## Review do TechLeader — PR #24 — REQUEST CHANGES

Não solicito nenhuma alteração relacionada à arquitetura do Sandbox que já foi implementada. Só quero fechar:

```
R13
Tool execution classification
+ Sandbox obrigatório para self-provided physical tools
+ pure tools explicitamente não-sandboxed
+ testes de ambas as rotas
```

Depois disso:

```
npm test
→ 196+ verdes

npm run example:sandbox
→ green

claude plugin validate . --strict
→ green
```

