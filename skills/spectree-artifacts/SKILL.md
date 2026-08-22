---
name: spectree-artifacts
description: Contrato de artefatos do squad Spectree - a árvore de notas em docs/notes/, os registros vivos, os artefatos da cadeia de derivação, o cabeçalho obrigatório, a supersessão, o mandato de escrita por PR e o handoff entre agentes. Use sempre que for ler ou escrever qualquer artefato do squad.
---

# Contrato de artefatos do squad

Todo estado do pipeline vive em arquivos no repositório. Subagente não
compartilha contexto com subagente — o disco é a única memória comum.

Essa memória mora em `docs/`. A escada abaixo decide de que forma cada arquivo
é, e a primeira linha que casa é a resposta:

1. `docs/notes/FROZEN.sha256` — o **manifesto de congelamento**, e a única
   exceção nomeada da árvore: não é nota, não tem cabeçalho, não tem classe nem
   ciclo de vida. O `notes-tree` o ignora por esse nome exato; quem o lê é o
   `notes-freeze`.
2. Sob `docs/`, qualquer um destes quatro — **recusa**: o arquivo não tem forma,
   não ganha cabeçalho, e o `notes-tree` recusa a criação dele.
   - sob `docs/notes/`, o que não é `<ciclo de vida>/<classe>/<nome>.md` com os
     dois níveis no conjunto fechado — `docs/notes/architecture/x.md`, sem o
     nível de ciclo de vida no meio;
   - `INDEX.md` ou `README.md`, em qualquer nível — não existe índice;
   - um nome de arquivo canônico num caminho que não é o dele, ou o caminho
     canônico escrito com outras maiúsculas — `docs/product/PRD.md`,
     `docs/prd.md`;
   - **os caminhos que a nota da cadeia de derivação declara como substituídos
     pela árvore de notas** — cada repositório tem os seus, e são os caminhos em
     que a memória dele morava antes deste contrato. Sem esta linha eles cairiam
     na linha 5 e voltariam a existir como registro vivo legal, que é o contrário
     de terem sido substituídos. Repositório que nunca teve memória em `docs/`
     não declara nenhum, e esta linha não recusa nada nele.
3. Qualquer outro arquivo sob `docs/notes/` — **nota**: o artefato que registra
   um momento, com dono, classe e ciclo de vida, e que congela quando sai de
   circulação.
4. Arquivo que a nota da cadeia de derivação declara como estágio da cadeia, no
   caminho canônico dele — **artefato da cadeia**: tem cabeçalho e
   `depends_on:`, e o ciclo de vida dele mora no `status:`, não no caminho.
5. Qualquer outro arquivo sob `docs/` — **registro vivo**: a fotografia do
   estado atual, reescrita continuamente, sem ciclo de vida. Congelá-lo o
   tornaria falso.
6. Arquivo fora de `docs/` — **não é memória do repositório**. Código,
   configuração, prompt de agente e este contrato caem aqui: nenhum dos cinco
   gates de repositório lê o conteúdo deles, e todo diff que os toca paga nota
   (mandato de escrita, abaixo).

Nenhuma linha pergunta o que o arquivo diz, nem a intenção de quem o escreveu.
A linha 4 e o quarto caso da linha 2 perguntam à **nota da cadeia de
derivação**, que declara os caminhos canônicos e os substituídos, e é a primeira
coisa que se lê aqui; o resto é o caminho puro. O custo fica escrito: `docs/PRD.md` é registro
vivo até essa nota o declarar estágio, e a conversão mora no corpo de outra
nota — passa por PR, gates e review, mas não aparece no diff do arquivo
convertido.

**A escada recusa antes de classificar**, e é por isso que é escada e não
tabela: sem a linha 2, todo caminho proibido cairia na linha 5 e existiria como
registro vivo legal. Escolha só há ao **criar** arquivo em `docs/` que a cadeia
não declara — e aí vale: se o texto envelhecer e ainda assim valer a pena ler,
é nota; se envelhecer só o tornar errado, é registro vivo.

**A recusa vale para criar, e um repositório que ainda tem arquivo nos caminhos
recusados os retira nesta ordem**, que é da migração e não do dia a dia:

1. este contrato entra em `main`;
2. os cinco gates de repositório entram;
3. um PR só move a árvore com `git mv` e reescreve, no mesmo diff, toda citação
   dos caminhos recusados nos prompts de agente, nas skills, no README do plugin
   e na matriz de autoridade.

Entre 1 e 3 este contrato recusa caminhos que os prompts ainda citam, e a
divergência é de prosa: nenhum gate fica vermelho no intervalo, porque **a
recusa da linha 2 é de criação** — o `notes-tree` a mede contra a base do PR, e
arquivo que já estava no caminho recusado é a entrada da migração, não violação
a consertar por fora dela. Quem precisar escrever nota nova no intervalo escreve
já na árvore, **e a nota da cadeia vem antes dela** — é a primeira nota de
qualquer árvore, e é ela que diz quais caminhos estão substituídos. Enquanto não
existir, a árvore está vazia e o quarto caso da linha 2 não tem o que recusar:
não há criação de nota em lugar nenhum. Quem ler um prompt que aponta para um
caminho recusado segue este contrato e reporta a citação ao Invoker.

**E o cabeçalho desses arquivos também é pré-contrato — com dois defeitos, não
um: forma antiga e ausência.** Enquanto a migração não terminar, derivar de um
artefato que `main` carrega de antes deste contrato responde assim:

- **ele tem linha `status:`** — solta ou entre cercas, vale a linha que ele tem;
- **ele não tem linha `status:` nenhuma** — lê-se `approved`, porque ele está em
  `main` e a aprovação é o merge.

A segunda metade não é folga, e sem ela a cláusula cobriria só o artefato de
cabeçalho torto, deixando de fora o que nunca teve cabeçalho — que é metade do
que a migração existe para consertar. **Linha presente vence a ausência:** o
pré-contrato que declara recusa continua recusando, e é só o silêncio que o
merge preenche. As duas metades morrem quando a migração termina, porque depois
dela não existe artefato sem cabeçalho para ler — e é por isso que isto é
cláusula de intervalo, não isenção. Sem elas, a forma nova recusaria todo o
pré-contrato que `main` carregue, e regra que reprova o repositório inteiro no
dia em que nasce é dívida com nome novo.

## Princípio AI FIRST

Execute, não peça. Se a tarefa pode ser concluída com o que está ao seu alcance
— CLI (`gh`, `npm`, `psql`, ...), MCP server conectado, script que você mesmo
escreve — faça você mesmo, agora. Devolver ao Founder uma lista de passos
manuais que você poderia ter executado é falha de entrega. Só há duas razões
válidas para parar: o que este contrato não deixa agente nenhum fazer (aprovar
artefato, mergear, operação destrutiva) ou informação que nada do que você pode
executar responde. Falta uma dependência do ambiente (CLI não
instalado, MCP não conectado)? Diga qual, em vez de degradar para instrução
manual.

## Matriz de autoridade

Quem pode o quê vive em `squad.policies.json`, na raiz do plugin — default
deny: o que a matriz não concede, nenhum agente tem. A prosa dos agentes e a
deste contrato resumem a matriz; em conflito, a matriz vence. Esbarrou em
autoridade que não é sua, reporte ao Invoker em vez de contornar.

**Este contrato não concede escrita nenhuma.** Ele nomeia o **dono** de cada
artefato e descreve a forma de cada um; conceder é da matriz, e só dela. Dono é
endereço — quem responde pela coerência daquele artefato, e a quem se reporta o
que falta nele —, nunca permissão de gravar. Onde este texto disser que alguém
escreve, leia "é o dono dele".

Duas consequências, e são elas que fecham a rota por onde a concessão volta:

- **A frase que concede sem nomear dono é ilegal aqui** — "todos escrevem",
  "qualquer agente escreve", "aberto a quem quiser". Ela não carrega roteamento
  nenhum: a única coisa que faz é convidar para uma escrita que a matriz nega.
  Quem a lê e obedece age de boa-fé, e o erro é da linha.
- **Dono nomeado aqui sem concessão correspondente na matriz é lacuna da
  matriz** — reporte ao Invoker. A correção é uma linha na matriz, nunca uma
  edição sua no artefato.

**A matriz governa conceder, não gravar.** O ato governado é a concessão, e uma
linha reescrita byte a byte igual à da base não concede nada — quem preserva não
concede.

**O guard passará a comparar a base e a cabeça, e hoje ele decide sobre o
byte.** É entrega do Invoker, junto com o resto do conserto da matriz. O guard é
peça **deste plugin** e viaja com este contrato, então descrevê-lo no presente
não é afirmar fato de instalação do repositório hospedeiro — é a única coisa
fora de `docs/` que este contrato pode afirmar assim, e ela morre quando a
entrega abaixo entrar. Em `hooks/guard.mjs` a detecção lê só o texto que entra (`new_string` ou
`content`), casa uma linha de status governado dentro dele e nega — o
`old_string` chega no mesmo payload e não é lido. Com isso o guard nega
exatamente o dever que este contrato dá ao Keeper: anexar `## QA Notes` numa
story `approved` preservando a linha de status byte a byte dentro da janela do
Edit. E a mesma edição passa quando a janela não alcança a linha de status —
isso é acidente da janela, não concessão. Enquanto a comparação com a base não
entrar, quem esbarrar na negação reporta ao Invoker em vez de reescrever a
janela para contorná-la.

**A escrita de nota passará a ser concedida por classe**, com o `owner:`
conferido contra a matriz pelo `notes-authority` — pelo motor real, não pela boa
vontade de quem escreveu. **São duas entregas e dois donos:** a família de
recursos por classe na matriz é do **Invoker**, junto com o resto do conserto
dela; o gate entra com os outros quatro, no PR que os traz. A matriz vem
primeiro — gate que perguntasse a uma matriz sem classes negaria a todo mundo.
Enquanto as duas não acontecerem, este contrato declara o destino e nada mais. Classe que a matriz não
concede a ninguém não tem escritor: quem precisar escrever nela reporta ao
Invoker, que é a mesma rota de qualquer lacuna da matriz.

## Convenção de nomes

**Identificador em inglês, prosa em português.**

Inglês técnico: pasta, arquivo, símbolo de código, tabela, coluna, rota, campo
de header, nome de branch e slug de artefato. Português: o conteúdo da
documentação, os critérios de aceite, a mensagem de commit e os comentários de
código. Uma nota mora em `ADR-025-invite-code-rotation.md` e o texto dentro
dela é português; uma migration chama `create_channels_table.sql`, e o
comentário dentro explica em português por que a constraint existe.

**`<english-slug>` é minúscula, dígito e hífen** — `[a-z0-9]+(-[a-z0-9]+)*`:
sem acento, sem `_`, sem maiúscula, sem hífen no início nem no fim, e nunca
vazio. É a forma que o `notes-tree` cobra em todo nome de arquivo que este
contrato define; o número e o token de fase que vêm antes dele carregam as
maiúsculas, e não fazem parte do slug.

**A mensagem de commit é Conventional Commits, daqui para frente.** A regra
institui a forma; ela não codifica prática anterior, não tem gate e não é
retroativa — nenhum commit já escrito é violação dela. A forma é
`<tipo>(<escopo>): <descrição>`, escopo opcional: o tipo em inglês, no conjunto
`feat`, `fix`, `docs`, `refactor`, `test`, `chore`; o escopo é a área tocada; a
descrição é português, como toda prosa. **Como o repositório merge — squash,
merge commit, rebase — este contrato não diz**: é fato de instalação, e nenhuma
regra daqui o lê. **Gatilho para remover a regra:**
medir a conformidade e achá-la sem lastro — se instituir não instituiu, a
convenção é folclore e sai, em vez de ficar como a única linha deste contrato
que ninguém cumpre.

**Título de seção é literal.** Ele não vira símbolo de código, então não cai na
regra do inglês: vale a forma exata que este contrato escreve, com o acento e a
língua que estão aqui — é ela que o `notes-tree` procura onde a seção é
obrigatória, e é ela que o grep acha em todas as outras. A lista é fechada:
`## Contexto`, `## Decisões`, `## Linguagem`, `## Laço vermelho`,
`## Alternativas descartadas`, `## Consequências`, `## Open Questions`,
`## Dev Log`, `## QA Notes`; e dentro de `## Open Questions` as três fronteiras
`### Blocking now`, `### Waiting on an answer above`,
`### Not blocking this stage`.

## Caminhos canônicos

```
docs/
  notes/
    proposed/{class}/             # decidido, ainda não implementado
    implemented/{class}/          # descreve código que existe
    archived/{class}/             # superseded, congelado
    rejected/{class}/             # perdeu antes de haver decisão vencedora
    FROZEN.sha256                 # manifesto de hash de archived/ e rejected/
  CONTEXT.md                      # glossário do domínio     - dono: Lina
  TEST-SEAMS.md                   # mapa de costuras de teste - dono: Rubick
```

`class` é conjunto fechado: `architecture`, `feature`, `bug-fix`, `process`,
`simplification`, `testing`. Ciclo de vida também: `proposed`, `implemented`,
`archived`, `rejected`. Não existe classe nova sem nota de `process` que a
decida.

**O ciclo de vida mora no caminho, não só no cabeçalho.** A pasta é um fato do
filesystem; a linha `status:` é um rótulo. Um `git mv` entre pastas aparece no
diff como movimento, e é barulhento — que é o ponto. Uma linha de status
trocada lê como inócua.

**Não existe índice.** A árvore é o índice, e a linha 2 da escada recusa a
criação de um. Convenção que só existe num README não é achada por quem faz
grep — é folclore com endereço; a que merece registro vira nota de `process`.

**O nome do arquivo é o token pelo qual o repositório já cita a nota.** Onde o
Founder, os reviews e os `depends_on` já citam por número, o número manda; onde
nenhum token cita, a data manda — ela não exige coordenação entre agentes
trabalhando em paralelo, que é o custo real do número sequencial.

| Classe | Nome do arquivo |
|---|---|
| `architecture`, `process` | `ADR-NN-<english-slug>.md` |
| `feature` | `<PREFIXO>-FNN-<english-slug>.md` |
| `bug-fix`, `simplification`, `testing` | `YYYY-MM-DD-<english-slug>.md` |

**Uma forma por classe, sem alternativa.** Quem decide a classe é a pasta; o
que a forma garante é que a mesma classe nunca tenha dois nomes legais — nome
que aceita duas formas não é achável por grep, e ser achável é para o que o
nome existe. O **token de fase** é `<PREFIXO>-F`, com `<PREFIXO>` casando
`[A-Z][A-Z0-9]*`: um repositório que cita as próprias fases como `<PREFIXO>-F09`
nomeia a nota `<PREFIXO>-F09-<english-slug>.md`. Quem declara o prefixo, uma vez,
é a nota da cadeia de derivação; repositório que não declarou prefixo não
escreve nota `feature`. Fixar aqui o prefixo de um repositório proibiria a
classe `feature` em todos os outros.

**A nota da cadeia de derivação tem nome fixo:** `ADR-NN-derivation-chain.md`,
classe `process`, uma por repositório. É o único nome de nota que este contrato
prende, e a razão é o localizador: quem chega sem contexto precisa achá-la, não
existe índice, e o nome é o que sobra. O que ela declara está na seção "Cadeia
de derivação".

**Largura do número.** O número usa **a mesma largura com que o identificador é
citado no texto do projeto** — é isso que torna `ADR-11` localizável por grep, e
é por isso que `ADR-011` no arquivo, com `ADR-11` no texto, quebra a regra em
vez de cumpri-la. Alargar depois exige renomear o conjunto inteiro de uma vez.

**Congelamento é fato, não promessa.** Nota em `archived/` ou `rejected/` tem
uma linha `<sha256>  <caminho>` em `docs/notes/FROZEN.sha256`. Quem move a nota
para lá acrescenta a linha no mesmo PR; o manifesto só cresce, e o
`notes-freeze` recompara todo hash. **"Só cresce" não tem exceção**, e não
precisa ter: as duas pastas são terminais (regra de derivação, abaixo), então
nenhum arquivo sai delas e nenhuma linha precisa sair do manifesto.

Os artefatos da cadeia têm caminho canônico próprio, e quem os declara é a nota
da cadeia; os de uma cadeia de produto estão listados, com dono e formato, em
"Formato mínimo por artefato".

## Cabeçalho obrigatório

Todo artefato começa com este bloco, entre as cercas `---`, que são a forma
única — **cabeçalho sem cercas não é cabeçalho.** O `notes-tree` lê `status:` só
de dentro das cercas: linha solta não é status, e artefato sem cabeçalho não tem
de onde ser derivado. Quem não tem o seu ganha na migração, e até ela rodar vale
a cláusula de intervalo do começo deste contrato — sem ela, esta frase e a regra
de derivação abaixo recusariam juntas todo pré-contrato que `main` carregue.

```markdown
---
status: draft | in-review | approved | rejected | in-progress | done | superseded
owner: <nome do agente>
depends_on: <caminho do artefato pai, ou "-">
---
```

Não há campo de data nem de aprovação. **O git responde os dois** — quando cada
linha mudou, quem a escreveu, em que merge entrou — e campo que duplica o git é
um git pior: um registro paralelo que envelhece sozinho e que ninguém recompara.
O que fica no cabeçalho é o que o git não responde.

**O `status:` é a declaração do autor sobre a maturidade do conteúdo — quão
pronto ele diz que aquele texto está —, e nada além.** Não é aprovação:
aprovação é o merge, e rótulo escrito numa branch não concede nenhuma. Não é
derivabilidade: quem responde isso é a regra de derivação, abaixo, que lê o
campo **junto com onde a cópia mora** e chega a respostas opostas para o mesmo
valor — `in-review` na base recusa, `in-review` no diff passa. Um campo que
respondesse "serve para derivar" teria de mudar de valor conforme quem pergunta.

A pasta responde outra coisa: "isto descreve código que existe?". São dois
eixos, nenhum dos dois é aprovação, e o `notes-tree` cruza os dois:

| Pasta | `status:` legais |
|---|---|
| `proposed/` | `draft`, `in-review`, `approved` |
| `implemented/` | `approved`, `in-review` |
| `archived/` | `superseded` |
| `rejected/` | `rejected` |

`in-progress` e `done` são exclusivos de story (ciclo de build abaixo) e nunca
aparecem em nota.

**Derive do pai que o review vai ver — e você não precisa de shell para isso.**

**O texto do pai você lê no disco.** A árvore de trabalho da sua branch **é** a
cópia que o review vai ver: o diff do PR é exatamente ela contra a base. Abrir o
arquivo é o ato inteiro, e nenhum comando entra aqui.

**O veredito sobre o pai é do `notes-tree`, e não seu.** "A base carrega este
pai? com que `status:`?" é fato sobre o repositório, e um agente que prometesse
consultá-lo antes de escrever estaria sustentando a invariante por promessa —
que é o que este contrato inteiro existe para não fazer. Metade dos agentes de um
squad pode não ter shell. O gate tem, sempre.

A forma que o gate cobra, e que você precisa conhecer para não escrever o que
vai ficar vermelho:

- **A base tem o pai** — a cópia da base decide, e ela tem de dizer
  `status: approved` no cabeçalho. Tocar o arquivo no seu PR não muda essa
  resposta, e movê-lo de pasta também não: a base guarda o veredito que já foi
  dado, e promover no seu diff um pai que a base carrega sem aprovar é lavar uma
  recusa, não obter uma aprovação.
- **A base não tem o pai** — sob nome nenhum. Ele nasce neste PR, chega ao review
  colado no filho, e o merge aprova os dois no mesmo ato. Deriva-se dele como ele
  está no PR, **e a cópia dele no diff não pode dizer `draft` nem `rejected`**.
  Não é o rótulo autorizando: a autoridade vem de o pai estar no diff, onde o
  revisor o lê. É que o rótulo **confessa** — quem escreve `draft` declara que o
  texto não está pronto, e derivar dele contradiz o próprio autor. É a única
  leitura de rótulo de branch que este contrato faz, e ela só recusa; nunca
  concede.

**A identidade da nota é o nome do arquivo, não o caminho.** Este contrato manda
mover nota de pasta, porque o ciclo de vida mora no caminho; se a pergunta fosse
indexada por caminho, um `git mv` sancionado trocaria "a base tem o pai" por "a
base não tem o pai" sem que nada além da pasta mudasse, e lavaria uma recusa. O
gate procura o **nome** sob `docs/notes/**` na base: um resultado é o pai, esteja
em que pasta estiver; nenhum resultado é pai nascido no PR; mais de um resultado
é **vermelho**, pedindo que se desfaça a colisão de nome.

**Nota que a base carrega não desaparece da árvore**, e é isto que faz o nome
servir de identidade. Nota sai de circulação indo para `archived/` ou
`rejected/` **com o nome intacto**, nunca sendo apagada nem renomeada; trocar o
conteúdo de uma nota por outro é supersessão, e supersessão escreve uma nota
**nova**, com nome novo, e arquiva a antiga como ela é — nenhum dos dois nomes
some. O `notes-tree` recusa o diff em que um nome que a base carrega sob
`docs/notes/**` deixe de existir na árvore.

**`archived/` e `rejected/` são terminais**, e esta é a mesma pergunta com uma
comparação a mais: nome que a base carrega numa das duas fica no caminho em que
está. Não sai por supersessão — ela troca a nota que **vale** por outra, e
nenhuma das duas vale —, e não sai por nenhum outro caminho. Sair de circulação
é o último movimento de uma nota; depois dele o que muda de ideia é uma nota
**nova**. O `notes-tree` recusa o diff em que esse nome apareça em outro
caminho, ou deixe de aparecer.

**Mudar de ideia sobre uma proposta recusada é escrever nota nova que a cita**,
por link relativo — que o gate resolve —, dizendo o que mudou desde a recusa. A
recusada fica onde está: ela perdeu, e continua tendo perdido, e é isso que faz
a recusa ser registro em vez de estado temporário. **O `depends_on:` dessa nota
nova é o pai da recusada, e não a recusada** — apontar para ela é vermelho nos
dois ramos abaixo, porque `rejected` não é `approved` na base e é recusa
explícita no diff; e `-` é reservado ao pai que não é arquivo do repositório
(abaixo). A nota nova responde à mesma pergunta que a recusada respondia, e é
dessa pergunta que ela deriva; se aquele pai era externo, ela leva `-` pelo
motivo real. A recusada entra no corpo, por link, como a tentativa anterior. Tirá-la de `rejected/` seria
o único movimento cujo diff é indistinguível do `git mv` de ciclo de vida que
este contrato torna rotineiro — `rename from`, `rename to`, e a linha de
`status:` —, e defesa que depende de o revisor ler a pasta de origem em todo PR
é vigilância proporcional ao volume.

**A invariante é sobre nomes, não sobre notas, e o limite dela fica escrito:**
ela garante que a identidade não some; não garante que o conteúdo de uma nota
não reapareça sob outro nome. Escrever o texto de uma nota recusada sob nome
novo e derivar dali **passa em todos os gates** — e é o mesmo diff da reproposta
legítima do parágrafo acima. As duas são indistinguíveis por forma, e o que as
separa é se o conteúdo merece voltar, que é juízo: **quem decide é o review**,
com a recusada parada em `rejected/` para ser comparada. Fechar isso por gate
exigiria comparar conteúdo, e comparação de conteúdo é similaridade com limiar,
que é exatamente o que a identidade por nome existe para não precisar.

**`depends_on: -` é o pai que não é arquivo do repositório** — o brief do
Founder, uma conversa, uma fonte externa. Não há cópia na base nem no diff, o
gate não tem o que resolver, e quem confere que o derivado é fiel ao pai é o
review. É o caso da nota da cadeia de derivação por construção, e o de qualquer
nota cujo pai o Founder deu de viva voz. O que `-` **não** é: rota de fuga para
pai que existe no repositório — a nota cita a fonte no corpo, e um `-` que
contradiga a citação é o que o review vê.

**"A base"** é o commit contra o qual o PR é medido — o mesmo que o review vê do
outro lado do diff, e o mesmo que os outros gates usam. Não é o tip do branch
principal: as duas divergem assim que ele anda depois do ponto de ramificação, e
a base vence porque é contra ela que o review lê. O preço é que um veredito
registrado depois do ponto de ramificação não é visto por este PR, e quem o paga
é a configuração, não o agente: `require branches to be up to date before
merging`, junto dos required status checks (abaixo).

E "diz `status: approved`" significa a linha entre as cercas `---` do cabeçalho:
linha solta não é status (acima), e a única exceção é a do intervalo de
migração, declarada uma vez no começo deste contrato.

**O que a regra recusa é derivar de texto que nenhum review vai ver** — o que
vive só na sua árvore de trabalho e não entra no diff. Esse é o caso inteiro, e
é o único que sobra: sob "a aprovação é o merge", o PR é revisado como unidade,
e pai e filho no mesmo PR chegam ao revisor juntos. O rótulo da sua cópia
continua não **concedendo** nada — a autoridade do pai que nasce no PR vem de
ele estar no diff, nunca de ele dizer `approved` numa branch. A única coisa que
esse rótulo faz é recusar, quando diz `draft` ou `rejected`.

**A cópia na sua árvore não entra na primeira pergunta**, e é isso que mantém a
regra compatível com o trabalho normal. O Jakiro escreve `status: in-progress` e
anexa `## Dev Log` na mesma story de que deriva o código; o PR que muda pai e
filho junto é o caso comum. Nos dois a sua cópia divergiu da da base, e nenhum
dos dois é violação.

**O pai criado no mesmo PR é caso normal, não bootstrap.** Uma cadeia de cinco
estágios em que cada transição esperasse o merge do pai cobraria quatro merges
sequenciais para ir do primeiro artefato ao último, e um repositório novo não
teria como escrever o segundo arquivo. A segunda pergunta dissolve os dois casos
de uma vez, sem isenção nomeada — e isenção nomeada é o que já falhou três vezes
na decisão que gerou esta regra.

**O pai é aquele de quem se deriva, tenha ele cabeçalho ou não.** Onde há
cabeçalho, é o que o `depends_on:` declara. Onde não há — código, prompt de
agente, este contrato, tudo o que cai na linha 6 da escada —, é a nota que o
trabalho cita como fonte, e a mesma pergunta vale para ela.

**O registro vivo não responde a esta regra.** Ele não carrega conteúdo
aprovado: é a fotografia do estado de agora, e "agora", para quem está dentro de
um PR, inclui esse PR. Tirar um nome do glossário ou uma costura do mapa de
testes lê a cópia da sua árvore — ler a da base devolveria a fotografia anterior
à sua própria mudança. Ele nunca é o pai de que se deriva: dele saem nomes e
costuras, não requisitos.

**A aprovação é o merge, e não se escreve.** Nenhum agente a registra num campo
— ela acontece quando o PR entra em `main`. É isso que tira "agente nenhum
aprova o próprio artefato" da promessa: **quem merge é quem aprova**, e agente
nenhum executa merge. Quem é essa pessoa varia por repositório e este contrato
não diz — o que ele prende é que não é um agente. Os cinco gates de repositório entram nessa garantia quando a
proteção de `main` os tornar obrigatórios (abaixo); até lá, o que sustenta a
frase é o merge sozinho, e ele já basta para ela.

**Decisão registrada permanece; o que muda é qual nota vale.** A nota nova leva
`supersedes:`, a substituída leva `superseded_by:` e vai para `archived/`, e a
linha dela entra em `FROZEN.sha256` no mesmo PR. Os dois campos são mútuos e
apontam para caminhos que resolvem — assim o grep acha as duas pontas. A
supersessão é o único ato que este contrato nomeia, porque é o único que o git
não responde sozinho: "esta nota foi trocada por aquela" não está no `git log`.
Registro vivo e artefato da cadeia não a têm — congelar uma fotografia a
tornaria falsa, e fora da árvore não há `archived/` para onde ir.

**A supersessão tem alcance: ela troca a nota que vale por outra, e o que a base
carrega em `rejected/` ou `archived/` já não vale — não há o que trocar.** O
`notes-tree` recusa o diff que dê `superseded_by:` a uma nota que a base carrega
nesses dois ciclos de vida. Sem o alcance, supersessão vira a rota limpa para
**lavar uma recusa**: move-se a nota recusada para `archived/`, escreve-se o
conteúdo dela sob nome novo, e deriva-se do nome novo, que a base não carrega. E
o review não pega, porque o diff dessa lavagem é byte a byte o do ato que este
contrato manda praticar.

**A mesma lavagem tem uma segunda rota, e ela morre noutra regra — as duas ficam
nomeadas, porque porta que se declara fechada nomeia quem a fecha.** A rota de
um PR é a de cima, e quem a fecha é o alcance. A rota de dois PRs é tirar a nota
de `rejected/` num PR e supersedê-la no seguinte, quando a base já a carrega em
`proposed/` — e o segundo PR é legítimo por construção, porque nada o distingue
de superseder qualquer outra nota de `proposed/`. Quem a fecha é a
**terminalidade** de `archived/` e `rejected/` (acima), no primeiro PR. Nenhuma
das duas é fechada pelo `notes-freeze`: ele recusaria o PR de desrejeição por
aritmética de manifesto, e defesa que depende do efeito colateral de outra regra
reabre no dia em que essa outra regra for consertada.

Stories levam um campo a mais:

```markdown
blocked_by: STORY-003, STORY-007   # ou "-" quando nada trava
```

Liste apenas bloqueio **genuíno e direto**: a story não pode *começar* sem
aquela outra pronta. Nada de dependência transitiva (se B trava C e C trava D,
D lista só C), nada de "seria melhor depois". Dependência descrita em prosa no
corpo da story é invisível para quem sequencia — se trava, é header.

## Cadeia de derivação

**Cada repositório declara a sua cadeia, uma vez, na nota
`ADR-NN-derivation-chain.md` de classe `process`.** Não existe cadeia
universal: a de um produto e a de um runtime produzem artefatos diferentes, e
aplicar a errada proíbe trabalho que já está certo. Antes de escrever qualquer
artefato, leia essa nota — `ls docs/notes/*/process/` a mostra pelo nome, sem
índice e sem perguntar a ninguém. Ela declara quatro coisas: os estágios da
cadeia, com o caminho canônico e o pai de cada um; o prefixo de fase; e **os
caminhos que a árvore de notas substituiu neste repositório**, que é o que a
linha 2 da escada recusa criar. Não declara o conteúdo da árvore, porque listar
notas seria índice.

**Ela é a primeira nota do repositório**, e a única cujo `depends_on: -` é
estrutural: o pai dela é o brief do Founder, e não poderia ser outra coisa.
Outras notas levam `-` quando o pai delas também não é arquivo do repositório
(regra de derivação, acima); o que nenhuma outra tem é a impossibilidade. Enquanto a árvore está vazia não há cadeia
declarada e não há o que ler, e escrevê-la é o primeiro trabalho — é assim que
"leia a nota da cadeia antes de escrever" tem como ser cumprida no primeiro
artefato de um repositório novo. Árvore não vazia sem ela é vermelho no
`notes-tree`.

O que vale em qualquer cadeia:

- `depends_on:` aponta para o pai que a cadeia declara, e esse pai é lido
  inteiro antes de o filho ser escrito — na cópia da sua árvore de trabalho, que
  é a que o review vai ver (regra de derivação, acima).
- Cada seção que você criar rastreia para algo no pai.
- Pai declarado que não existe é bloqueio: reporte, não invente o conteúdo do
  pai.
- Falta no pai é `## Open Questions`, nunca suposição sua.

A cadeia de produto, que é a que produz PRD, EPIC, stories, DESIGN e INFRA:

```
docs/PRD.md -> docs/EPIC.md -> docs/stories/STORY-*.md -> nota architecture + docs/DESIGN.md -> código
                                                          nota architecture -> docs/INFRA.md
```

Organize `## Open Questions` por **fronteira**, não em lista achatada — o
Invoker pergunta ao Founder na ordem que você deixar:

```markdown
### Blocking now
Respondíveis já, sem depender de outra resposta desta lista. Uma linha por
pergunta: o que muda conforme a resposta + sua recomendação.

### Waiting on an answer above
Cada uma indica de qual pergunta depende.

### Not blocking this stage
Ficam para quem vier depois — diga qual agente elas travam.
```

Pergunta cuja resposta existe no repositório, no ambiente ou no que você pode
executar não entra aqui: descubra você (princípio AI FIRST). Esta seção é só
para o que mora exclusivamente na cabeça do Founder — preferência, prioridade,
restrição de negócio.

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
não por simetria: é dela que os `depends_on` dos filhos derivam.

Seções opcionais entram só quando pagam a própria linha:
`## Alternativas descartadas` quando a rejeição é não óbvia e alguém vai propor
de novo em seis meses — e ela leva o **gatilho** que a reabriria, escrito como
**condição e sem remédio**: gatilho que já nomeia o conserto decide o desenho
junto com o disparo, e a medição que deveria testá-lo vira formalidade;
`## Consequências` quando o efeito colateral surpreende. Alternativa que perdeu
*dentro* de uma decisão mora junto de quem a venceu; proposta que morreu sem
haver decisão vencedora vai inteira para `rejected/`, e **quem a move é o
`owner:` dela**, no PR em que ela morre — quem recusa é o review, e o registro da
recusa é o merge desse PR. Nada obriga a entrada: o limite está escrito em
"O que não tem gate de repositório", abaixo.

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
essa: lição descreve defeito já pago, logo nasce em `implemented/`, e varrer os
outros ciclos devolveria conselho congelado ou rejeitado. Perdeu tempo com algo
que outro vai tropeçar depois? A lição vira nota de `bug-fix`, com o laço junto
— sessão de debug perdida sem nota é desperdício em dobro.

### Registros vivos

- **`docs/CONTEXT.md`** — dono: Lina. O glossário do domínio, e **nada além
  disso**. Um termo, a definição em 1-2 frases, e os sinônimos que ficam
  proibidos:

  ```markdown
  ## Linguagem

  **Member** (membro):
  Uma Account que entrou num Channel. É papel, não entidade separada.
  _Avoid_: participante, integrante, subscriber
  ```

  O glossário é a **ponte** entre as duas línguas do projeto: o termo canônico
  em inglês, porque é ele que vira `board.controller.ts` e a tabela `boards`; o
  português entre parênteses, porque é assim que o Founder fala. `_Avoid_` é o
  que o faz funcionar: quem ia escrever "participante" acha a palavra proibida
  e a substituição no mesmo lugar.

  Quatro regras:
  - **Defina o que a coisa é**, não o que ela faz. Uma ou duas frases.
  - **Só termo específico deste domínio.** `timeout`, `cache` e `retry` são
    conceitos gerais de programação e ficam de fora.
  - **Zero implementação.** Nome de tabela, rota e biblioteca pertencem às
    notas de `architecture`; glossário que vira spec deixa de ser consultável.
  - **Registre no instante em que o termo se resolve**, nunca em lote — lote
    não acontece. Quem não é o dono entrega o verbete pronto no handoff.

  Leia o glossário antes de escrever artefato ou código, e **tire dele os
  nomes**: variável, função, arquivo, tabela e rota usam o termo canônico em
  inglês; a prosa usa o português. É assim que agentes sem contexto
  compartilhado convergem. O arquivo nasce quando o primeiro termo se resolve;
  glossário escrito antes da primeira decisão é chute com cara de autoridade.
- **`docs/TEST-SEAMS.md`** — dono: Rubick. O mapa de onde cada classe de
  critério se prova para valer: a costura de teste, o que ela cobre, o runner,
  e o que deliberadamente fica de fora. Cresce a cada classe nova de critério,
  e por isso não é nota — nota se decide uma vez e se substitui. Decisão
  *individual* de costura, quando é dura de reverter, é nota de `architecture`,
  e o mapa aponta para ela.

Um repositório pode ter outros registros vivos — a visão consolidada da
arquitetura é o caso típico. Todos respondem à mesma regra: descrevem o estado
de agora, ficam em `docs/` fora de `docs/notes/`, não são estágio da cadeia, e
não têm data no nome nem ciclo de vida no caminho.

### Artefatos da cadeia

Existem no repositório cuja nota da cadeia de derivação os declara. Numa cadeia
de produto:

- **`docs/PRD.md`** — dono: Lina. Problema, Usuário-alvo, Escopo (fora do
  escopo explícito), Requisitos funcionais numerados (`RF-01`), Métricas de
  sucesso.
- **`docs/EPIC.md`** — dono: Lion. Lista de épicos (`EP-01`), cada um com
  objetivo, RFs cobertos e critério de pronto.
- **`docs/stories/STORY-NNN-<english-slug>.md`** — dono: Lion, que a define; as
  duas seções de apêndice têm dono próprio (ciclo de build abaixo).
  `Como <papel>, quero <ação>, para <valor>`, épico de origem, critérios de
  aceite em Gherkin, estimativa relativa.
- **`docs/DESIGN.md`** — dono: Zeus. Fluxos de tela, estados
  (vazio/carregando/erro), tokens de design, e acessibilidade mínima por tela.
- **`docs/INFRA.md`** — dono: Disruptor, deriva das notas de `architecture`. O
  que existe (serviços, ids, domínios), o que acontece no deploy, variáveis de
  ambiente (nomes e origem, nunca valores) e como subir o ambiente do zero.

## Mandato de escrita e os cinco gates de repositório

**Todo diff que toca qualquer coisa fora de `docs/**` adiciona ou modifica ao
menos uma nota sob `docs/notes/**`, no mesmo PR.** Sem isenção declarável —
isenção declarável é exatamente a promessa que o gate de repositório existe
para eliminar. O custo real é um PR trivial pagar um parágrafo, e ele é
deliberado.

Cinco gates de repositório sustentam o que este contrato declara, e o
repositório que o carrega deve os cinco. Cada um se identifica pelo nome, e o
nome é o que aparece vermelho — é assim que quem quebrou um sabe o que quebrou.

| Gate de repositório | O que ele prova |
|---|---|
| `notes-tree` | classe e ciclo de vida no conjunto fechado; forma do nome e do `<english-slug>` por classe; recusa da **criação** nos caminhos da linha 2 da escada, medida contra a base do PR, índice incluído; cabeçalho entre cercas e status no conjunto; tabela status×pasta; data do nome não futura; `supersedes`/`superseded_by` mútuos e resolvíveis, e a supersessão não alcançando o que a base carrega em `rejected/` ou `archived/`; links entre notas resolvem; seções obrigatórias por classe; árvore não vazia tem exatamente uma nota da cadeia; nome que a base carrega não desaparece da árvore, e o que ela carrega em `archived/` ou `rejected/` não muda de caminho (terminalidade); **a regra de derivação** — pai que a base carrega diz `approved`, pai que nasce no PR não diz `draft` nem `rejected`, nome do pai ambíguo na base é vermelho; `FROZEN.sha256` fora da conta |
| `notes-freeze` | `FROZEN.sha256` cobre `archived/` e `rejected/`; todo hash bate; o manifesto só cresce contra a base do PR |
| `notes-truth` | toda declaração de nota `implemented/` e de registro vivo resolve no código |
| `notes-mandate` | diff fora de `docs/**` traz nota no mesmo PR |
| `notes-authority` | o `owner:` da nota podia escrever aquela classe, decidido pelo motor real da matriz |

**O repositório que carrega este contrato protege `main`, com os cinco como
required status checks e com `require branches to be up to date before
merging`.** É configuração do GitHub, dono: Disruptor, e a ordem é: os cinco
gates existem, depois a proteção os exige. Só a partir daí "nada entra em `main`
sem os cinco verdes" é fato — antes, é intenção. A segunda opção não é enfeite:
os gates julgam contra a base do PR, e sem ela um veredito registrado depois do
ponto de ramificação passa despercebido.

**A regra de derivação é do gate, e o que sobra dela é do review — nada dela é
promessa de agente.** O `notes-tree` confere o que é fato de arquivo: o pai
existe na base e com que `status:`, o pai nascido no PR não diz `draft` nem
`rejected`, o nome do pai não é ambíguo na base. Três coisas ficam fora, e são
todas leitura, não forma: se o `depends_on:` aponta para o pai **certo**; se o
texto do filho depende do pedaço do pai que o PR mudou; e a derivação de quem
não tem `depends_on:` — código, prompt de agente, este contrato —, onde não há
campo a ler. Quem confere as três é o revisor.

**Uma regra que exigisse do agente rodar um comando não estaria sustentada.** Um
squad pode ter agentes sem shell, e um agente que *pode* rodar o comando não é um
agente que *rodou* — é a invariante sustentada por promessa com outro nome. Por
isso a leitura do pai é do disco (a sua árvore é a cópia que o review vai ver) e
a consulta à base é do CI. Você descobre no vermelho, não antes; vale para os
cinco gates e é o preço.

**Enquanto a proteção não estiver no lugar, leia a base assim:** `status:
approved` numa cópia da base diz que quem aprova mergeou aquele conteúdo — não
que os cinco gates o aprovaram, e num repositório que adotou este contrato
depois de já ter história, nem que eles chegaram a rodar sobre ele. A regra vale
inteira do mesmo jeito, porque o que ela sempre pediu foi conteúdo que um review
vai ver. Sem os checks, `main` é a branch que só quem aprova merge; não a branch
que os gates filtram.

A tabela nomeia invariante, não arquivo. Onde cada um mora, como se chama o
teste e qual runner o executa é do repositório — o que este contrato prende é o
nome e o que ele deve provar, que é o que precisa significar a mesma coisa nos
repositórios que o carregam. Os que precisam da base do PR **falham** quando
não conseguem computá-la, e nunca pulam verde.

**Declarar é fazer link, não pôr entre crases.** Em nota `implemented/` e em
registro vivo, afirmar que um arquivo existe é fazer link relativo para ele — e
o símbolo só é afirmado quando o token entre crases está colado no link:
`` [`createSandboxPolicy`](../../../caminho/para/policy.js) ``. Token entre
crases **sem link não afirma nada**: é tipografia, e mais das vezes é
vocabulário — `allow`, `deny`, `read-only` são valores de domínio, não
símbolos. O buraco simétrico fecha por lint: token com `/` e extensão de código
escrito em prosa, fora de link, falha pedindo que vire link.

O `notes-mandate` prova que uma nota foi tocada, não que valia a pena tocá-la.
Quem julga valor é o review — gate de repositório que tentasse medir
sinceridade seria o próximo rótulo a se descolar do fato.

### O que não tem gate de repositório, e é para ficar escrito

Os cinco leem o conteúdo de `docs/`. **Nenhum deles lê o conteúdo deste
arquivo**, que é a linha 6 da escada junto com os prompts de agente, as demais
skills e o README do plugin. Um caminho errado escrito aqui não fica vermelho
em lugar nenhum: vira o caminho errado que todo agente passa a seguir, e o erro
só aparece quando alguém tropeça nele.

Também não tem gate o `owner:` fora da árvore de notas. O `notes-authority`
decide `owner:` contra a classe, e classe só nota tem: dono de registro vivo e
de artefato da cadeia é conferido no review, contra a matriz.

E não tem gate a mensagem de commit: a forma acima é convenção verificada por
quem revisa. Gate de commit message custaria mais do que o defeito que ele pega.

**E não tem gate a entrada em `rejected/`.** A terminalidade e o alcance da
supersessão trancam a **saída** de `archived/` e `rejected/`; nada obriga
ninguém a entrar. Dono da entrada é o `owner:` da nota, que produz o `git mv` no
PR em que a proposta morre; quem recusa é o review, e o registro da recusa é o
merge. **O preço fica escrito:** proposta que morreu e que ninguém moveu
continua em `proposed/` como se estivesse viva, e as duas trancas não valem
sobre ela — o sistema prende o que está na árvore, e recusa que ninguém
registrou é opinião, não veredito. **E o resíduo é maior do que "sem proteção
extra":** para a base essa nota vale, o alcance da supersessão não a alcança, e
o diff de superseder-lhe é byte a byte o do ato de ciclo de vida que este
contrato manda praticar — não há duplicata a ver. Não é tranca por apertar: **é
a rota de um PR reaberta inteira, e o que a fecha é o review**, o mesmo que
decide que a proposta morreu; quem quer a tranca move a nota para `rejected/`, e
esse é o ato inteiro. Um gate que cobrasse a entrada teria de saber que uma
proposta morreu, e isso é juízo do review sobre conteúdo.

O que **alcança** este arquivo é o mandato de escrita: editá-lo é diff fora de
`docs/**` e paga nota no mesmo PR, como qualquer outro. E o `notes-tree` cobra
da árvore real a forma que este contrato declara — então contrato e árvore
divergindo dá vermelho **na árvore**, nunca aqui. É meia cobertura: prende o
repositório à regra, não a regra ao fato.

## Ciclo de build da story

Depois de `approved`, a story ganha duas seções de apêndice, cada uma com dono
próprio — nenhum agente edita a seção do outro nem a definição do Lion:

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

`in-progress` é setado pelo Jakiro ao começar a implementar; `done` só pelo
Invoker, depois de veredito APROVADO do Keeper e PR aberto pelo Disruptor.

## Handoff

Ao terminar, retorne ao Invoker no máximo 15 linhas:

```
ARTEFATO: <caminho>
STATUS: <o status que ficou no cabeçalho>
FEZ: <2-4 bullets do que mudou>
BLOQUEIOS: <perguntas em aberto, ou "nenhum">
PROXIMO: <qual agente deveria agir agora, e por quê>
```

O conteúdo completo fica no arquivo. Não repita o artefato na resposta.
