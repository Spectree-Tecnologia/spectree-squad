---
status: in-review
owner: TechLeader
depends_on: F1 Runtime Core, F2 Policy Engine, F3 Founder Gate, F4 Capability Providers, F4.5 Squad/Runtime Integration, F5 Sandbox Runtime
---

# Spectree Runtime v2 — F06 Process/Subprocess Capability

> Transcrição da especificação normativa da Fase 6, produzida no harness de
> planejamento do Founder (declarado na fonte: `Status: SPECIFICATION`,
> `Owner: TechLeader`). O texto é o do documento fonte, sem correção, melhoria
> ou complemento. O texto commitado é o contrato real (ver
> `docs/spec/README.md`).
>
> **Três fontes, e esta é a que vale.** É a primeira fase em que as três
> puderam ser comparadas lado a lado: a exportação achatada que gerou a versão
> anterior deste arquivo; um reexport de 290 linhas, 36 cercas e um único
> invariante, recusado por perda massiva; e o documento colado íntegro pelo
> Founder no chat, com 2667 linhas, 532 linhas de cerca e os 30 invariantes.
> A terceira venceu, e venceu por uma diferença que nenhuma fase anterior
> tinha: **os títulos de seção iniciam linha.** 180 seções contíguas de 1 a
> 180, `INV-601` a `INV-630` presentes e únicos, 266 blocos de código.
>
> **A divergência 30 × 31 nos invariantes era um artefato de contagem, não um
> invariante.** O disco media 31 ocorrências do prefixo contra 30 da fonte, e a
> suspeita era grave: ou o transporte fabricou um invariante, ou a fonte perdeu
> um. Não foi nem uma coisa nem outra. Os 30 identificadores normativos são
> idênticos dos dois lados — `INV-601` a `INV-630`, contíguos, únicos, com as
> mesmas 30 sentenças, byte a byte. A trigésima primeira ocorrência estava
> **dentro do próprio cabeçalho de transcrição**: a meta-nota que anunciava
> restaurar o formato dos invariantes citava o padrão com `NN` no lugar dos
> dígitos, e o detector, ancorado no prefixo nu, contou esse placeholder como
> se fosse contrato. O identificador extra nunca existiu no corpo normativo.
>
> Fica o método, e ele vale para as fases irmãs: **conte o prefixo seguido de
> três dígitos, e conte a partir da primeira seção numerada, nunca do arquivo
> inteiro.** Todo cabeçalho de proveniência fala a mesma língua do texto que
> descreve — este aqui cita identificadores reais na prosa acima e abaixo — e
> por isso um detector ancorado no prefixo nu vai sempre superestimar.
>
> **A conta da reconciliação fecha, com três parcelas de quatro possíveis.**
> 532 cercas na fonte (266 blocos) contra 466 em disco (233 blocos): 66 linhas,
> 33 blocos de diferença líquida. Deles:
>
> - **28 dissolvidos** em bullets ou prosa — dano de marcação puro, conteúdo
>   integralmente preservado. Por seção: §1 (duas vezes), §3, §4, §7, §9, §11,
>   §17, §20, §24, §26, §33, §55, §57, §58, §70, §87, §99, §105, §111, §117,
>   §124, §125, §134, §164, §169, §170, §178. Vinte e seis viraram listas de
>   `-` (150 linhas de bullet); os dois da §1 viraram prosa nua
>   (`Runtime que governa funções e Providers` e
>   `Runtime que também governa processos externos`, que a fonte cerca).
> - **3 cercas vazias apagadas** — uma na §97 e duas na §123. Não perderam
>   conteúdo porque não tinham nenhum; ver adiante.
> - **2 nunca chegaram**, porque a seção de review não existia neste arquivo.
>   Isso é conteúdo, não marcação.
> - **0 fundidos e 0 blocos fabricados.**
>
> `266 − 28 − 3 − 2 = 233`, exatamente os `466 ÷ 2` que estavam em disco. A
> conta foi conferida por um segundo caminho, independente da inspeção seção a
> seção: as 296 linhas `- ` do disco decompõem-se em 150 dos bullets
> dissolvidos, 99 bullets `*` que a fonte já traz, 12 do enumerado da §171, 30
> da lista de invariantes reformatada e 5 do bloco de identificação do topo.
> Bate na unidade, o que fixa os 28 dissolvidos sem depender de julgamento.
>
> **A invenção existe, mas não é bloco — é cabeçalho, e por isso nenhum
> balanço de cercas a revelaria.** A F04 avisou que uma invenção pode se
> esconder no líquido quando a contagem por seção bate dos dois lados; aqui ela
> se escondeu num eixo que a contagem de cercas nem mede. O disco trazia **9
> títulos `##` que a fonte não tem** — `Testes obrigatórios — Capability`,
> `— executable`, `— environment`, `— cwd`, `— stdio`, `— output`,
> `— lifecycle` (§149, §151 a §156), `Invariantes da Fase 6` (§174) e
> `Fluxo final da Fase 6` (§176) — e **não tinha o único `##` que a fonte
> traz**, o da seção de review. Os 15 `##` restantes dos dois lados vivem
> dentro da cerca do handoff da §175 e são conteúdo, não estrutura: `24 − 15 =
> 9` inventados, `16 − 15 = 1` real e ausente. Promover essas nove linhas a
> heading não foi só acrescentar marcação — apagou o número da seção junto, e
> foi assim que sete das seções de teste perderam o endereço. As nove foram
> revertidas para a linha numerada da fonte.
>
> **As cercas vazias da §97 e da §123 são da fonte, e o diagnóstico anterior
> apontava o buraco certo pelo motivo errado.** O cabeçalho anterior deste
> arquivo registrava que as seções 97 e 123 tinham "lacunas literais de
> conteúdo" e tratava isso como razão para não aprovar. A lacuna é real, mas
> ela **não é dano de transporte**: a fonte íntegra traz, nos três pontos, uma
> cerca de abertura seguida imediatamente da cerca de fechamento, sem nenhuma
> linha entre elas — a §97 depois de `ou:`, e a §123 depois de `enxerga:` e
> depois de `o processo deve receber o mesmo:`. Não há texto a restaurar
> porque nunca houve texto. É a mesma doença da §27 e da §47 da F04, e a
> diferença importa porque muda quem precisa consertar: reexportar a fonte não
> produz esse conteúdo, só o autor produz. A versão em disco tinha apagado até
> as cercas vazias, e com elas o registro visível do buraco. As três foram
> restauradas exatamente como a fonte as traz. A §123 é onde o `INV-630`
> (`Filesystem e Process compartilham execution world`) se apoia, e continua
> sem o par de valores que ela prometia enunciar.
>
> **Sobre extrair títulos de seção: a recusa continua, e agora com uma
> concessão que a evidência nova tornou mecânica.** A transcrição anterior
> recusou-se a extrair títulos porque naquela fonte nenhum dos 180 títulos
> iniciava linha, e o corte exigiria 180 julgamentos semânticos sobre o texto
> do Founder. A fonte nova mudou metade do problema: os 180 números de seção
> **iniciam linha**, contíguos de 1 a 180, sem lacuna e sem repetição — as 192
> linhas que casam `^N. ` são esses 180 mais o enumerado de 1 a 12 da §171.
> Restaurar o número é operação delimitada pelo próprio token `N. `, sem
> nenhuma decisão sobre o texto, e por isso foi feita: os cerca de 90 números
> que o achatamento havia comido estão de volta.
>
> O que **não** mudou é o resto: o título continua soldado à primeira frase do
> corpo. A fonte traz `6. Regra de ouro O Process Provider nunca interpreta uma
> string de comando como shell.` numa linha só, sem separador entre
> `Regra de ouro` e `O Process Provider`. Decidir que o título termina em
> "ouro" e não em "ouro O Process Provider" é julgamento semântico sobre o
> texto do Founder, e seriam 180 deles. Que algumas seções tragam o título
> sozinho na linha (§61, §71, §124, §128, §149 a §156, §158, §174, §176) não
> ajuda: uma regra que acerta em vinte casos e chuta nos outros 160 não é
> mecânica, é inferência com aparência de método — foi exatamente assim que os
> nove `##` inventados nasceram. **O problema mudou de grau, não de natureza, e
> a recusa continua certa.** Se o Founder quiser as seções como heading real,
> isso é pedido de reexport com `##` na origem; não se deriva daqui.
>
> **Esta fase traz review, e com ele o `R14` — a última órfã da família R.**
> A cauda da fonte é `Review do TechLeader — PR #25 — REQUEST CHANGES`, e ela é
> curta e inteira: só `R14`, a regra de honestidade operacional —
> `sem enforcement físico + modo que promete confinement = não executar`, com a
> recusa explícita de implementar Landlock, bwrap ou qualquer backend físico
> nesta fase. Ela fica aqui, ao final e fora da numeração normativa, pelo
> endereço que a F02 fixou e que a F04 e a F05 seguiram: é a rodada de correção
> que emendou este contrato antes do merge, não uma decisão tomada fora do
> documento. O `R14` é o segundo identificador mais citado do runtime, atrás só
> do `R8`: o código o cita **dezessete vezes**
> (`spectree-runtime/sandbox/execution-boundary.js`,
> `spectree-runtime/providers/local/subprocess-provider.js`,
> `spectree-runtime/sandbox/providers/local-filesystem-sandbox.js`,
> `spectree-runtime/sandbox/providers/linux-physical/linux-physical-sandbox-provider.js`,
> `spectree-runtime/tests/process-integration.test.js`,
> `spectree-runtime/tests/sandbox-unit.test.js`,
> `spectree-runtime/tests/linux-sandbox-physical.test.js`,
> `spectree-runtime/tests/linux-sandbox-unit.test.js`, e os dois exemplos), e o
> `ADR-06`, o `ADR-07`, o `docs/architecture/SPECTREE-RUNTIME.md` e a
> `RUNTIME-F07` inteira derivam dele. Até esta transcrição, `grep R14` não
> encontrava definição nenhuma em disco: o identificador que sustenta a Fase 7
> existia só como citação.
>
> Aprovação: a Fase 6 embarcou em `main` no PR #25 — squash `2089697`, tag
> `v0.30.0`, em 2026-08-20. A citação fica no corpo e não no cabeçalho (ADR-10,
> decisão 13) porque o `git log` **deste arquivo** não a contém: o merge
> aprovou a implementação da fase, e este arquivo só nasceu na transcrição
> posterior.
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
- Baseline: Spectree Runtime v2 — Fases 1, 2, 3, 4, 4.5 e 5 congeladas
- Versão de referência: pós-v0.29.0
- Fase: 6 — Process/Subprocess Capability
- Referência arquitetural principal: DeepSeek Harness — subprocess seam + process sandbox

1. Objetivo Criar a primeira Capability do Spectree capaz de iniciar e gerenciar processos externos de forma governada pelo Runtime. O resultado esperado é:

```
Agent
  ↓
ToolRuntime
  ↓
Policy
  ↓
Approval, quando exigido
  ↓
Capability: process
  ↓
Sandbox
  ↓
LocalSubprocessProvider
  ↓
Operating System Process
```

A Fase 6 deve transformar o Spectree de:

```
Runtime que governa funções e Providers
```

em:

```
Runtime que também governa processos externos
```

2. Referência DeepSeek O DeepSeek trata subprocesso como um seam independente, com um Service Definition abstrato e um provider local. Esse seam possui resolução de executável, spawn, handles vivos, stdio explícito, ambiente controlado, saída coletada e encerramento da árvore de processos. Bash, LSP, ACP e terminal consomem esse seam em vez de implementarem spawn diretamente. O DeepSeek também deixa o contrato de spawn explicitamente definido: argv, cwd, stdio, graceMs, signal e ambiente. O argv não é interpretado por shell. O Spectree deverá adotar esses princípios, mas não copiar a extensão completa do DeepSeek.

3. Escopo desta fase Implementar apenas:

```
Capability:
process

Provider:
LocalSubprocessProvider

Provider seam:
spawn

Process Handle:
lifecycle
stdout
stderr
stdin, quando permitido
exit outcome
termination
```

E integrar com:

```
Policy
Approval
Sandbox
Session
EventBus
CapabilityRegistry
CapabilityProviderRegistry
ToolRuntime
```

4. Fora do escopo Não implementar nesta fase:

```
❌ Bash
❌ sh
❌ PowerShell
❌ shell parser
❌ PTY
❌ Terminal persistente
❌ LSP
❌ ACP
❌ Git provider
❌ Docker provider
❌ Kubernetes execution
❌ remote execution
❌ E2B
❌ VM
❌ microVM
❌ container runtime
❌ process pool
❌ job scheduler
❌ distributed process service
❌ daemon manager
❌ background task scheduler
❌ interactive shell UI
❌ terminal UI
```

5. Princípio fundamental Processo é uma Capability. Shell não é a Capability desta fase. A diferença é:

```
Process
= executa argv explícito

Shell
= interpreta linguagem de comandos
```

Portanto:

```
process
  argv = ["node", "script.js"]
```

é permitido. Enquanto:

```
process
  command = "node script.js && echo ok"
```

não deve ser interpretado como shell.

6. Regra de ouro O Process Provider nunca interpreta uma string de comando como shell. O contrato é:

```
argv[0] = executable
argv[1...] = arguments
```

e nunca:

```
command = arbitrary shell source
```

Isso elimina uma classe inteira de ambiguidade e segue diretamente a decisão do DeepSeek de manter argv explícito e não shell-interpreted.

7. Capability Registrar:

```
Capability:
process
```

Operações mínimas:

```
spawn
terminate
```

Não transformar stdout, stderr e stdin em operações independentes da Capability. São partes do lifecycle do processo.

8. Process Tool Criar uma Tool representativa:

```
process.spawn
```

Metadata:

```
capability:
  process

operation:
  spawn

execution:
  physical
```

Como processo é sempre físico:

```
process.* → physical
```

A Tool jamais poderá declarar:

```
execution: pure
```

para uma operação que inicia processo.

9. Provider Criar:

```
LocalSubprocessProvider
```

Responsabilidades:

```
resolve executable
spawn
manage process
manage stdio
collect output
terminate process tree
produce outcome
cleanup
```

10. Provider não é Shell O Provider não deve saber:

```
Bash
PowerShell
&&
|
>
<
;
$(...)
```

nem qualquer outro operador de shell. Um futuro ShellProvider consumirá o process capability.

11. Provider não é Terminal O Provider desta fase não precisa possuir:

```
PTY
foreground process group interaction
terminal resize
scrollback
interactive terminal semantics
```

Esses conceitos pertencem a uma futura Capability Terminal. O DeepSeek separa subprocess e terminal exatamente por essa razão.

12. Spawn Spec Criar:

```
ProcessSpawnSpec
```

com:

```
argv
cwd
stdin
stdout
stderr
env
graceMs
signal?
```

13. argv Contrato:

```
argv: readonly string[]
```

Regras:

```
argv.length >= 1
argv[0] obrigatório
todos os elementos string
```

14. Empty argv Rejeitar:

```
[]
```

com:

```
ProcessConfigurationError
```

e:

```
process.start = 0
```

15. Shell flag Não criar:

```
shell: true
```

na Fase 6. Se o futuro Shell Provider quiser executar bash, ele deverá explicitamente solicitar:

```
process.spawn
argv = ["/bin/bash", ...]
```

e isso será governado como qualquer outro processo.

16. Executable resolution Criar:

```
resolveExecutable(command, env?)
```

Inspirado no DeepSeek: executáveis absolutos são validados diretamente; nomes simples são resolvidos através de um PATH controlado.

17. Absolute executable Exemplo:

```
/usr/bin/node
```

deve ser:

```
canonicalizado
verificado
```

antes do spawn.

18. Bare executable Exemplo:

```
node
```

pode ser resolvido através de:

```
PATH controlado
```

Não procurar executável arbitrariamente em todo filesystem.

19. PATH O Provider deve construir um ambiente base controlado. Não simplesmente usar:

```
process.env
```

sem filtragem.

20. Ambiente Criar:

```
ProcessEnvironment
```

com:

```
base environment
explicit overrides
managed variables
```

21. Parent environment O Provider pode derivar do ambiente do processo hospedeiro, mas deverá aplicar scrub antes de criar o ambiente filho. O DeepSeek faz isso explicitamente: remove variáveis ambient que pertencem ao namespace controlado antes de aplicar os overrides deliberados.

22. Spectree namespace Criar namespace:

```
SPECTREE_*
```

para fatos controlados pelo Runtime. Por exemplo, futuramente:

```
SPECTREE_SESSION_ID
SPECTREE_AGENT_ID
SPECTREE_CAPABILITY
SPECTREE_SANDBOX
```

Não expor automaticamente segredos.

23. Regra de ambiente Variáveis:

```
SPECTREE_*
```

herdadas do host não devem ser confiadas automaticamente. O Provider deve removê-las e somente recolocá-las quando o Runtime explicitamente as definir. Esse princípio acompanha a proteção de namespace usada pelo DeepSeek.

24. Credentials Não propagar automaticamente:

```
API keys
tokens
SSH secrets
cloud credentials
database credentials
```

via ambiente. O default é:

```
not inherited unless explicitly allowed
```

25. Environment allowlist O Provider deverá suportar:

```
allowedEnvironmentKeys?
```

Se não definido:

```
minimal safe environment
```

26. Working directory cwd é obrigatório. Nunca:

```
cwd = process.cwd()
```

implicitamente. O chamador deve fornecer ou o Runtime deve derivar explicitamente de:

```
execution resource
sandbox workspace
```

27. CWD binding O cwd deve estar dentro do execution world permitido pelo Sandbox. Isso é crítico. Não permitir:

```
Policy resource:
workspace

cwd:
/tmp/outside
```

e executar normalmente.

28. Resource Para process.spawn, o resource deve representar o execution world do processo. Exemplo:

```
process://workspace
```

ou uma forma equivalente definida pelo implementador. O formato precisa ser canônico.

29. Resource ↔ cwd Obrigatório:

```
authorized resource
    ↔
sandbox boundary
    ↔
process cwd
```

Nenhum desses três pode divergir.

30. Sandbox integration O processo deve nascer já dentro do Sandbox, não ser iniciado primeiro e "confinado" depois. Fluxo:

```
resolve argv
 ↓
resolve cwd
 ↓
Policy
 ↓
Approval
 ↓
Sandbox apply
 ↓
spawn process
```

31. Process tree O Sandbox precisa se aplicar ao processo e aos descendentes do processo. O DeepSeek trata o subprocesso como uma árvore gerenciada e o Sandbox como uma restrição sobre o processo que é spawnado e tudo que ele inicia. O Spectree deve adotar a mesma propriedade.

32. Não spawnar primeiro É proibido:

```
spawn()
 ↓
sandbox()
```

A ordem é:

```
sandbox preparation
 ↓
spawn()
```

33. Sandbox enforcement Para:

```
process.spawn
```

o Sandbox deve considerar:

```
process
environment
network
```

Mesmo que somente filesystem esteja implementado atualmente.

34. Process sandbox support A Fase 5 deixou:

```
process = unsupported
```

A Fase 6 passa a implementar o primeiro consumidor desse eixo. Não reescrever o Sandbox inteiro. Adicionar:

```
process execution boundary
```

ao contrato existente.

35. Full vs Partial A honestidade da Fase 5 permanece. Se o backend só consegue restringir filesystem:

```
enforcement = partial
```

Não declarar full para uma execução de processo se:

```
network/process/environment
```

continuarem sem isolamento físico.

36. Process full enforcement full somente quando o backend comprovar os boundaries declarados. Não considerar:

```
Node checks
```

como full.

37. Fail closed Se o perfil exigir:

```
process boundary = full
```

e o backend só tiver:

```
partial
```

resultado:

```
SandboxUnavailableError
```

e zero processo iniciado.

38. Process Handle O spawn() não deve bloquear até o processo terminar. Deve retornar:

```
ProcessHandle
```

imediatamente. Essa é uma das principais decisões do seam de subprocesso do DeepSeek.

39. ProcessHandle minimum surface O Handle deve expor somente:

```
pid
done
stdout
stderr
stdin?
terminate()
```

A implementação pode adaptar os detalhes à stack, mas a superfície deve ser mínima.

40. PID pid deve ser informativo. Não entregar:

```
process
childProcess
internal spawn object
```

diretamente.

41. done done representa o encerramento do processo. Resultado:

```
ProcessOutcome
```

42. ProcessOutcome Campos mínimos:

```
exitCode
signal
startedAt
endedAt
durationMs
```

Não incluir automaticamente stdout/stderr completos no outcome.

43. Spawn failure Se o processo nunca iniciar:

```
spawn()
```

deve falhar com:

```
ProcessSpawnError
```

Não produzir um ProcessHandle falso.

44. Runtime failure vs process failure Distinguir:

```
ProcessSpawnError
```

de:

```
Process exited with code != 0
```

O segundo é um outcome de execução, não necessariamente erro interno do Runtime.

45. Exit code Um processo pode terminar com:

```
exitCode = 0
```

ou:

```
exitCode != 0
```

O Provider deve retornar os fatos. A interpretação:

```
success/failure
```

é da Tool/consumer.

46. Signal Quando aplicável:

```
signal
```

deve ser registrado. Não criar uma taxonomia específica por SO.

47. STDIO Todos os streams devem possuir modo explícito. Inspirando-se no DeepSeek, usar pelo menos:

```
stdin:
  ignore
  pipe
  data

stdout:
  pipe
  inherit
  collect

stderr:
  pipe
  inherit
  collect
```

O DeepSeek utiliza justamente disposições explícitas para evitar defaults ocultos e permitir consumidores diferentes.

48. Default stdio Não criar defaults silenciosos no Process Provider. O ProcessSpawnSpec deve exigir:

```
stdin
stdout
stderr
```

Explicitamente.

49. Collected output Criar:

```
CollectedOutput
```

com:

```
text
truncated
```

Opcionalmente:

```
spillPath
```

O princípio vem diretamente do DeepSeek, que limita a coleta em memória e pode usar spill quando necessário.

50. Output limits Toda coleta precisa de:

```
maxBytes
```

Não coletar stdout indefinidamente em memória.

51. Spill O spill deve ser opcional. Se habilitado:

```
spill.maxBytes
```

também precisa ser limitado. Não permitir arquivo de saída ilimitado.

52. Output truncation Quando o limite for excedido:

```
truncated = true
```

e o Runtime deve preservar uma indicação explícita. Não fingir que o texto retornado é completo.

53. Spill security O spill deve ficar dentro de:

```
Sandbox writable root
```

e nunca em:

```
arbitrary /tmp
```

sem controle.

54. Stdin Modo:

```
ignore
```

deve impedir entrada interativa. Modo:

```
data
```

escreve bytes e fecha stdin. Modo:

```
pipe
```

expõe uma interface limitada para escrita contínua.

55. Interactive stdin Nesta fase, pipe deve existir apenas como primitive. Não criar ainda:

```
interactive terminal
prompt detection
terminal session
```

Esses pertencem à futura Terminal Capability.

56. stdout O modo pipe entrega fluxo bruto. O modo collect entrega CollectedOutput. O modo inherit conecta ao processo hospedeiro segundo política explícita.

57. inherit security inherit não deve ser default. É permitido somente quando o Runtime/Tool declarar explicitamente. Isso evita vazamento de:

```
stderr
logs
environment
```

para o processo pai.

58. Event payloads Eventos de process não podem publicar:

```
stdout completo
stderr completo
environment
command secrets
stdin contents
```

por padrão.

59. Process events Adicionar:

```
process.requested
process.resolved
process.started
process.exited
process.failed
process.terminated
```

O implementador pode reduzir o conjunto, mas a distinção entre lifecycle e failure deve existir.

60. Event ordering — success Fluxo mínimo:

```
tool.requested
policy.evaluated
sandbox.requested
sandbox.applied
tool.started
process.requested
process.resolved
process.started
process.exited
tool.completed
sandbox.released
```

Se o processo for o corpo principal da Tool, provider.started pode permanecer como:

```
provider.started
```

antes de process.started.

61. Event ordering — spawn failure

```
tool.requested
policy.evaluated
sandbox.applied
tool.started
process.requested
process.failed
tool.failed
sandbox.released
```

62. Event ordering — process non-zero exit A execução física ocorreu. Portanto:

```
process.started
process.exited
```

é sucesso do Provider do ponto de vista de infraestrutura. A Tool pode decidir:

```
tool.failed
```

com base no exit code.

63. Process termination Criar:

```
terminate()
```

como a única API de encerramento. Não expor:

```
kill()
forceKill()
signal()
```

como API pública nesta fase.

64. Termination escalation Inspirando-se no DeepSeek:

```
terminate()
   ↓
graceful termination
   ↓
wait graceMs
   ↓
forced termination
   ↓
wait for tree
```

O DeepSeek faz uma escalada equivalente e trata a árvore inteira, não apenas o processo raiz.

65. Process tree termination terminate() deve afetar:

```
process
+
descendants
```

Não apenas:

```
root PID
```

66. Grace period graceMs:

```
positive finite number
```

e limitado. Não permitir:

```
Infinity
```

nem números absurdamente grandes.

67. AbortSignal O ProcessSpawnSpec deve aceitar:

```
signal?: AbortSignal
```

Quando abortado:

```
terminate()
```

deve ser acionado. O DeepSeek usa esse padrão: o consumidor fornece deadlines/causa e o subprocess seam apenas reage ao abort.

68. Cancellation integration Quando:

```
Session.cancel()
```

ocorrer durante processo ativo:

```
ProcessHandle.terminate()
```

deve ser acionado.

69. Session authority A Session continua tendo autoridade sobre lifecycle. O processo não pode continuar indefinidamente depois de:

```
Session.cancel()
```

quando o Runtime consegue observá-lo.

70. Process cleanup Após término:

```
handle
streams
spill files
sandbox
```

devem ser limpos de forma determinística.

71. Process handle idempotency

```
terminate()
terminate()
```

não pode produzir corrupção. A segunda chamada pode retornar o estado existente.

72. Process completion after terminate Depois de terminate():

```
done
```

deve resolver com os fatos finais. Não considerar terminate() como completion.

73. Sandbox release after process A ordem:

```
process exits
 ↓
output drained
 ↓
sandbox released
```

é obrigatória. Não liberar Sandbox enquanto streams ainda possam conter dados necessários.

74. Sandbox release after kill Mesmo em forced termination:

```
sandbox.released
```

deve ocorrer.

75. Executable resolution security O Provider não deve resolver um executável por:

```
command string shell
```

Use:

```
argv[0]
```

e PATH controlado.

76. PATH spoofing O Agent não deve conseguir fornecer:

```
PATH=/arbitrary/path
```

como forma silenciosa de redefinir a execução. Overrides de PATH devem passar por regras do Runtime.

77. Executable resource O executável efetivamente selecionado deve estar no execution world compatível com o Sandbox. Não aceitar:

```
authorized cwd = workspace
executable = /outside/tool
```

se o Sandbox não permitir esse binário/recurso.

78. Executable snapshot Antes do spawn, registrar:

```
resolvedExecutable
version/path metadata
```

quando disponível. Isso ajuda auditoria.

79. No arbitrary executable substitution Se a Tool solicita:

```
node
```

e o resolver encontra:

```
/trusted/node
```

esse é o executável efetivo. Não aceitar alteração entre:

```
authorization
```

e:

```
execution
```

80. Capability policy A Fase 4.5 determina autorização por principal. Agora podem existir policies como:

```
{
  "id": "disruptor-process",
  "effect": "allow",
  "principal": { "id": "disruptor" },
  "capability": { "id": "process" },
  "operation": ["spawn"]
}
```

A matriz do Squad continua sendo a fonte de autorização. Não criar segunda matriz dentro do Process Provider.

81. Founder Approval Operações de processo consideradas destrutivas ou de alto risco podem ser:

```
approval-required
```

Mas o Process Provider não decide isso. Policy decide.

82. Example policy O exemplo deverá usar:

```
process.spawn
```

com:

```
Policy allow
```

para uma operação segura e controlada. Não usar comandos destrutivos no exemplo.

83. Capability operation granularity No mínimo:

```
process.spawn
```

Pode haver:

```
process.terminate
```

mas o Runtime deve tratar terminate como parte da lifecycle interna do processo, não como uma nova Tool necessariamente.

84. Public vs internal terminate Minha recomendação:

```
process.terminate
```

se existir, deve ser internal. A Tool de process não deve permitir que um Agent encerre processos arbitrários de outra Session.

85. Process ownership Todo ProcessHandle deve possuir:

```
sessionId
agentId
invocationId
```

internamente.

86. Cross-session termination Uma Session:

```
A
```

não pode terminar processo de:

```
B
```

através do Runtime.

87. Process Registry Criar:

```
ProcessRegistry
```

para:

```
register
get
remove
listBySession
```

Ele é necessário para:

```
cancel
cleanup
audit
```

88. ProcessRegistry ownership O Registry pertence ao Runtime. Não ao Agent. Não ao Provider individual.

89. Registry memory safety Processos encerrados devem ser removidos. Handles sem referência não podem permanecer eternamente no Registry.

90. Session cleanup Ao finalizar uma Session:

```
any active processes
   ↓
terminate
   ↓
wait
   ↓
cleanup
```

91. Shutdown O Runtime deve ter um seam para:

```
shutdown()
```

que encerre processos ainda vivos. Não é necessário tornar shutdown() público para o Agent.

92. Runtime crash Persistência de processos não é objetivo desta fase. Portanto:

```
process survives runtime crash
```

não precisa ser suportado. Mas devemos minimizar órfãos através de process-group/session cleanup.

93. Process orphan prevention O Provider deve iniciar o processo em um mecanismo que permita localizar seus descendentes. No Linux, isso pode envolver process groups/session IDs. No Windows, pode exigir tree-aware termination. Não exigir uma implementação cross-platform perfeita nesta fase.

94. Platform contract Criar:

```
ProcessProviderCapabilities
```

com:

```
platform
processTreeTermination
signalSupport
stdinPipe
stdoutPipe
stderrPipe
```

95. Enforcement reporting Assim como Sandbox:

```
process backend
```

deve informar suas capacidades reais. Não declarar:

```
tree termination = full
```

se o backend só consegue matar o processo raiz.

96. Linux Primeiro alvo preferencial:

```
Linux
```

por ter primitives maduras para process groups e pela compatibilidade com a evolução futura do Sandbox.

97. Windows Pode possuir:

```
partial
```

ou:

```
```

caso a implementação não consiga garantir process-tree cleanup equivalente.

98. macOS Mesma regra. Não fingir parity.

99. Process Sandbox integration A integração do Process Provider deve utilizar o mecanismo do Sandbox em vez de implementar:

```
Landlock
bwrap
ACL
Seatbelt
```

diretamente. Isso mantém a separação que o DeepSeek chama de ctx.subprocess + ctx.sandbox: subprocess conhece processo; sandbox conhece confinement.

100. Sandbox spawn interface A Fase 5 deverá ganhar um seam equivalente a:

```
sandbox.prepareProcess(spawnSpec, policy)
```

ou:

```
sandbox.wrapProcess(spawnSpec, policy)
```

O nome é livre. A propriedade obrigatória é: o resultado é o mecanismo efetivamente usado para iniciar o processo sob o boundary.

101. No post-spawn confinement Proibido:

```
spawn
↓
attach sandbox
```

O confinement deve existir antes do primeiro user instruction do processo.

102. Process environment + Sandbox O Sandbox pode fornecer:

```
sanitized environment
```

ou restringir o processo. O Process Provider continua responsável pela composição do ambiente. Separar:

```
environment policy
```

de:

```
process execution
```

103. Secrets Nenhuma secret deve entrar no processo simplesmente porque está no ambiente do host. Explicitamente autorizado:

```
env:
  FOO: ...
```

é permitido. Implícito:

```
entire process.env
```

é proibido como default.

104. Stdio + secret leakage Quando inherit for usado:

```
segredos impressos pelo processo
```

podem vazar. Portanto inherit deve exigir configuração explícita.

105. Output size limits are security controls Output ilimitado pode causar:

```
memory pressure
disk exhaustion
event flooding
```

Por isso:

```
maxBytes
```

é obrigatório para collect mode.

106. Event output limits Mesmo que CollectedOutput tenha 10 MB:

```
EventBus
```

não deverá publicar automaticamente esse conteúdo inteiro. Eventos continuam usando projeção segura.

107. Process metadata events process.started pode conter:

```
processId
providerId
capabilityId
operation
cwd (sanitized)
sandbox mode
```

Não conter:

```
full env
argv secrets
stdin
```

108. argv secrecy O argv pode conter secrets em alguns processos. Portanto:

```
process.requested
```

não deve publicar o argv bruto por padrão. Publicar somente:

```
executable identity
argument count
```

ou projeção equivalente.

109. Audit projection Para auditoria futura, o Runtime pode guardar internamente:

```
resolved executable
args hash
cwd
sandbox profile
```

sem publicar tudo no EventBus.

110. Argument hashing Opcionalmente:

```
argvDigest
```

pode identificar uma execução sem expor argumentos. Se implementado, documentar algoritmo.

111. Process failure taxonomy Adicionar:

```
ProcessError
ProcessConfigurationError
ProcessSpawnError
ProcessExecutableNotFoundError
ProcessCwdError
ProcessOutputLimitError
ProcessTerminationError
ProcessOwnershipError
ProcessSandboxError
```

112. Exit outcome is not ProcessError Reforçar:

```
exitCode = 1
```

não é automaticamente:

```
ProcessError
```

É um outcome. A Tool decide se isso é falha funcional.

113. Process executable not found Se:

```
resolveExecutable("node")
```

falhar:

```
ProcessExecutableNotFoundError
```

e:

```
Sandbox may not be applied
process not started
```

114. CWD not found Resultado:

```
ProcessCwdError
```

antes do spawn.

115. Sandbox failure Resultado:

```
ProcessSandboxError
```

ou propagação tipada de:

```
SandboxUnavailableError
SandboxDeniedError
```

Não transformar em ProcessSpawnError.

116. ProcessProvider context Aplicar R8. Context mínimo:

```
sessionId
agentId
capabilityId
operation
resource
sandbox
metadata
```

Se o Provider precisar de outra capacidade, deve justificar e atualizar o teste estrutural.

117. Handle surface R8 O Handle deve ter exatamente a API documentada. Exemplo:

```
pid
done
stdout
stderr
stdin
terminate
```

Não expor:

```
raw child process
spawn internals
sandbox provider
registry
runtime
policy
approval
```

118. Agent surface Continua:

```
requestTool
```

somente. Nenhum:

```
spawn
processRegistry
processHandle
```

direto.

119. Pure vs physical Process sempre:

```
physical
```

Não criar exceção.

120. Self-provided process Tool Se uma future Tool self-provided iniciar processo:

```
execution = physical
```

e:

```
process capability
```

ela deve igualmente passar pelo Sandbox. R13 continua valendo.

121. No self-provided raw spawn É proibido registrar:

```
process.spawn
```

com execute() que chama diretamente:

```
child_process.spawn
```

sem passar pelo LocalSubprocessProvider. Process Capability precisa existir como gate único.

122. Process Provider single execution world Executable:

```
cwd
sandbox workspace
filesystem provider
```

devem pertencer ao mesmo execution world. Essa é uma propriedade explícita do DeepSeek e deve ser uma invariante do Spectree.

123. File ↔ Process coherence Se:

```
filesystem Provider
```

enxerga:

```
```

o processo deve receber o mesmo:

```
```

como cwd ou mounted execution root. Não criar dois workspaces divergentes.

124. Sandbox same-world invariant

```
filesystem provider
+
process provider
+
sandbox
```

devem compartilhar o mesmo execution-world identity. Isso prepara futuras:

```
container
E2B
remote
microVM
```

125. Future remote provider O contrato deve permitir:

```
RemoteSubprocessProvider
```

sem mudar:

```
Tool
Capability
Policy
Approval
```

O Provider deverá fornecer um novo execution world.

126. Process world identity Adicionar metadata interna:

```
executionWorldId
```

Não necessariamente expor ao Agent. Pode estar no:

```
ProviderExecutionContext.metadata
```

127. ProcessRegistry + execution world Cada ProcessHandle deve estar associado a:

```
executionWorldId
sessionId
```

128. No cross-world handle reuse Um ProcessHandle de um Provider/world não pode ser reutilizado por outro.

129. Process result normalization ToolRuntime deve normalizar:

```
ProcessOutcome
```

em:

```
ToolResult
```

sem perder:

```
exitCode
signal
duration
```

130. Tool failure policy A Tool pode decidir:

```
exitCode != 0
```

→ ToolResult.isError = true mas o Process Provider não deve inventar semântica de negócio.

131. Timeouts O Process Provider deve suportar:

```
graceMs
signal
```

e o Runtime/Tool pode impor:

```
deadline
```

futuramente. Não implementar retry automático.

132. Retry Não implementar automaticamente:

```
spawn failed
→ spawn again
```

em Fase 6. Process pode ter efeitos colaterais. Retry pertence ao Orchestrator/policy future.

133. Exactly once A propriedade necessária:

```
uma Tool Invocation
→ no máximo um process start
```

até que exista um mecanismo de retry explícito futuramente.

134. Approval + process Para:

```
process.spawn
```

approval-required deve impedir:

```
Sandbox
Provider
process
```

até a aprovação.

135. Resume + process Após aprovação:

```
revalidate Policy
↓
rebuild Sandbox
↓
resolve executable
↓
spawn
```

Não reutilizar:

```
old ProcessHandle
```

136. Policy revalidation Se a Policy muda para:

```
deny
```

antes do resume:

```
no Sandbox
no spawn
```

137. Sandbox revalidation Mesmo que Policy continue allow, o Runtime deve reconstruir:

```
SandboxPolicy
```

no resume.

138. Resource revalidation O cwd deve ser recalculado:

```
same original input
+
same Tool metadata
```

para garantir que resource não mudou.

139. Process output security after resume A projeção segura continua. Approval não concede:

```
full stdout logging
```

140. First Tool Criar:

```
process.spawn
```

que aceite apenas um spec estruturado. Não criar uma Tool:

```
run_command
```

que recebe:

```
command: string
```

e passa para shell.

141. First example Exemplo seguro:

```
argv:
  ["node", "-e", "console.log('spectree-process-ok')"]
```

ou equivalente determinístico. Não usar shell.

142. Example filesystem interaction Demonstrar:

```
process
  ↓
criar arquivo dentro do workspace
```

seguido por:

```
filesystem.read
```

para provar que ambos compartilham o mesmo execution world.

143. Example sandbox denial Process tentar escrever fora do workspace. Esperado:

```
SandboxDeniedError
```

e:

```
file outside = untouched
```

144. Example environment Process deve receber:

```
SPECTREE_SESSION_ID
```

explicitamente. Verificar que um segredo arbitrário do host não aparece automaticamente.

145. Example termination Criar processo controlado que permanece ativo. Acionar:

```
terminate()
```

e verificar:

```
done resolves
tree terminated
```

146. Example output cap Criar processo que produz muita saída. Verificar:

```
truncated = true
```

e que memória não cresce sem limite.

147. Example non-zero exit Process termina com:

```
exitCode = 7
```

O Provider deve retornar:

```
ProcessOutcome
```

e não:

```
throw generic
```

148. Example spawn error Executar:

```
nonexistent-executable
```

e provar:

```
ProcessExecutableNotFoundError
```

149. Testes obrigatórios — Capability

* capability registrada;
* operation spawn;
* invalid operation;
* unknown capability.

150. Testes obrigatórios — Registry ProcessRegistry

* register;
* get;
* remove;
* list by Session;
* cleanup;
* ownership.

151. Testes obrigatórios — executable

* absolute path;
* bare command;
* PATH controlled;
* executable missing;
* executable outside policy.

152. Testes obrigatórios — environment

* host secrets not inherited;
* explicit env override;
* SPECTREE namespace sanitized;
* explicit SPECTREE values;
* environment surface snapshot.

153. Testes obrigatórios — cwd

* valid workspace cwd;
* invalid cwd;
* outside cwd;
* symlinked cwd;
* session isolation.

154. Testes obrigatórios — stdio

* stdin ignore;
* stdin data;
* stdin pipe;
* stdout collect;
* stderr collect;
* stdout pipe;
* stderr pipe;
* explicit inherit.

155. Testes obrigatórios — output

* bounded collect;
* truncation;
* no unbounded memory;
* spill inside sandbox;
* spill cleanup.

156. Testes obrigatórios — lifecycle

* spawn;
* done;
* normal exit;
* non-zero exit;
* termination;
* cancellation;
* runtime shutdown.

157. Testes obrigatórios — process tree Criar parent process que cria child controlado. Executar:

```
terminate()
```

e provar que:

```
parent gone
child gone
```

dentro das garantias do backend.

158. Testes obrigatórios — sandbox

* policy deny → no spawn;
* approval pending → no spawn;
* sandbox deny → no spawn;
* sandbox unavailable → no spawn;
* allow + sandbox → spawn;
* cancellation → terminate;
* revalidation deny → no spawn.

159. Teste de same-world Provar:

```
filesystem root
==
process cwd world
```

e:

```
process created file
→ filesystem provider sees same file
```

160. Teste de bypass Registrar uma Tool:

```
process.spawn
```

com execute() próprio tentando bypassar Provider. O Registry deve rejeitar a Tool ou o Runtime deve impedir a execução fora do Process Provider. Não existe terceira rota.

161. Teste de R8 Provider context:

```
sessionId
agentId
capabilityId
operation
resource
sandbox
metadata
```

deve ser igualdade estrutural.

162. Teste de Handle surface Verificar exatamente:

```
pid
done
stdout
stderr
stdin
terminate
```

ou a superfície oficialmente escolhida.

163. Teste de Agent surface Continuar exigindo:

```
context.runtime
→ requestTool
```

somente.

164. Teste de event security Procurar em todos os eventos:

```
secret
argv secret
stdin
full environment
```

e garantir zero vazamento.

165. Teste de session isolation Session A:

```
process A
```

Session B:

```
process B
```

Verificar:

```
A cannot terminate B
B cannot terminate A
```

166. Teste de cancellation race Executar:

```
process running
+
session.cancel()
+
process exit
```

e verificar uma única conclusão coerente.

167. Teste de terminate race Executar:

```
terminate()
terminate()
```

e verificar:

```
no corruption
single final outcome
```

168. Teste de cleanup Após cada cenário:

```
process registry empty
sandbox released
spill cleaned
```

169. Errors Adicionar:

```
ProcessError
ProcessConfigurationError
ProcessExecutableNotFoundError
ProcessCwdError
ProcessSpawnError
ProcessOutputLimitError
ProcessTerminationError
ProcessOwnershipError
ProcessSandboxError
```

170. Documentation Atualizar:

```
docs/architecture/SPECTREE-RUNTIME.md
```

com:

```
Process Capability
Process Provider
Spawn Spec
Process Handle
Process Registry
Environment
STDIO
Output collection
Termination
Process tree
Sandbox integration
Same execution world
Security
Platform limitations
```

171. ADR Criar:

```
docs/adr/ADR-06-process-subprocess-capability.md
```

Decisões mínimas:

1. Process é Capability.
2. Shell não faz parte da Fase 6.
3. argv nunca é shell-interpreted.
4. Process Provider é separado do Terminal.
5. Sandbox é aplicado antes do spawn.
6. Process tree pertence ao lifecycle do Provider.
7. Environment é explicitamente controlado.
8. Output é limitado.
9. terminate() é tree-scoped quando o backend permite.
10. Fail closed quando Sandbox exigido não pode ser garantido.
11. Process e Filesystem compartilham execution world.
12. Self-provided process tools não podem bypassar o Process Provider.

172. Definition of Done A Fase 6 só pode ser declarada DONE quando:

* process Capability existir.
* process.spawn Tool existir.
* LocalSubprocessProvider existir.
* ProcessSpawnSpec existir.
* ProcessHandle existir.
* ProcessOutcome existir.
* ProcessRegistry existir.
* executable resolution existir.
* cwd explícito existir.
* environment control existir.
* SPECTREE_* namespace controlado existir.
* stdin/stdout/stderr forem explícitos.
* output collection for bounded existir.
* truncation existir.
* spill opcional e limitado existir.
* terminate() existir.
* termination escalation existir.
* AbortSignal existir.
* process-tree lifecycle existir quando backend suportar.
* Session cancellation terminar processo.
* Runtime shutdown terminar processos.
* sandbox aplicado antes do spawn.
* sandbox denial bloquear spawn.
* sandbox unavailable bloquear spawn.
* Policy deny bloquear spawn.
* Approval pending bloquear spawn.
* Policy revalidation continuar obrigatória.
* resource ↔ cwd consistency estiver provada.
* filesystem + process same-world estiver provado.
* processo não usar shell implícito.
* self-provided process tool não tiver bypass.
* ProcessHandle surface estiver R8 locked.
* Provider context estiver R8 locked.
* eventos seguros existirem.
* secrets não vazarem.
* duas Sessions isoladas estiverem provadas.
* process tree termination estiver testada.
* provider errors estiverem tipados.
* non-zero exit estiver separado de spawn failure.
* testes unitários passarem.
* testes de integração passarem.
* testes de segurança passarem.
* claude plugin validate . --strict passar.
* nenhuma Shell Capability estiver implementada.
* nenhum Terminal Provider estiver implementado.
* nenhum Git/DB/MCP/Cloud Provider estiver implementado.
* nenhum Orchestrator estiver implementado.

173. Definition of Architecture Done A arquitetura só estará pronta quando conseguirmos provar:

```
Tool
 ↓
Policy
 ↓
Approval
 ↓
Capability: process
 ↓
Sandbox
 ↓
LocalSubprocessProvider
 ↓
Process
```

e que:

```
Shell
```

não está escondido dentro de:

```
Process Provider
```

e que:

```
Process Provider
```

não está escondendo:

```
Sandbox implementation
```

ou:

```
Policy implementation
```

174. Invariantes da Fase 6

INV-601
Process é uma Capability física.

INV-602
Toda execução de Process passa pelo ToolRuntime.

INV-603
Todo Process físico passa por Policy.

INV-604
Todo Process sujeito a Approval respeita Founder Gate.

INV-605
Todo Process físico passa pelo Sandbox apropriado.

INV-606
O argv nunca é interpretado por shell pelo Process Provider.

INV-607
cwd é explícito.

INV-608
cwd pertence ao execution world autorizado.

INV-609
Executável efetivo pertence ao execution world compatível.

INV-610
Environment não é herdado irrestritamente.

INV-611
SPECTREE_* é namespace controlado.

INV-612
Output coletado é bounded.

INV-613
Output bruto não é publicado automaticamente no EventBus.

INV-614
ProcessHandle possui superfície mínima e travada.

INV-615
ProviderContext possui superfície mínima e travada.

INV-616
Process pertence a uma Session.

INV-617
Uma Session não controla processos de outra Session.

INV-618
Cancelamento de Session termina processos ativos quando o backend permite.

INV-619
terminate() não abandona silenciosamente descendentes observáveis.

INV-620
Cleanup do Sandbox ocorre depois da drenagem necessária de output.

INV-621
Spawn failure é distinto de non-zero process exit.

INV-622
Process Provider não implementa Shell semantics.

INV-623
Process Provider não implementa Terminal semantics.

INV-624
Self-provided Process Tool não pode bypassar Sandbox ou Provider.

INV-625
Sandbox partial nunca é tratado como full.

INV-626
Ausência de Sandbox obrigatório resulta em fail closed.

INV-627
Policy denial impede qualquer spawn.

INV-628
Approval pending impede qualquer spawn.

INV-629
Policy revalidation continua obrigatória após Approval.

INV-630
Filesystem e Process compartilham execution world.

175. Handoff obrigatório do Opus 5 O handoff deverá conter:

```
## Implementation

arquivos criados/modificados

## DeepSeek Adaptation

o que foi adotado do subprocess seam
o que foi deliberadamente deixado para fases futuras

## Capability

process
operations

## Spawn Spec

argv
cwd
env
stdio
grace
signal

## Provider

LocalSubprocessProvider

## Handle

surface + lifecycle

## Process Tree

termination strategy

## Sandbox

integração
enforcement real
limitations

## Environment

scrub
SPECTREE_*
allowlist

## Output

collect
limits
truncation
spill

## Security

shell injection
cwd escape
executable escape
secret leakage
session isolation

## Tests

comando + resultado

## Integration Proof

Policy
Approval
Sandbox
Process
Filesystem same-world

## Known Limitations

limitações reais

## Scope Verification

confirmar ausência de Shell,
Terminal, PTY, LSP, Git,
DB, MCP, Cloud e Orchestrator
```

176. Fluxo final da Fase 6

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
                      Policy
                    /        \
                 DENY       APPROVAL
                   │           │
                  STOP      Founder
                               │
                         Revalidation
                               │
                               ▼
                          Capability
                           Process
                               │
                               ▼
                            Sandbox
                               │
                               ▼
                   LocalSubprocessProvider
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
              argv             cwd           env
                │              │              │
                └──────────────┼──────────────┘
                               ▼
                           OS Process
                               │
                 ┌─────────────┼─────────────┐
                 ▼             ▼             ▼
               stdin         stdout        stderr
                               │
                               ▼
                         ProcessOutcome
                               │
                               ▼
                         Sandbox.release
```

177. Adaptação estratégica do DeepSeek A arquitetura do DeepSeek possui exatamente a separação que queremos reproduzir:

```
ctx.subprocess
    = process substrate

ctx.shell
    = shell semantics

ctx.sandbox
    = confinement

ctx.terminal
    = terminal semantics
```

e esses seams possuem consumidores separados. No Spectree isso ficará:

```
Capability: process
        ↓
LocalSubprocessProvider

Capability futura: shell
        ↓
ShellProvider
        ↓
Process Capability

Capability futura: terminal
        ↓
TerminalProvider
        ↓
Process Capability

Sandbox
        ↓
confina todos
```

Essa composição é deliberada.

178. O que não devemos copiar do DeepSeek Não devemos importar para o Spectree nesta fase:

```
Cordis
PTY
ACP
LSP
E2B
remote providers
bash executor
PowerShell executor
subagent executors
terminal sessions
```

O ganho que queremos é o seam, não o tamanho do stack.

179. Resultado estratégico Depois da Fase 6, teremos:

```
                  SPECTREE RUNTIME

Agent
  ↓
Policy
  ↓
Founder Approval
  ↓
Capability
  ├── filesystem
  └── process
        ↓
      Sandbox
        ↓
    Provider
        ↓
   Physical World
```

E o Spectree terá finalmente a base para construir a camada seguinte:

```
Shell
```

sem transformar o Process Provider em um executor gigantesco. A ordem correta será:

```
Process
   ↓
Sandboxed Process
   ↓
Shell
   ↓
Terminal
```

porque Shell é apenas uma semântica sobre processo, enquanto Terminal é uma semântica adicional sobre processo + PTY + sessão interativa. O DeepSeek também mantém essas famílias separadas em seus capability seams.

180. Regra de ouro da Fase 6 O Spectree nunca deve executar uma string de comando; ele deve executar um processo com argv explícito, em um execution world conhecido, dentro de um Sandbox conhecido, sob uma Policy conhecida. Essa é a propriedade que transforma process.spawn de um simples wrapper de child_process.spawn() em uma Capability governada pelo Spectree Runtime.

## Review do TechLeader — PR #25 — REQUEST CHANGES

Somente R14.

Não quero que o Opus implemente Landlock, bwrap, Windows sandbox ou qualquer outro backend físico agora. Isso seria transformar a Fase 6 em outra fase.

Quero apenas que o Runtime seja honesto operacionalmente:

```
sem enforcement físico
+
modo que promete confinement
=
não executar
```

Depois disso, a arquitetura estará pronta para a próxima evolução:

```
Fase 6 atual
Process Capability
   ↓
argv + lifecycle + environment + tree
   ↓
Sandbox seam
   ↓
[backend físico futuro]
```
