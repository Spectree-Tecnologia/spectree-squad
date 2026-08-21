---
status: in-review
owner: TechLeader
depends_on: F1 Runtime Core, F2 Policy Engine, F3 Founder Gate, F4 Capability Providers, F4.5 Squad/Runtime Integration, F5 Sandbox Runtime, F6 Process/Subprocess
---

# Spectree Runtime v2 — Fase 7: Linux Physical Sandbox

> Transcrição da especificação normativa da Fase 7, produzida no harness de
> planejamento do Founder (declarado na fonte: `Status: SPECIFICATION`,
> `Owner: TechLeader`). O texto é o do documento fonte, sem correção, melhoria
> ou complemento. O texto commitado é o contrato real (ver
> `docs/spec/README.md`).
>
> **Três fontes, e a que vence é a que o código endereça.** A primeira versão
> deste arquivo nasceu de uma exportação achatada. A segunda veio de um
> reexport com a marcação intacta — 2323 linhas, 318 linhas de cerca, 112
> seções contíguas — e foi a melhor marcação das nove irmãs. A terceira é o
> documento colado pelo Founder no chat: 345 linhas, 201 não vazias, **127
> seções** contíguas de 1 a 127, e **zero cercas**. Venceu a terceira.
>
> **Os dois eixos apontaram em direções opostas pela primeira vez, e a
> revisão venceu a marcação.** O reexport de 112 seções tinha marcação
> impecável e uma numeração que não resolve nenhuma das cinco citações
> `secao NNN` que o código da fase faz — todas caem além da última seção
> dele. Uma spec com marcação perfeita cuja numeração não resolve as citações
> do código é um documento que mente sobre o próprio endereço. Marcação é
> recuperável por reexport; revisão errada, não.
>
> **Quatro das cinco citações passam a resolver.** Nesta revisão, a §118 é
> `Security error` (`SandboxUnavailableError`), a §121 é
> `Definition of Done`, a §122 é `Definition of Architecture Done` e a §127 é
> a `Regra de ouro da Fase 7`. As quatro conferem por título e por conteúdo.
> A quinta, a §143, **resolve — em outra spec.** O cabeçalho da rodada
> anterior a declarou órfã, e isso era falso: a busca tinha o escopo preso a
> este arquivo. Medição de 2026-08-21 sobre `docs/spec/`, procurando
> `^## 143\.` nas nove specs: a §143 existe na **F05**
> (`RUNTIME-F05-sandbox-runtime.md:3050`, `## 143. Real enforcement backend`,
> cuja última linha é "Nunca mascarar partial como full.") e na **F04**
> (`RUNTIME-F04-capability-providers.md:3182`, `## 143. Real integration
> tests`, sobre `temporary directory`). Nenhuma outra spec tem uma §143.
>
> O sítio da Fase 7 que a cita é
> `sandbox/providers/linux-physical/linux-physical-sandbox-provider.js:142`
> ("secao 39/143: nunca aceitar acima do que o probe PROVOU") e casa com a
> **F05**. Ele não está sozinho: a mesma medição achou oito linhas em
> `spectree-runtime/` citando 143, sete resolvendo na F05
> (`sandbox/sandbox-contract.js:46`,
> `sandbox/providers/local-filesystem-sandbox.js:11` e `:42`,
> `sandbox/providers/test-sandbox-provider.js:33`,
> `tests/sandbox-contract.test.js:33`, `tests/sandbox-unit.test.js:283` e a
> desta fase) e uma na **F04** — `tests/filesystem-provider.test.js:15`, que
> cita "secao 143" e "secao 144" como "workspace temporario real" e "limpo ao
> final", verbatim a F04 §143 e a F04 §144 `Cleanup`. Não há citação órfã de
> §143; há citação **ambígua**, e a correção delas é tarefa fora deste
> arquivo.
>
> **A causa vale mais que o conserto, e ela é estrutural.** Medição de
> 2026-08-21 em `spectree-runtime/`: 798 linhas, em 84 arquivos, citam
> `secao`/`secoes`/`seção`/`seções` seguido de número, e **nenhuma cita
> número ≥ 180** — o maior citado é 178
> (`tests/sandbox-integration.test.js:24`, "spec secoes 156-164, 178"). Como
> a F05 traz 186 seções `^## N.` terminando em `## 186.` e a F06 traz 180
> seções contíguas de 1 a 180 (declarado no cabeçalho dela e medido no mesmo
> dia), **todo número que o código cita existe simultaneamente em pelo menos
> duas specs.** Um `secao NNN` sem a fase não é ambíguo às vezes: é ambíguo
> sempre. O falso órfão desta transcrição não foi azar — foi o resultado
> garantido de procurar a seção num documento só. Resolver citação nua exige
> varrer `docs/spec/` inteiro e desempatar pelo texto, nunca pela fase que
> quem procura tem aberta.
>
> Consequência fora deste arquivo: o `docs/spec/README.md` escolheu
> justamente a §127 como exemplo de referência "histórica e não resolvível".
> Ela resolve agora. A correção é do dono daquele arquivo.
>
> **A numeração tem repetições, e a aritmética fecha.** São 134 linhas que
> casam `^N. ` na fonte, e não 127: as sete restantes são itens de lista
> ordenada dentro de seção, com a sequência reiniciando em dois pontos — três
> itens dentro da §3 (a cadeia de backends do DeepSeek) e quatro dentro da
> §16 (os passos do probe de Bubblewrap). Fora esses sete, os números de
> seção correm de 1 a 127 sem lacuna e sem repetição. As 201 linhas não
> vazias decompõem-se em 1 título + 8 linhas de metadados + 127 linhas de
> seção + 7 itens de lista + 30 linhas de invariante + 28 linhas do bloco de
> handoff da §124. `1 + 8 + 127 + 7 + 30 + 28 = 201`, sem sobra.
>
> **A divergência 30 × 31 nos invariantes era o detector, de novo.** O corpo
> normativo traz trinta invariantes dos dois lados, contíguos, únicos, na
> mesma ordem e com as mesmas trinta regras — divergem só em palavra solta
> (artigo, maiúscula, um `de`/`do`). A trigésima primeira ocorrência estava
> **no cabeçalho de transcrição da rodada anterior**, na frase que anunciava
> a faixa de identificadores; o mesmo bloco ainda citava duas vezes o
> placeholder de formato. Nenhum invariante foi fabricado e nenhum se perdeu.
>
> É a segunda vez que o mesmo detector erra, e a F06 já fixou o método:
> **conte o prefixo seguido de três dígitos, e conte a partir da primeira
> seção numerada, nunca do arquivo inteiro.** A F07 mostra que as duas
> metades do método são necessárias por motivos diferentes — aqui a frase de
> faixa usava dígitos reais, então a âncora de três dígitos sozinha não
> salvaria; só a segunda metade salva. Por isso este bloco **não escreve
> nenhum identificador da família de invariantes**, nem real nem placeholder:
> a próxima rodada que contar o arquivo inteiro vai medir trinta.
>
> **Correspondência entre as duas revisões: três seções de 127.** As duas
> compartilham os cinco primeiros números; dessas cinco, três correspondem em
> texto e foram as únicas em que a marcação do reexport foi aproveitada.
>
> - **§4** corresponde integralmente — mesmos sete componentes que a fase não
>   altera, mesma cadeia de nove elos. A única diferença é que o reexport
>   marca `não altera` em negrito. Três blocos restaurados.
> - **§1** corresponde a menos de uma palavra: o reexport escreve "não possui
>   **ainda** um mecanismo físico", esta revisão escreve "não possui um
>   mecanismo físico". A divergência fica fora de todo bloco. Cinco blocos
>   restaurados.
> - **§5** tem o mesmo bloco de responsabilidades e a mesma frase final, mas
>   esta revisão acrescenta a abertura "A responsabilidade de cada camada
>   permanece:" e titula a seção de outro jeito
>   (`Sandbox continua sendo uma camada independente` contra
>   `Responsabilidades das camadas`). Um bloco restaurado; as quatro linhas
>   em branco internas da cerca são conteúdo do bloco e vieram junto.
>
> **§2 e §3 não foram restauradas, de propósito.** Na §2 a prosa bate e a
> primeira cadeia bate linha a linha, mas a segunda diverge: esta revisão
> escreve `LinuxPhysicalSandbox` onde o reexport tem `SandboxResolver`
> seguido de `LinuxPhysicalSandboxProvider`. Restaurar metade dos blocos de
> uma seção sinaliza que a outra metade não é bloco — pior que deixar tudo
> plano. Na §3 não há o que restaurar: o reexport traz três parágrafos de
> prosa sem cerca nenhuma, e o texto diverge (esta revisão enumera três
> passos onde o outro resume em prosa).
>
> **Da §6 em diante as duas revisões decompõem o assunto de forma
> diferente.** A §6 daqui é sobre os três modos; a §6 de lá é a cadeia de
> backends, que aqui é a §7. Foram amostrados dezenove pares — escolhidos
> entre os de título idêntico, isto é, os mais prováveis de bater — e os
> dezenove divergem em texto: §14, §15, §17 a §21, §30, §55, §67, §105,
> §106, §107, §108, §109 e §110 na numeração do reexport, mais os
> metadados do topo (`Baseline`, `Versão de referência` e o rótulo da
> referência externa diferem entre as duas). A `Definition of Done` é o caso
> mais claro: 35 itens marcados lá contra 39 sentenças aqui. A
> `Regra de ouro` tem o mesmo título e nenhuma frase em comum.
>
> **Nenhum heading foi fabricado.** A fonte não tem uma única linha iniciada
> por `#` e não tem uma única cerca. Este arquivo tem exatamente um heading —
> o título — e nenhum `##`. Vale aqui, à letra, o precedente da F06: o título
> da seção vem soldado à primeira frase do corpo (`1. Objetivo A Fase 6
> terminou com:`), e cortá-lo seriam 127 julgamentos semânticos sobre o texto
> do Founder. Promover linha achatada a heading ainda **apaga o número da
> seção junto** — e o número é exatamente o endereço que o código cita. A
> versão anterior deste arquivo tinha 113 `##` porque *aquela* fonte trazia
> headings de verdade; esta não traz, e por isso a contagem é `0` dos dois
> lados. Se o Founder quiser seções como heading real, isso é pedido de
> reexport com marcação na origem.
>
> **Cerca vazia: não é mensurável nesta fonte.** A doença da §27/§47 da F04 e
> da §97/§123 da F06 — cerca de abertura seguida imediatamente do fechamento,
> que é lacuna do Founder e não dano de transporte — **não deixa rastro em
> fonte achatada**: um bloco sem conteúdo dissolve em nada. O reexport de 112
> seções não tem nenhuma. Fica o limite de medição registrado, para que a
> próxima rodada não leia silêncio como ausência.
>
> **Divergência conhecida com o ADR-07, e ela é de data.** O adendo de
> fidelidade do mount plan (o `/etc/resolv.conf` como symlink pendurado,
> 2026-08-20) é **posterior** a esta especificação e não deve constar dela.
> Ausência confirmada: a fonte não menciona `resolv`, mount plan nem
> equivalente em nenhuma das 127 seções. É divergência entre spec e ADR, não
> lacuna da transcrição.
>
> Preservado sem correção, porque a regra é não corrigir: um dos invariantes
> escreve o identificador do WSL como `Wsl2`, com caixa diferente do resto do
> documento. É assim na fonte.
>
> Aprovação: a Fase 7 embarcou em `main` no PR #26 — squash `1e40486`, tag
> `v0.31.0`, em 2026-08-20. A citação fica no corpo e não no cabeçalho
> (ADR-10, decisão 13) porque o `git log` **deste arquivo** não a contém: o
> merge aprovou a implementação da fase, e este arquivo só nasceu na
> transcrição posterior.
>
> `status: in-review` nesta edição, e **não por rebaixamento** — a ADR-10
> (decisões 5 e 13) aboliu o rebaixamento e manda ler o `status:` da cópia em
> `main`. É a matriz de autoridade que obriga: escrever a linha
> `status: approved` é o ato `artifact-status.approve`, que nenhum agente
> tem, e o guard lê o byte, não o delta. Sob a lei nova, preservar um
> `approved` que já existia é indistinguível de concedê-lo.
>
> Convenção de transcrição: cada linha não vazia da fonte vira exatamente uma
> linha deste arquivo, com no máximo um prefixo — `# ` no título, `- ` nas 8
> linhas de metadados e nas 30 linhas de invariante. A exceção são as três
> seções restauradas, onde a linha achatada foi quebrada **apenas nas
> fronteiras dos blocos restaurados**, jamais entre frases: 68 linhas a mais
> ao todo, sendo 18 de cerca e 50 de quebra dentro de texto que já existia.
> Nenhum caractere de texto foi acrescentado, alterado ou removido em ponto
> algum do documento. Linha em branco entre parágrafos é livre; dentro de
> bloco, não — o conteúdo cercado é verbatim.
>
> Do lado do destino a equação fecha assim: 431 linhas não vazias = 5 do
> cabeçalho + 1 do título + 157 deste bloco de proveniência + 8 de metadados
> + 260 de corpo. As 260 do corpo são as 192 não vazias do corpo da fonte
> (127 seções + 7 itens de lista + 30 invariantes + 28 do handoff), menos as
> 3 linhas que se expandiram, mais as 71 que as três seções restauradas
> passaram a ocupar. Seções 127 ↔ 127, invariantes 30 ↔ 30, heading 1 ↔ 1.

- Status: SPECIFICATION
- Owner: TechLeader
- Implementador: Agente Opus 5
- Baseline: Fases 1–6 congeladas
- Versão de referência: v0.30.0
- Prioridade: Linux
- Ambiente de desenvolvimento local do Founder: Windows + WSL2
- Referência externa principal: DeepSeek Harness Sandbox

1. Objetivo A Fase 6 terminou com:

```text
processEnforcement = unsupported
```

Isso significa que:

```text
Sandbox workspace-write
+
Process Capability
```

não pode executar processos, porque o Runtime não possui um mecanismo físico capaz de garantir o confinement do processo. A Fase 7 deve adicionar o primeiro backend físico real:

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

quando todas as garantias prometidas pelo profile forem efetivamente impostas. O objetivo não é criar um "wrapper de segurança" em JavaScript. O objetivo é fazer o sistema operacional participar da enforcement boundary.

2. Resultado esperado Antes: Policy ↓ Sandbox workspace-write ↓ processEnforcement unsupported ↓ SandboxUnavailableError Depois, em Linux com backend físico funcional: Policy ↓ Approval, quando necessário ↓ Capability ↓ LinuxPhysicalSandbox ↓ processEnforcement full ↓ Process O processo poderá executar com: workspace-write sem exigir: danger-full-access

3. Referência DeepSeek O DeepSeek define SandboxProvider como um seam abstrato que recebe o argv exato a ser executado e uma SandboxPolicy, devolvendo um argv confinado ou falhando fechado. O consumidor não conhece o mecanismo físico utilizado. No backend local Linux, o DeepSeek:

1. tenta bubblewrap
2. caso necessário, usa Landlock
3. se nenhum backend funcional existir, falha fechado e faz probes funcionais para determinar se o backend realmente consegue impor a política desejada. O Spectree deve adotar esse padrão.

4. Decisão arquitetural A Fase 7 não altera:

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

5. Sandbox continua sendo uma camada independente A responsabilidade de cada camada permanece:

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

6. Objetivo específico do backend Linux O backend precisa fornecer, no mínimo, um modo físico verificável para: read-only workspace-write danger-full-access não utiliza o backend físico. Conceitualmente: read-only ↓ filesystem writes proibidos workspace-write ↓ writes permitidos somente nas roots concedidas danger-full-access ↓ confinement bypass explícito O DeepSeek utiliza exatamente esses três modos e trata danger-full-access como bypass de confinement.

7. Backend chain A implementação deve permitir: LinuxPhysicalSandboxProvider │ ├── BubblewrapBackend │ └── LandlockBackend O Provider seleciona o backend capaz de satisfazer a policy. Minha ordem recomendada: bubblewrap ↓ Landlock ↓ unavailable Isso acompanha a estratégia atual do DeepSeek.

8. Por que não usar apenas Landlock Landlock é poderoso, mas possui dependência da ABI disponível do kernel. Versões mais antigas podem não oferecer todas as operações necessárias. O próprio DeepSeek classifica enforcement antigo como partial quando a ABI não cobre todos os efeitos prometidos. Portanto: Landlock disponível ≠ Landlock automaticamente full

9. Por que Bubblewrap Bubblewrap cria um novo mount namespace e permite construir explicitamente quais partes do filesystem estarão visíveis e quais são read-only. Também pode criar namespaces adicionais quando solicitado. Para a Fase 7, o uso principal será: filesystem visibility + read-only/write roots + isolated temporary execution world

10. Não copiar o Bubblewrap inteiro para o Spectree O Runtime não deve reimplementar: mount namespace user namespace PID namespace seccomp em JavaScript. Bubblewrap será um backend externo especializado. O Spectree apenas constrói: policy → backend invocation e observa o resultado.

11. Estrutura esperada Adaptar à estrutura existente, mas conceitualmente: spectree-runtime/ ├── sandbox/ │ ├── providers/ │ │ ├── linux-physical/ │ │ │ ├── linux-physical-sandbox-provider │ │ │ ├── bubblewrap-backend │ │ │ ├── landlock-backend │ │ │ └── probe │ │ └── ... │ │ │ ├── sandbox-resolver │ ├── sandbox-contract │ └── ... │ ├── providers/ │ └── local/ │ └── subprocess-provider

12. Linux backend identification O backend deverá possuir identidade: providerId version platform = linux Exemplo conceitual: linux-physical-sandbox 1.0.0 linux Não usar o nome do mecanismo como identidade principal da Capability.

13. Backend capability report O backend deverá conseguir informar: filesystem.read filesystem.write process.spawn process.descendants com um nível: full partial unsupported Exemplo: filesystem: read: full write: full process: spawn: full network: unsupported

14. full é um fato, não configuração É proibido fazer: config says full → backend = full O backend só pode devolver: full depois de validar que consegue impor a garantia.

15. Functional probe O LinuxPhysicalSandboxProvider deverá possuir probe funcional. Não basta: which bwrap ou: bwrap --version Porque o executável pode existir mas não funcionar no host. O DeepSeek adota exatamente essa postura: probe funcional para determinar se o runner realmente consegue aplicar a sandbox.

16. Bubblewrap probe O probe deve criar um processo descartável que tente:

1. iniciar dentro da sandbox
2. acessar um arquivo explicitamente permitido
3. tentar uma operação proibida
4. verificar o resultado Somente se o comportamento for conforme o contrato: BubblewrapBackend = usable

17. Landlock probe O mesmo conceito: LandlockBackend ↓ probe ↓ test rule enforcement Não confiar somente na presença das syscalls.

18. Probe timeout Todo probe deve possuir: probeTimeoutMs para evitar: sandbox initialization → processo pendurado → Runtime inteiro bloqueado

19. Probe result O probe deve produzir: usable enforcement backend reason Exemplo: { "usable": true, "backend": "bubblewrap", "enforcement": "full" } ou: { "usable": false, "backend": "landlock", "reason": "kernel ABI insufficient" }

20. Não esconder backend failure Um backend que falhou no probe não pode desaparecer silenciosamente. O diagnóstico deve estar disponível para: error event startup report example sem expor informações sensíveis.

21. Backend selection Fluxo: LinuxPhysicalSandboxProvider ↓ probe bubblewrap ↓ usable? ├── yes → select └── no ↓ probe Landlock ↓ usable? ├── yes → select └── no → unavailable

22. Runner caching Após probe bem-sucedido, o provider pode cachear o backend selecionado. O DeepSeek também seleciona/proba os runners e mantém o veredito. Mas: cached verdict não deve transformar um backend quebrado em full indefinidamente.

23. danger-full-access Não chamar nenhum backend. A execução segue pelo argv original: original argv → ProcessProvider Isso é deliberado e auditável.

24. Confined execution Para: read-only workspace-write o backend deverá produzir uma execução confinada. A API pode seguir o modelo do DeepSeek: confine(argv, policy) → confined argv + metadata ou o modelo de SandboxHandle já existente. O contrato interno deve, porém, permitir o equivalente a: "este é o comando efetivamente confinado"

25. argv exato O backend recebe: argv = [program, arg1, arg2...] Não recebe: command string Não criar shell parsing. Isso mantém a regra da Fase 6.

26. argv não pode ser alterado semanticamente O backend pode adicionar: sandbox launcher antes do processo original. Mas: original argv deve permanecer sem alteração semântica. Exemplo: [ bwrap, sandbox arguments, --, original argv... ]

27. Resource binding O Sandbox deve receber o mesmo Resource que: Policy ProcessProvider já conhecem. Não recalcular autorização.

28. Workspace root O backend deve receber uma root canônica: workspaceRoot e não: cwd arbitrário como fonte de autoridade.

29. Root canonicalization Antes de criar a sandbox: realpath(workspaceRoot) ou equivalente deve ser obtido. O backend não deve assumir que: /workspace/link é fisicamente: /workspace sem resolver.

30. Read-only profile Para read-only: workspace → read-only outside → hidden/denied write → denied O processo precisa de sinks mínimos para funcionar. Seguindo o DeepSeek, /dev/null pode ser disponibilizado quando necessário, sem transformar isso em writable workspace.

31. Workspace-write profile Para workspace-write: workspace → read/write outside → not visible or denied temp → writable only when explicitly allowed O DeepSeek permite workspace e uma área temporária do backend nesse modo.

32. Temp root Criar: sessionTempRoot por Session/sandbox invocation conforme a política. Deve ser: private writable cleanupable

33. Temp must belong to execution world O processo deve enxergar o mesmo temp que o Sandbox conhece. Não criar: Process temp ≠ Sandbox temp

34. Cross-session isolation Session A: /tmp/spectree/A Session B: /tmp/spectree/B O processo de A não deve conseguir: read/write B

35. Filesystem visibility Em Bubblewrap, o backend deve montar explicitamente as roots que o processo pode ver. Bubblewrap cria um novo mount namespace e permite selecionar exatamente as partes do filesystem visíveis à sandbox.

36. Landlock profile Quando Landlock for o backend: workspace → allowed path temp → allowed path others → denied As regras devem ser construídas a partir do profile.

37. Landlock ABI O backend deve verificar qual ABI está disponível. Se a ABI não suportar todos os file effects necessários: enforcement = partial e o Runtime deverá rejeitar requiredEnforcement = full. Isso acompanha a semântica do DeepSeek.

38. Full vs partial Exemplo: Bubblewrap → full para o profile implementado Landlock ABI antigo → partial sem backend → unsupported

39. Não declarar full por backend name Proibido: backend == bubblewrap → full A profile efetiva também deve ser validada.

40. Process confinement Quando o backend declarar: process.spawn = full isso significa que o processo e seus descendentes permanecem dentro do execution world prometido. Se o backend não consegue garantir isso: partial ou: unsupported

41. Process namespaces Não é obrigatório que a Fase 7 implemente isolamento completo de PID/IPC/network. O Profile atual é principalmente filesystem-oriented. A referência do DeepSeek também delimita o SandboxMode atual como file effects, deixando network e process visibility fora desse vocabulary.

42. Não superprometer network Nesta fase: network = unsupported A existência de: bwrap --unshare-net não significa que o Profile atual deve começar a declarar uma network policy. Isso pertence a uma evolução posterior.

43. Não superprometer process visibility Da mesma forma: process visibility não deve ser declarado como isolado apenas porque Bubblewrap pode usar PID namespaces. Não ampliar o contrato nesta fase.

44. Same-world invariant Filesystem e Process devem compartilhar: workspace temp sandbox identity Portanto: process writes file → filesystem provider sees same file deve continuar verdadeiro.

45. Sandbox execution world Criar conceito interno: executionWorldId para correlacionar: filesystem process sandbox session Isso prepara future: container microVM remote sem implementar nada disso agora.

46. SandboxHandle O SandboxHandle deve continuar expondo apenas: mode enforcement sandboxInstanceId assertPathAllowed release ou a superfície oficial equivalente. Não expor: bwrap argv landlock fd native handles ao Provider.

47. R8 A superfície do Sandbox Handle deve ser travada por: Object.keys() exatamente como fizemos em todas as outras boundaries.

48. Process Provider O Process Provider deve receber: SandboxHandle ou o prepared invocation produzido pelo Sandbox. Não deve receber: BubblewrapBackend LandlockBackend

49. No Linux logic in Process Provider Nenhuma: if linux if bwrap if landlock dentro do LocalSubprocessProvider.

50. No provider logic in Agent Nenhuma Tool/Persona deve conhecer: bubblewrap landlock

51. Backend launcher Se Bubblewrap for usado: LinuxPhysicalSandboxProvider → bwrap O Runtime não deve assumir que o caminho é: /usr/bin/bwrap O provider deve resolver de forma segura.

52. Executable validation Verificar: exists executable correct platform antes de selecioná-lo.

53. Custom runner Não implementar inicialmente um: sandboxCommand arbitrário. Caso seja introduzido no futuro, deverá ter assinatura/capabilities muito bem definidas e nunca ser considerado full automaticamente.

54. Landlock launcher Se Landlock exigir um helper nativo: native/landlock-run seguir o princípio do DeepSeek de manter esse launcher pequeno, isolado e com interface explícita. A implementação do DeepSeek usa um launcher C11, com API nativa do Landlock e fail-closed em caso de erro. Não copiar o código do DeepSeek. A ideia arquitetural é o que deve ser reaproveitado.

55. Helper binary lifecycle Qualquer helper nativo deverá possuir: version hash platform architecture conhecidos pelo Runtime.

56. Helper trust Não executar um helper encontrado casualmente no PATH como root de confiança. O caminho deverá ser controlado pelo pacote/installation do Runtime.

57. Helper failure Se: helper missing helper not executable helper incompatible helper crashes resultado: SandboxUnavailableError quando o profile exigir confinement.

58. Child exit ambiguity O backend deve distinguir: runner failed de: child returned non-zero O DeepSeek toma cuidado especial com isso: um launcher poderá utilizar códigos específicos de falha, mas o mero exit code do filho não deve ser interpretado automaticamente como falha do runner.

59. Runner failure metadata O provider deve retornar evidência estruturada: backend failureType details não apenas: Error("sandbox failed")

60. No silent unconfined fallback Proibido: bwrap failed ↓ Landlock failed ↓ spawn original argv O DeepSeek considera esse comportamento explicitamente proibido e falha com SANDBOX_UNAVAILABLE. O Spectree fará o mesmo: backend chain exhausted → SandboxUnavailableError

61. Approval interaction Quando: Policy = approval-required não aplicar Sandbox ainda. A ordem continua: Policy → Approval → Revalidation → Sandbox → Process

62. Policy revalidation No resume: Approval approved ↓ Policy revalidation ↓ Sandbox profile reconstruction ↓ physical apply Não reutilizar uma sandbox antiga.

63. Profile snapshot Uma invocation deve possuir: SandboxExecutionPolicy imutável. Não permitir alteração durante execução.

64. Tool restrictions A Tool pode pedir: read-only ou: workspace-write mas não pode ampliar o teto. O SandboxProfileResolver continua sendo a autoridade.

65. Runtime ceiling Exemplo: Runtime max = workspace-write Tool requests = danger-full-access Resultado: workspace-write ou rejeição, conforme policy do resolver. Nunca: danger-full-access

66. Physical backend does not decide authority O backend recebe a policy já resolvida. Não contém: if agent == oracle ou: if founder

67. Events Manter: sandbox.requested sandbox.applied sandbox.denied sandbox.failed sandbox.released Adicionar metadata: backendId enforcement sem expor detalhes internos.

68. Event order Sucesso: policy.evaluated sandbox.requested sandbox.applied provider.started process.started ... sandbox.released Falha de backend: policy.evaluated sandbox.requested sandbox.failed sem: provider.started process.started

69. Physical denial Quando o backend existe mas não consegue cumprir a policy: SandboxDeniedError ou: SandboxUnavailableError conforme a causa: denied vs no usable backend

70. Error taxonomy Manter/expandir: SandboxError SandboxConfigurationError SandboxUnavailableError SandboxDeniedError SandboxCapabilityError SandboxCleanupError SandboxEscalationRequiredError Adicionar Linux-specific somente se necessário: LinuxSandboxProbeError LinuxSandboxBackendError LinuxSandboxRunnerError Preferência: manter os erros públicos genéricos e cause.metadata.backend para detalhes.

71. Functional probe security O probe deverá usar: temporary directory e destruir tudo depois. Nunca testar sobre o workspace real do Founder.

72. Probe scenario Exemplo: probe-root/ ├── allowed.txt └── outside.txt Confinar processo: allowed = readable outside = denied workspace write = allowed Se resultado corresponder: usable

73. Probe process O processo do probe deve ser um programa pequeno e determinístico. Não usar: bash -c complex script para provar a sandbox do próprio Bash. Preferir um helper dedicado ou Node process controlado.

74. Probe cannot trust Agent code O probe é infraestrutura do Runtime. Não reutilizar uma Tool do Agent para validar a sandbox.

75. Probe no external network O probe deve ser local. Não depender: internet DNS cloud

76. Probe no credentials Sem: API key cloud credentials SSH key

77. Probe cache Cachear apenas: backend capability verdict não: specific workspace permission Porque cada invocation possui roots/policy diferentes.

78. Per-call policy Seguindo o DeepSeek, a policy física deve ser por invocation, e não apenas uma configuração global do provider. O backend mantém o mecanismo selecionado, enquanto cada chamada fornece sua policy efetiva. Isso permitirá: Session A → read-only Session B → workspace-write simultaneamente.

79. No provider-global mode Proibido: sandboxProvider.mode = workspace-write como estado mutável global.

80. Concurrent invocations Testar: A → read-only B → workspace-write no mesmo Runtime/processo. Uma não pode afetar a outra.

81. Sandbox instance isolation Cada invocation recebe: sandboxInstanceId único.

82. Cleanup Após execução: process finished outputs drained sandbox.release

83. Release idempotency release() release() não pode gerar double cleanup.

84. Cleanup after failure Falha de: process provider stdout stderr não pode impedir: sandbox.release

85. Cleanup after cancellation Session.cancel() deve: terminate process release sandbox remove registry entry na ordem apropriada.

86. Temp cleanup O temp privado deve ser removido após a execução. Se não puder ser removido: SandboxCleanupError com diagnóstico.

87. No broad chmod/chown O backend Linux não deve usar: chmod -R 777 chown -R como mecanismo de sandbox. Essas operações não constituem confinement.

88. No root requirement Não exigir: sudo para o modo normal. Bubblewrap é justamente interessante porque utiliza user namespaces para construir sandbox sem exigir root em ambientes suportados.

89. WSL2 development No Windows do Founder: Windows ↓ WSL2 ↓ Linux distro ↓ Spectree Runtime O runtime deve ser executado dentro do Linux/WSL.

90. WSL2 não é o sandbox O WSL2 é o execution host. O sandbox é: bubblewrap ou Landlock dentro do Linux. Essa distinção precisa aparecer na documentação.

91. Repository location in WSL Para desenvolvimento Linux: /home/<user>/spectree-squad é o local recomendado. Evitar: /mnt/c/... para workloads de filesystem do Runtime.

92. Windows interop A configuração de desenvolvimento deve evitar que um processo sandboxed tenha caminhos triviais para: /mnt/c ou executáveis Windows. Isso deve ser tratado no execution profile. Não assumir que WSL2 por si só bloqueia acesso ao host.

93. WSL profile Adicionar um perfil de desenvolvimento: linux-wsl que possa detectar: WSL_INTEROP /mnt/c windows.exe execution e produzir diagnóstico seguro. Não alterar o sandbox contract para acomodar WSL.

94. Não tratar WSL como production guarantee O backend Linux deve funcionar: Ubuntu native Debian native Linux VM WSL2 quando as capabilities exigidas existirem. Mas os testes devem diferenciar: native Linux WSL2 para troubleshooting.

95. Environment diagnostics O backend pode informar: linux kernel version WSL detected backend enforcement sem expor dados pessoais do Founder.

96. WSL-specific limitation Se uma função do kernel não estiver disponível na distro/kernel WSL: Landlock unsupported o Provider pode cair para: Bubblewrap se funcionalmente utilizável.

97. No fake fallback Se: bwrap unavailable Landlock unavailable resultado: SandboxUnavailableError

98. CI Adicionar pelo menos: ubuntu-latest para backend Linux. Depois: Windows + WSL2 pode existir como validation environment específica.

99. CI must not silently skip Se o job do Linux Physical Sandbox não consegue executar: functional probe o job deve falhar. Não: all sandbox tests skipped → green Essa é uma regra importante.

100. Platform matrix Obrigatório reportar: Platform Backend Result Linux + bubblewrap physical tested Linux + Landlock physical tested where available WSL2 + bubblewrap/Landlock physical tested Windows native unavailable expected macOS unavailable expected

101. Testes de segurança Obrigatórios: outside read outside write outside delete rename across boundary junction symlink hard-link reparse-like path process child grandchild temp isolation

102. Teste de same-world Process: write workspace/test.txt Filesystem Provider: read workspace/test.txt Resultado: same file

103. Teste de boundary real Process tenta: workspace/escape-link/outside.txt Resultado: denied Mesmo que o path lexical pareça autorizado.

104. Teste de full enforcement Para declarar: full todos os testes de effects relevantes precisam passar.

105. Teste de partial Criar fake/compatibility backend: partial e provar: required full → reject

106. Teste de unavailable Nenhum backend: unsupported resultado: SandboxUnavailableError sem processo.

107. Teste de backend selection Provar: bwrap usable → bwrap selected e: bwrap unusable Landlock usable → Landlock selected

108. Teste de runner failure Provar: bwrap executable exists but unusable → fallback. Se nenhum: → unavailable

109. Teste de concurrent policies A: read-only B: workspace-write mesmo Runtime. Provar isolamento.

110. Teste de cancellation Process ativo: Session.cancel() → process terminates → sandbox released.

111. Teste de shutdown runtime.shutdown() → all sandbox handles released.

112. Teste de no bypass Agent context continua: requestTool somente. Nenhum acesso a: SandboxProvider SandboxHandle bubblewrap Landlock

113. Teste de Process Provider Process Provider recebe somente: SandboxHandle ou prepared invocation. Nunca runner implementation.

114. Teste de Tool Tool física continua podendo existir como: provider-backed ou: physical self-provided mas ambas passam pelo Sandbox.

115. Teste de Pure Tool Pure Tool não deve iniciar Sandbox desnecessariamente.

116. Event projection Eventos: sandbox.applied devem conter apenas: sandboxInstanceId backendId mode enforcement sem: mounts completos kernel details environment

117. Event order Sucesso: policy.evaluated sandbox.requested sandbox.applied provider.started process.started process.exited provider.completed sandbox.released Failure: policy.evaluated sandbox.requested sandbox.failed sem execução.

118. Security error SandboxUnavailableError deve informar: mode required enforcement platform backend attempts sem segredos.

119. Documentation Atualizar: docs/architecture/SPECTREE-RUNTIME.md com: Linux Physical Sandbox Backend selection Bubblewrap Landlock Functional probes Full/partial WSL2 development Execution world Security boundaries Failure semantics

120. ADR Criar: docs/adr/ADR-07-linux-physical-sandbox.md Decisões: Linux é a primeira plataforma física. WSL2 é ambiente de desenvolvimento, não sandbox. Bubblewrap é primeiro runner preferencial. Landlock é fallback. Functional probe é obrigatório. Fail-closed é obrigatório. full depende do effect set real. partial é estruturalmente distinto. danger-full-access bypassa confinement explicitamente. Network/process visibility não fazem parte do SandboxMode desta fase. Containers/microVMs/remotes não são providers deste sandbox seam. O backend é por-call, não mode global. Process e filesystem compartilham execution world. O DeepSeek documenta exatamente essa última distinção: containers, microVMs e remote execution são ambientes de execução inteiros, não apenas outro backend de ctx.sandbox.

121. Definition of Done A Fase 7 só será DONE quando: LinuxPhysicalSandboxProvider existir. Bubblewrap backend existir. Landlock backend existir ou estar formalmente suportado pelo seam. backend selection existir. functional probes existirem. probe timeout existir. read-only funcionar fisicamente. workspace-write funcionar fisicamente. danger-full-access permanecer sem confinement. full/partial/unsupported forem reportados honestamente. nenhuma promessa de full depender apenas de configuração. workspace root for canonicalized. temp root for isolated. process tree estiver no execution world. filesystem e process compartilhem execution world. path traversal estiver protegido. symlink/junction estiver protegido. hard-link behavior estiver testado. outside write estiver bloqueado. outside delete estiver bloqueado. child/grandchild estiverem confinados quando declarado full. provider cleanup funcionar. sandbox cleanup funcionar. concurrent Sessions funcionarem. policies por invocation funcionarem. no silent fallback existir. no root requirement existir para o caminho suportado. WSL2 for suportado quando o backend for funcional. WSL2 não for tratado como sandbox. Linux CI real existir. sandbox tests não puderem virar "all skipped". Fases 1–6 continuarem verdes. claude plugin validate . --strict passar. documentação atualizada. ADR-07 criado. nenhum Shell implementado. nenhum Terminal/PTy implementado. nenhum Windows native backend implementado. nenhum container/microVM/remote executor implementado.

122. Definition of Architecture Done A prova principal será: Policy ↓ Approval ↓ SandboxProfile ↓ LinuxPhysicalSandboxProvider ↓ Bubblewrap/Landlock ↓ Process e o teste físico deverá mostrar: workspace/ read ✓ write ✓ delete ✓ outside/ read ✗ write ✗ delete ✗ quando o Profile for workspace-write. Também: process ↓ child ↓ grandchild deve permanecer dentro da mesma execution world.

123. Invariantes

- INV-701 LinuxPhysicalSandboxProvider é implementação de Sandbox, não Capability de negócio.
- INV-702 Bubblewrap/Landlock não são conhecidos pelo Agent.
- INV-703 Bubblewrap/Landlock não são conhecidos pelo Process Provider.
- INV-704 Policy continua autorizando.
- INV-705 Approval continua autorizando exceções humanas.
- INV-706 Sandbox continua impondo boundary físico.
- INV-707 Provider continua executando Capability.
- INV-708 Sandbox policy é por invocation.
- INV-709 Um backend incompatível não pode executar unconfined sob modo restritivo.
- INV-710 full só pode ser reportado quando o effect set prometido estiver fisicamente coberto.
- INV-711 partial nunca é tratado como full.
- INV-712 danger-full-access é escolha explícita.
- INV-713 O processo inicia já dentro da boundary.
- INV-714 Não existe pós-confinamento.
- INV-715 Workspace é fisicamente canonicalizado.
- INV-716 Temp é isolado por Session/invocation conforme profile.
- INV-717 Process e filesystem compartilham execution world.
- INV-718 Nenhum Agent acessa Sandbox internals.
- INV-719 Nenhum Tool amplia o Sandbox profile.
- INV-720 Nenhum Provider amplia o Sandbox profile.
- INV-721 Nenhuma policy contém detalhes de Linux backend.
- INV-722 Nenhuma Persona contém detalhes de Linux backend.
- INV-723 Wsl2 é host de desenvolvimento, não security boundary do Runtime.
- INV-724 Functional probe é a autoridade para backend availability.
- INV-725 Runner failure não pode virar child failure silenciosamente.
- INV-726 No silent unconfined fallback.
- INV-727 Cada SandboxHandle pertence a uma única invocation.
- INV-728 Release é idempotente.
- INV-729 Runtime shutdown libera todos os sandbox handles.
- INV-730 Sandbox backend pode ser substituído por outro Linux backend sem alterar consumidor.

124. Handoff obrigatório do Opus 5

Implementation
arquivos criados/modificados

Backend Architecture
LinuxPhysicalSandboxProvider BubblewrapBackend LandlockBackend

Runner Selection
probe fallback failure

Enforcement
full partial unsupported

Profiles
read-only workspace-write danger-full-access

Functional Probe
cenários reais

Physical Security
workspace outside symlink junction hard-link process descendants temp

WSL2
detecção limitações testes

Same World
filesystem + process

Cleanup
process sandbox temp native resources

CI
Linux WSL2

DeepSeek Adaptation
o que foi reutilizado o que foi deliberadamente alterado

Known Limitations
limitações reais

Scope Verification
ausência de: Shell Terminal Windows native Container MicroVM Remote Network Orchestrator

125. Resultado estratégico Depois desta fase, teremos: SPECTREE RUNTIME Agent ↓ Policy ↓ Founder Approval ↓ Capability ↓ Sandbox ↓ Linux Physical Backend ├── Bubblewrap └── Landlock ↓ Process Provider ↓ Linux Execution World E o comportamento de processo muda de: workspace-write → SandboxUnavailable para: workspace-write → physical sandbox → Process quando o Linux host realmente oferecer a garantia necessária.

126. O que isso destrava Depois da Fase 7 podemos finalmente entrar na próxima camada sem a dívida do R14: F8 — Execution Effects / Resource Model que vai resolver formalmente o problema que identificamos antes do Shell: cwd deixa de ser suficiente como modelo de efeito. A arquitetura evolui para: Invocation ↓ Effect Set ├── filesystem.read ├── filesystem.write ├── process.spawn ├── process.output └── future network.* ↓ Policy ↓ Approval ↓ Sandbox ↓ Execution Aí, finalmente: F9 — Shell poderá ser construído sobre uma representação capaz de dizer não apenas onde o shell começou, mas quais efeitos ele potencialmente produz.

127. Regra de ouro da Fase 7 Não basta o Spectree saber que uma sandbox existe. Ele precisa provar que o processo está fisicamente confinado antes de chamar o processo de "confinado". Essa é a mesma disciplina que o DeepSeek aplica ao seu SandboxProvider: o backend precisa provar a execução confinada ou o Runtime deve recusar executar sem isolamento. E essa é a razão pela qual a Fase 7, para o Spectree, não é "integrar Bubblewrap". É criar a primeira execution boundary física verificável do Spectree Runtime.
