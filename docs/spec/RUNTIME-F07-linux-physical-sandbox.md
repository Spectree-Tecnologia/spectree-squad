---
status: in-review
owner: TechLeader
updated: 2026-08-20
approved: - (o merge existe — PR #26, squash `1e40486`, tag `v0.31.0`, 2026-08-20 — e a marcacao desta fonte e a melhor das nove. O bloqueio e outro: esta e uma REVISAO DIFERENTE da que governou a implementacao. Tem 112 secoes, 1 a 112, sem buraco; o codigo da fase cita as secoes 118, 121, 122, 127 e 143, todas alem da ultima. Nao ha deslocamento constante — as secoes 14 a 20 batem exatas e a divergencia cresce depois. As irmas resolvem (F05 §151/§152/§154 e F08 §67-70 conferidos), so a F7 nao. Aguarda a revisao de >=143 secoes contra a qual a Fase 7 foi implementada.)
depends_on: F1 Runtime Core, F2 Policy Engine, F3 Founder Gate, F4 Capability Providers, F4.5 Squad/Runtime Integration, F5 Sandbox Runtime, F6 Process/Subprocess
---

# Spectree Runtime v2 — Fase 7: Linux Physical Sandbox

> Transcrição da especificação normativa da Fase 7, produzida no harness de
> planejamento do Founder (owner declarado na fonte: TechLeader; transcrição
> feita pelo Rubick). Diferente das sete irmãs, esta fonte chegou com a
> marcação markdown intacta — 2323 linhas, 161 headings, 318 linhas de cerca,
> 112 separadores. O trabalho aqui não foi restaurar marcação: foi conformar
> a fonte à forma do repositório. O texto é o do documento fonte, sem
> correção, melhoria ou complemento. O texto commitado é o contrato real
> (ver `docs/spec/README.md`).
>
> **Equação de equivalência usada.** Como a fonte já traz headings e cercas
> próprios, a equação das irmãs (linha de prosa → linha com no máximo um
> prefixo) muda de forma. Aqui vale uma bijeção sobre as linhas não vazias,
> com exatamente três transformações mecânicas e nenhuma exceção:
>
> 1. `# ` → `## ` em todo heading de topo, menos o título da linha 1 da
>    fonte, que permanece o único `#` do documento. São 113 linhas: as 112
>    seções numeradas e a linha `# **Fase 8 — Execution Effects / Resource
>    Model**` de dentro da §111, que a fonte não numerou e que esta
>    transcrição não numera.
> 2. As 8 linhas de metadados da fonte (`**Status:**` a `**Referência
>    arquitetural principal:**`, marcadas na fonte com quebra dura de duas
>    colunas) ganharam o prefixo `- ` e viraram a lista de cabeçalho das
>    irmãs.
> 3. Os 30 `### INV-7NN` viraram `- **INV-7NN**`, e a regra da linha
>    seguinte ganhou indentação de dois espaços. Zero junção: 30
>    identificadores, 30 regras, 60 linhas dos dois lados.
>
> Todo o resto passou intacto: as 318 linhas de cerca, os 112 separadores
> `---`, a tabela de 7 linhas da §85, os 35 itens `- [ ]` da §105, os 3
> blockquotes, e as 14 linhas iniciadas por `## ` de dentro da cerca da
> §108 — que são conteúdo de bloco de código, não headings, e por isso não
> foram tocadas.
>
> Contagens não ancoradas que atravessam intactas: 2323 linhas na fonte,
> 758 vazias, 1565 não vazias; 112 seções numeradas de 1 a 112, sem buraco e
> sem repetição de número; 30 invariantes de INV-701 a INV-730, cada id
> único; 318 linhas de cerca; 35 itens de Definition of Done; 112
> separadores. A separação lista-vs-seção mede 112 seções e 35 itens de
> lista dos dois lados: nenhum título de seção está soldado dentro de item
> de lista, e nenhum item de lista foi promovido a seção.
>
> Do lado do destino a equação fecha assim: 2394 linhas, 760 em branco,
> 1634 não vazias = 1565 da fonte, uma a uma, + 7 do cabeçalho + 62 deste
> bloco de proveniência. Cercas 318 ↔ 318, seções 112 ↔ 112, invariantes
> 30 ↔ 30, itens de Definition of Done 35 ↔ 35, separadores 112 ↔ 112.
>
> **`Status: SPECIFICATION` na lista abaixo é declaração da fonte**, não o
> `status:` deste artefato — que é `in-review`, porque a matriz de
> autoridade barra `rubick -> artifact-status.approve`.
>
> Aprovação a derivar: a Fase 7 embarcou em `main` no PR #26 — squash
> `1e40486`, tag `v0.31.0`, em 2026-08-20. A data está no git; o flip de
> `status:` e o preenchimento de `approved:` são ato do Invoker.
>
> `updated:` registra a data do conteúdo, não a do arquivo: a transcrição
> feita em 2026-08-21 conformou a forma e não alterou conteúdo.
>
> Divergência conhecida, não reconciliada por esta transcrição: a numeração
> de seções desta fonte não resolve as citações `secao NNN` que o código da
> Fase 7 faz. A "Regra de ouro da Fase 7" é a §109 aqui, e o código a chama
> de §127; o código também cita §118, §121, §122 e §143, além da última
> seção desta fonte. Nada foi renumerado — a fonte é a fonte.

- **Status:** SPECIFICATION
- **Owner:** TechLeader
- **Implementador:** Agente Opus 5
- **Baseline:** Spectree Runtime v2 — Fases 1–6 congeladas
- **Versão de referência:** pós-v0.30.0
- **Prioridade:** Linux
- **Ambiente de desenvolvimento local do Founder:** Windows + WSL2
- **Referência arquitetural principal:** DeepSeek Harness Sandbox

---

## 1. Objetivo

A Fase 6 terminou com:

```text
processEnforcement = unsupported
```

Isso significa que:

```text
Sandbox workspace-write
+
Process Capability
```

não pode executar processos, porque o Runtime não possui ainda um mecanismo físico capaz de garantir o confinement do processo.

A Fase 7 deve adicionar o primeiro backend físico real:

```text
LinuxPhysicalSandboxProvider
```

capaz de transformar:

```text
processEnforcement = unsupported
```

em:

```text
processEnforcement = full
```

quando todas as garantias prometidas pelo profile forem efetivamente impostas.

O objetivo não é criar um "wrapper de segurança" em JavaScript.

O objetivo é fazer o sistema operacional participar da enforcement boundary.

---

## 2. Resultado esperado

Antes:

```text
Policy
 ↓
Sandbox workspace-write
 ↓
processEnforcement unsupported
 ↓
SandboxUnavailableError
```

Depois, em Linux com backend físico funcional:

```text
Policy
 ↓
Approval, quando necessário
 ↓
Capability
 ↓
SandboxResolver
 ↓
LinuxPhysicalSandboxProvider
 ↓
processEnforcement full
 ↓
Process
```

O processo poderá executar com:

```text
workspace-write
```

sem exigir:

```text
danger-full-access
```

---

## 3. Referência DeepSeek

O DeepSeek define `SandboxProvider` como um seam abstrato que recebe o `argv` exato a ser executado e uma `SandboxPolicy`, devolvendo uma execução confinada ou falhando fechado.

No backend local Linux, o DeepSeek usa uma estratégia de seleção/probe entre backends como Bubblewrap e Landlock, com fail-closed quando nenhum backend funcional consegue atender ao profile.

O Spectree deve adotar esse padrão, sem copiar a implementação inteira.

---

## 4. Decisão arquitetural

A Fase 7 **não altera**:

```text
Agent
AgentLoop
PolicyEngine
ApprovalManager
CapabilityRegistry
CapabilityResolver
ProcessProvider
```

Ela adiciona uma implementação física ao contrato existente:

```text
SandboxProvider
```

Arquitetura:

```text
Agent
  ↓
ToolRuntime
  ↓
Policy
  ↓
Approval
  ↓
Capability
  ↓
SandboxResolver
  ↓
LinuxPhysicalSandboxProvider
  ↓
ProcessProvider
  ↓
Linux process
```

---

## 5. Responsabilidades das camadas

```text
Policy
= "pode?"

Approval
= "Founder autorizou?"

Capability
= "o quê?"

Sandbox
= "sob quais limites físicos?"

Provider
= "como executa?"
```

Não misturar essas responsabilidades.

---

## 6. Primeiro backend físico

A primeira implementação física será:

```text
LinuxPhysicalSandboxProvider
```

Ela deverá suportar uma cadeia de backends:

```text
LinuxPhysicalSandboxProvider
        │
        ├── BubblewrapBackend
        │
        └── LandlockBackend
```

Ordem preferencial:

```text
bubblewrap
    ↓
Landlock
    ↓
unavailable
```

A seleção deve ser baseada em **probe funcional**, não apenas na presença do executável.

---

## 7. Escopo

Implementar:

```text
LinuxPhysicalSandboxProvider
BubblewrapBackend
LandlockBackend ou seu seam compatível
FunctionalProbe
BackendSelection
EnforcementReport
Sandbox lifecycle
Filesystem confinement
Process confinement
Private temp
Execution-world correlation
Fail-closed behavior
```

---

## 8. Fora do escopo

Não implementar:

```text
Windows native sandbox
macOS sandbox
Docker
Kubernetes
VM
microVM
E2B
remote sandbox
network isolation completo
GPU isolation
CPU quotas
memory quotas
Shell
Terminal/PTy
Git
Database
MCP
Orchestrator
```

---

## 9. Sandbox modes

Os modos existentes permanecem:

```text
read-only
workspace-write
danger-full-access
```

---

## 10. `read-only`

Semântica:

```text
workspace:
  read   = permitido
  write  = negado
  delete = negado

outside:
  não acessível conforme o boundary
```

Processo físico sujeito a esse profile deve ser confinado quando `full` for exigido.

---

## 11. `workspace-write`

Semântica:

```text
workspace:
  read   = permitido
  write  = permitido
  delete = permitido conforme capability/policy

outside:
  write = negado
  delete = negado
```

O modo não significa filesystem irrestrito.

---

## 12. `danger-full-access`

`danger-full-access` significa:

> o Sandbox não adiciona um boundary físico adicional.

Não significa:

```text
Policy bypass
Approval bypass
Capability bypass
Provider bypass
```

O fluxo permanece:

```text
Policy
 ↓
Approval
 ↓
Capability
 ↓
Provider
```

---

## 13. `full`, `partial`, `unsupported`

O backend deve reportar o nível real de enforcement:

```text
full
partial
unsupported
```

### `full`

Todos os efeitos prometidos pelo profile estão fisicamente cobertos pelo backend.

### `partial`

Somente parte dos efeitos prometidos é fisicamente coberta.

### `unsupported`

Não há enforcement físico utilizável para o efeito/profilerequerido.

---

## 14. Regra absoluta de honestidade

É proibido:

```text
backendName == bubblewrap
→ enforcement = full
```

ou:

```text
backendName == landlock
→ enforcement = full
```

O nível precisa ser resultado de capability detection + probe funcional + efeito solicitado.

---

## 15. Functional Probe

Não é suficiente:

```text
which bwrap
```

ou:

```text
bwrap --version
```

O probe deve executar um processo real e verificar fisicamente:

```text
access permitido
access proibido
write permitido
write proibido
```

conforme o profile.

---

## 16. Probe lifecycle

```text
discover backend
 ↓
prepare temporary probe world
 ↓
execute probe
 ↓
verify expected effects
 ↓
cleanup
 ↓
publish capability verdict
```

---

## 17. Probe timeout

Toda prova funcional deve possuir:

```text
probeTimeoutMs
```

finito e limitado.

Um backend que trava no probe não pode travar o Runtime indefinidamente.

---

## 18. Probe result

Modelo conceitual:

```json
{
  "usable": true,
  "backend": "bubblewrap",
  "enforcement": "full",
  "capabilities": {
    "filesystem.read": "full",
    "filesystem.write": "full",
    "process.spawn": "full"
  }
}
```

Ou:

```json
{
  "usable": false,
  "backend": "landlock",
  "enforcement": "partial",
  "reason": "required filesystem effect unavailable"
}
```

---

## 19. Backend selection

Algoritmo:

```text
probe Bubblewrap
   ↓
usable?
 ├── yes → select
 └── no
      ↓
probe Landlock
      ↓
usable?
 ├── yes → select
 └── no → SandboxUnavailableError
```

Não executar sem confinement silenciosamente.

---

## 20. No silent fallback

Proibido:

```text
bwrap falhou
 ↓
Landlock falhou
 ↓
spawn original argv
```

Resultado obrigatório:

```text
SandboxUnavailableError
```

quando o profile exigir enforcement.

---

## 21. `argv` exato

O backend físico deve receber o `argv` da execução:

```text
[
  executable,
  arg1,
  arg2,
  ...
]
```

Não deve receber uma string de shell.

---

## 22. No shell parsing

A Fase 7 não implementa Shell.

Não interpretar:

```text
&&
||
|
>
<
;
$()
```

O backend apenas confina a execução que já foi definida.

---

## 23. `argv` preservation

O backend pode introduzir:

```text
sandbox launcher
```

como Bubblewrap.

Mas o processo original deve permanecer semanticamente idêntico.

Exemplo conceitual:

```text
[
  "bwrap",
  "...sandbox args...",
  "--",
  originalExecutable,
  originalArg1,
  originalArg2
]
```

---

## 24. Workspace root

Receber:

```text
workspaceRoot
```

já canonicalizado pelo Runtime.

Não usar:

```text
process.cwd()
```

como autoridade.

---

## 25. Physical canonicalization

O backend deve considerar:

```text
realpath(workspaceRoot)
```

e não somente a forma textual.

Essa regra preserva o R12.

---

## 26. Symlink / Junction / Reparse

No Linux, testar:

```text
symlink
```

e qualquer equivalente relevante.

A boundary não pode ser somente lexical.

---

## 27. Same execution world

Process e filesystem devem compartilhar:

```text
workspace
temp
sandbox instance
executionWorldId
```

Portanto:

```text
process escreve arquivo
 ↓
filesystem.read
 ↓
mesmo arquivo
```

deve continuar funcionando.

---

## 28. ExecutionWorldId

Cada invocation física deve possuir:

```text
executionWorldId
```

para correlacionar:

```text
Sandbox
Process
Filesystem
Session
```

Não expor esse identificador ao Agent sem necessidade.

---

## 29. Private temp

O backend poderá criar um:

```text
sessionTempRoot
```

ou:

```text
sandboxTempRoot
```

por invocation.

Características:

```text
private
writable
isolated
cleanupable
```

---

## 30. Cross-session isolation

Session A:

```text
temp/A
```

Session B:

```text
temp/B
```

A não pode acessar B e vice-versa.

---

## 31. Bubblewrap backend

Bubblewrap deve ser utilizado como backend físico quando funcional.

Responsabilidades:

```text
mount namespace
filesystem visibility
read-only/write roots
temp isolation
execution world setup
```

Não reimplementar seus mecanismos internos em JavaScript.

---

## 32. Bubblewrap root

Não assumir:

```text
/usr/bin/bwrap
```

sempre.

O provider deve resolver e validar de forma segura.

Não confiar em um executável encontrado arbitrariamente no PATH sem controle.

---

## 33. Landlock backend

Quando Landlock estiver disponível, o backend deverá:

```text
detect ABI
construct ruleset
add allowed roots
apply before execution
```

A aplicação precisa ocorrer antes do processo executar qualquer código controlado.

---

## 34. Landlock ABI

Se a ABI não suportar os efeitos necessários:

```text
partial
```

ou:

```text
unsupported
```

conforme o profile.

Nunca promover ABI insuficiente para `full`.

---

## 35. No root requirement

O backend deve funcionar sem `sudo`/root quando o mecanismo escolhido permitir isso.

Não criar uma arquitetura que exija privilégios elevados apenas para iniciar o Sandbox.

---

## 36. Native helper

Se Landlock exigir helper nativo:

```text
landlock-run
```

ou equivalente, o helper deverá ser pequeno, versionado, verificável e isolado do restante do Runtime.

Não copiar código do DeepSeek diretamente.

---

## 37. Helper trust

Registrar:

```text
version
platform
architecture
hash
```

quando aplicável.

Não executar helper arbitrário encontrado no PATH como autoridade.

---

## 38. Helper failure

Se o helper:

```text
não existe
não executa
crasha
retorna erro
```

o backend deve falhar de forma tipada.

Nunca cair para execução não confinada.

---

## 39. Process confinement

Quando:

```text
processEnforcement = full
```

o processo deve nascer já sob a sandbox.

Não:

```text
spawn
 ↓
sandbox
```

Mas:

```text
sandbox preparation
 ↓
spawn confined process
```

---

## 40. Descendants

O confinement deve se aplicar aos descendentes do processo sempre que isso fizer parte do enforcement declarado.

Testar:

```text
parent
 ↓
child
 ↓
grandchild
```

e provar que permanecem dentro do execution world.

---

## 41. Process provider integration

`LocalSubprocessProvider` não deve conhecer:

```text
bubblewrap
landlock
mount namespace
```

Ele recebe:

```text
SandboxHandle
```

ou uma prepared execution equivalente.

---

## 42. Process Provider invariant

O Process Provider continua responsável por:

```text
argv
cwd
environment
stdio
process lifecycle
```

O Sandbox continua responsável por:

```text
physical boundary
```

---

## 43. Provider boundary

Nenhum backend físico deve ser capaz de alterar:

```text
Policy
Approval
Capability
```

Ele recebe uma execução já autorizada.

---

## 44. Sandbox Profile Resolution

O profile efetivo deve continuar sendo resultado de:

```text
Runtime ceiling
∩
Capability profile
∩
Tool requested profile
```

A Tool pode restringir.

Nunca ampliar.

---

## 45. `danger-full-access`

Quando o profile efetivo for:

```text
danger-full-access
```

o backend físico não é necessário.

O processo segue o caminho não confinado explicitamente.

Esse fato deve ser observável nos eventos/auditoria.

---

## 46. `full` enforcement

Um backend só pode declarar:

```text
full
```

se o effect set do profile for integralmente comprovado.

Para `workspace-write`, pelo menos:

```text
filesystem read
filesystem write
filesystem delete/rename
process confinement
relevant path traversal protections
```

devem ser cobertos conforme o contrato definido.

---

## 47. Effects fora do escopo

Nesta fase:

```text
network
environment
IPC
GPU
CPU
memory quota
```

não devem ser declarados como `full` sem implementação física específica.

---

## 48. Network

Permanece:

```text
unsupported
```

nesta fase.

Não implementar network isolation parcial apenas para aumentar a lista de features.

---

## 49. Process visibility

Não declarar:

```text
process visibility = isolated
```

sem backend que efetivamente garanta isso.

---

## 50. Environment

O ambiente continua sendo tratado pela Fase 6.

O Sandbox pode fornecer o mundo físico, mas não deve reimplementar toda a política de environment do Process Provider.

---

## 51. `SPECTREE_*`

Continuar a regra:

```text
SPECTREE_*
```

é namespace controlado pelo Runtime.

O processo não pode sobrescrever esses valores via input arbitrário.

---

## 52. Session isolation

Duas invocações simultâneas:

```text
A → read-only
B → workspace-write
```

devem coexistir sem vazamento de profile ou temp.

---

## 53. Per-call policy

A SandboxPolicy é por invocation.

Nunca criar:

```text
globalSandboxMode
```

como estado mutável.

---

## 54. SandboxHandle

A superfície oficial deve permanecer mínima:

```text
mode
enforcement
sandboxInstanceId
assertPathAllowed
release
```

ou equivalente já estabelecido na Fase 5.

---

## 55. R8

Aplicar teste estrutural:

```text
Object.keys(handle)
```

e, quando aplicável:

```text
Object.keys(sandboxContext)
```

Qualquer nova autoridade deve quebrar o teste antes de ser adicionada.

---

## 56. Native resources

SandboxHandle não deve expor:

```text
landlock fd
mount namespace fd
raw process handle
bwrap internals
```

O backend é owner desses recursos.

---

## 57. Lifecycle

```text
prepare
 ↓
apply
 ↓
spawn
 ↓
process execution
 ↓
output drain
 ↓
release
```

---

## 58. Cleanup

`release()` deve ocorrer:

```text
success
failure
cancel
shutdown
```

inclusive quando o Provider falhar.

---

## 59. Cleanup idempotency

```text
release()
release()
```

não pode gerar double cleanup.

---

## 60. Cleanup failure

Se cleanup físico falhar:

```text
SandboxCleanupError
```

deve ser observável.

Não esconder o problema.

---

## 61. Event model

Manter:

```text
sandbox.requested
sandbox.applied
sandbox.denied
sandbox.failed
sandbox.released
```

---

## 62. Event payload

Publicar somente metadata segura:

```text
sandboxInstanceId
backendId
mode
enforcement
executionWorldId
```

Não publicar:

```text
mount details completos
environment
secrets
native handles
kernel internals
```

---

## 63. Event ordering

Sucesso:

```text
policy.evaluated
sandbox.requested
sandbox.applied
provider.started
process.started
process.exited
provider.completed
sandbox.released
```

Falha do backend:

```text
policy.evaluated
sandbox.requested
sandbox.failed
```

sem execução física.

---

## 64. Policy deny

```text
Policy DENY
```

deve resultar em:

```text
sandbox.requested = 0
provider.started = 0
process.started = 0
```

---

## 65. Approval pending

```text
Approval pending
```

não deve aplicar Sandbox.

---

## 66. Revalidation

Após aprovação:

```text
Policy revalidation
 ↓
Sandbox profile reconstruction
 ↓
Physical sandbox
```

Se a Policy mudou para deny:

```text
Sandbox apply = 0
Process = 0
```

---

## 67. Resource binding

O Sandbox recebe o mesmo recurso canônico que a Policy e o Provider usam.

A Fase 4 R12 continua válida.

Não existir:

```text
Policy resource A
Sandbox resource B
Provider resource C
```

---

## 68. Physical boundary test

Processo deve tentar:

```text
outside read
outside write
outside delete
rename across boundary
```

e o teste deve verificar o filesystem real depois da execução.

---

## 69. Symlink test

Criar:

```text
workspace/link → outside
```

e tentar:

```text
write link/file
```

Resultado:

```text
DENIED
```

---

## 70. Hard-link test

Criar arquivo fora do workspace e um hard link dentro quando o ambiente permitir.

Tentar escrever pelo link.

Se a implementação não puder garantir o boundary:

```text
enforcement = partial
```

e `full` não pode ser anunciado.

---

## 71. Process child test

Parent cria child.

Child tenta escrever outside.

Resultado:

```text
DENIED
```

---

## 72. Grandchild test

Parent:

```text
child
  ↓
grandchild
```

O grandchild deve permanecer no mesmo boundary quando o backend declarar `full`.

---

## 73. Same-world test

Process cria:

```text
workspace/file.txt
```

Filesystem Provider lê o mesmo arquivo.

Resultado:

```text
same execution world
```

---

## 74. Concurrent session test

A:

```text
workspace/A
temp/A
read-only
```

B:

```text
workspace/B
temp/B
workspace-write
```

verificar isolamento das policies e temp roots.

---

## 75. Backend fallback test

Provar:

```text
Bubblewrap usable
→ Bubblewrap selected
```

e:

```text
Bubblewrap unusable
Landlock usable
→ Landlock selected
```

---

## 76. Backend unavailable test

Provar:

```text
Bubblewrap unavailable
Landlock unavailable
```

resulta:

```text
SandboxUnavailableError
```

sem spawn.

---

## 77. Partial enforcement test

Usar um backend de teste que declara:

```text
partial
```

e exigir:

```text
full
```

Resultado:

```text
SandboxUnavailableError
```

---

## 78. Typo safety

Qualquer enforcement desconhecido:

```text
Full
FULL
whatever
```

deve gerar erro de configuração/tipo.

Nunca interpretar como permissivo.

---

## 79. WSL2

WSL2 é ambiente Linux de desenvolvimento.

Não é o sandbox.

O backend deverá detectar WSL quando útil para diagnósticos, mas o enforcement continua sendo Bubblewrap/Landlock.

---

## 80. WSL filesystem

Para desenvolvimento:

```text
/home/<user>/spectree-squad
```

é preferível a:

```text
/mnt/c/...
```

para workloads Linux.

---

## 81. WSL interoperability

Não assumir que WSL2 bloqueia automaticamente:

```text
/mnt/c
windows executables
Windows host integration
```

O profile do Runtime deve evitar dar esse acesso implicitamente ao processo sandboxed.

---

## 82. WSL test

Rodar o mesmo teste físico em:

```text
Ubuntu native
WSL2
```

e registrar diferenças reais.

---

## 83. CI

Adicionar job Linux real:

```text
ubuntu-latest
```

com testes físicos.

---

## 84. No silent skip

Se o backend esperado não puder ser testado:

```text
job deve falhar
```

e não:

```text
all sandbox tests skipped
```

---

## 85. Platform matrix

| Platform | Backend | Resultado |
|---|---|---|
| Linux + Bubblewrap | physical | testado |
| Linux + Landlock | physical | testado quando disponível |
| WSL2 + Linux backend | physical | testado |
| Windows native | unavailable | esperado |
| macOS | unavailable | esperado |

---

## 86. Security probe environment

Probes devem usar:

```text
temporary root
```

e nunca o workspace pessoal do Founder.

Não usar:

```text
internet
cloud
credentials
SSH keys
```

nos probes.

---

## 87. No root

Não exigir `sudo`/root para o caminho suportado por Bubblewrap quando o ambiente permitir.

Se um backend exigir privilégio específico:

```text
unsupported/unavailable
```

deve ser preferível a elevar privilégios silenciosamente.

---

## 88. Native helper

Se existir helper para Landlock:

```text
version
architecture
hash
```

devem ser conhecidos.

O helper não pode ser encontrado arbitrariamente no PATH e aceito como confiável.

---

## 89. Helper failure

Falha do helper:

```text
SandboxUnavailableError
```

quando o profile exige confinement.

---

## 90. ToolRuntime

Nenhuma mudança de responsabilidade:

```text
Policy
Approval
Sandbox
Provider
```

continua sendo a cadeia.

O ToolRuntime não conhece Bubblewrap/Landlock.

---

## 91. Process Provider

Nenhuma mudança de responsabilidade.

Ele recebe o SandboxHandle/prepared execution.

Não decide Sandbox.

---

## 92. Capability Registry

Nenhuma nova Capability criada.

A Capability `process` continua sendo da Fase 6.

---

## 93. Squad Integration

`Squad` não deve conhecer:

```text
bubblewrap
landlock
executionWorld
```

`squad.policies.json` continua sendo somente autorização.

---

## 94. Sandbox profile source

O documento:

```text
sandbox.profiles.json
```

continua representando o profile físico.

Não criar:

```text
linux.policies.json
```

ou uma segunda matriz de autorização.

---

## 95. No platform policy duplication

Platform-specific behavior pertence ao backend.

Não duplicar profiles:

```text
linux-workspace-write.json
windows-workspace-write.json
```

A semântica do profile permanece igual.

---

## 96. Backend capability negotiation

O Resolver pergunta:

```text
supports(profile, effects, requiredEnforcement)
```

O backend responde com fatos.

O Resolver decide:

```text
compatible
incompatible
unavailable
```

---

## 97. Profile ceiling

Exemplo:

```text
Runtime max = workspace-write
Tool request = danger-full-access
```

Resultado efetivo não pode ultrapassar:

```text
workspace-write
```

---

## 98. `danger-full-access` audit

O modo deve ser visível em:

```text
events
logs
example
audit metadata
```

sem vazar secrets.

---

## 99. Process environment

Fase 6 continua sendo autoridade sobre:

```text
environment allowlist
SPECTREE_* namespace
secret scrub
```

O Sandbox não deve criar uma segunda lógica contraditória.

---

## 100. Output

A Fase 6 continua limitando:

```text
stdout
stderr
spill
```

O Sandbox não altera esse contrato.

---

## 101. Process lifecycle

A Fase 6 continua controlando:

```text
spawn
terminate
done
ProcessRegistry
Session cancellation
shutdown
```

A Fase 7 apenas fornece a execution boundary.

---

## 102. Shell

Fora do escopo.

A existência do backend físico prepara:

```text
process
→ sandboxed process
```

para uma futura Shell Capability.

---

## 103. Terminal

Fora do escopo.

---

## 104. Container / VM

Fora do escopo.

No futuro poderão representar **execution worlds inteiros**, e não apenas outro detalhe interno do SandboxProvider.

---

## 105. Definition of Done

A Fase 7 só poderá ser CLOSED quando:

- [ ] LinuxPhysicalSandboxProvider existir.
- [ ] BubblewrapBackend existir.
- [ ] LandlockBackend ou seam compatível existir.
- [ ] Backend selection existir.
- [ ] Functional probes existirem.
- [ ] Probe timeout existir.
- [ ] Read-only estiver fisicamente implementado.
- [ ] Workspace-write estiver fisicamente implementado.
- [ ] Danger-full-access continuar explícito.
- [ ] Full/partial/unsupported forem reportados honestamente.
- [ ] Sem silent fallback.
- [ ] Workspace root canonicalizada.
- [ ] Temp root isolada.
- [ ] Symlink/junction boundary testada.
- [ ] Hard-link behavior testado.
- [ ] Outside read/write/delete testados.
- [ ] Child/grandchild boundary testados.
- [ ] Filesystem e Process same-world testado.
- [ ] Concurrent Sessions testadas.
- [ ] Cleanup testado.
- [ ] Cancellation cleanup testado.
- [ ] Shutdown cleanup testado.
- [ ] Policy deny impede sandbox.
- [ ] Approval pending impede sandbox.
- [ ] Policy revalidation deny impede sandbox.
- [ ] Backend unavailable impede process.
- [ ] Partial não conta como full.
- [ ] R8 do SandboxHandle permanece travado.
- [ ] WSL2 validado como host de desenvolvimento.
- [ ] CI Linux físico existe.
- [ ] Fases 1–6 permanecem verdes.
- [ ] `claude plugin validate . --strict` passa.
- [ ] documentação atualizada.
- [ ] ADR-07 criado.
- [ ] Shell/Terminal/Windows-native/containers/microVM/remote não implementados.

---

## 106. Definition of Architecture Done

A prova central deverá ser:

```text
Policy
 ↓
Approval
 ↓
SandboxProfile
 ↓
LinuxPhysicalSandboxProvider
 ↓
Bubblewrap / Landlock
 ↓
Process
```

com prova física real:

```text
workspace:
  read     ✓
  write    ✓
  delete   ✓

outside:
  read     ✗
  write    ✗
  delete   ✗
```

para `workspace-write`, conforme o effect set definido.

Também:

```text
parent
 ↓
child
 ↓
grandchild
```

deve permanecer dentro do execution world quando o backend declarar `full`.

---

## 107. Invariantes da Fase 7

- **INV-701**
  LinuxPhysicalSandboxProvider é implementação de Sandbox, não Capability de negócio.

- **INV-702**
  Bubblewrap/Landlock não são conhecidos pelo Agent.

- **INV-703**
  Bubblewrap/Landlock não são conhecidos pelo Process Provider.

- **INV-704**
  Policy continua autorizando.

- **INV-705**
  Approval continua autorizando exceções humanas.

- **INV-706**
  Sandbox continua impondo boundary físico.

- **INV-707**
  Provider continua executando Capability.

- **INV-708**
  Sandbox policy é por invocation.

- **INV-709**
  Backend incompatível não pode executar unconfined sob modo restritivo.

- **INV-710**
  `full` só pode ser reportado quando o effect set prometido estiver fisicamente coberto.

- **INV-711**
  `partial` nunca é tratado como `full`.

- **INV-712**
  `danger-full-access` é escolha explícita.

- **INV-713**
  O processo inicia já dentro da boundary.

- **INV-714**
  Não existe pós-confinamento.

- **INV-715**
  Workspace é fisicamente canonicalizado.

- **INV-716**
  Temp é isolado por Session/invocation conforme o Profile.

- **INV-717**
  Process e filesystem compartilham execution world.

- **INV-718**
  Nenhum Agent acessa Sandbox internals.

- **INV-719**
  Nenhum Tool amplia o Sandbox Profile.

- **INV-720**
  Nenhum Provider amplia o Sandbox Profile.

- **INV-721**
  Nenhuma Policy contém detalhes do Linux backend.

- **INV-722**
  Nenhuma Persona contém detalhes do Linux backend.

- **INV-723**
  WSL2 é host de desenvolvimento, não security boundary do Runtime.

- **INV-724**
  Functional probe é a autoridade para backend availability.

- **INV-725**
  Runner failure não pode virar child failure silenciosamente.

- **INV-726**
  No silent unconfined fallback.

- **INV-727**
  Cada SandboxHandle pertence a uma única invocation.

- **INV-728**
  Release é idempotente.

- **INV-729**
  Runtime shutdown libera todos os Sandbox Handles.

- **INV-730**
  Sandbox backend pode ser substituído por outro backend Linux sem alterar consumidores.

---

## 108. Handoff obrigatório do Opus 5

```text
## Implementation

arquivos criados/modificados

## Backend Architecture

LinuxPhysicalSandboxProvider
BubblewrapBackend
LandlockBackend

## Runner Selection

probe
fallback
failure

## Enforcement

full
partial
unsupported

## Profiles

read-only
workspace-write
danger-full-access

## Functional Probe

cenários reais

## Physical Security

workspace
outside
symlink
junction
hard-link
process descendants
temp

## WSL2

detecção
limitações
testes

## Same World

filesystem + process

## Cleanup

process
sandbox
temp
native resources

## CI

Linux
WSL2

## DeepSeek Adaptation

o que foi adotado
o que foi deliberadamente alterado

## Known Limitations

limitações reais

## Scope Verification

ausência de:
Shell
Terminal
Windows native
Container
MicroVM
Remote
Network
Orchestrator
```

---

## 109. Regra de ouro da Fase 7

> **O Spectree só pode declarar um processo como fisicamente confinado quando o sistema operacional estiver realmente impondo a fronteira declarada.**

Não basta:

```text
JavaScript path check
```

Não basta:

```text
bwrap instalado
```

Não basta:

```text
Landlock disponível
```

A prova é:

```text
backend
+
profile
+
functional probe
+
physical black-box tests
=
enforcement fact
```

---

## 110. Resultado estratégico

Após a Fase 7:

```text
Agent
 ↓
Policy
 ↓
Founder Approval
 ↓
Capability
 ↓
Linux Physical Sandbox
 ├── Bubblewrap
 └── Landlock
 ↓
Process Provider
 ↓
Linux Execution World
```

E a mudança prática será:

```text
Antes:

workspace-write + process
→ SandboxUnavailableError

Depois:

workspace-write + physical backend full
→ sandboxed process
```

---

## 111. Próxima fronteira

Depois da Fase 7, a próxima fase deverá ser:

## **Fase 8 — Execution Effects / Resource Model**

Antes da Shell.

O motivo é estrutural: `cwd` funciona para Process, mas Shell pode produzir múltiplos efeitos em uma única invocação.

Precisamos evoluir de:

```text
Invocation
 ↓
Resource
```

para:

```text
Invocation
 ↓
EffectSet
 ├── filesystem.read
 ├── filesystem.write
 ├── process.spawn
 ├── process.output
 └── future network.*
```

Só então Shell poderá ser implementado sem repetir o problema que corrigimos em R9/R14:

> **Policy avalia uma coisa enquanto a execução efetivamente faz outra.**

---

## 112. Regra estratégica final

A Fase 7 não é uma integração de Bubblewrap.

Ela é a implementação da primeira:

```text
Physical Execution Boundary
```

do Spectree Runtime.

Bubblewrap e Landlock são mecanismos.

A arquitetura do Spectree continua sendo:

```text
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

O mecanismo físico pode mudar sem mudar essa cadeia.

Isso é o que permitirá ao Spectree evoluir posteriormente para:

```text
Linux native
Container
MicroVM
Remote execution
```

sem reabrir o Core que já congelamos nas Fases 1–6.
