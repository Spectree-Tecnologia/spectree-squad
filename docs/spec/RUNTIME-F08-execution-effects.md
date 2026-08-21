---
status: approved
owner: TechLeader
updated: 2026-08-20
approved: 2026-08-20 (merge do PR #27 em `main`: squash `97e25a7`, tag `v0.32.0`. Texto transcrito para este repositorio em 2026-08-21, com equivalencia de conteudo medida linha a linha)
depends_on: F1 Runtime Core, F2 Policy Engine, F3 Founder Gate, F4 Capability Providers, F4.5 Squad/Runtime Integration, F5 Sandbox Runtime, F6 Process/Subprocess, F7 Linux Physical Sandbox
---

# Spectree Runtime v2 — Fase 8: Execution Effects / Resource Model

> Transcrição da especificação normativa da Fase 8, produzida no harness de
> planejamento do Founder (owner declarado na fonte: TechLeader). Esta versão
> restaura a marcação markdown perdida no transporte; o texto é o do documento
> fonte, sem correção, melhoria ou complemento. O texto commitado é o contrato
> real (ver `docs/spec/README.md`).
>
> Aprovação a derivar: a Fase 8 embarcou em `main` no PR #27 — squash
> `97e25a7`, tag `v0.32.0`, em 2026-08-20. A data está no git; o flip de
> `status:` e o preenchimento de `approved:` são ato do Invoker (a matriz de
> autoridade barra `rubick -> artifact-status.approve`).
>
> `updated:` registra a data do conteúdo, não a do arquivo: a transcrição
> feita em 2026-08-21 restaurou marcação e não alterou conteúdo.

- Status: Proposed
- Owner: TechLeader
- Phase: F8
- Depends on: F1 Runtime Core, F2 Policy Engine, F3 Founder Gate, F4 Capability Providers, F4.5 Squad/Runtime Integration, F5 Sandbox Runtime, F6 Process/Subprocess, F7 Linux Physical Sandbox
- Next: F9 Shell
- Normative language: MUST, MUST NOT, SHOULD, SHOULD NOT, MAY

## 1. Objetivo

A Fase 8 introduz o modelo normativo de Execution Effects.

O objetivo é retirar do cwd a responsabilidade implícita de representar tudo o que uma execução pode afetar.

Até a Fase 7, a autorização e o sandbox conseguem responder principalmente:

"Este processo pode nascer neste workspace e sob este boundary?"

Isso é suficiente para process.spawn simples, mas não para uma operação expressiva que possa:

- ler vários recursos;
- escrever em vários recursos;
- criar recursos;
- renomear recursos;
- remover recursos;
- criar links;
- executar outro processo;
- estabelecer efeitos adicionais no futuro.

A Fase 8 deve permitir que o Runtime responda:

"Quais efeitos esta execução está autorizada a produzir e sobre quais recursos?"

A partir desta fase:

```
cwd != execution effects
```

cwd passa a ser somente contexto de execução, e não o modelo completo de autorização.

## 2. Resultado arquitetural esperado

A arquitetura deixa de ser:

```
Tool
  ↓
Policy(resource baseado no cwd)
  ↓
Sandbox(cwd)
  ↓
Provider
```

e passa a ser:

```
Tool Request
     ↓
Effect Resolver
     ↓
Execution Effect Set
     ↓
Policy Evaluation
     ↓
Founder Gate, se necessário
     ↓
Sandbox Resolution
     ↓
Provider
     ↓
Execution
```

O caminho normativo passa a ser:

```
request
  ↓
resolve identity
  ↓
resolve resources
  ↓
resolve effects
  ↓
authorize ALL effects
  ↓
resolve physical boundary
  ↓
execute
```

Nenhuma execução física pode ocorrer antes da autorização de seu EffectSet.

## 3. Princípios normativos

- **INV-801** — Effect Set é a unidade normativa

  Toda execução física governada pelo Runtime MUST possuir um ExecutionEffectSet.

  Uma execução sem ExecutionEffectSet MUST NOT ser considerada autorizável por este modelo.

- **INV-802** — cwd não é efeito

  cwd MUST NOT ser utilizado como substituto de resource.

  cwd representa:

  ```
  onde o processo inicia
  ```

  e não:

  ```
  o que o processo poderá afetar
  ```

- **INV-803** — Efeitos são explícitos

  Cada efeito MUST possuir:

  ```
  kind
  operation
  resource
  ```

  e uma identidade determinística.

  Exemplo:

  ```
  {
    kind: "filesystem",
    operation: "write",
    resource: "filesystem://workspace/docs/a.md"
  }
  ```

- **INV-804** — Efeitos múltiplos são autorizados como conjunto

  Uma execução que possui múltiplos efeitos MUST ser tratada como uma única operação lógica composta por todos os efeitos declarados.

  Não existe autorização parcial.

  Se:

  ```
  E1 = ALLOW
  E2 = ALLOW
  E3 = DENY
  ```

  o resultado da execução inteira é:

  ```
  DENY
  ```

  Nenhum efeito autorizado individualmente pode fazer a execução prosseguir.

- **INV-805** — Falta de efeito conhecido é fail-closed

  Se o Runtime não conseguir determinar os efeitos necessários de uma operação física:

  ```
  EffectResolutionError
  ```

  ou erro equivalente MUST interromper a execução.

  Não é permitido assumir:

  ```
  "provavelmente só afeta o workspace"
  ```

- **INV-806** — Recursos são resolvidos pelo Runtime

  O caller MUST NOT poder fornecer diretamente o resource utilizado para autorização quando esse recurso puder ser derivado da operação.

  O Runtime deve derivar o recurso da:

  ```
  tool metadata
  +
  input
  +
  execution context
  ```

  seguindo a mesma regra da Fase 2/Fase 4.

- **INV-807** — Approval pertence ao Effect Set

  Quando uma execução exigir Founder approval, a aprovação MUST representar o conjunto de efeitos autorizado.

  A aprovação não pode autorizar apenas uma interpretação parcial do pedido.

- **INV-808** — Revalidation reavalia os efeitos

  resume() MUST recalcular o ExecutionEffectSet a partir do input original.

  A aprovação nunca fornece novos recursos ou efeitos.

- **INV-809** — Sandbox consome efeitos resolvidos

  A Sandbox MUST receber uma representação derivada dos efeitos autorizados.

  O Sandbox não decide:

  ```
  "o que pode"
  ```

  Ele implementa:

  ```
  "como impor fisicamente o que já foi autorizado"
  ```

- **INV-810** — Provider não é Policy Engine

  Provider MUST NOT interpretar política.

  Seu contrato continua sendo:

  ```
  request autorizado
  +
  contexto físico
  →
  efeito real
  ```

## 4. Conceito de Execution Effect

O novo tipo fundamental é:

```
interface ExecutionEffect {
  kind: EffectKind
  operation: EffectOperation
  resource: ResourceRef
  metadata?: EffectMetadata
}
```

Onde:

```
type EffectKind =
  | "filesystem"
  | "process"
  | "network"
  | "environment"
```

Nesta fase:

- filesystem é normativamente obrigatório;
- process é normativamente obrigatório;
- network e environment entram no vocabulário do modelo, mas não ganham enforcement físico adicional nesta fase.

Isso evita criar vocabulário novo de Sandbox sem backend que o sustente.

## 5. Effect Operation

As operações iniciais são:

```
type FilesystemEffectOperation =
  | "read"
  | "write"
  | "create"
  | "delete"
  | "rename"
  | "link"
```

e:

```
type ProcessEffectOperation =
  | "spawn"
  | "terminate"
```

O Runtime MUST diferenciar semanticamente essas operações.

Não é permitido reduzir tudo a:

```
filesystem.write
```

quando a operação real for:

```
delete
rename
link
```

porque políticas futuras poderão governá-las de forma diferente.

## 6. Resource Model

O resource passa a ser um objeto normativo:

```
interface ResourceRef {
  type: string
  id: string
}
```

Exemplos:

```
filesystem / filesystem://workspace/docs/a.md
filesystem / filesystem://workspace/src/*
process    / process://executable/node
```

O formato canônico continua seguindo a filosofia já adotada na Fase 4.

## 7. Resource Canonicalization

Todo recurso MUST possuir representação canônica.

Para filesystem:

```
filesystem://workspace<normalized-path>
```

O Runtime MUST normalizar:

- separadores;
- . ;
- ..;
- caminho relativo;
- caminho absoluto permitido;
- realpath quando fisicamente disponível;
- identidade do workspace.

A canonicalização MUST acontecer antes da decisão de Policy.

## 8. Workspace identity

O modelo de recurso não deve depender somente de pathname.

Um workspace deve possuir identidade estável dentro da execução:

```
interface WorkspaceRef {
  id: string
  root: string
}
```

A representação canônica de recurso deve ser derivada da identidade do workspace e de seu caminho lógico.

Isso reduz ambiguidades entre:

```
/home/user/project
```

e o mesmo diretório acessado por outro caminho físico.

## 9. Physical identity versus logical identity

A Fase 8 estabelece explicitamente duas camadas:

```
Logical Resource
       ↓
Canonical Resource
       ↓
Physical Resolution
```

Exemplo:

```
filesystem://workspace/src/a.js
```

pode resolver fisicamente para:

```
/home/user/project/src/a.js
```

O Provider e Sandbox trabalham com a representação física necessária para executar.

Policy trabalha com a identidade normativa canônica.

Nunca devemos fazer o contrário:

```
physical path → policy diretamente
```

porque isso recoloca detalhes de plataforma dentro da autoridade.

## 10. Effect Set

Uma execução passa a carregar:

```
interface ExecutionEffectSet {
  effects: readonly ExecutionEffect[]
  fingerprint: string
}
```

O fingerprint MUST ser determinístico.

Exemplo conceitual:

```
sha256(
  canonical(effect1)
  +
  canonical(effect2)
  +
  ...
)
```

O fingerprint não precisa expor dados sensíveis.

Seu objetivo é:

- correlação;
- approval;
- audit;
- revalidation;
- comparação entre resolução original e resolução posterior.

## 11. Determinismo do Effect Resolver

O Effect Resolver MUST ser determinístico para a mesma:

```
Tool
+
Input
+
Principal
+
Session execution context
+
Workspace identity
```

LLM não pode participar da resolução.

Não existe:

"acho que este comando provavelmente escreve aqui"

## 12. Effect Resolver

Novo seam:

```
interface EffectResolver {
  resolve(request: EffectResolutionRequest): ExecutionEffectSet
}
```

Com:

```
interface EffectResolutionRequest {
  principal: PrincipalRef
  session: SessionRef
  tool: ToolRef
  input: unknown
  cwd: string
}
```

O resolver MUST:

- validar input;
- canonicalizar recursos;
- determinar efeitos;
- normalizar duplicatas;
- ordenar deterministicamente;
- produzir fingerprint.

## 13. Efeitos duplicados

Efeitos semanticamente idênticos MUST ser deduplicados.

Exemplo:

```
filesystem.read A
filesystem.read A
filesystem.read A
```

vira:

```
filesystem.read A
```

Entretanto:

```
filesystem.read A
filesystem.write A
```

não são equivalentes e MUST permanecer distintos.

## 14. Ordenação canônica

O Effect Set MUST possuir ordenação determinística independente da ordem em que o resolver encontrou os efeitos.

Ordenação recomendada:

```
kind
operation
resource.type
resource.id
```

Isso impede que:

```
[A, B, C]
```

e:

```
[C, A, B]
```

produzam fingerprints diferentes.

## 15. Policy sobre Effect Set

A Policy Engine existente continua sendo a autoridade.

A diferença é que, agora, ela recebe cada efeito necessário.

Conceitualmente:

```
PolicyEngine.evaluate(effect)
```

é chamado para:

```
E1
E2
E3
...
En
```

e gera:

```
EffectDecision[]
```

## 16. Effect Decision

```
interface EffectDecision {
  effect: ExecutionEffect
  decision: PolicyDecision
}
```

Exemplo:

```
filesystem.read   workspace/a.md → ALLOW
filesystem.write  workspace/b.md → ALLOW
filesystem.write  /etc/passwd   → DENY
```

Resultado composto:

```
DENY
```

## 17. Composição de decisões

A composição global MUST respeitar a precedência existente:

```
DENY
>
APPROVAL-REQUIRED
>
ALLOW
>
DEFAULT-DENY
```

Mas existe uma regra adicional:

Qualquer DENY vence o conjunto.

Exemplo:

```
ALLOW
ALLOW
APPROVAL
```

resultado:

```
APPROVAL
```

Exemplo:

```
ALLOW
APPROVAL
DENY
```

resultado:

```
DENY
```

## 18. Approval múltiplo

Se houver múltiplos efeitos com:

```
approval-required
```

uma única ApprovalRequest deve representar o conjunto completo, salvo quando uma futura política explícita introduzir agrupamento diferente.

A aprovação deve carregar:

```
{
  approvalId,
  effectSetFingerprint,
  effectsMetadata,
  policyIds,
  reason
}
```

Nunca deve carregar apenas:

```
toolId
```

como identidade suficiente da autorização.

## 19. Approval público

A projeção pública MUST continuar sem input bruto ou segredo.

Deve carregar somente metadata equivalente a:

```
approvalId
effectSetFingerprint
effects
policyIds
reason
expiresAt
```

Os recursos devem ser projetados de forma segura.

## 20. Resume e revalidation

O fluxo passa a ser:

```
Approval approved
        ↓
reconstruct original request
        ↓
resolve effects again
        ↓
calculate new fingerprint
        ↓
re-evaluate Policy
        ↓
compare approval
        ↓
execute
```

O fingerprint é uma trava adicional.

Se:

```
approvedFingerprint !== currentFingerprint
```

o Runtime MUST NOT prosseguir automaticamente.

Erro:

```
EffectRevalidationError
```

ou equivalente tipado.

## 21. Tool contract

Uma Tool física deve declarar como seus efeitos são obtidos.

Há dois modos:

### Static effect declaration

Adequado quando os recursos são fixos.

```
effects: {
  operation: "read",
  resource: "filesystem://workspace/config.json"
}
```

### Resolver dinâmico

Adequado quando depende do input.

```
resolveEffects(input, context)
```

Uma Tool não pode permanecer implicitamente física sem um mecanismo conhecido de resolução.

## 22. Physical Tool classification

A classificação da Fase 5 continua válida:

```
pure
physical
provider-backed
```

Agora:

```
physical
```

deve possuir EffectResolver.

Uma Tool física sem resolução de efeitos SHOULD ser rejeitada no registro quando o Runtime estiver operando no modelo F8.

## 23. Provider-backed

Provider-backed continua sendo o caminho canônico.

A resolução passa a ser:

```
Tool
 ↓
Capability
 ↓
EffectResolver
 ↓
Policy
 ↓
Sandbox
 ↓
Provider
```

O Provider não deve calcular novos efeitos normativos depois da autorização.

## 24. Process.spawn

process.spawn é o primeiro caso crítico.

Hoje:

```
cwd
```

é usado como resource principal.

Na F8 isso deixa de ser suficiente.

Uma execução de processo deve poder declarar:

```
process.spawn(node)
filesystem.read(workspace/src/a.js)
filesystem.read(workspace/package.json)
filesystem.write(workspace/dist/a.js)
filesystem.delete(workspace/tmp)
```

O cwd é apenas:

```
execution context
```

## 25. Spawn effect mínimo

Mesmo uma execução simples deve produzir pelo menos:

```
process.spawn -> process://executable<canonical-executable>
```

Mais os filesystem effects conhecidos pelo contrato da Tool.

## 26. O problema do processo aberto

A Fase 8 não precisa descobrir magicamente tudo o que um processo arbitrário fará.

Ela estabelece uma regra:

Execution Effects representam o conjunto autorizado e conhecido no momento do spawn.

Quando a execução não consegue declarar o conjunto com segurança:

```
effect resolution = incomplete
```

e a política MUST fail closed.

Não existe:

```
"o processo pode descobrir sozinho"
```

como mecanismo de autorização.

## 27. Declared effects versus observed effects

A arquitetura deve distinguir:

```
Declared Effects
```

de:

```
Observed Effects
```

Nesta fase:

```
Declared Effects
```

são normativos.

Observed Effects são auditáveis, quando um mecanismo futuro puder observá-los.

A F8 MUST NOT alegar possuir observabilidade completa do sistema operacional.

## 28. Effect containment

O Sandbox deve receber uma projeção dos efeitos.

Exemplo:

```
EffectSet
 ├─ read workspace/src
 ├─ write workspace/dist
 └─ spawn node
```

vira uma boundary física capaz de suportar:

```
read workspace/src
write workspace/dist
spawn node
```

O Sandbox não deve criar permissões maiores que o Effect Set.

## 29. Monotonicidade

A boundary física MUST ser monotônica em relação aos efeitos autorizados.

Ou seja:

```
authorized effects
      ⊇
physical permissions
```

e nunca:

```
physical permissions
      ⊃
authorized effects
```

quando o backend possui capacidade de aplicar a restrição.

Caso o backend não consiga cumprir o limite:

```
SandboxUnavailableError
```

ou erro equivalente deve ocorrer.

Não pode ocorrer downgrade silencioso.

## 30. Relationship com SandboxMode

A Fase 8 não elimina:

```
read-only
workspace-write
danger-full-access
```

Esses continuam sendo perfis físicos.

O novo modelo adiciona a dimensão:

```
EffectSet
```

Portanto:

```
Policy
   ↓
Effect Set
   ↓
Sandbox Mode
   ↓
Physical Backend
```

workspace-write não significa:

"qualquer escrita dentro do workspace"

sem limite.

Ele representa o teto físico que pode ser reduzido pelos efeitos da execução.

## 31. Teto físico versus efeitos

A boundary final deve representar:

```
AllowedPhysicalBoundary
    =
    intersection(
      Runtime ceiling,
      Capability ceiling,
      Tool ceiling,
      EffectSet
    )
```

Nenhuma camada inferior pode ampliar autoridade.

## 32. Exemplo

Pedido:

```
process.spawn
cwd = workspace
argv = [
  "node",
  "build.js"
]
```

Effect Resolver:

```
process.spawn -> process://executable/node
filesystem.read -> filesystem://workspace/build.js
filesystem.read -> filesystem://workspace/package.json
filesystem.write -> filesystem://workspace/dist/*
```

Policy:

```
spawn node          ALLOW
read build.js       ALLOW
read package.json   ALLOW
write dist/*        ALLOW
```

Resultado:

```
AUTHORIZED
```

Sandbox recebe a boundary física equivalente.

## 33. Exemplo de deny composto

Effects:

```
process.spawn node              ALLOW
filesystem.read workspace/*    ALLOW
filesystem.write workspace/*   ALLOW
filesystem.write /etc/*        DENY
```

Resultado:

```
DENY
```

Mesmo que três efeitos tenham sido autorizados.

Nenhum processo nasce.

## 34. Exemplo de approval composto

Effects:

```
filesystem.read workspace/*       ALLOW
filesystem.write workspace/*      ALLOW
filesystem.delete workspace/*     APPROVAL-REQUIRED
```

Resultado:

```
APPROVAL-REQUIRED
```

O processo não inicia antes da decisão.

## 35. Resource matcher

O mecanismo de matching existente da Policy deve continuar aceitando:

```
resource exact
resource glob
resource wildcard
```

Mas a Fase 8 deve formalizar que matching acontece sobre:

```
canonical resource
```

e nunca sobre:

```
raw user input
```

## 36. Resource aliases

Não devem existir múltiplas strings semanticamente equivalentes utilizadas como autorização independente.

Exemplo:

```
./src/a.js
src/a.js
workspace/src/a.js
```

devem convergir para a mesma identidade canônica quando representarem o mesmo recurso.

## 37. Resource boundary

Filesystem resources devem suportar ao menos:

```
exact file
directory subtree
workspace subtree
```

Exemplos:

```
filesystem://workspace/a.txt
filesystem://workspace/src/*
filesystem://workspace/*
```

## 38. Traversal

Um resource resolvido como:

```
outside-workspace
```

MUST NOT casar com uma Policy destinada a:

```
filesystem://workspace/*
```

Isso preserva a defesa em profundidade da Fase 4.

## 39. Symlink, junction e hardlink

A resolução lógica não substitui a verificação física.

Mesmo que:

```
resource = filesystem://workspace/a
```

a camada física continua responsável por verificar:

- symlink;
- junction;
- ancestral redirecionado;
- hardlink;
- realpath;
- boundary física.

F8 amplia o modelo lógico.

F7 continua responsável pela verdade física.

## 40. Rename

rename MUST ser modelado como efeito composto, não apenas como write.

Mínimo:

```
filesystem.rename
source
destination
```

A autorização deve conseguir representar ambos os recursos.

Exemplo:

```
rename:
  source      workspace/a
  destination workspace/b
```

Não é suficiente autorizar somente o destination.

## 41. Link

link MUST possuir:

```
source
destination
```

e os dois recursos devem participar da autorização.

Isso é importante especialmente por causa da fronteira de hardlinks demonstrada na Fase 7.

## 42. Delete

delete MUST ser diferente de write.

Uma Policy que permita:

```
filesystem.write
```

não deve automaticamente permitir:

```
filesystem.delete
```

salvo quando isso for explicitamente declarado pelo modelo de Policy.

## 43. Create

create MUST ser distinguível de write.

Um recurso inexistente não deixa de ser um recurso governável.

Exemplo:

```
create workspace/output.txt
```

é um efeito distinto de:

```
write workspace/existing.txt
```

## 44. Effect authorization order

A ordem normativa para uma operação física é:

1. validate input
2. resolve principal
3. resolve workspace/session
4. resolve canonical resources
5. resolve effect set
6. canonicalize + deduplicate
7. fingerprint
8. evaluate every effect
9. create approval if necessary
10. revalidate on resume
11. resolve sandbox boundary
12. prepare provider
13. execute
14. observe outcome
15. publish safe audit events

## 45. Event model

A Fase 8 adiciona:

```
effect.resolved
effect.evaluated
effect.denied
effect.approval-required
```

com projeção segura.

## 46. effect.resolved

Payload mínimo:

```
{
  effectSetFingerprint,
  effectCount
}
```

Pode incluir metadata agregada segura.

Não deve publicar:

```
raw command
stdin
secret
environment
full user input
```

## 47. effect.evaluated

Cada decisão deve permitir auditoria sem revelar conteúdo sensível.

Exemplo:

```
{
  effectSetFingerprint,
  kind: "filesystem",
  operation: "write",
  resource: "filesystem://workspace/dist/*",
  policyId: "build-write",
  effect: "allow"
}
```

## 48. Ordering de eventos

Para uma execução autorizada:

```
tool.requested
policy/effect resolution
effect.resolved
effect.evaluated*
sandbox.requested
sandbox.applied
tool.started
provider.started
...
```

Nenhum evento físico de início pode aparecer antes de todos os efeitos terem sido autorizados.

## 49. Approval event ordering

Para approval:

```
tool.requested
effect.resolved
effect.evaluated
approval.requested
```

e somente após aprovação:

```
approval.approved
effect.revalidated
sandbox.requested
sandbox.applied
tool.started
```

## 50. Resume fingerprint

O approvalId sozinho não basta.

O Runtime MUST verificar:

```
approval.effectSetFingerprint
==
current.effectSetFingerprint
```

antes de executar.

## 51. Effect planning

A Fase 8 introduz o conceito de:

```
Effect Plan
```

que é a representação normalizada dos efeitos antes da execução.

Exemplo:

```
interface EffectPlan {
  effects: readonly ExecutionEffect[]
  fingerprint: string
  completeness: "complete" | "incomplete"
}
```

Somente:

```
completeness === "complete"
```

pode chegar à execução física governada.

## 52. Incomplete effect plan

Um resolver pode saber:

"este processo pode escrever em arquivos"

mas não conseguir determinar em quais arquivos.

Isso é insuficiente para uma Policy restritiva.

O plano deve então ser:

```
incomplete
```

e a execução deve ser negada ou enviada para uma futura estratégia explícita de escalation.

Não pode virar automaticamente:

```
workspace-write/*
```

sem a Policy permitir esse efeito amplo.

## 53. Effect scopes

Resources podem possuir escopo:

```
exact
subtree
set
pattern
```

Mas a semântica MUST permanecer explícita.

Exemplo:

```
workspace/src/*
```

não deve ser tratado como:

```
entire filesystem
```

## 54. Wildcards e Effect Resolution

Wildcard é uma propriedade do resource matcher.

Não é autorização implícita.

Exemplo:

```
filesystem://workspace/dist/*
```

pode autorizar múltiplos efeitos.

Mas:

```
filesystem://workspace/*
```

não deve surgir porque o resolver "não sabe" qual arquivo será usado.

## 55. Capability declaration

Capabilities podem declarar limites de efeitos.

Exemplo:

```
{
  id: "filesystem",
  effectKinds: ["filesystem"],
  operations: ["read", "write", "create", "delete", "rename", "link"]
}
```

A Capability MUST NOT ganhar efeito que sua definição não conhece.

## 56. Effect resolver ownership

O resolver deve estar associado ao seam que possui conhecimento suficiente.

Preferência:

```
Capability-owned effect resolver
```

ou:

```
Tool-owned resolver
```

quando o efeito depender do input específico da Tool.

Nunca deve existir um único parser global tentando adivinhar semântica de todas as capacidades.

## 57. Shell preparation

A Fase 8 deve preparar o contrato que a F9 utilizará.

No Shell, um input poderá representar múltiplas operações:

```
cmd1
&&
cmd2
>
output
```

A F9 deverá transformar essa expressão em um EffectPlan.

Portanto:

F9 não cria o modelo de Effects. F9 apenas passa a utilizá-lo.

## 58. Shell não pode contornar Effects

Uma vez que F8 esteja implementada, a F9 MUST NOT autorizar Shell como:

```
filesystem.write(command.cwd)
```

Esse modelo é explicitamente proibido.

O Shell deve produzir o conjunto real conhecido pelo parser/analysis.

## 59. Relation with DeepSeek Harness

A Fase 8 absorve a filosofia de seam do DeepSeek:

```
capability
    ↓
resource/effect contract
    ↓
consumer
```

mas preserva a autoridade do Spectree:

```
PolicyEngine
+
FounderGate
+
EffectSet
```

O DeepSeek não deve ser tratado como especificação normativa do Spectree.

## 60. Execution Effects versus Sandbox

A distinção MUST ser permanente:

```
Policy
pode?
Effects
o que pretende afetar?
Sandbox
como limitar fisicamente?
Provider
como executar?
Process
qual processo efetivamente nasceu?
```

## 61. Segurança por construção

É proibido criar uma API:

```
executeWithoutEffects()
```

ou:

```
executeAssumingWorkspace()
```

ou:

```
executeAllWorkspace()
```

para contornar o novo modelo.

Qualquer bypass físico MUST ser explicitamente classificado como:

```
danger-full-access
```

quando apropriado ao contrato já estabelecido.

## 62. Compatibility rule

F8 MUST preserve all valid behavior das Fases 1–7.

Em particular:

- Policy continua default-deny;
- Founder approval continua revalidável;
- Capability registry continua sendo gate;
- Provider continua sem conhecer Policy;
- Sandbox continua fail-closed;
- Process continua usando argv;
- Bubblewrap continua sendo enforcement físico;
- R14 continua válido quando nenhum backend físico suporta o limite requerido.

## 63. Migration

Durante a implementação da F8, APIs antigas baseadas somente em:

```
resource
cwd
```

podem existir internamente apenas enquanto adaptadores de compatibilidade.

O caminho canônico, porém, passa a ser:

```
EffectSet
```

Nenhuma nova feature deve ser construída diretamente sobre autorização baseada somente em cwd.

## 64. R8 — Surface Lock

As superfícies abaixo MUST ser travadas por igualdade estrutural:

```
ExecutionEffect
EffectPlan
EffectDecision
ResourceRef
ExecutionEffectSet
EffectResolver
```

Mudanças em seus campos devem quebrar testes de contrato.

## 65. R8 — Provider boundary

O ProviderExecutionContext não deve ganhar:

```
PolicyEngine
EffectResolver
ApprovalManager
EventBus
```

O Provider recebe apenas os dados necessários para executar a operação já autorizada.

## 66. R8 — Agent isolation

O Agent continua sem acesso direto a:

```
PolicyEngine
EffectResolver
SandboxProvider
ProviderRegistry
EventBus
```

O Agent continua vendo apenas o contrato definido pelo AgentLoop.

## 67. Error taxonomy

A Fase 8 deve introduzir pelo menos:

```
EffectResolutionError
EffectAuthorizationError
EffectRevalidationError
```

Sem reutilizar um erro genérico para significados diferentes.

## 68. EffectResolutionError

Indica:

o Runtime não conseguiu determinar com segurança o efeito necessário

Não significa:

Policy negou

## 69. EffectAuthorizationError

Indica:

o conjunto de efeitos foi resolvido, mas não foi autorizado

Pode envolver:

```
DENY
APPROVAL-REQUIRED
```

preferencialmente preservando o detalhe tipado já existente.

## 70. EffectRevalidationError

Indica:

o conjunto de efeitos no momento do resume não corresponde à autorização original

A Approval permanece approved quando essa é a política já estabelecida para falhas de revalidation.

## 71. Observability

O Runtime deve conseguir responder:

- qual execução?
- qual effectSet?
- qual fingerprint?
- quais effects?
- quais decisões?
- qual sandbox?
- qual provider?
- qual outcome?

sem necessariamente expor:

```
argv
stdin
env
secrets
full input
output bruto
```

## 72. Audit identity

Cada execução física deve poder ser correlacionada por:

```
sessionId
toolUseId / invocationId
effectSetFingerprint
sandboxInstanceId
providerId
```

O fingerprint serve como ligação entre:

```
authorization
approval
sandbox
execution
audit
```

## 73. Concurrency

Dois Effect Sets simultâneos MUST ser independentes.

Exemplo:

```
Session A:
write workspace/a

Session B:
read workspace/b
```

Cada execução possui:

```
effectSet próprio
fingerprint próprio
sandboxInstanceId próprio
```

Não existe estado global de efeitos.

## 74. Effect Set immutability

Depois de autorizado, o ExecutionEffectSet MUST ser imutável.

Para alterar:

```
effect
resource
operation
```

é necessário criar uma nova execução lógica e passar novamente por autorização.

## 75. No post-hoc authorization

Não é permitido:

```
execute
↓
descobrir efeitos
↓
pedir autorização depois
```

A Fase 8 continua sendo pre-execution authorization.

Observabilidade pós-execução é auditoria, não autorização retroativa.

## 76. Physical enforcement gap

A existência de um Effect Set autorizado não garante que o backend físico consiga impor todos os efeitos.

Portanto:

```
authorized
≠
physically enforceable
```

Se a Sandbox necessária não puder representar o limite:

```
SandboxUnavailableError
```

deve interromper a operação.

## 77. danger-full-access

danger-full-access continua sendo:

```
ausência de confinement adicional
```

e não:

```
bypass de Policy
```

F8 não altera essa regra.

Mesmo nesse modo:

```
Policy
+
Effect resolution
```

continuam existindo.

## 78. Acceptance criteria

A Fase 8 só pode ser considerada CLOSED quando:

- Todo processo físico possui EffectSet.
- cwd deixou de ser o modelo de autorização.
- Recursos são canonicalizados deterministicamente.
- Effects múltiplos são suportados.
- DENY em qualquer efeito bloqueia a execução inteira.
- Approval cobre o Effect Set completo.
- Resume compara e revalida effectSetFingerprint.
- Effects incompletos falham fechado.
- rename possui source + destination.
- link possui source + destination.
- delete é semanticamente distinto de write.
- create é semanticamente distinto de write.
- Sandbox recebe somente efeitos autorizados/projeção correspondente.
- Process Provider permanece ignorante sobre Policy e implementação de Sandbox.
- Agent permanece isolado.
- R8 trava as novas superfícies.
- Eventos são projetados sem segredo.
- F1–F7 continuam verdes.
- Pelo menos um teste real prova multi-effect authorization.
- Pelo menos um teste real prova deny composto.
- Pelo menos um teste real prova approval composto.
- Pelo menos um teste prova effect-set mutation/revalidation.
- Pelo menos um teste prova que cwd não amplia authorization.
- Pelo menos um teste prova que um effect fora do conjunto autorizado não executa.
- npm test permanece verde.
- claude plugin validate . --strict permanece verde.

## 79. Suite mínima obrigatória

A Fase 8 deve adicionar testes separados para:

```
effects.unit.test.js
resource-model.test.js
effect-resolution.test.js
effect-policy.test.js
effect-approval.test.js
effect-revalidation.test.js
effect-surface.test.js
```

e testes de integração para:

```
process + multi-effect
filesystem + multi-effect
sandbox + effect set
```

## 80. Teste obrigatório — cwd não é authority

Criar um caso como:

```
cwd = workspace
```

mas Effect Set:

```
filesystem.write /etc/example
```

O resultado MUST ser:

```
DENY
```

O fato de o processo começar no workspace não pode criar autorização para /etc/example.

## 81. Teste obrigatório — múltiplos effects

Uma operação deve produzir:

```
read A
write B
delete C
```

e o teste deve provar que todos são avaliados.

## 82. Teste obrigatório — um deny bloqueia tudo

Com:

```
read A   ALLOW
write B  ALLOW
delete C DENY
```

o provider NÃO deve iniciar.

## 83. Teste obrigatório — approval composto

Com:

```
read A   ALLOW
write B  APPROVAL
```

o Runtime deve:

- não executar
- criar uma única approval

e, após aprovação:

- revalidar ambos
- executar apenas se ambos continuarem autorizados

## 84. Teste obrigatório — fingerprint mutation

A execução autorizada:

```
write workspace/a
```

deve produzir:

```
fingerprint A
```

Após mudança de input para:

```
write workspace/b
```

a revalidation MUST detectar:

```
fingerprint B != fingerprint A
```

e bloquear.

## 85. Teste obrigatório — same world continua

O processo autorizado por um Effect Set deve continuar produzindo o mesmo efeito físico observado pela F7:

```
process
  ↓
filesystem
  ↓
same resource model
```

F8 não pode quebrar a garantia de same-world.

## 86. Fluxo final da Fase 8

O caminho normativo passa a ser:

```
Agent
  ↓
requestTool()
  ↓
ToolRuntime
  ↓
Policy identity
  ↓
EffectResolver
  ↓
ExecutionEffectSet
  ↓
canonicalization
  ↓
fingerprint
  ↓
PolicyEngine
  ├── DENY ───────────────→ stop
  ├── APPROVAL ───────────→ Founder Gate
  │                            ↓
  │                         revalidate
  │                            ↓
  └── ALLOW ────────────────→ continue
                               ↓
                         SandboxResolver
                               ↓
                         Physical Boundary
                               ↓
                         CapabilityProvider
                               ↓
                         Process / Filesystem
                               ↓
                            Outcome
```

## 87. Decisão arquitetural

A Fase 8 estabelece uma regra permanente para o Spectree Runtime:

Policy autoriza efeitos; Sandbox impõe fronteiras físicas; Provider executa a operação.

O cwd deixa de ser autoridade.

O recurso deixa de ser um detalhe do Provider.

O conjunto de efeitos passa a ser a unidade explícita entre autorização e execução.

Isso cria a fundação necessária para:

```
F9 Shell
F10 Terminal / PTY
```

sem transformar nenhum desses componentes em uma rota paralela de autorização.

## 88. Definition of Done

A Fase 8 estará CLOSED somente quando o Runtime puder demonstrar, por testes:

"eu sei exatamente quais efeitos esta execução pretende produzir"

e, antes de executar:

"todos esses efeitos foram autorizados"

e, antes do spawn:

"o Sandbox físico suporta a boundary necessária"

e, depois:

"o efeito executado continua correlacionável à autorização original"

Sem essas quatro provas, a Fase 8 não deve ser considerada concluída.
