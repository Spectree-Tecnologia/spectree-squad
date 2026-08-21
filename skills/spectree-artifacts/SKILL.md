---
name: spectree-artifacts
description: Contrato de artefatos do squad Spectree - a árvore de notas em docs/notes/, os registros vivos, os artefatos da cadeia de derivação, o cabeçalho obrigatório, os três atos sobre conteúdo aprovado, o mandato de escrita por PR e o handoff entre agentes. Use sempre que for ler ou escrever qualquer artefato do squad.
---

# Contrato de artefatos do squad

Todo estado do pipeline vive em arquivos no repositório. Subagente não
compartilha contexto com subagente — o disco é a única memória comum.

Essa memória mora em `docs/`, e **o caminho decide** de que forma cada arquivo
é. Na ordem abaixo, e a primeira linha que casa é a resposta:

1. `docs/notes/FROZEN.sha256` — o **manifesto de congelamento**, e a única
   exceção nomeada da árvore: não é nota, não tem cabeçalho, não tem classe
   nem ciclo de vida. O `notes-tree` o ignora por esse nome exato; quem o lê é
   o `notes-freeze`.
2. Qualquer outro arquivo sob `docs/notes/` — **nota**: o artefato que
   registra um momento, com data, dono, classe e ciclo de vida, e que congela
   quando sai de circulação.
3. Arquivo que a nota da cadeia de derivação declara como estágio da cadeia,
   no caminho canônico dele — **artefato da cadeia**: tem cabeçalho e
   `depends_on:`, e o ciclo de vida dele mora no `status:`, não no caminho.
   PRD, EPIC, story, DESIGN e INFRA são estes.
4. Qualquer outro arquivo sob `docs/` — **registro vivo**: a fotografia do
   estado atual, reescrita continuamente, sem data e sem ciclo de vida.
   Congelá-lo o tornaria falso.
5. Arquivo fora de `docs/` — **não é memória do repositório**. Código,
   configuração, prompt de agente e este contrato caem aqui: nenhum gate de
   conteúdo os alcança, e todo diff que os toca paga nota (mandato de escrita,
   abaixo).

Este arquivo é a linha 5, e o que essa posição custa em verificação está em
"Mandato de escrita e os cinco gates de repositório", nomeado.

A ordem é o que torna a classificação decidível sem perguntar a intenção de
quem escreveu: nota da cadeia é nota, story é artefato da cadeia, e código é
código mesmo quando prescreve. Escolha só existe ao **criar** arquivo novo em
`docs/` que a cadeia não declara — e aí vale: se o texto envelhecer e ainda
assim valer a pena ler, é nota; se envelhecer só o tornar errado, é registro
vivo.

## Princípio AI FIRST

Execute, não peça. Se a tarefa pode ser concluída com o que está ao seu
alcance — CLI (`gh`, `npm`, `psql`, ...), MCP server conectado, script que
você mesmo escreve — faça você mesmo, agora. Devolver ao Founder uma lista
de passos manuais que você poderia ter executado é falha de entrega. Só há
duas razões válidas para parar: um Founder Gate deste contrato (status
`approved`, operação destrutiva) ou informação que nada do que você pode
executar responde. Se o que falta é uma dependência do ambiente (CLI não
instalado, MCP não conectado), diga exatamente qual, em vez de degradar para
instrução manual.

## Matriz de autoridade

Quem pode o quê vive em `squad.policies.json`, na raiz do plugin — default
deny: o que a matriz não concede, nenhum agente tem. A prosa dos agentes
resume a matriz; em conflito, a matriz vence. Esbarrou em autoridade que
não é sua, reporte ao Invoker em vez de contornar.

A escrita de nota é concedida **por classe**: o `owner:` da nota é conferido
contra a matriz pelo motor real, não pela boa vontade de quem escreveu.
Classe que não é sua é bloqueio, não formalidade. Se a matriz não concede a
classe a ninguém, é a matriz que vence e a classe não tem escritor — este
contrato declara a regra, não a executa.

## Convenção de nomes

**Identificador em inglês, prosa em português.**

Inglês técnico: pasta, arquivo, símbolo de código, tabela, coluna, rota,
campo de header, nome de branch e slug de artefato.

Português: o conteúdo da documentação, os critérios de aceite, a mensagem de
commit e os comentários de código.

Uma nota mora em `ADR-025-invite-code-rotation.md` e o texto dentro dela é
português. Uma migration chama `create_channels_table.sql`, e o comentário
dentro explica em português por que a constraint existe.

**Título de seção é literal.** Ele não vira símbolo de código, então não cai
na regra do inglês: vale a forma exata que este contrato escreve — é ela que o
gate de repositório procura onde a seção é obrigatória, e é ela que o grep
acha em todas as outras. A lista é esta, fechada, cada um com o acento e a
língua que estão aqui: `## Contexto`, `## Decisões`,
`## Linguagem`, `## Laço vermelho`, `## Alternativas descartadas`,
`## Consequências`, `## Open Questions`, `## Dev Log`, `## QA Notes`. Dentro
de `## Open Questions`, as três fronteiras também são literais:
`### Blocking now`, `### Waiting on an answer above`,
`### Not blocking this stage`.

## Caminhos canônicos

```
docs/
  notes/
    proposed/{class}/             # decidido, ainda não implementado
    implemented/{class}/          # descreve código que existe
    archived/{class}/             # superseded, congelado
    rejected/{class}/             # perdeu antes de haver decisão vencedora, congelado
    FROZEN.sha256                 # manifesto de hash de archived/ e rejected/
  CONTEXT.md                      # glossário do domínio - Lina mantém, todos escrevem
  TEST-SEAMS.md                   # Rubick - onde cada classe de critério se prova
```

`class` é conjunto fechado: `architecture`, `feature`, `bug-fix`, `process`,
`simplification`, `testing`. Ciclo de vida também: `proposed`, `implemented`,
`archived`, `rejected`. Pasta fora do conjunto é recusada por gate de
repositório — não existe classe nova sem nota de `process` que a decida.

**O ciclo de vida mora no caminho, não só no cabeçalho.** A pasta é um fato do
filesystem; a linha `status:` é um rótulo. Um `git mv` entre pastas aparece no
diff como movimento, e é barulhento — que é o ponto. Uma linha de status
trocada lê como inócua.

**Não existe índice.** Sem `INDEX.md`, sem README de índice. A árvore é o
índice, e o gate de repositório recusa a criação de um. Convenção de projeto
que merece ser registrada vira nota de classe `process`: convenção que só
existe num README não é achada por quem faz grep — é folclore com endereço.

**O nome do arquivo é o token pelo qual o repositório já cita a nota.** Nas
classes que o Founder, os reviews e os `depends_on` já citam por número, o
número manda; nas três que nenhum token cita, a data manda — ela não exige
coordenação entre agentes trabalhando em paralelo, que é o custo real do
número sequencial. Aplicado às seis classes:

| Classe | Nome do arquivo |
|---|---|
| `architecture`, `process` | `ADR-NN-<english-slug>.md` |
| `feature` | `<PREFIXO>-FNN-<english-slug>.md` |
| `bug-fix`, `simplification`, `testing` | `YYYY-MM-DD-<english-slug>.md` |

**Uma regra por classe, sem alternativa** — o nome tem de decidir sozinho de
que classe ele é, e forma que aceita duas coisas não decide nada. `ADR` é
token universal e não depende de repositório. O **token de fase** é
`<PREFIXO>-F`, com `<PREFIXO>` casando `[A-Z][A-Z0-9]*`: um repositório que
cita as próprias fases como `RUNTIME-F09` nomeia a nota
`RUNTIME-F09-<english-slug>.md`. Quem declara o prefixo, uma vez, é a nota da
cadeia de derivação; repositório que não declarou prefixo não escreve nota
`feature`, e declarar é uma linha na nota que ele já deve. Fixar aqui o
prefixo de um repositório proibiria a classe `feature` em todos os outros.

**A nota da cadeia de derivação tem nome fixo:**
`ADR-NN-derivation-chain.md`, classe `process`, uma por repositório. É o único
nome de nota que este contrato prende, e a razão é o localizador: ela precisa
ser achada por quem chega sem contexto, não existe índice, e o nome é o que
sobra — `ls docs/notes/*/process/` a entrega. Ela declara a cadeia, os
caminhos canônicos dela e o prefixo de fase; não declara o conteúdo da
árvore, porque listar notas seria índice, e índice não existe.

**Ela é a primeira nota do repositório**, e o `depends_on:` dela é `-`: o pai
é o brief do Founder. Enquanto a árvore de notas está vazia não há cadeia
declarada, não há o que ler, e escrevê-la é o primeiro trabalho — é assim que
a regra "leia a nota da cadeia antes de escrever" tem como ser cumprida no
primeiro artefato de um repositório novo. Árvore não vazia sem nota da cadeia
é vermelho no `notes-tree`.

**Largura do número.** O número no nome do arquivo usa **a mesma largura
com que o identificador é citado no texto do projeto**. É isso que torna
`ADR-11` localizável por grep — e é por isso que `ADR-011` no arquivo,
com `ADR-11` no texto, quebra a regra em vez de cumpri-la. Projeto novo
começa em `ADR-NN` e `STORY-NNN`; alargar depois exige renomear o conjunto
inteiro de uma vez, porque largura misturada é pior que qualquer uma das
duas.

**Congelamento é fato, não promessa.** Nota em `archived/` ou `rejected/` tem
uma linha `<sha256>  <caminho>` em `docs/notes/FROZEN.sha256`. Quem move a
nota para lá acrescenta a linha no mesmo PR; o manifesto só cresce, e o gate
de repositório recompara todo hash.

Os artefatos da cadeia de produto têm caminho canônico próprio, e existem no
repositório cuja cadeia declarada os produz:

```
docs/
  PRD.md                          # Lina  (Product Manager)
  EPIC.md                         # Lion  (Scrum Master)
  DESIGN.md                       # Zeus  (UI/UX)
  INFRA.md                        # Disruptor
  stories/
    STORY-NNN-english-slug.md     # Lion define; Jakiro e Keeper anexam seções
```

**Nunca crie variação de caminho.** Nem na árvore de notas — `docs/decisions/`,
`notes/` na raiz, `docs/notes/architecture/` sem o nível de ciclo de vida no
meio — nem nos artefatos da cadeia: `PRD/`, `prd.md`, `docs/product/PRD.md`,
`STORY-001.md` na raiz. Nome torto é nome que ninguém acha. Um repositório
ganha outros caminhos conforme a cadeia que declara, e quem os declara é a
nota da cadeia de derivação (seção abaixo).

## Cabeçalho obrigatório

Todo artefato começa com este bloco, entre as cercas `---`, que são a forma
única — cabeçalho sem cercas não é cabeçalho:

```markdown
---
status: draft | in-review | approved | rejected | in-progress | done | superseded
owner: <nome do agente>
updated: <YYYY-MM-DD>
approved: <YYYY-MM-DD e de onde veio a data, ou "-">
depends_on: <caminho do artefato pai, ou "-">
---
```

`approved` só é setado pelo Invoker depois de aprovação explícita do Founder,
que preenche `approved:` com a data no mesmo ato — o que registra *qual*
conteúdo foi aprovado é o `updated:` daquele momento. **A data carrega a
própria origem**, no mesmo campo e logo depois dela: quem aprovou, ou o merge
que registra a aprovação. O merge do PR de uma fase é o ato de aprovação do
Founder; não se inventa aprovação, deriva-se do git, e a origem viaja no
arquivo para quem for conferir depois. O gate de repositório lê a data; o
resto do campo é para quem confere, e por isso a pontuação dele não é
prescrita. Agente nenhum aprova o próprio artefato. Toda edição atualiza a
linha `updated:` — header desatualizado é bug.

O `status:` responde "este conteúdo está aprovado?"; a pasta responde "isto
descreve código que existe?". São eixos diferentes, e o gate de repositório
cruza os dois:

| Pasta | `status:` legais |
|---|---|
| `proposed/` | `draft`, `in-review`, `approved` |
| `implemented/` | `approved`, `in-review` |
| `archived/` | `superseded` |
| `rejected/` | `rejected` |

`in-progress` e `done` são exclusivos de story (ciclo de build abaixo) e nunca
aparecem em nota: `in-progress` é setado pelo Jakiro ao começar a implementar;
`done` só pelo Invoker, depois de veredito APROVADO do Keeper e PR aberto pelo
Disruptor.

Nota que substitui outra leva `supersedes:`; a substituída leva
`superseded_by:` e vai para `archived/`. Os dois campos são mútuos e apontam
para caminhos que resolvem — assim o grep encontra as duas pontas.

**A aprovação pertence ao conteúdo, não ao arquivo.** O texto commitado é o
contrato real: implementação nunca acontece contra uma versão "quase igual"
vinda de conversa. Alterar conteúdo aprovado rebaixa o `status:` para
`in-review` na mesma edição, feita por quem editou, e invalida a
implementação correspondente até nova aprovação. Derivar trabalho de um
artefato exige `updated:` igual ou anterior a `approved:`; divergência
significa conteúdo que ninguém aprovou, e volta ao Invoker.
(Regra espelhada do runtime: aprovação nunca sobrevive à mudança do que foi
aprovado.)

Não rebaixam: as transições sancionadas do ciclo de build
(`approved -> in-progress -> done`, cada uma com seu dono), os appends nas
seções de build (`## Dev Log`, `## QA Notes`) — eles registram execução, não
mudam o que foi aprovado — e a emenda aditiva, abaixo. A regra de derivação
vale para o artefato-pai no ato de derivar; story em ciclo de build carrega
`updated:` posterior por natureza, e isso não é violação.

Stories levam um campo a mais no header:

```markdown
blocked_by: STORY-003, STORY-007   # ou "-" quando nada trava
```

Liste apenas bloqueio **genuíno e direto**: a story não pode *começar* sem
aquela outra pronta. Nada de dependência transitiva (se B trava C e C trava
D, D lista só C), nada de "seria melhor depois". Dependência descrita em
prosa no corpo da story é invisível para quem sequencia — se trava, é
header.

## Os três atos sobre conteúdo aprovado

Editar o que já está aprovado é escolher um de três atos. **Nenhum deles se
declara:** os três se leem do diff, do cabeçalho e do disco, e cada um paga o
próprio preço com marca física no mesmo diff. O gatilho é o `status: approved`
no cabeçalho da **base do PR** — o que nunca foi aprovado, ou já está
rebaixado, se edita livre: não há o que defender.

A **unidade protegida** — o que dispara os três atos — é `## Decisões` na
nota, e o arquivo inteiro no registro vivo e no artefato da cadeia, que não
têm essa seção e são conteúdo do começo ao fim. Ficam de fora as seções de
build da story e as transições sancionadas de status: registram execução, não
mudam o que foi aprovado.

| Ato | Marca, no mesmo diff | Preço |
|---|---|---|
| **Emenda aditiva** | toda linha que muda na unidade protegida tem par na base e, retirados os links relativos e os símbolos colados neles, é byte a byte igual a ele; e cada link novo resolve no commit de cabeça | nenhum: muda `updated:`, preserva `approved:`, não invalida derivação |
| **Emenda substantiva** | o cabeçalho, no commit de cabeça, diz `status: in-review` | reaprovação do Founder, que é o merge |
| **Supersessão** | a nota vai para `archived/` com `superseded_by:`, o mesmo diff traz a nota nova com `supersedes:`, e a linha entra em `FROZEN.sha256` | congelamento |

**A emenda aditiva existe onde o `notes-truth` obriga a corrigir, e em lugar
nenhum além.** O código move um caminho, a declaração que o cita fica
vermelha, e a correção deixa de ser opcional: cobrar rebaixamento por obedecer
a um gate de repositório é cobrar por consertar o que o repositório mandou
consertar, e um refactor que move um arquivo rebaixaria tudo que o cita até a
aprovação virar ruído. Daí o teste ser o próprio texto alterado, e não um link
ao lado — trocar uma palavra de prosa junto fecha a rota, e ela nunca esteve
aberta onde a linha alterada não tem link para retirar. Linha acrescentada não
tem par na base com que comparar, logo não passa aqui. E onde o `notes-truth`
não alcança — o artefato da cadeia, que não cita código — a rota se fecha
sozinha, sem precisar ser proibida: sem link para retirar, o resto difere.

**A emenda substantiva é a saída comum, não a excepcional.** Acrescentar,
remover ou alterar item de `## Decisões`, trocar a razão que sustenta um, ou
mudar qualquer outra coisa num registro vivo aprovado: edita-se no lugar,
rebaixa-se o `status:` na mesma edição, feita por quem editou, e o Founder
reaprova no merge — que é o mesmo ato que já aprova qualquer entrega.

**A supersessão não é preço de emenda nenhuma.** Ela substitui a nota inteira
e serve à nota que foi **substituída**, nunca à que foi corrigida. Registro
vivo e artefato da cadeia não a alcançam — congelar uma fotografia a tornaria
falsa, e fora da árvore não há `archived/` para onde ir: para eles as saídas
são duas.

## Cadeia de derivação

**Cada repositório declara a sua cadeia, uma vez, na nota
`ADR-NN-derivation-chain.md` de classe `process`.** Não existe cadeia
universal: a de um produto e a de um runtime produzem artefatos diferentes, e
aplicar a errada proíbe trabalho que já está certo. Antes de escrever qualquer
artefato, leia essa nota — `ls docs/notes/*/process/` a mostra pelo nome, sem
índice e sem perguntar a ninguém. Ela declara os estágios da cadeia, o caminho
canônico e o pai de cada um, e o prefixo de fase do repositório. A única que
não tem essa nota por pai é ela mesma: repositório novo começa escrevendo-a,
com `depends_on: -`, contra o brief do Founder.

O que vale em qualquer cadeia:

- `depends_on:` aponta para o pai que a cadeia declara, e esse pai é lido
  inteiro antes de o filho ser escrito.
- Cada seção que você criar rastreia para algo no pai.
- Pai declarado que não existe é bloqueio: reporte, não invente o conteúdo
  do pai.
- Falta no pai é `## Open Questions`, nunca suposição sua.

A cadeia de produto, que é a que produz PRD, EPIC, stories, DESIGN e INFRA:

```
docs/PRD.md -> docs/EPIC.md -> docs/stories/STORY-*.md -> nota architecture + docs/DESIGN.md -> código
                                                           nota architecture -> docs/INFRA.md
```

Um repositório que não roda essa cadeia não tem esses arquivos, e isso não é
lacuna — é a cadeia dele sendo outra.

Organize `## Open Questions` por **fronteira**, não em lista achatada — o
Invoker pergunta ao Founder na ordem que você deixar:

```markdown
## Open Questions

### Blocking now
Respondíveis já, sem depender de nenhuma outra resposta desta lista.
Uma linha por pergunta: o que muda conforme a resposta + sua recomendação.

### Waiting on an answer above
Cada uma indica de qual pergunta depende. Não têm resposta útil antes disso.

### Not blocking this stage
Ficam registradas para quem vier depois — diga qual agente elas travam.
```

Pergunta cuja resposta existe no repositório, no ambiente ou no que você pode
executar não entra aqui: descubra você (princípio AI FIRST). Esta seção é só
para o que mora exclusivamente na cabeça do Founder — preferência,
prioridade, restrição de negócio.

## Formato mínimo por artefato

### Notas

| Classe | O que cai aqui | Seções obrigatórias |
|---|---|---|
| `architecture` | a decisão dura de reverter, com o porquê e as alternativas | `## Contexto`, `## Decisões` |
| `process` | como o squad trabalha: cadeia de derivação, convenção, ritual | `## Contexto`, `## Decisões` |
| `feature` | a spec normativa de uma fase: o que MUST valer, invariantes numeradas, critérios de aceite | — |
| `bug-fix` | a lição de um defeito já pago, com a causa real | `## Laço vermelho` |
| `simplification` | o que saiu, e por que sair é seguro | — |
| `testing` | o que uma costura de teste passou a provar, e desde quando | — |

**`architecture` e `process`** — uma decisão por arquivo:

```markdown
# ADR-11 — Título curto da decisão

## Contexto
<1 a 3 frases: o que estava em jogo.>

## Decisões
1. <a decisão, com o porquê colado nela.>
```

Uma nota de **um item** é uma nota completa — o valor está em registrar *que*
se decidiu e *por quê*. A lista numerada é obrigatória mesmo com um item só, e
não por simetria: é dela que os `depends_on` dos filhos derivam, e é ela a
unidade protegida da nota — o que o gate de repositório compara linha a linha.
Parágrafo solto, sem seção nomeada, não lhe dá o que proteger.

Seções opcionais entram só quando pagam a própria linha:
`## Alternativas descartadas` quando a rejeição é não óbvia e alguém vai
propor de novo em seis meses — e ela leva o **gatilho** que a reabriria;
`## Consequências` quando o efeito colateral surpreende.

Alternativa que perdeu *dentro* de uma decisão mora em
`## Alternativas descartadas`, junto de quem a venceu. Proposta que morreu sem
haver decisão vencedora não tem onde morar: vai inteira para `rejected/`.

**`bug-fix`** — uma lição por arquivo, nunca um arquivo com todas:

```markdown
# <título curto do defeito>

**Contexto:** o que estava acontecendo, em 1-2 linhas.
**Lição:** o que aprendemos — a armadilha, o bug, a causa real.
**Gatilho de releitura:** que mudança futura torna isto relevante de novo.

## Laço vermelho
Comando: `<o comando exato>`
Vermelho antes: <a saída de falha, curta e verbatim>
Verde depois: [<teste de regressão commitado>](<link relativo>)
```

Nota de `bug-fix` sem laço vermelho é opinião datada; com laço, é regressor
reexecutável — e a metade verde se reprova a cada CI, porque a suíte roda
inteira.

Antes de trabalhar, procure a sua área com
`grep -ril "<sua área>" docs/notes/implemented/bug-fix/`. Uma pasta só, e é
essa: lição descreve defeito já pago, logo nasce em `implemented/`, e varrer
os outros ciclos de vida devolveria conselho congelado ou rejeitado. O ganho é
o recorte — você lê só os arquivos que casam. Perdeu tempo com algo que outro
agente vai tropeçar depois? Registre. Sessão de debug perdida sem nota é
desperdício em dobro.

### Registros vivos

- **CONTEXT.md** — O glossário do domínio, e **nada além disso**. Um termo,
  a definição em 1-2 frases, e os sinônimos que ficam proibidos:

  ```markdown
  ## Linguagem

  **Account** (conta):
  O registro de autenticação de uma pessoa — e-mail e senha.
  _Avoid_: user, usuário, login

  **Member** (membro):
  Uma Account que entrou num Channel. É papel, não entidade separada.
  _Avoid_: participante, integrante, subscriber
  ```

  O glossário é a **ponte** entre as duas línguas do projeto: o termo
  canônico em inglês, porque é ele que vira `board.controller.ts` e a tabela
  `boards`; o português entre parênteses, porque é assim que o Founder e a
  documentação falam. `_Avoid_` recolhe os rejeitados nas duas línguas, e é o
  que faz o glossário funcionar: quem ia escrever "participante" encontra a
  palavra proibida e a substituição no mesmo lugar.

  Quatro regras:
  - **Defina o que a coisa é**, não o que ela faz. Uma ou duas frases.
  - **Só termo específico deste domínio.** `timeout`, `cache` e `retry` são
    conceitos gerais de programação e ficam de fora, por mais usados que
    sejam aqui.
  - **Zero implementação.** Nome de tabela, rota e biblioteca pertencem às
    notas de `architecture`; glossário que vira spec deixa de ser consultável.
  - **Escreva no instante em que o termo se resolve**, nunca em lote — lote
    não acontece. Qualquer agente escreve; a Lina mantém a consistência.

  Leia o glossário antes de escrever artefato ou código, e **tire dele os
  nomes**: variável, função, arquivo, tabela e rota usam o termo canônico em
  inglês; a prosa usa o português. É assim que oito agentes sem contexto
  compartilhado convergem para a mesma linguagem.

  O arquivo nasce quando o primeiro termo se resolve. Glossário escrito
  antes da primeira decisão é chute com aparência de autoridade.
- **TEST-SEAMS.md** — Owner Rubick. O mapa de onde cada classe de critério
  se prova para valer: a costura de teste, o que ela cobre, o runner, e o
  que deliberadamente fica de fora. É registro vivo: cresce a cada classe nova
  de critério, e por isso não é nota — nota se decide uma vez e se substitui.
  Decisão *individual* de costura, quando é dura de reverter, é nota de
  `architecture`, e o mapa aponta para ela.

Um repositório pode ter outros registros vivos — a visão consolidada da
arquitetura é o caso típico. Todos respondem à mesma regra: descrevem o estado
de agora, ficam em `docs/` fora de `docs/notes/`, não são estágio da cadeia, e
não têm data no nome nem ciclo de vida no caminho.

### Artefatos da cadeia de produto

Existem no repositório cuja cadeia de derivação declarada os produz.

- **docs/PRD.md** — Owner Lina. Problema, Usuário-alvo, Escopo (fora do escopo
  explícito), Requisitos funcionais numerados (`RF-01`), Métricas de sucesso.
- **docs/EPIC.md** — Owner Lion. Lista de épicos (`EP-01`), cada um com
  objetivo, RFs cobertos e critério de pronto.
- **docs/stories/STORY-NNN-english-slug.md** — Lion define; Jakiro e Keeper
  anexam seções. `Como <papel>, quero <ação>, para <valor>`, épico de origem,
  critérios de aceite em Gherkin, estimativa relativa.
- **docs/DESIGN.md** — Owner Zeus. Fluxos de tela, estados
  (vazio/carregando/erro), tokens de design, e acessibilidade mínima por tela.
- **docs/INFRA.md** — Owner Disruptor, deriva das notas de `architecture`. O
  que existe (serviços, ids, domínios), o que acontece no deploy, variáveis de
  ambiente (nomes e origem, nunca valores) e como subir o ambiente do zero.

## Mandato de escrita e os cinco gates de repositório

**Todo diff que toca qualquer coisa fora de `docs/**` adiciona ou modifica ao
menos uma nota sob `docs/notes/**`, no mesmo PR.** Sem isenção declarável —
isenção declarável é exatamente a promessa que o gate de repositório existe
para eliminar. O custo real é um PR trivial pagar um parágrafo, e ele é
deliberado.

Cinco gates de repositório sustentam o que este contrato declara. Cada um se
identifica pelo nome, e o nome é o que aparece vermelho — é assim que quem
quebrou um sabe o que quebrou. O repositório que carrega este contrato deve os
cinco:

| Gate de repositório | O que ele prova |
|---|---|
| `notes-tree` | classe e ciclo de vida no conjunto fechado; forma do nome por classe; cabeçalho presente e status no conjunto; tabela status×pasta; datas não futuras; `supersedes`/`superseded_by` mútuos e resolvíveis; links entre notas resolvem; seções obrigatórias por classe; ausência de índice; árvore não vazia tem exatamente uma nota da cadeia de derivação; `FROZEN.sha256` fora da conta |
| `notes-freeze` | `FROZEN.sha256` cobre `archived/` e `rejected/`; todo hash bate; o manifesto só cresce contra a base do PR |
| `notes-truth` | toda declaração de nota `implemented/` e de registro vivo resolve no código |
| `notes-mandate` | diff fora de `docs/**` traz nota no mesmo PR; e diff que toca a unidade protegida de um artefato cujo cabeçalho, **na base do PR**, diz `status: approved` traz a marca de um dos três atos |
| `notes-authority` | o `owner:` da nota podia escrever aquela classe, decidido pelo motor real da matriz |

A tabela nomeia invariante, não arquivo. Onde cada um mora, como se chama o
teste e qual runner o executa é do repositório — o que este contrato prende é
o nome e o que ele deve provar, porque é isso que precisa significar a mesma
coisa nos repositórios que o carregam.

**Declarar é fazer link, não pôr entre crases.** Em nota `implemented/` e em
registro vivo, afirmar que um arquivo existe é fazer link relativo para ele —
e o símbolo só é afirmado quando o token entre crases está colado no link:
`` [`createSandboxPolicy`](../../../caminho/para/policy.js) ``. Token entre crases
**sem link não afirma nada**: é tipografia, e mais das vezes é vocabulário —
`allow`, `deny`, `read-only` são valores de domínio, não símbolos. O buraco
simétrico fecha por lint: token com `/` e extensão de código escrito em prosa,
fora de link, falha pedindo que vire link. Escreva o link, e o gate de
repositório confere por você; escreva a crase, e você não afirmou nada.

O `notes-mandate` prova que uma nota foi tocada, não que valia a pena tocá-la.
Quem julga valor é o review — gate de repositório que tentasse medir
sinceridade seria o próximo rótulo a se descolar do fato.

### O que não tem gate de repositório, e é para ficar escrito

Os cinco verificam o conteúdo de `docs/`. **Nenhum deles verifica o conteúdo
deste arquivo.** Ele e os outros arquivos que o squad carrega para saber como
trabalhar — os prompts de agente, as demais skills, o README do plugin — estão
fora de `docs/`, que é a linha 5 da taxonomia, e o escopo do `notes-truth` é
fechado e nomeado: nota em `implemented/` e registro vivo.

A consequência, sem rodeio: um caminho errado escrito aqui não fica vermelho
em lugar nenhum. Vira o caminho errado que oito agentes passam a seguir, e o
erro só aparece quando alguém tropeça nele. Contrato que alega verificação que
não tem é a mesma mentira que um modo restritivo sem quem o aplique — sem quem
verifique, o que sobra é dizer que não há.

O que **alcança** este arquivo é o mandato de escrita: editá-lo é diff fora de
`docs/**` e paga nota no mesmo PR, como qualquer outro. E o `notes-tree` cobra
da árvore real a forma que este contrato declara — então contrato e árvore
divergindo dá vermelho **na árvore**, nunca aqui. É meia cobertura: prende o
repositório à regra, não a regra ao fato.

## Ciclo de build da story

Depois de `approved`, a story ganha duas seções de apêndice, cada uma com
dono exclusivo — nenhum agente edita a seção do outro nem a definição do
Lion:

```markdown
## Dev Log            <- dono: Jakiro, append-only
- [ ] CA-1: <resumo curto do critério de aceite>
- [ ] CA-2: ...

### <YYYY-MM-DD> — Jakiro
<o que mudou, arquivos tocados, decisões locais, pegadinhas encontradas>

## QA Notes           <- dono: Keeper of the Light, append-only
### <YYYY-MM-DD> — veredito: APROVADO | REPROVADO
- CA-1: <veredito> — <evidência: teste rodado ou arquivo:linha>
- CA-2: ...
<o que falta, em ordem de impacto, se REPROVADO>
```

Jakiro cria o checklist (um item por critério de aceite) ao iniciar e marca
`[x]` conforme fecha cada um, com nota datada por sessão de trabalho. Keeper
anexa um bloco de veredito por rodada de review — rodadas anteriores não são
editadas nem apagadas: o histórico de reprovações fica.

## Handoff

Ao terminar, retorne ao Invoker no máximo 15 linhas:

```
ARTEFATO: <caminho>
STATUS: <draft|in-review>
FEZ: <2-4 bullets do que mudou>
BLOQUEIOS: <perguntas em aberto, ou "nenhum">
PROXIMO: <qual agente deveria agir agora, e por quê>
```

O conteúdo completo fica no arquivo. Não repita o artefato na resposta.
