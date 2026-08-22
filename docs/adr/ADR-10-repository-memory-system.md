---
status: in-review
owner: rubick
depends_on: -
---

# ADR-10 — Sistema de memória do repositório

## Contexto

O Founder quer o squad reconstruindo o próprio repositório. Isso torna a
memória do repositório uma dependência de execução, não documentação: o que
não estiver em disco, num formato que um agente sem contexto compartilhado
consiga achar e confiar, não existe.

**O enquadramento desta ADR inteira é a base deste PR** — o commit contra o qual
o review lê o diff. É o frame da regra de derivação (decisão 13), é o frame dos
gates que precisam de uma ref (decisão 9), e é o único que não vira sozinho
quando um PR irmão merge. **Ele vale para toda afirmação desta ADR sobre o
estado do repositório, diga a linha `main` ou não.** A versão anterior desta
declaração dizia "desta ADR inteira" na primeira frase e dava a regra operante
como "onde qualquer linha daqui diz `main`" na segunda — duas leituras que não
recusam as mesmas linhas, e a tabela abaixo caía justamente na folga entre elas.

Ele virou **dentro do review desta ADR**: um PR irmão mergeou durante a medição,
e com ele mudaram a contagem de arquivos de `docs/`, a de cabeçalhos entre
cercas e a existência de pelo menos um `status: approved` cercado. É a
regra desta ADR se provando contra ela mesma, e a consequência é de redação:
**onde uma contagem carregava peso normativo, ela sai e fica o critério.**

**A tabela abaixo não afirma estado, e é por isso que ela perdeu a coluna de
estado.** Ela nomeia a classe de defeito que cada artefato exibe; quantos
arquivos a exibem, e sob qual ref, é medição, e medição se roda, não se escreve.
A versão anterior tinha a coluna, e ela descrevia a árvore de trabalho enquanto
a declaração acima prendia a ADR à base — com um agravante de forma: a violação
tinha migrado de dígito para **quantificador** ("a maioria das specs"), que é
contagem escrita em palavras e envelhece igual.

**E a declaração acima passou a ser varrida contra o artefato inteiro, porque
declarar o enquadramento e não varrer é o mesmo defeito com um enquadramento por
cima.** A rodada
anterior registrou esta mesma classe — afirmação sobre `main` que o comando
desmentiu, mais abaixo nesta ADR — e consertou os três parágrafos que o review
citou, não a classe. O critério é mecânico: **todo caminho e toda contagem que
esta ADR cita ou resolvem contra a base, ou saem e fica o critério.** O que saiu
nesta varredura: a linha do glossário na tabela acima e as medições que o
citavam (ele não está na base); a terceira forma de cabeçalho em `docs/adr/`
(não há nenhuma entre cercas na base); a contagem de specs e a de entradas do
`docs/LESSONS.md`, em todo sítio em que apareciam; o `status:` que a migração
atribuía a cada ADR nominalmente; e as citações de commit usadas como prova de
argumento, que a base não alcança por construção. **Uma citação de commit fica**,
e é a do registro da medição que desmentiu "estão em `main`, mergeadas", na
decisão 13: ela existe justamente para afirmar que a base **não** carrega
aqueles arquivos, que é a única coisa que uma citação dessas pode provar daqui. Nenhum argumento caiu junto com as contagens —
os que dependiam delas já tinham o critério escrito ao lado, que é o que esta
regra vinha prometendo.

**Aquela varredura consertou os sítios que o review apontou e não chegou a zero
— terceira vez que se conserta a instância em vez da classe. Por isso ela deixa
de ser uma lista e passa a ser um comando**, que qualquer um reexecuta contra o
artefato inteiro:

```
BASE=$(git merge-base origin/main HEAD)
grep -oE '(docs|tests|agents|hooks|skills|commands|spectree-runtime)/[A-Za-z0-9._/-]+' \
  docs/adr/ADR-10-repository-memory-system.md \
| grep -vE 'docs/notes|notes-|TEST-SEAMS|ADR-NN|ADR-10-repository|docs/decisions' \
| sed 's:/$::' | sort -u \
| while read -r p; do git cat-file -e "$BASE:$p" 2>/dev/null || echo "NAO RESOLVE: $p"; done
```

**O filtro é a única lista que sobra, e ela não envelhece porque é de coisas que
esta ADR cria ou é, não de coisas que ela mede:** a árvore de notas, os cinco
gates, o mapa de costuras, o placeholder `ADR-NN`, o `docs/decisions/`
hipotético de outro repositório, e este próprio arquivo, que a base não carrega.
**Toda linha `NAO RESOLVE` é violação, com uma exceção de espécie:** o caminho
citado justamente para afirmar que a base **não** o carrega — a `RUNTIME-F04` da
decisão 13 e o `docs/adr/README.md` que a decisão 1 proíbe. Afirmar ausência é a
única coisa que uma citação dessas pode provar daqui, e é por isso que essas
duas ficam. **O que saiu nesta
rodada:** as seis citações do glossário — ele é registro vivo e
a base não o carrega, então a enumeração da decisão 10 item 5 virou critério e
as medições dele nas Consequências viraram uma declaração de não-mudança; a
contagem de testes que já existem — ela estava errada, e o conserto não é o
número certo, porque ele anda a cada teste novo e o que a linha precisa dizer é
o estilo; a contagem de laços da
semana; os três números de linha da matriz e dos dois testes, que o `grep` acha
sem eles; o caminho do adapter oficial, que é
`spectree-runtime/adapters/policy-document.js`; e a violação nominal do Founder
num arquivo que a base não carrega, cujo argumento já morava na última linha das
Consequências. **Os PRs #28 e #29 não saem: viram comando** (decisão 4) — quem
revisou esta ADR não pôde medi-los e reportou em vez de contornar, e afirmar sem
medir é a classe que esta ADR já pegou três vezes.

| Artefato | Classe de defeito |
|---|---|
| `docs/adr/` | Duas formas de cabeçalho vivas ao mesmo tempo: nenhuma, e cabeçalho sem as cercas `---` que o contrato exige. |
| `docs/LESSONS.md` | Escrita voluntária, num arquivo sem cabeçalho, sem ordem cobrada e sem gatilho de releitura cobrado. |
| `docs/spec/` | O README declara a cadeia de derivação real do repo (Brief -> Spec -> ADR -> PR), que não é a do contrato de artefatos. E nada governa o `status:` de uma spec: o contrato não diz que pergunta o campo responde, que é o defeito fechado na decisão 13. |
| `docs/architecture/` | Registro vivo inteiro de afirmações sobre o código, nenhuma verificada. |
| `skills/spectree-artifacts/SKILL.md` | Contrato que descreve artefatos canônicos que este repositório não tem, e cala sobre os que ele tem. |

Nenhum desses defeitos é falta de disciplina. Todos são invariantes
sustentadas por promessa: `superseded` está declarado no contrato e nunca
foi usado; "manter atual com o que shipou" não tem quem verifique;
"append-only" não tem quem prove. Este repositório inteiro é construído
sobre a regra oposta — invariante sustentada por disciplina não está
sustentada — e a memória é o único subsistema onde ela não foi aplicada.

O modelo de referência é `deepseek-ai/deepseek-harness` (MIT): 2.177 notas
em `{lifecycle}/{class}/`, escrita obrigatória por mudança, classe e
ciclo de vida como conjunto fechado em código, formato como gate, árvore
como índice, referências como links relativos verificáveis, arquivado
congelado. A instrução do Founder: usar a referência inteira e melhorar —
o ônus do argumento é para **excluir**, não para incluir.

**A segunda instrução do Founder, e ela é de fundação:** as regras deste
repositório passam a seguir as boas práticas do GitHub, **sem divergência**.
Dela sai a regra que governa as decisões 5, 13 e 14 — *o que o GitHub já
registra, o repositório não re-registra*. Quem aprovou, quando, em que commit,
sob qual PR: a plataforma guarda isso com identidade forte, e um campo escrito
à mão pode mentir onde um merge não pode. Duplicar a plataforma dentro do
arquivo é reimplementá-la, e pior.

O fato que a forçou é de forma, e não de contagem: a forma
`approved: <YYYY-MM-DD> (merge do PR #NN)`, fixada nas decisões 12 e 13, cobra
do arquivo um fato que já mora no git, e a única invariante que um gate saberia
verificar nela é se o campo concorda com o git. Campo cuja correção se define
como "bate com a plataforma" é a plataforma reescrita à mão, com a
possibilidade de mentir acrescentada. A decisão 13 decide campo a campo por
esse teste, e o veredito não depende de quantos cabeçalhos a forma reprovava.

Esta ADR não tem spec normativa porque decide processo, não contrato de
runtime (ver decisão 1). **Seu pai é o brief do Founder, e o cabeçalho passa a
dizer isso:** `depends_on: -`, o terceiro estado da decisão 13. Ele declarava
`docs/spec/README.md`, que por sua vez declara esta ADR como pai — um ciclo, e a
ponta a quebrar é esta, porque o brief realmente não é arquivo do repositório e
o `README.md` realmente deriva daqui. Duas respostas do brief
sustentam decisões daqui: o merge do PR da fase conta como aprovação (decisões 5
e 13), e o mandato de escrita é estrito, sem isenção (decisão 4). A prosa que
registrava isso morava no campo `approved:` do cabeçalho; o campo saiu com a
decisão 13, e a razão desceu para o corpo, que é onde razão mora. *Quando* o
Founder aprovou é pergunta do `git log`.

## Decisões

### 1. Uma árvore só, com ciclo de vida no caminho e classe fechada

```
docs/notes/{proposed|implemented|archived|rejected}/{class}/
class: feature · architecture · bug-fix · process · simplification · testing
```

`docs/adr/`, `docs/spec/` e `docs/LESSONS.md` deixam de existir como
caminhos: viram classes dentro da árvore (`architecture`, `feature`,
`bug-fix`). Ciclo de vida e classe são conjuntos fechados em código;
pasta fora do conjunto é recusada por gate.

O ciclo de vida mora no **caminho**, não só no cabeçalho, porque a pasta é
um fato do filesystem e a linha `status:` é um rótulo. É a mesma regra que
o runtime já aplica em três lugares (LESSONS de 2026-08-20 e 2026-08-21):
propriedade física se deriva do disco, nunca se acredita no rótulo. Um
`git mv` entre pastas aparece no diff como movimento — é barulhento, que é
o ponto; uma linha de status trocada lê como inócua.

Cabeçalho e pasta convivem e são cruzados por gate, mas não são o mesmo
eixo. A pasta responde "isto descreve código que existe?"; o `status:` responde
"quão pronto o autor diz que este texto está?" — **a pergunta do campo é decidida
na decisão 13, e esta linha não a responde por conta própria**, que é o defeito
que essas duas respostas divergirem produziu. Para o pai que a base já carrega, a
cópia do status que vale é a de lá, nunca a da sua branch (decisão 13). As
combinações legais:

| Pasta | `status:` legais |
|---|---|
| `proposed/` | `draft`, `in-review`, `approved` |
| `implemented/` | `approved`, `in-review` |
| `archived/` | `superseded` |
| `rejected/` | `rejected` |

`in-progress` e `done` continuam exclusivos de story e não aparecem em
nota. `rejected` entra no conjunto de status.

`archived/` é o destino de nota superseded — e com isso a regra "decisão
registrada permanece" vira física (decisão 6) em vez de convenção que
nunca foi exercida. `rejected/` guarda a proposta que perdeu antes de
existir decisão vencedora; a alternativa que perdeu **dentro** de uma
decisão continua em `## Alternativas descartadas`, junto de quem a venceu.

**`archived/` e `rejected/` são terminais: nome que a base carrega numa das duas
fica no caminho em que está.** Não sai por supersessão — a supersessão troca a
nota que vale por outra, e nenhuma das duas vale (decisão 5) — e não sai por
nenhum outro caminho. O `notes-tree` recusa o diff em que um nome que a base
carrega sob `archived/` ou `rejected/` apareça em outro caminho, ou deixe de
aparecer. É a mesma pergunta da invariante de não-desaparecimento (decisão 13,
sétimo corte), indexada pelo mesmo nome e medida contra a mesma base, comparando
o caminho além da existência.

A versão anterior desta linha abria uma saída — "sair de `rejected/` num PR
próprio, que o merge aprova" — e ela custou uma rodada. Duas medições a mataram.
**A primeira: o ato não passava em gate nenhum.** Os quatro desfechos possíveis
do `FROZEN.sha256` num PR de desrejeição colidem todos com a decisão 6 — a linha
intacta aponta para caminho que não resolve; a linha removida encolhe o
manifesto; a linha reescrita para o caminho novo faz as duas coisas; manter a
antiga e somar a nova deixa a antiga sem resolver. O texto sancionava em três
sítios um ato que o gate 2 proibia. **A segunda, e é a que decide: a saída não
era visível, e a visibilidade era a razão inteira de preferi-la à
terminalidade.** Medido com `git diff -M`, o diff da desrejeição é
`rename from`/`rename to` mais a troca do `status:` — byte a byte a forma do
`proposed/` -> `implemented/` que esta mesma decisão torna rotineiro e
obrigatório. A única diferença é a pasta de origem, e ler pasta de origem em
todo PR de ciclo de vida é vigilância proporcional ao volume, que é como esta
ADR define invariante sustentada por promessa.

**E a terminalidade tranca a saída de uma sala em que ninguém é obrigado a
entrar. Fica decidido que é assim mesmo, e o limite fica escrito.** Nada obriga
uma proposta que morreu a ir para `rejected/`: o gate só alcança o que está na
árvore, e recusa que ninguém registrou não é veredito — é opinião, e opinião não
tem o que congelar. **Quem produz o movimento é o `owner:` da nota**, no PR em
que a proposta morre, como qualquer outro movimento de ciclo de vida; quem
recusa é o review, e o registro da recusa é o merge desse PR. **Não há gate, e
não deve haver:** um gate que cobrasse a entrada teria de saber que uma proposta
morreu, e "morreu" é juízo do review sobre conteúdo, que é a mesma comparação de
conteúdo que a decisão 5 recusa em toda a família. O preço fica escrito junto
(decisão 11 item 9): **o sistema não prende recusa não registrada, e as duas
trancas — terminalidade e alcance — só valem depois de alguém entrar na sala.**
Declarar isso é honesto; deixá-lo implícito é a promessa que estas duas regras
existem para não fazer.

**E o resíduo é maior do que "sem proteção extra", que é o que um leitor
apressado conclui daí.** A proposta que morreu e ficou em `proposed/` é, para a
base, uma nota que vale — logo o alcance da decisão 5 não a alcança, e
superseder-lhe é legal. Para essa classe a frase da decisão 5 continua verdadeira
inteira: **o diff dessa lavagem é byte a byte o do ato que o contrato manda
praticar**, e não há duplicata a ver. Não é uma tranca que falta apertar: **é a
rota de um PR reaberta por completo, e o que a fecha é o review** — o mesmo que
decide que a proposta morreu. Quem quiser a tranca move a nota para `rejected/`,
que é o ato inteiro.

**Mudar de ideia sobre uma proposta recusada continua possível, e a forma é a
que a árvore já usava para todo o resto: nota nova.** Ela cita a recusada por
link relativo — que o `notes-tree` resolve —, diz o que mudou desde a recusa, e
chega ao review com a recusa intacta do outro lado do link. A recusada não vira
`superseded`, porque não foi trocada: perdeu, e continua tendo perdido. É a
mesma forma de `archived/`, para onde ninguém nunca propôs um caminho de volta —
a assimetria entre as duas pastas é que era a anomalia, não a terminalidade.

**E o `depends_on:` dessa nota nova é o pai da proposta recusada, não a
recusada.** As duas leituras óbvias são vermelhas, e é por isso que a linha
precisa existir. Apontar para a recusada é vermelho nos **dois** ramos da regra
de derivação: se a base a carrega, ela diz `status: rejected`, e o ramo 1 exige
`approved`; se ela nasce no mesmo PR, o ramo 2 recusa exatamente `draft` e
`rejected`. E `-` é reservado ao pai que não é arquivo do repositório (decisão
13, terceiro estado), e usá-lo aqui seria a rota de fuga que aquele estado
nomeia como o que ele não é. Sobra o pai de quem a recusada derivava — a nota
nova é outra tentativa de responder à **mesma** pergunta, e é dessa pergunta que
ela deriva; se aquele pai era externo, a nota nova também leva `-`, e aí o `-` é
o estado real e não a fuga. A recusada entra no corpo, por link, como a
tentativa anterior.

**Não existe índice.** Sem `INDEX.md`, sem `docs/adr/README.md`. A árvore
é o índice, e o gate recusa a criação de um.

### 2. O nome é o token pelo qual o repositório já cita a nota

| Classe | Nome do arquivo |
|---|---|
| `architecture`, `process` | `ADR-NN-<english-slug>.md` |
| `feature` | `<PREFIXO>-FNN-<english-slug>.md` |
| `bug-fix`, `simplification`, `testing` | `YYYY-MM-DD-<english-slug>.md` |

O `<PREFIXO>` é o token de fase que **cada repositório declara** na nota da
cadeia, com a sintaxe da decisão 12 item 3; neste repositório ele é `RUNTIME`,
e `RUNTIME-F09-...` é instância, não regra. A tabela citava a instância como se
fosse a forma, e com isso esta ADR dava duas respostas para a mesma pergunta.

A referência usa data em tudo porque não tem numeração de fase. Nós temos:
`ADR-09` e `F9` são o vocabulário que o Founder, os reviews, os `depends_on`
e os comentários de código já falam. Trocar por data custaria esse
vocabulário e compraria uniformidade. Onde não há token citável, a data
manda — ela não exige coordenação entre agentes paralelos, que é o custo
real do número sequencial.

Slug em inglês, prosa em português, mesma convenção de nomes do repositório.

**E o `<english-slug>` tem forma fechada: `[a-z0-9]+(-[a-z0-9]+)*`** — minúscula,
dígito e hífen; sem acento, sem `_`, sem maiúscula, sem hífen na ponta, nunca
vazio. O número e o token de fase que vêm antes dele carregam as maiúsculas e
ficam fora do slug. A regra é cobrada pelo `notes-tree` em todo nome que o
contrato define, e por isso precisava de pai: o contrato de artefatos a escrevia
sozinho, que é o mesmo defeito que a decisão 12 consertou para o token de fase.

A escolha real era entre fixar uma forma e aceitar o que o autor escrevesse.
Aceitar dá duas grafias legais para o mesmo assunto —
`invite-code-rotation` e `invite_code_rotation`, `Invite-Code-Rotation`,
`rotação-de-convite` — e nome com duas grafias não é achável por grep, que é
para o que o nome existe. Entre as formas fixas, `snake_case` perde para o hífen
porque o hífen é o que a URL, o `ls` e o slug de arquivo já usam em todo lugar;
e o acento perde porque o slug é identificador, não prosa. Fechar as pontas e o
vazio não é preciosismo: `-x-.md` e `--.md` passariam numa regra escrita a olho,
e o gate precisa de uma que não passe.

### 3. `LESSONS.md` vira classe `bug-fix`, uma nota por lição

Uma lição por arquivo em `docs/notes/implemented/bug-fix/`. O arquivo único
tem três defeitos que já se manifestaram: a cauda append-only é conflito de
merge garantido quando dois agentes aprendem no mesmo ciclo; a ordem
cronológica já quebrou; e "grep pela sua área" num arquivo que carrega todas as
lições devolve o arquivo inteiro, enquanto `grep -ril` numa pasta devolve os
arquivos que interessam.

### 4. Escrever é obrigatório, no mesmo PR

Todo diff que toca qualquer coisa fora de `docs/**` adiciona ou modifica ao
menos uma nota sob `docs/notes/**`, no mesmo PR. Sem isenção declarável.

**O mandato é estrito, e o argumento mais forte é que ele não seria
aspiracional — mas essa evidência a base não alcança, e por isso ela vira
comando em vez de afirmação.** O teste é o do fim da decisão 14: regra que trava
prática cita evidência anterior a si mesma. Quem tiver a tool de PR o roda —
`gh pr view <N> --json files` num PR de fase anterior a esta ADR — e vê se ele
já traria spec, ADR e lição no mesmo diff. Versões anteriores desta linha
afirmavam isso dos PRs #28 e #29 no presente do indicativo, sem ninguém ter
medido, que é a classe de defeito que esta ADR pegou três vezes em si mesma.
**Enquanto ninguém medir, o mandato se sustenta no argumento sozinho, e ele
basta:** sem a regra, o que se escreve é o que a escrita voluntária produz — o
defeito que a tabela do contexto nomeia.

Isenção nenhuma porque isenção declarável é a promessa que o gate existe
para eliminar. O custo real: um PR genuinamente trivial paga um parágrafo.
A variante mais barata — mandato só no veredito de review — está em
Alternativas descartadas com o gatilho que a reabriria.

### 5. Emenda não é ato: editar é editar, e o merge é a aprovação

O primeiro corte desta decisão classificava emenda por intenção; o segundo
trocou a classificação por três atos com assinatura no disco. Os dois
resolviam o mesmo problema: **como cobrar de quem edita conteúdo aprovado o
preço de uma aprovação nova.** A instrução do Founder — as regras deste
repositório seguem as boas práticas do GitHub, sem divergência — dissolve o
problema em vez de resolvê-lo melhor.

**Aprovação não é um rótulo que uma edição possa invalidar: é o merge.** Um
artefato em `main` está lá porque um PR foi mergeado, e o merge é o ato do
Founder — nenhum agente o executa. Hoje quem sustenta isso é a matriz, pelo
`no-direct-push-main`, e ela vale por dentro; a proteção de branch nativa, que
vale por fora, é a adoção da decisão 14 e ainda não existe no repositório. Um
artefato numa branch não passou por merge nenhum, e nada nele está aprovado,
diga o cabeçalho o que disser.

Com isso a máquina de emendas perde as duas peças que a sustentavam:

- **O preço não existe.** O preço da emenda substantiva era "reaprovação do
  Founder, que é o merge". Mas todo PR merge. O rebaixamento era um bilhete
  pedindo o que ia acontecer de qualquer jeito.
- **A isenção não tem do que isentar.** A emenda aditiva existia para não
  cobrar rebaixamento de quem obedece ao gate 3. Sem cobrança, a rota some
  junto com o pedágio que ela contornava.

**Fica: editar é editar.** Quem precisa mudar conteúdo aprovado muda, e o PR
vai a review como qualquer outro. O que impede um agente de aprovar o próprio
artefato deixa de ser uma linha que ele não pode escrever e passa a ser um
merge que ele não pode executar — a mesma impossibilidade, uma regra a menos e
nenhum campo novo.

**A supersessão não sai junto**, e a razão é que ela nunca foi preço de emenda
— esta ADR já a tinha tirado da máquina. É o ato de substituir uma nota
inteira por outra, com pasta, campos e manifesto próprios (decisões 1 e 6), e
responde a "esta nota foi trocada por aquela", que o git não responde: o
`git log` mostra dois arquivos mudando no mesmo commit e não sabe que um
substituiu o outro.

**E ela tem alcance, decidido aqui porque foi aqui que ela sobreviveu: a
supersessão troca a nota que vale por outra, e o que a base carrega em
`rejected/` ou `archived/` já não vale — não há o que trocar.** O
`notes-tree` recusa o diff que dê `superseded_by:` a uma nota que a base
carrega nesses dois ciclos de vida.

O alcance não é preciosismo: sem ele, **a supersessão lava uma recusa, e lava-a
onde nenhum review a pega.** O laço vermelho é do Keeper, que construiu quatro
árvores de fixture e rodou a regra como os dois artefatos a escrevem. Move-se a
nota recusada para `archived/` com `status: superseded` e `superseded_by:`;
escreve-se o conteúdo dela sob nome novo com `supersedes:`; deriva-se do nome
novo. Tudo passa: o nome antigo não desaparece, `archived/` + `superseded` é
linha legal da tabela da decisão 1, os campos mútuos resolvem, o
`FROZEN.sha256` só cresce, e o nome novo não aparece na base — ramo 2, com
`in-review`, que não é `draft` nem `rejected`. Nenhuma linha desta ADR nem do
contrato proibia `rejected/` -> `archived/`.

**E não exige má-fé.** Um agente que raciocine "a proposta recusada foi
retrabalhada, então supersedo" produz exatamente esse diff e ganha um pai
derivável a partir de uma recusa. É por isso que a defesa que esta ADR escrevia
mais abaixo — "a lavagem aparece no diff como uma duplicata, e quem a pega é o
review" — **é falsa para esta espécie**: na supersessão não há duplicata, e a
assinatura no diff é byte a byte a do ato que o contrato **manda** praticar. Ato
cuja fraude é indistinguível do ato legítimo não tem como ser conferido por
leitura; ou o gate o alcança, ou ninguém alcança.

**A lavagem tem duas rotas, elas morrem em regras diferentes, e as duas regras
ficam nomeadas aqui.** Porta que se declara fechada sem dizer quem a fecha
reabre no dia em que a regra que a fechava por acidente for consertada, e o
conserto não menciona a porta.

- **Rota de um PR** — superseder a nota que a base carrega em `rejected/`. Morre
  no **alcance da supersessão**, escrito acima.
- **Rota de dois PRs** — tirar a nota de `rejected/` num PR, e superseder no
  seguinte, quando a base já a carrega em `proposed/`. O segundo PR é legítimo
  por construção: nada distingue superseder uma nota de `proposed/` recém-saída
  de `rejected/` de superseder qualquer outra. Ela morre no **primeiro** PR, na
  **terminalidade de `archived/` e `rejected/`** (decisão 1).

As duas são asserções do `notes-tree` contra a base do PR, e nenhuma das duas
precisa medir escopo de PR — que nenhum dos cinco gates mede.

**O `notes-freeze` não fecha nenhuma das duas, e isto precisa estar escrito
porque hoje ele fecha uma delas.** O PR de desrejeição fica vermelho nele — o
manifesto encolhe, ou a entrada deixa de resolver —, mas fica vermelho por ele
ser manifesto de hash, não por ter opinião sobre lavagem de recusa. Era uma
porta fechada por acidente, e a armadilha era exata: quem consertasse a colisão
do manifesto pelo caminho óbvio, deixando a linha sair, reabriria a lavagem em
dois PRs sem tocar em nenhuma linha sobre supersessão. **Com a terminalidade não
há colisão a consertar** — nenhum arquivo sai de pasta congelada, logo nenhuma
linha precisa sair do manifesto —, e os dois problemas se resolvem no mesmo ato,
que era a condição.

**O que fica de fora, e é preciso dizer:** copiar o conteúdo de uma nota
recusada para um **nome novo**, sem supersessão nenhuma, continua sendo do
review — a nota antiga fica onde está, e a nova é uma duplicata que o diff
mostra. É a mesma classe, mais fraca, e mostra o que a
invariante de não-desaparecimento realmente é: **ela é sobre nomes, não sobre
notas.** Ela garante que a identidade não some; não garante que o conteúdo não
se mude de nome. Fechar isso no gate exigiria comparar conteúdo, que é a
heurística de similaridade com limiar que o sétimo corte da decisão 13 acabou
de expulsar.

**A terminalidade encolhe esse resíduo sem fechá-lo, e a diferença é de
natureza.** "A nota antiga fica onde está" era descrição do que o autor
provavelmente faria; com a terminalidade é asserção de gate. O que sobra é
alguém copiar o texto de uma recusada para nome novo e derivar dali, com a
recusa parada em `rejected/` — visível para quem procurar, ausente do diff
porque nada a tocou. E é também a forma **legítima** de repropor: as duas são o
mesmo diff, e o que as separa é se o conteúdo merece voltar, que é juízo e é do
review. Gate que tentasse separá-las estaria comparando conteúdo.

**O que morre com esta decisão**, nominalmente, para o contrato e o glossário
não ficarem com órfãos: os três atos com assinatura, a emenda aditiva, a
emenda substantiva, a unidade protegida, o gatilho `status: approved` na base
do PR, a exclusão de `## Dev Log` e `## QA Notes`, e a metade de emendas do
gate 4. A seção `## Emendas` já tinha morrido no corte anterior. **E morre a
desrejeição** — o ato de sair de `rejected/` —, que o contrato sancionava e que
o glossário chegou a registrar como ato próprio. Ela não vira `_Avoid_` de outra
coisa: deixa de existir como ato, e quem quer o efeito escreve nota nova. **Onde
cada um dizia isso não fica escrito aqui**, pela regra da varredura: os dois são
arquivos que se editam, e o sítio envelhece antes do veredito.

**O registro de por que isto levou três cortes fica**, porque o caminho é o
argumento. As duas partições que falharam:

- **Carimbo.** O satisfator aditivo era "link relativo para código ou teste já
  commitado que sustenta o texto novo". Nas classes `process` e
  `simplification` o fato que sustenta o texto mora numa regra, não em código:
  o gate confere que o link resolve e não tem como conferir que o alvo prova
  alguma coisa. Qualquer teste verde do repositório servia de sustentação.
- **Absurdo.** Fixar o slug da nota da cadeia de derivação é escolha entre
  `derivation-chain`, `chain`, `artifact-chain` e `derivation`; escolha era
  substantiva; substantiva mandava não editar e superseder a nota inteira.
  Onze decisões congeladas e recarregadas noutro arquivo para acrescentar uma
  décima segunda — por um slug, dois dias depois da aprovação.

A terceira tentativa não é uma partição melhor: é a constatação de que **as
duas anteriores existiam para cobrar um preço que a plataforma já cobra.** Uma
máquina de classificar edições, dentro de um repositório onde toda edição
chega ao `main` por um PR que o Founder merge, é a revisão de PR
reimplementada em campo de cabeçalho — e reimplementada pior, porque um
cabeçalho se escreve à mão e um merge não.

A referência resolve emenda em prosa ("facts only — not the decision itself"),
que é a pergunta de intenção com outra roupa. Nós não a resolvemos: deixamos
de ter o conceito.

### 6. Congelamento é fato: manifesto de hash

`docs/notes/FROZEN.sha256`, uma linha `<sha256>  <caminho>` por arquivo sob
`archived/` e `rejected/`. Gate: todo arquivo congelado tem entrada, todo
hash bate, e o manifesto só cresce em relação ao da base do PR.

Sem isto, "nunca editar nota arquivada" é promessa — e este projeto não
sustenta invariante por promessa. `node:crypto` é stdlib; zero dependência
continua valendo (ADR-01). Sem segunda língua (decisão 8), é um hash por
nota, não três.

**"Só cresce" não tem exceção, e quem paga por isso é a terminalidade**
(decisão 1): nenhum arquivo sai de `archived/` nem de `rejected/`, logo nenhuma
linha precisa sair do manifesto. A regra mais curta desta ADR continua cabendo
em duas palavras porque outra decisão fechou o único caso que a obrigaria a
virar condicional com prova de dois lados. E o inverso também fica escrito:
**este gate não é a defesa contra lavagem de recusa** — ele recusaria o PR de
desrejeição, mas por aritmética de manifesto, e defesa que depende de outra
regra ter um efeito colateral não é defesa (decisão 5).

### 7. Onde melhoramos a referência

**(a) O laço vermelho vai junto da nota.** Nota de `bug-fix` exige
`## Laço vermelho`: o comando exato, a saída vermelha antes, e um link
relativo para o teste de regressão commitado que a mantém verde. As notas
da referência carregam racional; nós produzimos rotineiramente algo mais
forte — o laço vermelho de cada rodada de review — e
hoje ele evapora no handoff. Nota de bug-fix sem laço é opinião datada;
com laço, é regressor reexecutável, e a metade verde se reprova a cada CI
porque a suíte roda inteira. A metade vermelha fica como evidência textual
— só um revert a reproduziria, e isso é gatilho futuro, não escopo agora.

**(b) Declaração provada por execução.** Toda nota em `implemented/` cita
caminho e símbolo em forma verificável, e o gate resolve cada um: o arquivo
existe, o símbolo está definido lá. A referência verifica links entre
notas; nós verificamos o link da nota para o código que ela descreve.
É o que torna `implemented/` confiável sem depender de ninguém lembrar, e
é o precedente direto de `tests/squad-policy-reachability.test.js`, que não
acredita na declaração: executa o guard e prova. O maior beneficiário é
`docs/architecture/SPECTREE-RUNTIME.md`, um documento inteiro de afirmações
sobre o código que hoje ninguém confere.

**A citação é o link, não a crase.** O gate só resolve o que está em link
relativo — o arquivo, e o símbolo quando o token entre crases está colado
no link (`` [`createSandboxPolicy`](...) ``). Token entre crases **sem
link não afirma nada** e o gate o ignora: é tipografia, e mais das vezes é
vocabulário. **O glossário é o caso que torna a distinção não-teórica, e ele
não precisa de medição para sê-lo:** por contrato ele não cita implementação
nenhuma (decisão 10 item 5), então tudo o que ele põe entre crases é valor de
domínio por construção. Um gate que lesse crase como símbolo nasceria
reprovando o registro vivo mais consultado de qualquer repositório, e o
reprovaria por ele estar certo — rótulo lido como fato, exatamente o defeito
que esta ADR existe para não repetir.

O buraco simétrico — citar caminho em prosa para escapar do gate — fecha
com um lint, não com um allowlist: token com `/` e extensão de código
(`spectree-runtime/<caminho>.js`) fora de link falha pedindo que vire link.
Valor de vocabulário nunca tem essa forma, então a regra não precisa
saber o que é vocabulário para deixá-lo passar.

**(c) Autoria com autoridade.** A nota carrega `owner:`, e o gate pergunta
ao `PolicyEngine` real — pelo adapter oficial
`spectree-runtime/adapters/policy-document.js` — se aquele principal podia
escrever aquela classe. A matriz ganha uma
família de recursos por classe de nota. Isso não existe no mundo de
referência, e é barato aqui porque a matriz e o motor já existem. Uma linha
não pode regredir na migração: o Keeper hoje tem `artifact-edit` sobre
`docs/LESSONS.md` e precisa ter sobre `docs/notes/*/bug-fix/*` — e nada
além.

**(d) Removido.** Era a mecanização da máquina de emendas, e a decisão 5 a
tirou. Aqui não melhoramos a referência: ela tem uma disciplina de emenda em
prosa e nós deixamos de ter o conceito, porque o merge aprova o conteúdo que
existe no instante do merge. Fica registrado como item removido, e não
apagado, porque "não temos disciplina de emenda" é uma escolha e alguém vai
propor uma de novo.

### 8. Português apenas — uma nota é um arquivo

Sem `.zh.md`, sem `.pt.md`, sem sidecar `.i18n.yaml`. A razão é do Founder e
não é de escala: **o projeto está em modo shadow**. Não construímos para
público; quando o mundo perceber, será porque construímos em silêncio.
Bilinguismo é custo de audiência, e audiência não é o objetivo agora.

A convenção do repositório vale integralmente e sem exceção: identificador
em inglês, prosa em português, dentro do mesmo arquivo. O
`{lifecycle}/{class}/<slug>.md` mantém o slug em inglês; o corpo é
português.

### 9. Cinco gates

Todos `node:test`, zero dependência, no estilo dos testes de repositório que já
existem em `tests/`. **Quantos são não fica escrito**, pela regra da varredura:
o número muda a cada teste novo, e o estilo é o que a linha precisa dizer.

| Gate | Prova | Defeito real que ele pega hoje |
|---|---|---|
| `tests/notes-tree.test.js` | classe e ciclo de vida no conjunto fechado; forma do nome e do `<english-slug>` por classe; recusa da **criação** nos caminhos da linha 2 da escada, medida contra a base do PR, índice incluído; cabeçalho entre cercas com status no conjunto; tabela status×pasta; data do nome do arquivo não futura; `supersedes`/`superseded_by` mútuos e resolvíveis; **supersessão não alcança o que a base carrega em `rejected/` ou `archived/`** (decisão 5); links entre notas resolvem; esqueleto por classe; árvore não vazia tem exatamente uma nota da cadeia; **nota que a base carrega não desaparece da árvore**, e **nome que a base carrega em `archived/` ou `rejected/` não muda de caminho** (terminalidade, decisão 1); **o veredito do pai** — a regra de derivação inteira, decisão 13 | ADR-01 a ADR-04 sem cabeçalho; lição cuja data ninguém confere; `superseded` declarado e nunca exercido; nada impede derivar de um pai `draft` escrito na mesma branch, nem de um pai que a base recusa e o PR moveu de pasta — ou que o PR **supersedeu**, que passava por ser o ato sancionado, ou que o PR **desrejeitou**, que o texto sancionava em três sítios e gate nenhum podia executar |
| `tests/notes-freeze.test.js` | manifesto cobre `archived/` e `rejected/`; hashes batem; manifesto só cresce contra a base | "nota arquivada não se edita" hoje é promessa |
| `tests/notes-truth.test.js` | toda citação **em link** de nota `implemented/` e de registro vivo resolve no código (arquivo, e símbolo quando colado no link); crase sem link é vocabulário e não é claim; caminho em prosa fora de link falha pedindo link | o doc de arquitetura inteiro, não verificado; e o glossário reprovado por citar vocabulário, se a regra fosse a crase |
| `tests/notes-mandate.test.js` | diff fora de `docs/**` traz nota no mesmo PR — e nada além | LESSONS é voluntária: quem não escreve não fica vermelho em lugar nenhum |
| `tests/notes-authority.test.js` | `owner:` × classe decidido pelo `PolicyEngine` real | nada impede o principal errado escrever a classe errada |

O gate 1 inclui o esqueleto por classe. Para `architecture` e `process`,
`## Contexto` e `## Decisões` são obrigatórias — e isso **substitui a ADR de
um parágrafo pela ADR de um item**: a lista numerada é o endereço de que os
`depends_on` dos filhos derivam (ADR-08 e ADR-09 derivam das 14 decisões da
ADR-07). Uma ADR de um item continua sendo uma ADR completa. O esqueleto não
protege nada: com a decisão 5, nenhum gate lê seção nomeada para decidir preço,
porque não há preço.

**Título de seção é literal, e a lista é fechada.** O gate procura a seção
obrigatória pela forma exata, e a forma exata é a que o contrato de artefatos
escreve — com o acento e a língua que estão lá:

```
## Contexto · ## Decisões · ## Linguagem · ## Laço vermelho
## Alternativas descartadas · ## Consequências · ## Open Questions
## Dev Log · ## QA Notes
### Blocking now · ### Waiting on an answer above · ### Not blocking this stage
```

Duas escolhas aqui, e as duas tinham alternativa real. **A língua:** a regra do
repositório manda identificador em inglês, e traduzir todos os títulos era a
opção óbvia. Perde por duas razões — título de seção não vira símbolo de código,
e a regra do inglês existe para o que vira; e traduzir cobraria reescrever as
seções que já existem em português em toda nota e em toda spec, para comprar
uniformidade com um identificador que nenhum código vai referenciar. É a mesma
exceção que o termo `laço vermelho` já obrigava — ele é nome de seção cobrada
por gate, e não vira símbolo —, e agora ela vale para a lista inteira. **O fechamento:** título aberto reintroduz na seção o que a
forma do slug já fechou no nome — `## Decisões` e `## Decisoes` e `## Decisão`
não são achados pelo mesmo grep. Seção nova exige nota de `process`, como classe
nova.

Nenhuma das duas regras — a forma do slug (decisão 2) e esta lista — acrescenta
obrigação: as duas já eram cobradas pelo `notes-tree` e já estavam contadas em
"forma por classe" e em "esqueleto" na conta abaixo. O que muda é onde elas são
decididas. Estavam só no contrato de artefatos, que não é nota e não é pai de
ninguém, e regra normativa sem pai é o defeito que a decisão 12 nasceu para
consertar.

**O gate 4 encolheu para uma linha.** Ele hospedava a mecânica da decisão 5 e a
citação de merge da decisão 13; as duas saíram, e o que sobra é o mandato de
escrita e mais nada. Nenhum gate desta ADR lê o cabeçalho para decidir se uma
**edição** podia acontecer — quem decide isso é o review do PR, e quem a torna
efetiva é o merge. O `notes-tree` lê o `status:` do pai (decisão 13, sétimo
corte), e é outra pergunta: não é se a edição podia acontecer, é se aquele texto
serve de pai.

**Os gates 1, 2 e 4 precisam da base do PR, e é uma ref só.** O 1 por quatro
razões, e a quarta faltava aqui: porque a recusa da linha 2 da escada é de
criação; porque a asserção do pai nascido no PR se mede no diff; porque a regra
de derivação da decisão 13 desceu para dentro dele; e porque **"nota que a base
carrega não desaparece da árvore", o alcance da supersessão e a terminalidade
das duas pastas congeladas são, os três, perguntas sobre a base** — não há como
saber que um nome sumiu ou mudou de caminho, nem em que ciclo de vida a nota
estava antes, sem o outro lado do diff. O `checkout` do CI passa
a exigir `fetch-depth: 0`, e o gate **falha**
quando não consegue computar a base — nunca pula verde. Vale a regra da seção 99
já escrita no `ci.yml`: não existe caminho "all skipped -> green".

**A ref é a base do PR, nunca o tip de `origin/main`**, e as duas divergem assim
que `main` anda depois do ponto de ramificação. A base vence por uma razão só: é
contra ela que o review lê o diff, e um gate que julgasse contra outra ref
reprovaria ou aprovaria coisa que ninguém está olhando. O preço é que um
veredito registrado em `main` **depois** do ponto de ramificação não é visto por
este PR — e o conserto não é uma segunda ref, é
**`require branches to be up to date before merging`** na proteção da decisão
14: com ele a base é sempre recente, e sem ele a janela existe. Mesma
configuração, mesmo dono (Disruptor), mesma entrega.

**Por que cinco gates e não um, agora que os três primeiros compartilham a base
do PR.** A premissa antiga era que o `notes-tree` não precisava da base, e ela
caiu no parágrafo acima: a recusa de criação, a asserção do diff e a regra de
derivação todas a pedem. A razão que fica não é de dependência, é de
**diagnóstico**: cada gate se identifica pelo nome, e o nome é o que aparece
vermelho — quem quebrou um sabe o que quebrou sem ler saída nenhuma. Um gate só
diria "algo em `docs/` está errado", que é o que uma suíte diz quando não vale a
pena separá-la. E há um segundo motivo, que é de configuração e não de gosto: os
required status checks da decisão 14 são configurados **por nome de check**;
fundir os cinco tornaria a proteção de `main` grossa e impediria exigir quatro
enquanto o quinto ainda não existe — que é exatamente a ordem que a decisão 11
item 8 escreve para o `notes-authority`.

### 10. Migração

Acontece num PR só, depois desta ADR aprovada, e o histórico é preservado
por `git mv`.

1. Esta ADR sai de `docs/adr/` para `docs/notes/proposed/process/ADR-10-repository-memory-system.md`
   ao ser aprovada, e migra para `implemented/` no PR que entrega os gates.
   O movimento é a primeira prova de que a pasta carrega informação — e é
   também o primeiro caso da identidade por nome (decisão 13, sétimo corte):
   depois de cada um dos dois movimentos, o `notes-tree` continua achando esta
   ADR na base **pelo nome do arquivo**, que os dois movimentos preservam, e o
   caminho que ela tem lá ou aqui não entra na pergunta. A versão anterior desta
   linha dizia "regra de caminho antigo", e essa regra morreu no sétimo corte
   junto com a detecção de rename que ela exigia.
2. `docs/adr/ADR-NN-*.md` -> `docs/notes/implemented/architecture/`, nomes
   preservados, todas em `implemented/` — o código delas shipou. **O critério do
   `status:` de cada uma é um só, e não é uma lista nominal:** a que já traz uma
   linha `status:` migra com a linha que tem, perdendo `approved:` e `updated:`
   (decisão 13); a que não tem cabeçalho ganha os três campos que sobraram —
   `status: approved`, `owner:`, `depends_on:` —, e o `approved` vem de a base a
   carregar, logo alguém a mergeou, e o merge é a aprovação. **Linha presente
   vence a ausência**, que é a mesma regra da cláusula de intervalo do contrato:
   ADR que diga `in-review` em `main` migra `in-review`, e é para ela que a linha
   da tabela da decisão 1 que admite `in-review` em `implemented/` existe. Quem
   mede qual é qual é o PR de migração; a versão anterior desta linha nomeava
   quais ADRs traziam `approved`, e o nome errado sobrevive à correção do arquivo.
3. **As specs de `docs/spec/`** vão inteiras para
   `docs/notes/implemented/feature/`, nomes preservados: elas já casam
   `<PREFIXO>-FNN-<english-slug>.md` com `<PREFIXO>` = `RUNTIME`, que é o token
   que a nota da cadeia declara. Todas em `implemented/`, porque descrevem código
   que shipou; o `status:` de cada uma migra como está. **A migração é da pasta
   inteira, e é isso que a linha precisa dizer:** nomear uma fase deixava as
   outras num caminho que a linha 2 da escada recusa, sem linha de migração.
   **E a consequência é de forma, não de proporção.** A versão anterior desta
   linha dizia que o `status:` "separa a spec de que se deriva da que o Founder
   recusa"; a seguinte trocou isso por uma contagem, e a contagem envelhece a
   cada spec nova. O que fica é a regra: **spec que chegar à base dizendo
   `in-review` não serve de pai**, pelo ramo 1 da regra de derivação, e
   `implemented/feature/` nasce com tantas assim quantas o PR de migração
   carregar. A tabela da decisão 1 admite a combinação e nenhum gate fica
   vermelho — mas quem chegar depois pode ler uma pasta em que pouco serve de
   pai. **A razão não é uniforme e não é recusa do Founder:** a spec da fase mais
   recente registra no corpo que as anteriores estavam sendo transcritas quando o
   status foi escrito, e são legitimamente `in-review` por isso. Nada nesta ADR
   conserta isso, e nada deveria: quem tira uma spec de `in-review` é o Founder,
   aprovando-a, e o registro disso é o merge. Fica em `## Open Questions` para o
   Invoker rotear.
   `docs/spec/README.md` -> `docs/notes/implemented/process/ADR-11-derivation-chain.md`,
   que é a nota da cadeia de derivação deste repositório (decisão 12 item 1).
   **O nome muda, e tem de mudar por duas razões:** `README.md` é recusado pela
   linha 2 da escada em qualquer nível, e a nota da cadeia tem nome fixo, que é
   o localizador dela. `ADR-11` é o próximo número livre. O que ela declara —
   estágios, caminhos canônicos, pais e o prefixo `RUNTIME` — fica. O mapa de
   fases que ela carrega hoje **não fica**: listar as notas da árvore é índice,
   e não existe índice. Ele descreve o estado de agora, então vai para
   `docs/architecture/SPECTREE-RUNTIME.md`, que é o registro vivo do runtime, e
   passa a responder ao gate 3 como o resto de lá.
4. `docs/LESSONS.md` -> **uma nota por entrada** em
   `docs/notes/implemented/bug-fix/`, texto verbatim, quantas entradas houver
   no dia do PR de migração. Data do nome é a data da entrada, exceto quando ela
   postdata o último commit do arquivo — aí vale a do commit. O arquivo é
   removido; `git log -- docs/LESSONS.md` continua respondendo pela história.
   **A contagem não entra aqui, e a razão é medida:** três versões desta linha
   fixaram um número de notas, e o arquivo já tinha mais entradas do que isso
   quando a terceira foi escrita — uma delas é a lição do `--find-renames`, que
   esta ADR cita como o laço vermelho do sétimo corte. Número que cresce toda vez
   que alguém aprende alguma coisa é o `updated:` com outra roupa (decisão 13), e
   dimensionar migração por ele é a mesma doença.
5. **O que a linha 5 da escada do contrato classifica como registro vivo não
   entra na árvore** — reescrito continuamente, nunca congelado, sem data e sem
   ciclo de vida. Fica na raiz de `docs/` e responde ao gate 3. O critério que o
   separa de nota: nota é o registro de um momento (tem data, tem autor,
   tem ciclo de vida, congela); registro vivo é uma fotografia do estado
   atual, e congelá-lo o tornaria falso. **A linha não enumera, e é a terceira
   vez nesta migração que a enumeração perde:** registro vivo que nasça depois
   desta ADR não estaria na lista, e a escada já o classifica sem que ninguém a
   atualize. O glossário é o caso mais claro do critério — um glossário não
   decide nem ensina, descreve a linguagem de agora —, e é também o que passa no
   gate 3 por construção, pela regra da decisão 7(b): ele não cita código, cita
   vocabulário.
6. **Cabeçalho é retroativo, sem cláusula de avô — e não há data nenhuma a
   reconstruir.** O merge do PR da fase **é** o ato de aprovação do Founder,
   e ele já está no git: o que faltava era o registro no arquivo, e a decisão
   13 conclui que o registro no arquivo é que sobrava. ADR-01 a ADR-04 e as
   lições ganham `status:`, `owner:` e `depends_on:`, e mais nada. Some com
   isto a metade mais cara da migração: nenhuma arqueologia de PR, nenhum
   `approved: -` para irrecuperável, nenhum caso de "o merge existe mas a
   citação se perdeu". Uma isenção permanente para artefato pré-contrato
   seria a promessa de novo; uma migração única já era fato, e agora é uma
   migração menor.
7. `## Laço vermelho` das lições migradas: recupera-se o que for recuperável
   (várias já citam o teste commitado, e a do `--find-renames` já traz a seção
   inteira); o que não for leva a linha `não registrado — anterior à ADR-10`, e
   o gate aceita essa linha **apenas para uma lista exata de caminhos, escrita
   no gate dentro do próprio PR de migração**, no padrão de
   `tests/squad-surface.test.js` — nunca checagem de ausência, sempre a lista
   exata. **Quem escreve a lista é a migração, não esta ADR**, e o critério que
   a delimita é fechado: nota de `bug-fix` que a migração produziu a partir de
   uma entrada do `docs/LESSONS.md` e cujo laço não foi recuperado. Nota de
   `bug-fix` escrita depois da migração precisa do laço, sem exceção — e é isso,
   e não um número, que separa a isenta da cobrada.
   **A lista só encolhe, e é isso que a mata.** Quem recuperar o laço de uma
   delas tira o caminho dela da lista no mesmo PR; lista vazia, a cláusula sai
   do gate. **Gatilho de morte:** a última da lista ganhar laço. Sem o
   encolhimento a isenção viraria permanente, que é a promessa que esta ADR
   existe para eliminar.
8. Toda citação de `docs/adr/`, `docs/spec/` e `docs/LESSONS.md` em
   `README.md`, `agents/*.md`, `commands/techleader.md`, `skills/**` e
   `squad.policies.json` é reescrita no mesmo PR. Depois disso o gate 1
   mantém as citações honestas.

### 11. O que muda em `skills/spectree-artifacts/SKILL.md`

A edição é entrega separada; a decisão é esta. Nove mudanças, e a sétima é
onde a readequação bate — **o contrato perde mais texto do que ganha.**

1. **A cadeia de derivação passa a ser declarada por repositório**, não
   universal. Hoje o contrato afirma `PRD -> EPIC -> STORY -> ADR` como se
   fosse a única, e este repositório roda `Brief -> Spec -> ADR -> PR` — daí
   sete artefatos canônicos que não existem e dois que existem e não estão
   no contrato. Aplicada ao pé da letra, a regra "sem pai não se escreve o
   derivado" proibiria toda ADR que este repositório já tem. Os artefatos de pipeline
   (PRD, EPIC, stories, DESIGN) continuam corretos para projeto de produto:
   o contrato passa a separar o que é incondicional do que nasce com um
   pipeline, e cada repo declara sua cadeia de derivação em um lugar só.
2. **Caminhos canônicos** trocam `docs/adr/`, `docs/LESSONS.md` e o silêncio
   sobre `docs/spec/` pela árvore de notas, mais os três registros vivos. E os
   três caminhos substituídos entram na **recusa** da escada do contrato, não no
   silêncio: silenciados, eles caem na linha do registro vivo e voltam a existir
   como caminho legal, que é o contrário da decisão 1. **Mas quem os nomeia é a
   nota da cadeia deste repositório, não o contrato** — e isto é o item 8
   aplicado a si mesmo. `docs/adr/`, `docs/LESSONS.md` e `docs/spec/` são
   caminhos **deste** repositório; `docs/spec/` nunca existiu em versão nenhuma
   deste contrato antes desta ADR. Escritos na escada, viajam para todo
   repositório que o squad serve como recusa de três caminhos que a maioria
   nunca teve, e calam sobre o `docs/decisions/` que o próximo vai ter. A escada
   passa a recusar **"o que a nota da cadeia declara como substituído pela
   árvore"**, que é o mesmo mecanismo da linha 4 (decisão 12 item 2 ganha o
   item), e a lista dos três desce para a `ADR-11` deste repositório. A recusa
   vale para
   **criar**; os arquivos que ainda moram lá são a entrada da migração (decisão
   10), não violação a consertar por fora dela. A ordem — contrato, gates,
   migração com a reescrita das citações no mesmo PR — fica escrita no próprio
   contrato, para não depender de ninguém lembrar dela, e o intervalo entre o
   contrato e a migração não deixa gate nenhum vermelho — mas a razão certa não
   é a que este item deu antes ("o `notes-tree` lê a árvore de notas, e não
   `docs/adr/`"), porque o gate 1 prova justamente a recusa desses caminhos. A
   razão é que **a recusa é de criação**, medida contra a base do PR: arquivo
   que já estava lá é a entrada da migração. A janela de inconsistência é de
   prosa — com uma exceção que o contrato declara junto: no intervalo, o
   cabeçalho pré-contrato do que `main` carrega é o que a regra de derivação lê,
   porque exigir cercas antes da migração recusaria todo o pré-contrato que
   `docs/` tem em `main` (decisão 13, quinto corte). **E a exceção tem duas
   metades, porque o defeito registrado no contexto desta ADR é duplo — formato
   e ausência.** O corte anterior estendeu a cláusula só ao formato, e com isso
   ela respondia pelo artefato de cabeçalho torto e continuava muda diante do
   que **nunca teve cabeçalho nenhum** — a classe inteira, e não uma lista: todo
   arquivo de `docs/` anterior ao contrato que não abre com as cercas `---`. A
   versão anterior desta linha enumerava caminhos, e a enumeração estava errada
   nas duas direções: deixava de fora arquivo que não tinha cabeçalho nenhum e
   trazia dentro arquivo que já tinha cabeçalho entre cercas. Lista de estado
   medido dentro de cláusula normativa é a contagem que envelhece sozinha, pela
   terceira vez nesta ADR — some, e fica o critério, que não envelhece. Metade da migração é criar cabeçalho onde não há;
   uma cláusula que só perdoa forma torta não podia cobrir a outra metade. A
   segunda metade fica: **pré-contrato sem linha `status:` lê-se `approved`**,
   e o argumento é o que a decisão 10 item 2 já usa para as ADRs — está em
   `main`, e a aprovação é o merge. Linha presente vence a ausência, então
   `in-review` escrito em `main` continua prendendo, e as duas metades morrem
   juntas no passo 3.
3. **Cabeçalho** com as cercas `---` como forma única, conjunto de status
   incluindo `rejected`, e a tabela status×pasta. **E a pergunta que o `status:`
   responde é decidida na decisão 13, num lugar só; o contrato a carrega e não a
   redecide:** maturidade declarada pelo autor, nunca "está aprovado?" — que é o
   que o contrato dizia, contradizendo a decisão 1 desta ADR, que dizia "serve
   para derivar?". As duas estavam erradas pelo mesmo contrafactual, e agora há
   uma resposta só. **A versão anterior deste item pedia "as mesmas palavras", e
   era pedir a duplicação que produziu o defeito:** duas glosas do mesmo campo,
   em dois arquivos, divergem na primeira edição de qualquer um dos dois. O que
   tem de bater é a decisão; a redação de cada sítio é do sítio.
4. **Só a supersessão entra no contrato como ato** (decisões 5 e 13), **com o
   alcance junto**: ela não toca o que a base carrega em `rejected/` ou
   `archived/`. O alcance não é detalhe de gate — sem ele o contrato descreve,
   passo a passo, o ato que lava uma recusa, e um agente de boa-fé o executa
   achando que cumpre a regra. **E a terminalidade entra junto** (decisão 1): o
   contrato para de sancionar a saída de `rejected/` num PR próprio — sanção que
   gate nenhum podia executar, e cuja visibilidade a medição do `git diff -M`
   desmentiu — e passa a dizer que nome em pasta congelada fica no caminho em
   que está, com a nota nova que cita a recusada como a forma de mudar de ideia.
   Sem essa troca o contrato continuaria mandando praticar um ato impossível, e
   as duas rotas de lavagem continuariam fechadas uma por regra e outra por
   acidente. Saem: a emenda aditiva, a emenda substantiva, a
   seção `## Emendas` com `tipo:`, a escalação de caso duvidoso ao Invoker, e a
   unidade protegida. Sem preço não há classificação; sem classificação não há
   caso duvidoso; sem preço a proteger não há unidade a nomear.
5. **O mandato de escrita por PR** (decisão 4) e os nomes dos cinco gates,
   para que um agente que quebre um saiba o que quebrou.
6. **"ADR de um parágrafo"** vira **"ADR de um item"** (decisão 9).
7. **O bloco de aprovação do cabeçalho sai inteiro** (decisão 13), e é aqui
   que a readequação subtrai. O que sai, nominalmente:
   - Os campos `approved:` e `updated:` — o cabeçalho obrigatório fica
     `status:`, `owner:`, `depends_on:`, mais `blocked_by:` em story.
   - "`approved` só é setado pelo Invoker depois de aprovação explícita do
     Founder, que preenche `approved:` com a data no mesmo ato" — **sai**.
     "Agente nenhum aprova o próprio artefato" fica, e passa a se sustentar no
     merge que agente nenhum executa.
   - "Toda edição em um artefato atualiza a linha `updated:`" — **sai** com o
     campo. Quem data byte é o `git log`.
   - "Editar um artefato `approved` rebaixa o `status:` para `in-review` na
     mesma edição" — **sai**. Substituída por uma linha: **do pai que `main`
     carrega, o `status:` que vale é o da cópia em `main`.**
   - "Derivar exige `updated:` igual ou anterior a `approved:`" — **sai**.
     Substituída por: derive do pai que o review vai ver — a cópia de `main`
     dizendo `status: approved` quando `main` o tem, a cópia do PR quando o pai
     nasce ali (decisão 13).
   - "story em ciclo de build carrega `updated:` posterior por natureza" e a
     exclusão de `## Dev Log`/`## QA Notes` — **saem**, e a razão certa não é a
     que este item deu antes ("nenhuma das duas descreve caso algum sem o
     rebaixamento"). O caso existe, e o ciclo de build o produz toda vez: o
     Jakiro escreve na story de que deriva. Elas deixam de ser necessárias
     porque a regra de derivação parou de ler a sua cópia — não porque o caso
     tenha sumido. `in-progress` e `done` continuam status de story e não mudam.
   - **Entram**: Conventional Commits como convenção declarada **daqui para
     frente**, sem gate (decisão 14); e a proteção de `main` com checks
     obrigatórios, escrita **como destino, com o Disruptor por dono** — no
     presente do indicativo ela afirmaria um fato que ainda não existe. Junto
     entra o que a regra de derivação vale antes de a proteção existir, que é
     disciplina: sem os checks, `main` é a branch que só quem aprova merge, não
     a branch que os gates filtram.

8. **O contrato não afirma fato de instalação nenhuma**, e esta é a mudança que
   nasceu de uma classe de defeito que nenhuma rodada anterior tinha nomeado.
   Ele viaja para todo repositório que o squad serve (ver Consequências), e
   escrevia no presente do indicativo coisas verdadeiras **aqui**: que `main`
   nunca filtrou nada, que tudo o que `main` carrega é pré-contrato, que só o
   Founder merge. Num repositório que adote o contrato depois de já ter gates,
   ou com outro dono de merge, as três são falsas — e o agente que as lê age
   sobre um repositório imaginário. **A regra: o contrato descreve o que o
   repositório que o carrega deve, nunca o que este repositório tem.** A
   proteção de `main` vira dever com dono (Disruptor) em vez de futuro; a
   leitura de `main` antes dos checks vira condicional; o dono da entrega do
   `notes-authority` fica escrito (a matriz é do Invoker, o gate vem com os
   outros quatro, e nessa ordem); e o gatilho de remoção do Conventional Commits
   — que só morava nesta ADR — desce para o contrato, que é onde a regra mora.
   Medição de repositório continua sendo desta ADR, e nunca de lá.

   **E este item vence o item 7, onde os dois se contradiziam.** O item 7 mandava
   o squash com `(#NN)` entrar no contrato "porque é prática medida do
   repositório", e é exatamente essa justificativa que o item 8 proíbe: medida em
   **qual** repositório? O contrato obedeceu ao item 7 e passou a afirmar, no
   presente do indicativo, o estilo de merge do repositório hospedeiro — um fato
   de instalação, e o `(#NN)` já tinha deixado de ser carga estrutural quando o
   `approved:` morreu (decisão 14, fim). **O item 7 cede: o `(#NN)` sai do
   contrato inteiro.** A mesma correção alcança "quem merge é o Founder", que
   sobreviveu num sítio depois de ter sido consertado noutro, e é a garantia
   central do contrato — quem merge é **quem aprova**, e num repositório que o
   squad sirva pode não ser o Founder. Terceiro sítio, o da escada, está no item
   2. **O padrão que os três compartilham:** fato de instalação não se corrige
   sítio a sítio, porque a regra que o autoriza continua de pé em outro item —
   por isso a autorização é que cai.

9. **O que a árvore não prende passa a estar escrito, e o contrato ganha três
   linhas por isso** (decisão 1). A primeira é a **entrada em `rejected/`**: o
   contrato dizia, em voz passiva, que a proposta que morreu sem decisão
   vencedora "vai inteira para `rejected/`" — sem dono, sem gatilho e sem gate,
   que é a forma que este contrato proíbe em toda outra linha. Passa a ter dono
   (o `owner:` da nota move; o review recusa; o merge registra) e passa a ter o
   limite escrito na seção **`### O que não tem gate de repositório, e é para
   ficar escrito`**, ao lado das outras coisas que moram lá: nada obriga a
   entrada, e as duas trancas da saída — terminalidade e alcance da supersessão —
   só valem depois dela. A segunda é o **`depends_on:` da nota que repropõe uma
   recusada**, que não estava escrito em lugar nenhum e cujas duas leituras
   óbvias são vermelhas: é o pai da recusada, e a recusada entra por link no
   corpo. Nenhuma das duas acrescenta obrigação — a primeira declara a ausência
   de uma, e a segunda diz qual valor um campo obrigatório recebe num caso que o
   contrato já mandava praticar. **E uma terceira, de forma:** o gatilho que
   `## Alternativas descartadas` carrega passa a ser escrito como **condição e
   sem remédio**, pela razão que as Consequências registram — gatilho que
   pré-nomeia o conserto decide o desenho no ato de disparar.

### 12. A nota da cadeia de derivação: nome fixo, o que declara, e o piso

A decisão 11 item 1 tira a cadeia do contrato e a põe numa nota por
repositório; a decisão 2 nomeia a classe `feature` por um token de fase
(`<PREFIXO>-FNN`) que só este repositório declara. Faltou dizer onde essa nota está,
o que ela declara e qual é a sintaxe do token — e o contrato de artefatos
preencheu a lacuna sozinho, que é o pai estendido sem emenda apontado nas
Consequências. Fica decidido:

1. **Nome fixo:** `ADR-NN-derivation-chain.md`, classe `process`, uma por
   repositório. É o único nome de nota que se prende, e a razão é o
   localizador: não existe índice (decisão 1), quem chega sem contexto precisa
   achá-la, e o nome é o que sobra — `ls docs/notes/*/process/` a entrega. O
   slug foi escolha entre `derivation-chain`, `chain` e `artifact-chain`; foi
   escolha, logo mora aqui e não no contrato.
2. **O que ela declara:** os estágios da cadeia, com o caminho canônico e o
   pai de cada um; o prefixo de fase do repositório; e **os caminhos que a
   árvore de notas substituiu neste repositório** — aqui, `docs/adr/`,
   `docs/spec/` e `docs/LESSONS.md` —, que é o que a linha 2 da escada recusa
   criar (decisão 11 item 2). Não lista notas — listar seria índice. A
   diferença entre as três coisas e a quarta: as três descrevem forma, a
   quarta descreve história, e é por ela morar aqui que o contrato para de
   afirmar o passado de um repositório que ele não conhece.
3. **Sintaxe do token de fase:** `<PREFIXO>-F`, com `<PREFIXO>` casando
   `[A-Z][A-Z0-9]*`; a nota da classe `feature` chama-se
   `<PREFIXO>-FNN-<english-slug>.md`, e repositório que não declarou prefixo
   não escreve nota `feature`. A alternativa — cair na data quando não há
   token — dava duas formas legais de nome para a mesma classe, e forma de
   nome que aceita duas coisas não classifica nada.
4. **`notes-tree` ganha uma invariante:** árvore de notas não vazia tem
   exatamente uma nota da cadeia. Vazia não tem, e é isso que faz o bootstrap
   existir: a nota da cadeia é a primeira nota de um repositório, e o
   `depends_on:` dela é `-` porque o pai é o brief do Founder — o terceiro
   estado da decisão 13, e nela o único possível. A invariante é indexada pelo
   **nome fixo**, nunca pelo `-`: outras notas levam `-` quando o pai delas
   também mora fora do repositório, e contar por `depends_on:` daria duas
   cadeias onde há uma. Sem esse piso,
   "leia a nota da cadeia antes de escrever" seria inexecutável no primeiro
   artefato de qualquer repositório novo.

### 13. O cabeçalho carrega o que o git não sabe, e nada além

O primeiro corte desta decisão deu a unidade protegida como `## Decisões`; o
segundo a alargou para o corpo e fixou `approved: <YYYY-MM-DD> (merge do PR
#NN)`; o terceiro tirou os campos do cabeçalho; o quarto trocou as duas
condições da derivação por uma; o quinto trocou a pergunta que a condição faz; o
sexto prendeu a pergunta ao **caminho que o pai tem em `main`** e fechou o ramo
do pai nascido no PR; o sétimo tirou a regra da mão do agente e a pôs no gate,
e com isso trocou a identidade por caminho pela **identidade por nome de
arquivo**; o oitavo fechou a porta que a supersessão abria na identidade por
nome (decisão 5) e decidiu, num lugar só, **qual pergunta o `status:`
responde** — que este documento e o contrato respondiam de dois jeitos.
O registro do que caiu em cada corte fica no fim desta decisão, porque o caminho
é o argumento. O que decide agora vem primeiro.

**O fato que forçou o terceiro corte, e ele não é uma contagem.** A forma
fixada em 12/13 foi medida contra o repositório no dia em que nasceu, e o que
ela encontrou foram três formas ilegais — data nua sem citação de merge,
`approved: -` com o merge em prosa, e prosa sem merge nenhum —, mais os
cabeçalhos que não tinham o campo. Legal só era o que tinha sido transcrito
naquele mesmo dia, já sabendo da regra. **O número não fica escrito aqui, e
a razão é a desta rodada:** ele foi medido contra a árvore de trabalho de então,
não contra a base, e cada rodada o mudou. O que fica é o critério, que não
depende de quantos eram: **a forma nova reprovava toda forma que já existia, e
regra que reprova o que existe no dia em que nasce é dívida com nome novo.**
A parte da medição que continua carregando peso é a que uma rodada seguinte
conferiu com o comando na mão, e ela está mais abaixo nesta decisão, verbatim.

E a razão de ela reprovar o que existia é a mesma que a torna dispensável. **O campo
registra um fato que mora no git, e a única invariante que o gate sabia
verificar era se o campo concordava com o git.** Campo cuja correção se define
como "bate com a plataforma" é a plataforma reescrita à mão, com a
possibilidade de mentir acrescentada. Quem aprovou, quando, em que commit, sob
qual PR: o GitHub guarda isso com identidade forte, e o repositório não guarda
melhor.

Fica decidido, um campo de cada vez, pelo mesmo teste: **o git responde? então
o campo sai.**

| Campo | O git responde? | Veredito |
|---|---|---|
| `approved:` | sim — o merge, a data, o PR, o commit | **sai** |
| `updated:` | sim — `git log -1 --format=%ad -- <caminho>` | **sai** |
| `status:` | não — em que ponto do ciclo o autor declara que o texto está é juízo dele | fica |
| `owner:` | não — Founder e agentes assinam com a mesma identidade git | fica |
| `depends_on:` | não | fica |
| `supersedes:` / `superseded_by:` | não — o git vê dois arquivos mudarem, não a substituição | fica |
| `blocked_by:` | não | fica |

**E a pergunta que o `status:` responde fica decidida aqui, num lugar só,
porque este documento e o contrato davam duas respostas diferentes.** O contrato
escrevia "este conteúdo está aprovado?"; a decisão 1 desta ADR escrevia "este
conteúdo serve para derivar?". **As duas estão erradas, e o contrafactual é o
mesmo para as duas:** o pai que nasce no PR com `in-review` serve para derivar e
não está aprovado.

Fica decidido: **`status:` é a declaração do autor sobre a maturidade do
conteúdo — em que ponto do ciclo aquele texto está —, e nada além.** Não é
aprovação, porque aprovação é o merge e rótulo escrito numa branch não concede
nenhuma (decisão 5). Não é derivabilidade, porque quem responde isso é a regra
de derivação, que lê o campo **junto com onde a cópia mora** e chega a respostas
opostas para o mesmo valor: `in-review` na base recusa, `in-review` no diff
passa. Um campo que respondesse "serve para derivar" teria de mudar de valor
conforme quem pergunta — que é a definição do rótulo que se descola do fato, e é
o defeito de origem desta ADR.

É também o que torna a tabela status×pasta legível: **são dois eixos, e nenhum
dos dois é aprovação.** A pasta responde "isto descreve código que existe?"; o
`status:`, "quão pronto o autor diz que este texto está?". A aprovação não mora
em eixo nenhum dos dois — mora no merge.

**A regra que substitui `approved:` é uma só: derive do pai que o review vai
ver.** O campo `status:` continua no arquivo; o que muda é qual cópia dele vale.
Ela se parte em duas metades que não têm o mesmo dono, e **o sétimo corte é
descobrir que elas nunca tiveram**:

- **O texto do pai — do agente, e sem comando nenhum.** A árvore de trabalho da
  branch **é** a cópia que o review vai ver: o diff do PR é exatamente ela
  contra a base. Ler o pai é abrir o arquivo. O `git show` nunca foi preciso
  para isto.
- **O veredito sobre o pai — do gate, e de mais ninguém.** "A base carrega este
  pai? com que `status:`?" é pergunta de fato sobre o repositório, respondida
  onde o git existe sempre e onde falhar é barato.

Nas duas metades a forma é:

- **A base tem o pai** — a cópia da base decide, e ela tem de dizer
  `status: approved`. Tocar o arquivo no seu PR não muda essa resposta, e
  movê-lo de pasta também não.
- **A base não tem o pai** — sob nome nenhum. Ele nasce neste PR, chega ao
  review colado no filho, e o merge aprova os dois no mesmo ato. Deriva-se dele
  como está no PR, e a cópia dele no diff não pode dizer `draft` nem `rejected`.

**"A base" é o `main` contra o qual este PR é medido**, e onde o resto desta
decisão diz `main` é disso que fala. As duas divergem quando `main` anda depois
do ponto de ramificação, e a decisão 9 escolhe a base, com a razão e o preço.

**O sétimo corte, e os dois defeitos que o forçaram.** O primeiro foi medido: o
`--find-renames` que o sexto corte usava para achar o caminho antigo **tem
limiar**, e abaixo dele o caminho antigo não existe na saída. Nota de 16 linhas,
mesmo nome, movida entre pastas e reescrita no mesmo PR: `-M50%` a `-M10%` não
detectam, o git reporta delete + add, e o ramo 2 conclui "nasce neste PR" —
que é a porta que o sexto corte fechou, com a fechadura um degrau acima. O laço
vermelho está no `docs/LESSONS.md` (2026-08-21), escrito pelo Keeper, e o risco é
maior justamente nas notas curtas — `bug-fix`, `simplification`, `testing` —
onde mover entre pastas não é exceção, é o que a decisão 1 obriga.

O segundo defeito é maior e é a raiz. **Metade do squad não pode rodar `git`:**
medido em `agents/*.md` no campo `tools:`, Rubick, Lina, Lion e Zeus não têm
`Bash` — quatro dos oito. E esta decisão chamava a regra de "regra de agente,
executável em um comando antes de derivar", tornando-a **mais** dependente de
comando a cada corte: `git show`, `git fetch` antes, `git diff --find-renames`
para o caminho antigo. Um agente que se compromete a rodar um comando antes de
derivar **é uma promessa** — e "invariante sustentada por disciplina não está
sustentada" é o critério com que esta ADR abre, e com que ela reprovou os
defeitos do contexto. Estava escrito no coração dela.

**A regra estava na camada errada, e trocar de camada resolve os dois de uma
vez.** O agente lê no contrato o que é legal derivar; o `notes-tree` prova em
CI. A executabilidade morre como problema, porque nenhum agente precisa de
shell. A promessa vira máquina, e a ADR passa a obedecer o próprio critério. E o
limiar do rename vira detalhe de implementação de um gate que pode ser
fail-closed, o que um agente com a saída de um comando na mão não podia ser.

**E, na camada do gate, o limiar não precisa nem de fail-closed: ele some.** A
identidade da nota não é o caminho e não é a similaridade do conteúdo — **é o
nome do arquivo**, que é o que a decisão 2 fixou como "o token pelo qual o
repositório já cita a nota" e o que a decisão 10 preserva em cada um dos
movimentos que ela manda fazer. O gate pergunta pelo **nome**, não pelo caminho:

1. o nome do pai aparece uma vez sob `docs/notes/**` na base → é ele, e o
   `status:` que vale é o de lá, esteja em que pasta estiver;
2. não aparece nenhuma vez → nasce neste PR, e vale o ramo 2;
3. aparece mais de uma vez → **falha**, pedindo que se desfaça a colisão de
   nome. É a honestidade operacional do `R14` do Runtime aplicada a um gate: não
   se finge uma garantia que não se pode entregar — quando não dá para provar,
   recusa.

Nenhuma heurística, nenhum `-M`, nenhuma fronteira de conteúdo. O que sustenta
isso é uma obrigação nova, e ela é a única que este corte acrescenta: **nota que
a base carrega não desaparece da árvore.** Se o nome pudesse sumir, sumiria com
ele a identidade, e a lavagem voltaria pela porta do rename-de-nome em vez do
rename-de-pasta. A obrigação não custa nada porque esta ADR já acreditava nela
por três caminhos independentes — `archived/` e `rejected/` existem para que
nota não se apague, o `FROZEN.sha256` só cresce, e "decisão registrada
permanece" é a decisão 6. O que faltava era um gate.

Fica registrado, e é o padrão da semana pela quinta vez: **o sexto corte foi
achado por leitura e consertado por leitura, e o conserto durou uma rodada.** O
que o derrubou foi alguém construir um repositório descartável e varrer o
limiar. Regra que só é lida não mostra o buraco.

**O quinto corte, e a medição que o forçou.** O quarto corte escreveu, no
presente do indicativo, que a leitura de `main` "recusa esse caso e nada mais".
Medido contra este repositório no dia em que a frase foi escrita, ela falha nas
duas direções.

*Recusa demais.* O `docs/` da base é quase todo pré-contrato: cabeçalho ausente,
ou cabeçalho solto sem as cercas `---`. Cruzando a regra de derivação com a
regra de cabeçalho do próprio contrato — "linha solta não é status; artefato sem
cabeçalho não tem de onde ser derivado" —, **quase nada na base serve de pai**,
e esta ADR não serve, porque a base não a carrega sob nome nenhum. É o mesmo
teste com que esta decisão matou o `approved:`, e ela não o havia apontado para
a regra que entrou.

**A versão anterior deste parágrafo dizia "nada", com a contagem junto, e as
duas coisas envelheceram dentro do review desta ADR** — um PR irmão mergeou e
levou a `main` pelo menos um artefato com cercas dizendo `status: approved`, que
é derivável pela letra e sem cláusula de intervalo nenhuma. O erro não foi a
medição: foi escrever o resultado dela numa cláusula que ninguém remede. Fica
"quase nada", que é o que o critério sustenta sozinho.

*Recusa de menos.* O caso que a regra existe para recusar — escrever o requisito
na sua branch e derivar dele no mesmo PR — é exatamente o que a decisão 11 e o
contrato de artefatos fazem: a decisão 11 é o requisito, o `SKILL.md` é o
derivado, os dois na mesma branch. Escapava porque o `SKILL.md` cai na linha 6
da escada, não carrega `depends_on:`, e a cláusula do quarto corte governava
"o pai declarado no `depends_on:`, e nada além dele".

*E o caso do pai criado no mesmo PR era maior do que bootstrap.* Sob "cada
transição exige o pai mergeado", a cadeia de produto — PRD, EPIC, story, nota
de `architecture` — cobra **quatro merges sequenciais** para ir do primeiro
artefato ao último. E não é hipótese: um lote de artefatos irmãos que chega
pronto, com `depends_on` entre eles, é o modo normal de trabalho deste
repositório — a versão anterior desta linha provava isso com um sha e duas
contagens, e a base não alcança nenhum dos dois. A regra não era praticável.

**A forma nova, e por que ela é a certa.** Sob "a aprovação é o merge", o PR é
revisado como unidade: o revisor vê pai e filho juntos. Logo pai-e-filho-no-
mesmo-PR nunca foi a ameaça. **A ameaça é derivar de conteúdo que não entra em
revisão nenhuma** — o que vive só na árvore de trabalho de um agente e não chega
ao diff. As duas situações que a forma nova admite são revisáveis; a que ela
proíbe é a única que não é. É subtração, não emenda: o "bootstrap" da decisão 12
item 4 deixa de precisar de cláusula, e a isenção nomeada — que já falhou três
vezes nesta decisão — não volta por uma quarta porta.

**A assimetria entre as duas perguntas é deliberada, e é escolha de projeto sem
caso empírico atrás.** Um pai que nasce no PR não precisa dizer `approved`; um
pai que já está em `main` precisa. A razão se sustenta sozinha e cabe numa
linha: **`main` é o único lugar onde mora um veredito já dado.** Sobre o que
`main` não carrega não há veredito a contrariar, e por isso não há o que exigir;
sobre o que ela carrega há, e promovê-lo no próprio diff seria dá-lo por si
mesmo. É a mesma regra que sustenta "agente nenhum aprova o próprio artefato" —
não a folga de um caso particular.

**E é preciso registrar de onde veio a versão anterior desta linha, porque o
erro é do tipo que esta ADR existe para não cometer.** Três vezes, no presente
do indicativo, esta decisão afirmou que `RUNTIME-F04`, `F06` e `F07` "estão em
`main`, mergeadas", e as usou como o caso medido que sustentava a assimetria.
Medido no review desta rodada, `git show origin/main:docs/spec/RUNTIME-F04-capability-providers.md`
responde `fatal: exists on disk, but not in 'origin/main'`, e o mesmo vale para
`F06`, `F07` e para esta própria ADR: são arquivos novos, adicionados em
`ec759b5`, que nunca foram mergeados. **O argumento sobreviveu; a prova não
existia.** Três afirmações não verificadas dentro da ADR que institui um gate
cujo ofício é pegar afirmação não verificada — e nenhuma das três foi pega por
leitura; todas por alguém rodar o comando. As três viram, aqui, o caso que a
assimetria vai proteger **quando** `main` carregar uma nota que o Founder recusa
por escrito, e não um dia antes.

**O ramo 2 aperta agora, e não fica como resíduo.** O corte anterior deixou
escrito que o pai nascido no PR não é conferido por `status:` nenhum, com
gatilho para apertar *depois* de alguém derivar de um pai `draft`. Isso é a
promessa que o começo desta ADR condena, aplicada à regra que ela acabou de
escrever: dispara depois do dano, depende de um humano notar, e nenhum dos cinco
gates o mede. **Fica decidido: a cópia do pai no diff não pode dizer `draft` nem
`rejected`.** É uma asserção do `notes-tree` sobre o diff, e com o sétimo corte
os dois ramos são asserções do mesmo gate, lidas do mesmo lugar — a base e o
diff. Custa uma linha.

Ela não contradiz "o rótulo da sua branch não vale nada", que é o que esta ADR
decidiu quatro vezes. **Um rótulo não concede, mas confessa.** A autoridade do
pai nascido no PR continua vindo de ele estar no diff, onde o revisor o lê; o
que a asserção faz é recusar quando o próprio autor escreveu que o texto não
está pronto. É a única leitura de rótulo de branch em toda esta ADR, e ela **só
recusa**. O que o gate continua não sabendo perguntar é o que importa — se o
texto do filho depende do pedaço do pai que o PR mudou —, e isso é leitura, não
forma. Fora da árvore de notas não há `depends_on:` a ler, e aí quem confere é o
review, como antes.

**Uma espécie de fraude continua fora do alcance do gate, e uma que parecia
estar fora entrou.** Copiar o conteúdo de uma nota recusada para um **nome
novo**, sem supersessão, aparece no diff como duplicata, e quem a pega é o
review — é o único caso que sobra, e sobra porque fechá-lo exigiria comparar
conteúdo. **Mover** já não é fraude alcançável só por review: é o sexto corte, e
o sétimo o pôs no gate. E **superseder** deixou de ser, no oitavo: a versão
anterior desta linha dizia "duplicata" de toda lavagem por nome novo, e isso é
falso para a supersessão, cuja assinatura no diff é idêntica à do ato sancionado
— não há duplicata a ver. O alcance da supersessão está na decisão 5, e é o gate
que o cobra.

**O corte anterior pedia duas condições, e a segunda colidia com o ciclo de
build deste mesmo repositório.** Ela era "o arquivo na sua árvore é idêntico ao
de `main`". Mas o contrato manda o Jakiro escrever `status: in-progress` e
anexar `## Dev Log` na própria story de que ele deriva o código: no instante em
que cumpre o ciclo de build, a cópia dele deixa de ser idêntica e, pela letra,
ele perde o direito de derivar. O PR que muda pai e filho junto — que esta mesma
decisão chama de caso normal — cai igual, e o registro vivo também, porque ele é
reescrito continuamente e o contrato manda tirar nomes e costuras dele. O
contrato antigo tinha isenção nominal para o ciclo de build; a decisão 11 item 7
a removeu alegando que ela "não descreve caso algum sem o rebaixamento", e o
argumento estava errado: a condição de identidade reproduz o mesmo caso por
outro mecanismo.

**O conserto não é reenumerar a isenção — é perguntar onde o pai está, e não o
que a sua cópia diz.** Enumerar onde o conteúdo mora já falhou três vezes nesta
ADR, e falharia uma quarta na próxima seção de apêndice que nascer. A pergunta
"o pai está em `main`, ou nasce neste PR?" não precisa saber o que é conteúdo e
o que é execução, nem o que é bootstrap e o que é dia normal: as duas respostas
são revisáveis, e nenhuma delas depende de um rótulo escrito numa branch. Cai a
enumeração, e o caso comum — pai e filho no mesmo PR — deixa de ser violação
para virar o que sempre foi: o PR propõe os dois juntos, e o merge aprova os
dois juntos.

O que a regra recusa, depois do quinto corte, é um caso só: **derivar de texto
que nenhum review vai ver** — o que existe só na sua árvore de trabalho e não
entra no diff. A condição de identidade recusava-o junto com um punhado de casos
legítimos; a leitura de `main` como condição única recusava-o junto com tudo o
que `main` carrega e com o próprio trabalho desta ADR.

**O registro vivo fica fora da regra**, e é preciso dizê-lo porque o contrato
manda derivar nomes do glossário e costuras do mapa de testes. Registro vivo não
carrega conteúdo aprovado: é a fotografia do estado de agora (decisão 10 item
5), e "agora", para quem está dentro de um PR, inclui esse PR. Ler a cópia de
`main` devolveria a fotografia anterior à mudança do próprio leitor — o termo
que a Lina acabou de registrar no glossário sumiria justamente para quem o
registrou. Registro vivo nunca é pai de quem deriva: dele saem nomes e costuras,
não requisitos.

**E o pai é aquele de quem se deriva, tenha ele cabeçalho ou não.** Onde há
cabeçalho, é o que o `depends_on:` declara; onde não há — código, prompt de
agente, o contrato de artefatos, tudo o que cai na linha 6 da escada —, é a nota
que o trabalho cita como fonte. O quarto corte escreveu "a regra governa o pai
declarado no `depends_on:`, e nada além dele", e essa formulação deixou a
derivação para fora de `docs/` sem regra nenhuma: é literalmente por ela que o
caso-alvo escapou, com a decisão 11 de requisito e o `SKILL.md` de derivado na
mesma branch.

**E há um terceiro estado, que as duas perguntas não cobrem porque não há o que
perguntar: o pai que não é arquivo do repositório.** O brief do Founder é o caso
inteiro — não está em `main`, não nasce no PR, e é o pai desta ADR e o da nota
da cadeia de derivação. Ele se escreve `depends_on: -`, o gate não tem o que
resolver, e quem confere que o derivado é fiel ao pai é o review, que é quem já
confere a única coisa que nenhum gate confere. **Não é uma isenção nova, e é preciso
dizer por quê:** isenção é folga concedida a um caso que a regra alcançaria; aqui
a regra não alcança, porque ela lê arquivos e não existe arquivo. A rota de fuga
— escrever `-` para um pai que existe no repositório — o review fecha de graça,
porque a nota cita a fonte no corpo e o `-` contradiz a citação. Com isto, o
`depends_on: -` da nota da cadeia (decisão 12 item 4) deixa de ser exceção
nomeada e passa a ser a instância obrigatória de um estado geral: nela o pai
externo é impossibilidade, nas outras é circunstância.

É isso que torna o rebaixamento desnecessário em vez de opcional. No instante
em que você edita um artefato aprovado, a sua cópia deixa de ser a de `main`, e
o `status: approved` de `main` continua descrevendo o conteúdo de `main` — que
não é o seu. **O rótulo não tem como mentir sobre o seu conteúdo porque nunca
falou dele.** A decisão 5 cobrava uma edição de cabeçalho para produzir esse
efeito; o git o produz sem que ninguém escreva nada, e sem depender de o autor
lembrar.

**`updated:` sai sem regra substituta, e é preciso dizer por quê.** O corte
anterior justificava "a emenda aditiva não move `updated:`" com o argumento de
que assim `updated: <= approved:` ficava verdadeiro por construção. Tirado o
`approved:`, esse pagamento some e o argumento fica órfão. O conserto não é
dar-lhe outro argumento: é notar que, sem `approved:` e sem a máquina de
emendas, **o campo não tem mais consumidor nenhum.** A ADR já dizia a frase
inteira e não tirava a conclusão — "quem data byte é o `git log`, e um
`updated:` que o duplicasse seria um `git log` pior, o registro paralelo que
esta ADR existe para não criar".

**Cai junto tudo que orbitava o campo:** o intervalo "o registro da aprovação
anda um PR atrás do merge" (não há registro a escrever), o `approved: -` para
irrecuperável (não há campo), a reconstrução retroativa na migração (decisão
10, item 6), e o parser de `(#NN)` no assunto do squash (ninguém o lê).

**O caso que parecia contraexemplo, e não é.** Existe spec que descreve código
que shipou e que traz `status: in-review` escrito no cabeçalho, e nenhuma delas
está na base — a versão anterior desta decisão afirmava três vezes que algumas
estavam, e o comando desmentiu (medição abaixo). **O argumento não depende de
quantas são, e é por isso que o número saiu:** no dia em que entrarem,
"mergeado = aprovado" será falso para cada uma delas. É exatamente por isso que
`status:` fica. O que elas precisam declarar não é *quando* alguém aprovou; é
*que não se deriva delas*, e `status: in-review` em `main` diz isso inteiro. A
prosa que hoje mora no `approved:` delas explica **por que** o status é esse: é
razão, e razão mora no corpo. A migração a move para lá.

**E a razão não é uniforme, o que a versão anterior também errava.** Ela dizia
"o Founder recusa aprová-las: a fonte transcrita chegou danificada", e isso vale
para algumas; a spec da fase mais recente registra no corpo que as anteriores
estavam **sendo transcritas** quando o status foi escrito, e são legitimamente
`in-review` por isso. Duas razões diferentes, o mesmo rótulo — que é o que o
rótulo deve fazer, porque o que ele afirma é "não se deriva daqui", e não o
motivo. O motivo mora no corpo de cada uma. O efeito, esse, é único e está na
decisão 10 item 3: `implemented/feature/` pode nascer com mais não-derivável do
que derivável, e nenhum gate fica vermelho por isso.

**Da regra de derivação, o que é fato vira gate e o que é leitura fica com o
review — e nada fica com um agente prometendo rodar um comando.** Esta é a
fronteira do sétimo corte, e ela substitui a do quinto, que dava a regra inteira
ao agente:

| Pergunta | Quem responde | Por quê |
|---|---|---|
| O pai existe na base? sob que `status:`? | `notes-tree` | fato sobre o repositório, e o CI é onde o git existe sempre |
| A cópia do pai no diff diz `draft` ou `rejected`? | `notes-tree` | forma de arquivo, medida no diff |
| Dois arquivos com o mesmo nome na base | `notes-tree`, falhando | identidade ambígua não se adivinha |
| O `depends_on:` aponta para o pai certo? | review | juízo, e o gate não sabe qual é o certo |
| O texto do filho depende do pedaço do pai que o PR mudou? | review | leitura, não forma — e é o que importa |
| Derivação de quem não tem `depends_on:` (linha 6 da escada) | review | não há campo a ler, e um gate não sabe o que um `.js` deriva |

**O que morre é a formulação "regra de agente, executável em um comando antes de
derivar."** Ela era falsa por medição — `agents/*.md` mostra Rubick, Lina, Lion e
Zeus sem `Bash`, quatro dos oito — e era promessa por construção, que é a classe
que esta ADR condena. As duas últimas linhas da tabela continuam sendo review, e
review não é promessa de agente: é o gate humano que esta ADR nunca tentou
substituir.

**O que o agente faz, e é tudo:** abre o arquivo do pai. A árvore de trabalho é
a cópia que o review vai ver, e nenhum comando é preciso para lê-la.

**O contra-argumento, e a resposta.** O agente descobre tarde: em vez de recusar
antes de escrever, escreve e o CI reprova. É verdade, e vale igual para os cinco
gates — nenhum deles avisa antes. A troca é uma promessa que metade do squad não
podia cumprir por um vermelho que ninguém pode ignorar, e o custo é uma rodada
de CI. **Gatilho para reabrir:** derivação de artefato desalinhado que passe
pelo review, ou custo de rodada de CI que torne o feedback tardio caro o
bastante para valer uma segunda camada.

**Onde os dois primeiros cortes caíram.** Ficam registrados porque cada um
mediu uma coisa que continua verdadeira. O primeiro corte deu a unidade como
`## Decisões`, e o esqueleto da decisão 9 só a obriga em `architecture` e
`process`: em `feature`, `bug-fix`, `simplification` e `testing` a unidade era
vazia — uma spec de fase não tem `## Decisões`, então proteger essa seção nela
protege nada, e todo rebaixamento que ela registrasse viraria zero. O segundo corte alargou a unidade para
o corpo e chocou-se com o `updated:` obrigatório: `updated: 2026-08-21 ->
2026-08-22` não tem link para retirar e não é igual à base, então **toda**
correção obrigada pelo gate 3 virava substantiva. As duas medições sobrevivem
como o mesmo diagnóstico — **enumerar onde o conteúdo mora nunca fecha** — e o
terceiro corte não enumera nada porque não protege nada.

### 14. O arsenal nativo: o que adotamos, e por que o resto não

A instrução do Founder é "sem divergência", e o teste é o mesmo em todos os
itens, nesta ordem: **a plataforma já faz? adota. Não faz? a nossa versão fica,
e a razão é o que ela consegue e a plataforma não — nunca o fato de ser
nossa.**

**Adotado: required status checks na proteção de `main`.** É a única adoção que
acrescenta regra, e ela paga o próprio custo. Hoje o `ci.yml` roda em
`pull_request` e nada impede mergear com o X vermelho na tela: os cinco gates da
decisão 9 são, literalmente até esta linha, invariantes sustentadas por
promessa — a promessa de que alguém olha. Com o check obrigatório, o gate
vermelho para o merge, e o merge é a aprovação (decisões 5 e 13). É a
configuração que converte esta ADR inteira de intenção em fato.

**Adotado: proteção de branch em `main`, como fronteira externa.** A matriz já
tem `no-direct-push-main`, e ela vale por dentro: recusa a tentativa do agente
antes de ela sair. A proteção nativa vale por fora e alcança quem não passa pelo
guard — um humano no terminal, um token. Não é duplicação, é a mesma camada
dupla que o Runtime já justifica quando o Sandbox restringe depois de a Policy
autorizar. Nenhuma das duas sai.

**Não adotado: CODEOWNERS como matriz de autoridade.** Duas razões, e a
primeira é medida. (a) CODEOWNERS roteia review por conta do GitHub; os oito
principais do squad são personas dentro da sessão de uma pessoa e assinam com
**uma identidade git só** — é a mesma medição que já recusou "quem escreveu a
linha?" como pergunta de gate. Um CODEOWNERS que mapeie os oito para a mesma
conta não separa nada. (b) As duas coisas governam perguntas diferentes:
CODEOWNERS decide **quem revisa o PR**, depois da escrita; a matriz decide **se
a escrita acontece**, no instante da invocação da tool. O defeito que o Keeper
mediu na matriz — `squad.policies.json` não conhece a árvore de notas: zero
ocorrências de `docs/notes` e zero das seis classes, logo classe nenhuma tem
escritor — é bug da matriz, e CODEOWNERS não o conserta porque não sabe parar
escrita nenhuma. A outra metade daquela medição, "sítios do contrato que
concedem escrita que a matriz não concede", **morreu com o contrato novo**: ela
foi feita contra o contrato anterior, e o de agora declara não conceder escrita
nenhuma. Sobra a metade viva, e ela merece a frase sozinha. Conserto da
matriz é entrega do Invoker; a decisão 7(c) já diz o que ela precisa ganhar.
**Gatilho:** a segunda conta GitHub no repositório.

**Não adotado: required reviews.** O GitHub não deixa o autor de um PR aprovar
o próprio PR. Com uma conta só, exigir review aprovador significa que nenhum PR
merge sem bypass de admin — e regra cujo caminho normal é o bypass é pior que
regra nenhuma. O Founder Gate aqui é o próprio merge, e só o Founder o executa.
**Gatilho:** o mesmo, a segunda conta.

**Não adotado: template de PR para carregar o mandato de escrita.** Template é
prosa numa caixa de texto que o autor apaga, e é checklist — a coisa que esta
ADR existe para não usar. O mandato da decisão 4 se mede no diff: PR que toca
código sem tocar `docs/notes/**` fica vermelho, e nenhum template produz isso.
O que ele produziria é a isenção declarável por outra porta ("N/A — PR
trivial"), que é o que a decisão 4 recusou explicitamente. **Gatilho:** o
fallback já registrado em Alternativas — mandato só no veredito de review —
entrar.

**Convenção declarada no contrato, sem gate: Conventional Commits — e só ela.**
Nem ela nem o squash merge passam no portão das três condições — reverter é
trivial, ninguém se surpreende, não houve alternativa pesada —, e por isso
seriam convenção declarada em vez de decisão desta ADR. **Mas eles não têm o
mesmo lastro, e a medição separa.** O squash com `(#NN)` no assunto é prática
travada deste repositório, muito anterior a esta ADR. Conventional Commits **não
é**: a medição da rodada 6, feita contra `main` e contra todos os refs, achou
conformidade residual, e a maioria dos commits conformes estava datada do próprio
dia em que a regra nasceu. Pelo critério que o fim desta decisão escreve, ela
cita a si mesma um dia depois.

**Os números daquela medição não ficam escritos aqui, e é regra desta ADR, não
economia de prosa.** Contagem de commit envelhece a cada push — a mesma medição,
refeita duas rodadas depois, já devolvia outros dois números —, e número que
envelhece sozinho é o registro paralelo que a decisão 13 recusa. O que fica é o
veredito e a data em que ele foi medido; quem quiser o número roda a medição, que
é onde ela é barata.

**E o `(#NN)` do squash, ainda que seja prática travada, sai do contrato.** Ele é
fato de instalação — prática *deste* repositório —, e a decisão 11 item 8 proíbe
o contrato de afirmar fato de instalação. O item 7 o autorizava por ser "prática
medida do repositório", e é a autorização que cai. Sem consumidor estrutural (o
parser morreu com o `approved:`, no fim desta decisão), ele não paga nem a
própria linha.

Fica assim mesmo, e a honestidade é o preço inteiro: o contrato a declara
**daqui para frente**, sem gate e sem retroatividade, dizendo que institui a
forma em vez de codificar prática. Convenção que institui sem gate não reprova
nada do que existe — o que seria fraude é escrevê-la como codificação de
prática, e foi o que a primeira redação do contrato fez, duas rodadas seguidas.
**Gatilho para removê-la:** ela continuar sem lastro quando alguém for medir de
novo — se instituir não instituiu, a regra é folclore e sai.

**E o que fica do squash é uma linha nesta ADR, não no contrato:** ele continua
sendo como este repositório merge, o `(#NN)` continua ligando commit e PR, e
nenhuma regra o lê. Conveniência, medida aqui, invisível lá.

**O critério que separa adotar de manter, e ele nasceu de um erro nosso.** A
decisão 13 anterior escreveu "travamos comportamento observado" citando um
intervalo de specs como prova de que a forma de `approved:` já era prática — e a
própria citação estava torta, porque uma das specs do intervalo trazia
`approved: -`. A medição completa dizia outra coisa: o único lugar em que a forma
aparecia conforme eram specs **transcritas por nós no mesmo dia**, já sabendo da
regra, e os cabeçalhos delas registram a transcrição. Isso não é comportamento
observado; é comportamento que acabamos de produzir. A decisão 4 reivindica a
expressão pelo mesmo teste, e a evidência dela é a única desta ADR que ficou
**por medir**: o comando está lá, a base não alcança PR nenhum, e afirmar sem
medir é o que esta linha existe para condenar. **Uma regra que trava
prática cita evidência anterior a si mesma; uma regra que inventa prática cita
a si mesma um dia depois.** É por esse teste que cada item acima recebeu o
veredito.

## A conta

Unidade: **obrigação enunciada que um agente cumpre ou um gate verifica**,
contada uma vez onde é enunciada. Cláusula de migração — que roda uma vez e
some — fica fora.

| Subsistema | Antes | Depois |
|---|---|---|
| Cabeçalho: cercas, cinco campos, `blocked_by:`, conjunto de status, forma de `approved:`, gate do merge alcançável, `approved:` nunca no PR que aprova, `approved: -` | 12 | 6 |
| Emenda, unidade protegida e derivação | 6 | 4 |
| Árvore: ciclo de vida e classe fechados, ausência de índice, tabela pasta×status, terminalidade de `archived/` e `rejected/` | 4 | 5 |
| Nomes: forma por classe, token de fase, nota da cadeia (nome, conteúdo, unicidade) | 5 | 5 |
| Conteúdo: esqueleto, laço vermelho e a lista de isenções da migração, um arquivo por nota, uma lição por arquivo, registros vivos fora da árvore | 6 | 6 |
| Declaração provada por execução: link é a declaração, símbolo colado, caminho em prosa falha | 3 | 3 |
| Mandato de escrita | 1 | 1 |
| Congelamento por manifesto | 1 | 1 |
| Autoria com autoridade | 1 | 1 |
| CI: `fetch-depth: 0`, sem "all skipped -> green" | 1 | 1 |
| Proteção de `main`: checks obrigatórios + base atualizada | 0 | 2 |
| **Total** | **40** | **35** |

Os seis que sobram no cabeçalho: cercas `---`; `status:` presente; conjunto
fechado de `status:`; `owner:`; `depends_on:`; `blocked_by:` em story. Os quatro
que sobram na segunda linha: a assinatura da supersessão — que o oitavo corte
**estreitou** em vez de acompanhar, porque o alcance é uma condição da mesma
assinatura e não uma obrigação a mais —, a regra de derivação, a asserção do pai
nascido no PR, e **"nota que a base carrega não desaparece da árvore"**, que é o
que faz o nome do arquivo servir de identidade sem heurística nenhuma. Essa
última entrou no **sétimo** corte, e não nesta rodada: a prosa que a chamava de
"a única obrigação que esta rodada acrescentou" envelheceu junto com a rodada
que a escreveu, e envelheceu na seção cujo assunto é contabilidade honesta. A
regra de identidade por nome não conta como obrigação nova: é a mesma pergunta
apontada para um índice que não tem limiar.

**Cinco regras a menos. Entraram ao longo dos cortes quatro coisas, e elas valem
cinco unidades na tabela:** a proteção de `main` (duas — os checks obrigatórios
e a base atualizada), a asserção de uma linha sobre a cópia do pai no diff, a
invariante de não-desaparecimento, e a terminalidade das duas pastas congeladas.
O alcance da supersessão **não** está nesta lista, e é por isso que a segunda
linha da tabela não subiu: ele é condição da assinatura que já estava contada.
**Do nono corte é só a terminalidade**, e ela não é regra nova sobre um caso
novo: é a mesma pergunta da não-desaparecimento comparando caminho além de
existência, e o que ela substitui é uma **permissão** — a saída de `rejected/` —
que nenhum gate conseguia executar. Trocar permissão impossível por obrigação
verificável sobe a conta em um e desce a dívida em um ato. Uma coisa **saiu da conta sem entrar em lugar
nenhum**, e é o resultado do sétimo corte: a regra de derivação deixou de ser
obrigação de agente e virou asserção de gate. Ela continua contada uma vez —
mudou de dono, não de número. **E duas coisas do décimo corte não entram na
conta, cada uma por uma razão:** o limite escrito na decisão 1 sobre a entrada em
`rejected/` não enuncia obrigação nenhuma — declara que não há gate e nomeia o
dono do movimento, e dono é endereço, não permissão; e a forma do gatilho
(condição, sem remédio) **estreita** a obrigação de escrever o gatilho, que já
estava contada em "esqueleto", pelo mesmo argumento com que o alcance da
supersessão não subiu a segunda linha. As decisões numeradas vão de 13 para 14: o número
de decisões subiu porque os vereditos sobre o arsenal nativo precisam de endereço
citável, e o número de regras caiu. Se a próxima rodada quiser cortar mais, o
candidato óbvio não está nesta lista — está na matriz de autoridade, que a
decisão 14 mandou consertar e não mandou crescer.

## Alternativas descartadas

Dez entradas desta lista descrevem escolhas dentro da máquina de emendas que a
decisão 5 removeu — o carimbo aditivo, a terceira categoria, a quarta, o preço
único, o fechamento por classe, a supersessão parcial, a fronteira pela forma do
diff, a seção nomeada nas seis classes, o `updated:` como exclusão, e a autoria
do commit. Ficam registradas, e não apagadas, porque **o caminho é o
argumento**:
duas partições diferentes falharam contra o repositório real antes de a
pergunta certa aparecer, e a pergunta certa não era "qual partição" — era "por
que estamos cobrando um preço que a plataforma já cobra".

- **Manter o que existe: `docs/adr/` plano, status só no cabeçalho,
  `LESSONS.md` único, escrita voluntária.** É o estado que produziu os defeitos
  da tabela de contexto. Gatilho que a reabriria: nenhum.
- **Triplet bilíngue (`.md` + `.pt.md`/`.zh.md` + `.i18n.yaml`), como a
  referência.** Gatilho: **mudança de audiência** — o repositório sair do
  modo shadow e passar a ter leitor além do Founder. Não é gatilho de
  escala: número de notas não reabre esta decisão. O manifesto de hash já
  estará no lugar e é o mesmo mecanismo que detecta tradução vencida, então
  o custo marginal de reabrir é baixo — o custo alto é escrever duas vezes.
- **Data no nome para todas as classes**, como na referência. Gatilho:
  primeira colisão real de dois agentes reivindicando o mesmo `ADR-NN` em
  paralelo.
- **`INDEX.md` ou `docs/adr/README.md` como índice.** Índice manual é o
  artefato que apodrece primeiro, e a referência decidiu igual. Gatilho: a
  árvore deixar de responder a um `ls` de relance por classe.
- **Mandato só no veredito de review** (quem reprova deve lição), em vez de
  por PR. Mais barato e cobre a origem das lições que hoje existem, mas deixa
  passar decisão e simplificação. Gatilho: `simplification` e `process`
  encherem de notas sem conteúdo.
- **Manifesto de hash cobrindo todas as notas, não só as congeladas.**
  Gatilho: nota viva editada por fora do fluxo de PR — hoje impossível, porque
  o único caminho até `main` é o merge que o Founder executa.
- **Manter a pergunta "havia mais de um resultado possível" e só apertar o
  satisfator aditivo.** É pergunta de intenção: nenhum aperto no satisfator
  alcança quem a responde. Gatilho que a reabriria: nenhum.
- **Uma terceira categoria para "acrescentar decisão a documento que continua
  correto".** Duas falhas em uma semana numa máquina de duas saídas é partição
  errada, não ramo faltando — e o caso cabe inteiro na emenda substantiva
  assim que ela deixa de significar supersessão. Gatilho: aparecer edição
  legítima que não caiba em nenhuma das três assinaturas.
- **Fronteira pela forma do diff: só acrescentar linha é livre, alterar linha
  supersede.** Mecânica e barata, e fecha a rota da correção de fato — o
  caminho que o código moveu mora numa linha que já existe, e o gate 3 obriga
  a mudá-la. Cobraria supersessão por obedecer a um gate. Gatilho: o gate 3
  deixar de obrigar a correção, o que só acontece se ele sair.
- **Preço único: toda mudança no corpo rebaixa, sem rota aditiva.**
  Uma saída a menos, e falha por volume: um refactor que move um arquivo
  rebaixa toda nota que o cita e a aprovação vira ruído. Gatilho: a rota
  aditiva ser usada para passar prosa, e o teste do resto idêntico não fechar.
- **Fechar a rota aditiva por classe (`process` e `simplification` não a
  têm).** Enumera o que já se deriva: nessas classes a linha alterada não tem
  link para retirar, e a rota se fecha sozinha. A enumeração ainda cobraria
  manutenção a cada classe nova. Gatilho: nenhum.
- **Supersessão parcial — superseder um item da lista, não a nota.** Resolveria
  a desproporção direto, e cobra caro: nota viva cujo item N mora em outro
  arquivo, e derivação por item exigindo endereço estável por item. Gatilho:
  lista de decisões grande o bastante para que rebaixar a nota inteira por um
  item custe review desproporcional.
- **Distinguir símbolo de vocabulário por allowlist derivada do
  glossário** (todo termo do glossário é isento; o resto é
  símbolo). Acopla o gate ao glossário nas duas direções e transforma
  cada termo novo da Lina em manutenção de gate — e volta a ler crase
  como afirmação, que é a raiz do defeito. A regra do link não precisa
  saber o que é vocabulário. Gatilho: aparecer uma classe de citação que
  precise ser verificada e que não caiba em link.
- **Reexecutar o laço vermelho no CI (revert + rodar).** Prova a metade
  vermelha, mas exige orquestração de revert por nota. Gatilho: laço
  vermelho declarado que não reproduz.
- **Uma quarta categoria de ato, para o caso que a unidade nomeada não
  alcançava.** Dois buracos numa máquina de três atos é fronteira errada, não
  ramo faltando — o mesmo argumento que já descartou a terceira categoria uma
  vez. A fronteira nova é subtração: a unidade cresce para o corpo inteiro e a
  enumeração some. Gatilho: aparecer edição legítima que não caiba nas três
  assinaturas com a unidade nova.
- **Obrigar seção nomeada nas seis classes** (`## Decisões` na ADR,
  `## Critérios de aceite` na spec, e assim por diante), para que a unidade
  nomeada tenha o que proteger em todas. Resolveria o buraco de dentro e
  cobraria a reescrita de toda spec que existe e o esqueleto de toda nota futura, para
  caber num formato desenhado para ADR. É enumerar de novo, desta vez com custo
  de migração. Gatilho: nenhum.
- **`updated:` como exclusão enumerada, ao lado das seções de build.** Fecharia
  o buraco de fora com uma linha e deixaria de pé a pergunta "o que mais está
  no cabeçalho e não é conteúdo?" — `approved:` já era o próximo. Tirar o
  cabeçalho inteiro do corpo responde de uma vez, e é uma exclusão a menos em
  vez de uma a mais. Gatilho: nenhum.
- **Identificar quem escreveu `approved:` pela autoria do commit.** Founder e
  agente assinam com a mesma identidade git neste repositório, então a autoria
  não separa nada — e um gate que perguntasse "quem" estaria lendo rótulo, que
  é o defeito de origem desta ADR. A regra do *quando* é fato e roda hoje.
  Gatilho: identidade de commit distinta por principal, o que exige assinatura
  e é outra decisão.
- **Derivação pelo `status: approved` lido da sua branch.** É acreditar no
  rótulo, e perde em todos os cortes desta ADR. O quinto corte não a ressuscita:
  o pai que nasce no PR autoriza por **estar no diff**, onde o revisor o lê, e o
  rótulo dele não concede coisa nenhuma. **Gatilho: nenhum.**
- **A condição de identidade: `main` diz `approved` e a sua cópia é idêntica à
  de `main`.** Foi o que a decisão 13 decidiu no terceiro corte, e caiu no
  quarto. O defeito é que ela cobra, além de "não invente o conteúdo do pai",
  uma segunda coisa que ninguém pediu — "não toque no arquivo por nenhuma outra
  razão" —, e o ciclo de build obriga a tocar. Ela e a leitura de `main` recusam
  o mesmo caso real; só uma delas recusa também o trabalho normal. **Gatilho:**
  aparecer derivação em que ler o pai de `main` seja impossível ou mentiroso —
  o candidato é um artefato cujo caminho mudou no mesmo PR, e aí o comando é
  `git show origin/main:<caminho antigo>`, não uma condição a mais.
  **O gatilho disparou no sexto corte**, e o candidato era a própria migração
  desta ADR. **Ele previu o defeito e errou o conserto:** a resposta que estava
  escrita aqui — perguntar pelo caminho antigo — dependia de `--find-renames`,
  que tem limiar, e o sétimo corte a trocou por indexar pelo nome do arquivo.
  Fica como o gatilho desta ADR que acertou *onde* o buraco seguinte estava e
  não acertou *como* fechá-lo, que é o que um gatilho pode fazer: ele aponta o
  candidato, não escreve a decisão.
- **A leitura de `main` como condição única: só se deriva do que `main` já
  carrega aprovado.** Foi o quarto corte da decisão 13, e caiu no quinto por
  medição, nas duas direções. Recusava demais — o `docs/` da base é quase todo
  pré-contrato, sem cercas e sem `status:` dentro delas, e esta ADR a base não
  carrega —, e recusava de menos, porque governava só o `depends_on:` e deixava
  passar o caso-alvo quando o derivado não tem cabeçalho. Somava a isso quatro
  merges sequenciais para percorrer uma cadeia de cinco estágios. **O aperto que
  o gatilho previa entrou no sexto corte sem esperar o gatilho**, porque gatilho
  que só dispara depois do dano é a promessa que esta ADR condena: o `status:`
  do pai no PR não pode dizer `draft` nem `rejected`. **Gatilho remanescente:**
  derivação de pai nascido no PR que diga `in-review` e que o review deixe passar
  errada — aí o conjunto recusado cresce, e continua sem voltar a `main` sozinha.
- **Isentar nominalmente o "pai criado no mesmo PR" (a cláusula de bootstrap),
  mantendo a leitura de `main` como regra.** É a quarta enumeração de isenção
  desta decisão, e as três anteriores caíram pela mesma razão: enumerar onde o
  conteúdo mora nunca fecha. Além disso a isenção seria falsa como bootstrap:
  pai e filho no mesmo PR não é o primeiro dia de um repositório, é o dia normal
  de um repositório que já tem história. **Gatilho: nenhum.**
- **Exigir as cercas `---` na leitura de derivação desde já, sem cláusula de
  intervalo.** É a forma limpa, e reprova hoje quase todo o `docs/` que a base
  carrega, porque a migração que põe as cercas é o passo 3 da ordem que o próprio
  contrato escreve. Regra que reprova o repositório inteiro no dia em que nasce
  é dívida com nome novo — a frase é desta ADR e vale contra ela. A cláusula de
  intervalo morre com o passo 3 e não é isenção permanente. **Gatilho: nenhum.**
- **`## Alternativas descartadas` substituindo a pasta `rejected/`.** As
  duas coexistem e cobrem casos diferentes: alternativa que perdeu dentro de
  uma decisão mora junto de quem a venceu; proposta que morreu sem decisão
  vencedora não tem onde morar e vai para `rejected/`. **Gatilho: nenhum** — não
  há aperto nem folga que faça uma cobrir o caso da outra; são endereços para
  coisas diferentes.
- **Manter `approved:` e só consertar a forma** — aceitar data nua, ou aceitar
  prosa, ou dar cláusula de avô ao que já existe. Cada aperto e cada folga
  mexem no mesmo defeito sem tocá-lo: o campo continua sendo a plataforma
  reescrita à mão, e o gate continua conferindo se o rótulo concorda com o git.
  Cláusula de avô seria ainda pior: uma isenção permanente é a promessa que
  esta ADR existe para eliminar. **Gatilho: nenhum.**
- **Manter `updated:` com um argumento novo** — por exemplo, "é a data que o
  leitor humano procura primeiro". O `git log` responde melhor e não pode ficar
  desatualizado. Manter uma regra viva depois que o argumento dela morre é
  exatamente o que esta rodada veio corrigir. **Gatilho:** consumidor de
  `updated:` que não seja um humano curioso e que o `git log` não sirva.
- **CODEOWNERS substituindo `squad.policies.json`.** Descartada na decisão 14
  pela identidade única e por governarem perguntas diferentes. **Gatilho:** a
  segunda conta GitHub no repositório — aí CODEOWNERS passa a separar alguma
  coisa, e a pergunta volta legitimamente.
- **Required reviews como Founder Gate.** O autor não aprova o próprio PR, e
  com uma conta só o caminho normal vira o bypass de admin. **Gatilho:** o
  mesmo, a segunda conta.
- **Template de PR carregando o mandato de escrita.** Prosa apagável no lugar
  de um gate sobre o diff, e a isenção declarável de volta por outra porta.
  **Gatilho:** o fallback do mandato por review, se ele entrar.
- **Conventional Commits com gate no assunto do commit.** Reprova no portão das
  três condições — trivial de reverter, óbvio, sem alternativa pesada — e
  acrescentaria o sexto gate para verificar uma convenção que ninguém quebra.
  Fica como prática declarada. **Gatilho:** commit cuja forma quebre alguma
  ferramenta de release, que hoje não existe.
- **Largar a assimetria: só importa o pai estar no diff, em qualquer dos dois
  ramos.** É o outro chifre do dilema do rename, e resolve o mesmo defeito por
  subtração maior — sem exigência sobre `main`, mover o pai não lava nada porque
  não há nada a lavar. Perde porque joga fora a única coisa que o repositório
  sabe e o revisor não: `main` guarda um veredito **já dado**, e um PR que
  promova no próprio diff um pai recusado é indistinguível, para quem lê só o
  diff, de um PR que proponha um pai novo. **Gatilho:** aparecer repositório em
  que `main` não guarde veredito nenhum — nele a assimetria é decoração e sai
  inteira.
- **Indexar a pergunta pelo caminho novo e confiar no review para pegar o
  rename.** É o que a decisão tinha escrito, e o defeito não é o review falhar:
  é que a decisão 1 torna o `git mv` **rotineiro e obrigatório**, então a regra
  passaria a depender de o revisor notar, em todo PR de ciclo de vida, qual
  movimento é sancionado e qual é lavagem. Pedir vigilância proporcional ao
  volume é a definição de invariante sustentada por promessa. **Gatilho:
  nenhum** — o nome do arquivo entrega a identidade sem heurística.
- **Recuperar o caminho antigo com `git diff --find-renames`.** Foi o sexto
  corte, e caiu no sétimo por medição: `--find-renames` é heurística de
  similaridade de **conteúdo**, com limiar em 50%, e uma nota curta movida e
  reescrita no mesmo PR cai abaixo dele — o git reporta delete + add, o caminho
  antigo não existe na saída, e o ramo 2 conclui "nasce neste PR". O laço
  vermelho está no `docs/LESSONS.md` (2026-08-21). **Gatilho: nenhum** — a
  identidade da nota é o nome, que a decisão 2 fixou e a decisão 10 preserva, e
  nome não tem limiar.
- **Fixar o limiar (`-M5%`, ou qualquer outro) e declarar o que acontece quando
  a detecção falha.** É o conserto mínimo do defeito medido, e continua sendo
  heurística: um limiar baixo detecta renames que não são renames, um alto perde
  os que são, e nenhum valor é defensável por argumento — só por amostra. Perde
  para indexar por nome, que é exato e é uma linha mais curta. **Gatilho:**
  aparecer classe de nota cujo **nome** mude legitimamente entre a base e o PR,
  sem ser supersessão — hoje não existe, porque a decisão 10 preserva nome em
  todo movimento sancionado.
- **Falhar fechado ao ver `A` + `D` de mesmo nome entre pastas de ciclo de
  vida.** Era o conserto proposto no review desta rodada e resolve o defeito,
  mas resolve-o **depois** de aceitar a detecção de rename como fonte: o gate
  ainda leria o raw do diff e ainda precisaria de uma regra sobre quando não
  confiar nele. Indexar por nome na base não precisa de detecção nenhuma, e o
  fail-closed sobrevive onde ainda faz falta — colisão de nome, item 3 do
  sétimo corte. **Gatilho: nenhum.**
- **`rejected/` terminal — descartada na rodada anterior, e agora adotada pelo
  gatilho que ela mesma escreveu.** O gatilho era "desrejeição que passe pelo
  review sem ninguém notar; aí o ato precisa de nome próprio, e a terminalidade
  é a forma dele", e o que o disparou não foi uma desrejeição real: foi medir a
  forma do diff dela contra a do movimento rotineiro mais parecido e achá-las
  iguais. A entrada fica registrada aqui como o caminho, e a decisão está na
  decisão 1. **O argumento que a derrubava** — "desrejeitar é ato legítimo e,
  sobretudo, visível" — errava nas duas metades: visível não era, e legítimo não
  chegava a ser, porque gate nenhum o executava.
- **Sancionar a desrejeição como esta ADR a escrevia: sair de `rejected/` num PR
  próprio, cujo conteúdo inteiro é essa saída.** Duas medições a mataram. O ato
  não passa em gate nenhum — os quatro desfechos do `FROZEN.sha256` colidem com
  a decisão 6 —, e a exigência de "PR próprio" é promessa: **nenhum dos cinco
  gates mede escopo de PR**, então nada impede a saída de viajar dentro de um PR
  qualquer, ao lado de qualquer coisa. A visibilidade que sustentava a sanção
  era o revisor ler a pasta de origem num `rename from`, e essa é a forma do
  `git mv` que a decisão 1 torna rotineiro. **Gatilho: nenhum** — a exigência de
  PR próprio só voltaria a valer alguma coisa com um gate que medisse escopo de
  PR, e um gate desses não existe nem foi proposto.
- **O manifesto pode encolher, mas só quando o mesmo diff move aquele nome para
  fora de pasta congelada.** A mecânica é correta e eu não tenho objeção a ela:
  é verificação de dois lados dentro do próprio diff, não pede escopo de PR, e é
  implementável sem ambiguidade. Perde na pergunta anterior — **ela compra uma
  capacidade que ninguém precisa.** Torna a desrejeição possível, e a
  desrejeição só existe para fazer o que uma nota nova faz melhor, com a recusa
  intacta do outro lado de um link que o gate resolve. O preço é trocar a regra
  mais curta desta ADR — "o manifesto só cresce" — por uma condicional com prova
  de dois lados, para habilitar um ato cuja justificativa já tinha morrido na
  medição do `git diff -M`. **E sozinha ela é a regressão**: libera o passo 1 da
  lavagem em dois PRs sem tocar em nada que feche o passo 2.
- **O que foi congelado carrega a marca para sempre, e a supersessão não alcança
  marca.** É a companheira obrigatória da anterior, e fecha a lavagem em dois
  PRs no passo 2, que é onde ela morreria se o passo 1 fosse legal. Perde junto,
  e tem um custo próprio que a terminalidade não tem: para o gate ler a marca
  sem consultar histórico, ela precisa morar na árvore da cabeça — o
  `FROZEN.sha256` deixa de ser a lista do que está congelado e vira o razão de
  todo congelamento que já houve. Aí "todo congelado tem entrada" e "todo hash
  bate" ganham um caso a mais (a linha cujo caminho não resolve); um nome
  congelado duas vezes produz duas linhas cujos hashes não podem bater ao mesmo
  tempo, e o manifesto não tem noção de ordem para desempatar; e a nota
  desrejeitada fica **impossível de aposentar** — marcada, não pode ser
  superseded; viva, só volta a `rejected/`. **E o que foi medido das duas fica
  aqui, para a rodada que reabrir não remedir:** a primeira sozinha reabre a
  lavagem em dois PRs, e a segunda sozinha não tem o que marcar. **Gatilho, e é
  um só para as duas:** reproposta de nota recusada virar rotina, a ponto de a
  árvore carregar mais cópias de conteúdo do que decisões — aí o custo da
  terminalidade, que é duplicar o texto na nota nova, supera o da desrejeição.
- **Pegar no gate a cópia da nota recusada sob nome novo, comparando conteúdo.**
  É o caso que sobra depois do alcance da supersessão, e o único conserto de
  gate é similaridade de conteúdo — a heurística com limiar que o sétimo corte
  expulsou por medição, reintroduzida por outra porta e agora contra um
  adversário que pode reescrever o texto de propósito. A duplicata está no diff;
  review é o que a lê. **Com a terminalidade, este caso encolhe e muda de
  natureza:** o esvaziamento da recusada deixa de ser possível (ela não sai e
  não muda), então o que sobra é uma cópia ao lado de uma recusa parada — que é
  também a forma **legítima** de repropor. As duas são o mesmo diff, e separá-las
  é juízo sobre o conteúdo. **Gatilho: nenhum** — nem um limiar melhor reabre
  isto, porque (b) do argumento do sétimo corte não depende do valor.
- **Alargar a invariante de não-desaparecimento para "o conteúdo de uma nota não
  reaparece sob outro nome".** Resolveria os dois casos de uma vez, e é a mesma
  comparação de conteúdo com outra roupa: a invariante que temos é sobre
  **nomes** justamente porque nome é exato e conteúdo é limiar. **Gatilho:**
  identidade de nota que não seja o nome do arquivo — hoje não existe, e a
  decisão 2 é a razão.
- **Manter a regra na mão do agente e dar `Bash` aos quatro que não têm.** É a
  outra saída para a executabilidade: em vez de mudar de camada, mudar o campo
  `tools:` de Rubick, Lina, Lion e Zeus. Perde por três razões, e nenhuma é de
  esforço. (a) Dar shell a quatro agentes para que eles rodem **um** comando de
  leitura alarga a superfície de quatro personas por uma pergunta que o CI já
  responde. (b) Continuaria sendo promessa: um agente com `Bash` que *pode*
  rodar o comando não é um agente que *rodou* — e "invariante sustentada por
  promessa não está sustentada" não fala de capacidade, fala de garantia. (c) A
  regra ficaria dependendo de o `origin/main` local estar atualizado, que é erro
  silencioso. **Gatilho: nenhum** — nem o conjunto de `tools:` mudando reabre
  isto, porque (b) não depende dele.
- **Deixar o ramo 2 sem asserção, com o gatilho "apertar depois que alguém
  derivar de um pai `draft`".** Era o texto do quinto corte. Cai pelo próprio
  contexto desta ADR: dispara depois do dano, depende de um humano notar, e
  nenhum dos cinco gates o mede. **Gatilho: nenhum.**
- **Exigir `status: approved` do pai nascido no PR, por simetria com o ramo 1.**
  Aí o rótulo da branch voltaria a **conceder**, que é o que esta ADR recusou em
  quatro cortes, e as cadeias longas voltariam a cobrar merges sequenciais — o
  autor escreveria `approved` no pai para poder escrever o filho, e a palavra
  não significaria nada. Recusar `draft` e `rejected` custa o oposto: o rótulo
  só é lido quando confessa. **Gatilho: nenhum.**
- **Cláusula de intervalo só para o formato do cabeçalho, sem a metade da
  ausência.** Era o texto do quinto corte, e cobre o artefato de cabeçalho
  torto deixando de fora o que nunca teve cabeçalho — que é a outra metade do
  defeito registrado no contexto desta ADR, e a metade que inclui o pai
  declarado desta própria ADR. Meia cláusula para um defeito duplo.
  **Gatilho: nenhum.**
- **Rodar a migração antes de o contrato entrar**, para que a cláusula de
  intervalo não precise existir. Inverte a ordem que o contrato escreve, e o
  custo é que a migração passaria a obedecer a uma forma que `main` ainda não
  declara: o PR que move a árvore inteira seria revisado contra um contrato que só
  existe na branch dele. A cláusula de intervalo é o preço de o contrato vir
  primeiro, e ela morre no passo 3. **Gatilho: nenhum.**
- **`status:` derivado do git também** ("está em `main`, logo é aprovado"). É a
  simplificação seguinte e ela é falsa assim que existir em `main` um artefato
  que o Founder mergeou e não quer que ninguém use — o caso que toda spec
  `in-review` produz no dia em que entrar.
  Mergear é o ato de aprovação, e não é o ato de declarar o conteúdo íntegro.
  **E a cláusula de intervalo não é esta alternativa por outra porta:** ela lê
  como `approved` a **ausência** de `status:` no pré-contrato, nunca uma linha
  escrita, e morre no passo 3 da migração. Linha presente vence a ausência, que
  é exatamente o que mantém a recusa prendendo. **Gatilho: nenhum.**

## Consequências

- **PR trivial passa a custar um parágrafo.** É deliberado (decisão 4).
- **A ADR de um parágrafo acaba.** Passa a exigir `## Contexto` e
  `## Decisões` com ao menos um item — o preço, e o único, de dar aos filhos um
  endereço citável em `depends_on`.
- **O gate prova que uma nota foi tocada, não que valia a pena tocá-la.**
  Qualquer satisfator pode ser cumprido com uma edição vazia; quem julga
  valor é o review. Gate que tentasse medir sinceridade seria o próximo
  rótulo a se descolar do fato.
- **`fetch-depth: 0` no CI** vira requisito de correção, não de conveniência:
  sem a base, os gates 2 e 4 não têm o que comparar e a regra de derivação não
  tem `main` para ler, e passar verde nessa condição seria exatamente o
  "all skipped -> green" que o `ci.yml` proíbe.
- **A matriz de autoridade muda junto.** `docs/LESSONS.md` some de
  `squad.policies.json`, de `tests/squad-policy-reachability.test.js` e de
  `tests/squad-guard.test.js`; a família de recursos por classe de nota entra.
  **O número da linha não fica escrito** — ele anda a cada edição dos três
  arquivos, e um `grep` pelo caminho os acha nos três sem ele. Migração que esquecer isso tira do
  Keeper a única superfície de escrita que ele tem.
- **Citação em comentário de código continua não verificável.** O runtime cita
  `LESSONS 2026-08-20` como token em prosa, dentro de
  [`bubblewrap-backend.js`](../../spectree-runtime/sandbox/providers/linux-physical/bubblewrap-backend.js);
  em quantos arquivos mais, três versões desta ADR afirmaram sem medir, e a
  quarta mediu e escreveu o número, que envelhece igual. O gate 3 verifica link,
  não prosa. Gatilho para reabrir: comentário citando nota que não existe mais.
- **A seção `## Emendas` deixa de existir, e o conceito de emenda também.** Ela
  carregava o `tipo:` e o link que sustentavam a classificação; a decisão 5
  tirou a classificação e a decisão 13 tirou o campo que ela protegia. Quem
  mudou o quê e quando é `git log -p`. Registro paralelo do que o git já diz é
  exatamente o rótulo que esta ADR existe para não criar — e era o que
  `## Emendas`, `approved:` e `updated:` eram, os três.
- **Rebaixar deixa de existir, e corrigir typo em nota aprovada custa um PR.**
  Não custa linha de cabeçalho, não custa reaprovação declarada, não custa
  classificação. Custa o que qualquer mudança custa neste repositório: passar
  por um PR que o Founder merge. A pergunta "um gate aplica esta fronteira sem
  consultar a intenção de quem editou?" fica respondida por não haver fronteira
  a aplicar.
- **Tirar o campo não bastou para o repositório passar, e a medição do quinto
  corte é o registro disso.** O terceiro corte tirou o `approved:` e escreveu
  aqui que "o repositório inteiro passa a passar". Era falso: a regra que
  entrou no lugar do campo — ler `main` como condição única — reprovava quase
  todo o `docs/` que a base carrega (pré-contrato, sem cercas) e reprovava esta
  ADR, que a base não carrega.
  **A ADR aplicou o teste da regra que saiu e não o apontou para a que entrou**,
  e o padrão vale mais que o caso: quem escreve a regra é o pior medidor dela.
  Com a forma do quinto corte e a cláusula de intervalo do contrato, o
  repositório de hoje passa — e passa por medição, não por afirmação.
- **A regra de derivação tinha um buraco do tamanho de um `git mv`, e quem o
  agendava era esta ADR.** A decisão 1 põe o ciclo de vida no caminho, a decisão
  10 manda mover, e a pergunta era indexada por caminho: o movimento sancionado
  respondia `fatal` e reclassificava um pai recusado como pai novo. Não foi
  leitura que achou — foi apontar a regra para o próprio plano de migração. **O
  padrão desta semana inteira se repete pela quarta vez:** a regra que só é lida
  não mostra o buraco; a regra rodada mostra na primeira tentativa.
- **E o conserto daquele buraco durou uma rodada, pela mesma porta.** O sexto
  corte fechou a lavagem de recusa com `--find-renames`, que é heurística de
  similaridade com limiar em 50%; abaixo dele o caminho antigo some da saída e a
  porta reabre. **Quinta vez, e a variação importa:** o sexto corte foi achado
  por execução *e consertado por leitura* — ninguém rodou o comando que a linha
  nova mandava rodar. O sétimo foi achado por alguém construir um repositório
  descartável e varrer o limiar. Conserto proposto por leitura merece a mesma
  desconfiança que a regra escrita por leitura.
- **Três afirmações desta ADR sobre `main` eram falsas, e o gate que ela institui
  existe para pegar exatamente essa classe.** `RUNTIME-F04`, `F06` e `F07` foram
  citadas três vezes no presente do indicativo como "mergeadas", e o `git`
  responde `fatal`; o `docs/architecture/SPECTREE-RUNTIME.md` foi citado três
  vezes com uma contagem de linhas que a medição não sustentou, uma delas dentro
  da tabela chamada "o que existe hoje, **verificado**". As seis
  citações caíram, e duas viraram regra de redação: **contagem some** (número
  que envelhece sozinho é o registro paralelo que esta ADR recusa), e **estado
  de `main` só se afirma com a medição junto**. Quem escreve a regra continua
  sendo o pior medidor dela.
- **A ref de comparação andou dentro do review desta ADR, e é a regra desta ADR
  se provando contra ela mesma.** Um PR irmão mergeou durante a medição do
  Keeper, e com ele mudaram a contagem de arquivos de `docs/` em `main`, a de
  cabeçalhos entre cercas e a existência de `status: approved` cercado — o que
  tornou falsa, no meio de uma rodada, a conclusão "nada em `main` é derivável",
  que três cortes desta ADR carregaram. **Duas coisas saem disso, e as duas são
  de redação:** o enquadramento é a base do PR, declarado uma vez no contexto e
  obedecido em toda linha; e contagem que carrega peso normativo vira critério,
  porque a única contagem que não envelhece é a que não está escrita. Foi o que
  já se fez com a lista de cabeçalhos da decisão 11 item 2, e funcionou.
- **A supersessão era uma porta de lavagem de recusa, e a defesa que esta ADR
  escrevia era falsa para ela.** "A lavagem aparece no diff como uma duplicata"
  vale para a cópia sob nome novo e não vale para a supersessão, cuja assinatura
  no diff é byte a byte a do ato sancionado. **O padrão, e é o sexto da semana:**
  o buraco foi achado por alguém rodar a regra sobre árvores de fixture
  construídas para isso, não por releitura — e a espécie nova é pior que as
  anteriores, porque não precisa de má-fé: basta um agente concluir que a
  proposta recusada foi retrabalhada. Defesa que depende de o revisor distinguir
  o ato legítimo do idêntico é invariante sustentada por promessa, e o conserto
  coube numa linha porque a pergunta certa era de alcance, não de detecção.
- **Uma porta desta ADR estava fechada por acidente de outra regra, e nenhuma
  linha dizia que era ela.** A lavagem em dois PRs morria no `notes-freeze`, que
  não sabe o que é lavagem de recusa — e quem consertasse a colisão de manifesto
  pelo caminho óbvio, deixando a linha sair, a reabriria sem tocar em nenhuma
  linha sobre supersessão. **Fica a regra de redação: porta que se declara
  fechada nomeia a regra que a fecha.** A decisão 5 passa a nomear as duas rotas
  e as duas regras, e nenhuma das duas é o gate de congelamento.
- **O texto sancionava, em três sítios, um ato que gate nenhum podia executar.**
  A desrejeição não passava em desfecho nenhum do manifesto, e esta ADR, o
  contrato e o glossário a descreviam como o caminho de volta legítimo. É a
  classe de defeito oposta à das outras rodadas — não uma regra que reprova o
  que existe, mas uma **permissão que nada consegue exercer** —, e nenhuma
  leitura a acha: quem lê vê um ato descrito com todos os seus passos. Achou-a
  quem rodou os quatro desfechos possíveis do manifesto contra o gate 2.
- **A rodada anterior descartou a terminalidade e escreveu o gatilho que a
  trouxe de volta em uma rodada.** O gatilho previa o dano — "desrejeição que
  passe pelo review sem ninguém notar" — e o que disparou foi a medição da forma
  do diff, antes de qualquer desrejeição existir. **Sétima vez na semana que a
  execução acha o que a leitura não achou, e a variação é nova:** desta vez o
  gatilho escrito na rodada anterior já nomeava o conserto certo. Gatilho com
  critério, e não com contagem, é a parte desta ADR que se provou barata duas
  vezes.
  **E a ressalva de forma vale para todo gatilho desta ADR — os escritos e os
  por escrever, e o escopo é esse e não outro**, porque "daqui para frente"
  isentaria justamente os que já estavam tortos: este acertou, e acertou tendo
  sido auditado — a condição casava com a
  medição, a medição derrubou o argumento do próprio autor em vez de confirmá-lo,
  e quem mediu foi o adversário. Mas ele **pré-nomeava o próprio remédio** ("aí o
  ato precisa de nome próprio, e a terminalidade é a forma dele"), e gatilho
  assim é mais propenso a virar carimbo, porque disparar decide o desenho junto:
  quem mede já sabe o que vai escrever, e a medição vira formalidade.
  **Gatilho se escreve com condição e sem remédio** — a condição diz quando
  reabrir; o que fazer é decisão da rodada que reabrir, com o repositório que ela
  tiver na frente. **A regra foi aplicada a si mesma na rodada seguinte, e
  quatro gatilhos vivos pré-nomeavam o remédio:** o do mandato por review, o do
  preço único, o do template de PR e — o mais caro, porque era o gatilho das
  alternativas que o nono corte produziu — o das duas regras que só entram
  juntas. Os quatro passam a ser condição; o que a medição já disse sobre a
  forma do remédio desceu para o corpo das entradas, que é onde a rodada
  seguinte o lê sem ser mandada por ele.
- **A proteção de `main` vira dependência de correção e mora fora do
  repositório.** Nenhum `grep` a encontra, e é por isso que a decisão 14 a
  escreve aqui: sem os required status checks, os cinco gates são testes que
  alguém pode ignorar, e a ADR volta a ser promessa. Entrega do Disruptor,
  junto com o `fetch-depth: 0`.
- **Nenhum gate lê o assunto do commit.** O parser de `(#NN)` era o único
  consumidor estrutural do squash, e morreu com `approved:`.
- **Derivar deixa de exigir comando nenhum do agente, e é o sétimo corte.** A
  versão anterior desta consequência dizia que derivar exigia um `origin/main`
  atualizado, com `git fetch` antes, sob pena de erro silencioso. Ela morre com
  a regra que a produziu: o agente lê o pai no disco — a árvore de trabalho é a
  cópia que o review vai ver — e quem consulta a base é o `notes-tree`, no CI,
  onde `fetch-depth: 0` já é requisito. **O erro silencioso não some, muda de
  endereço:** vira a janela entre a base do PR e o tip de `main`, e o que a fecha
  é `require branches to be up to date before merging` (decisão 9).
- **Quatro dos oito agentes não podem rodar `git`, e isso é fato de configuração
  do squad, não desta ADR.** Medido em `agents/*.md`, campo `tools:`: Rubick,
  Lina, Lion e Zeus não têm `Bash`. Nenhuma regra desta ADR depende mais disso —
  é o que o sétimo corte comprou. Fica escrito porque a próxima regra que alguém
  escrever com um comando no meio vai nascer inexecutável para metade do squad, e
  o defeito não dá sinal em leitura nenhuma: o texto parece perfeito.
- **`implemented/feature/` pode nascer com mais não-derivável do que derivável.**
  Spec que chegue à base dizendo `status: in-review` é recusada como pai pelo
  ramo 1 da regra de derivação, a partir do merge do PR que a leva a `main`.
  Nenhum gate fica vermelho — a tabela da decisão 1 admite —, e o conserto não é
  desta ADR: é o Founder aprovar as specs, e o registro disso é o merge.
  Rastreado em `## Open Questions`. **Quantas são não fica escrito**, pela regra
  desta rodada: o número foi medido contra a árvore de trabalho, não contra a
  base, e o PR de migração é quem o mede quando importa.
- **Três defeitos ficam regidos por esta ADR, e a máquina que os classificava
  não existe mais.** (1) A ADR-09 se contradizia entre a decisão 8 e o adendo
  E6, sobre a mesma pergunta. Duas versões desta ADR gastaram parágrafos
  decidindo se o conserto seria aditivo ou substantivo; **a contradição já não
  está lá, e foi desfeita exatamente como esta decisão diz que se desfaz** —
  editou-se a decisão 8, e o veto por nome desceu para `## Alternativas
  descartadas` com o gatilho que o reabriria. Nenhum ato, nenhum
  preço, nenhuma classificação: a pergunta não se fez. (2) ADR-01 a ADR-04
  e `LESSONS.md` sem cabeçalho, resolvido pela decisão 10 item 6, que encolheu
  para três campos. (3) O slug fixo `ADR-NN-derivation-chain.md` e a invariante
  nova do `notes-tree`, que a rodada 2 do contrato escreveu sem derivar da
  decisão 2 — pai estendido sem emenda, consertado pela decisão 12. **O padrão
  vale mais que os três:** cada corte desta ADR que veio de tentar executar a
  regra achou um buraco, e nenhum corte que veio de reler o texto achou. A
  regra que só é lida não mostra o buraco; a regra rodada mostra na primeira
  tentativa — e a rodada em que ela foi *medida contra o repositório inteiro*
  mostrou que a regra não devia existir.

## Open Questions

### Not blocking this stage

- `docs/TEST-SEAMS.md` ainda não existe, e esta ADR o pressupõe como registro
  vivo sujeito ao gate 3. É entrega do Rubick, e o mapa precisa nascer para o
  gate ter o que verificar nele. As costuras das classes de critério **desta**
  ADR já estão nomeadas e são os cinco gates da decisão 9, todos `node:test`
  sobre o repositório. **O sétimo corte muda o que o mapa vai ter de escrever na
  coluna "fica de fora", e muda para menos:** a regra de derivação deixou de ser
  disciplina de agente e passou a ter costura em quatro das seis linhas da tabela
  do sétimo corte — existência e `status:` do pai na base, `draft`/`rejected` no
  diff, e a colisão de nome —, todas no `notes-tree`. **O oitavo corte acrescenta
  uma classe de critério ao mapa e uma linha à coluna "fica de fora", e as duas
  são da mesma família — lavagem de recusa:** entra o **alcance da supersessão**
  (decisão 5), costurado no `notes-tree` contra a base, cuja prova é a árvore de
  fixture em que uma nota de `rejected/` é movida para `archived/` com
  `superseded_by:` e o conteúdo reescrito sob nome novo — o gate tem de ficar
  vermelho ali, e verde na supersessão de nota que a base carrega em `proposed/`
  ou `implemented/`. **Fica de fora, e é o mapa que precisa dizê-lo:** (a) "o
  `depends_on:` aponta para o pai certo"; (b) "o texto do filho depende do pedaço
  do pai que o PR mudou"; (c) a derivação de quem não tem `depends_on:` — código,
  prompt de agente, o próprio contrato —, que nenhum gate alcança porque não há
  campo a ler; e (d) **a cópia do conteúdo de uma nota recusada sob nome novo,
  sem supersessão**, que passa em todos os gates porque a invariante de
  não-desaparecimento é sobre nomes e não sobre notas. São quatro invariantes
  desta ADR sem costura, e as quatro são de leitura, não de forma. Nenhuma delas
  é promessa de agente: quem as confere é o revisor, que é o único gate humano
  que esta ADR nunca tentou substituir. **O mapa nasce com a fixture de lavagem
  escrita, e não com a descrição dela** — foi construindo árvore de fixture, e
  não relendo, que esta classe apareceu.
  **O nono corte acrescenta uma classe de critério e ela é a mais dura de todas,
  porque a prova é de duas peças:** a **terminalidade** (decisão 1), costurada no
  `notes-tree` contra a base. A fixture é a saída de `rejected/` — a mesma que a
  rodada anterior mediu com o `notes-tree` inteiro verde —, e o mapa tem de
  cobrar duas coisas dela, nunca uma: que o `notes-tree` fique **vermelho** ali,
  e que **esse vermelho seja o da asserção de terminalidade**, nomeadamente.
  Costura que aceitasse "algum gate ficou vermelho" registraria como fechada uma
  porta fechada por acidente, que é o defeito desta rodada.
  **A peça tem de ser afirmativa, e a formulação negativa reproduz o mesmo
  defeito um nível para dentro:** desqualificar só o vermelho do `notes-freeze`
  deixa passar outra invariante produzindo o vermelho certo pela razão errada. É
  medido nas duas células em que o nome **deixa de aparecer** — a de `rejected/`
  e a de `archived/` —, onde a invariante de não-desaparecimento (decisão 13,
  sétimo corte) fica vermelha sozinha, sem que a terminalidade precise existir.
  Uma costura que cumprisse a peça negativa ao pé da letra registraria a
  terminalidade como coberta por um vermelho que não é dela. E a fixture da
  supersessão de nota que a base carrega em `proposed/` continua tendo de ficar
  verde nas duas — é o par que separa o conserto do excesso.
  **A fixture não é uma, são quatro células, e o texto acima só nomeia uma
  delas:** a terminalidade tem dois modos de falha — o nome muda de caminho, ou o
  nome deixa de aparecer — e duas pastas, `rejected/` e `archived/`. A saída de
  `rejected/` é a célula medida; as outras três não foram, e a de `archived/`
  importa tanto quanto, porque é a pasta em que a supersessão deposita e onde a
  rota de um PR terminava. O mapa cobra as quatro, com a exigência de duas peças
  valendo em cada uma.
- **O que o glossário precisa carregar por causa desta ADR já está carregado, e
  a ordem que estava escrita aqui mandava desfazer trabalho certo.** As versões
  anteriores desta seção citavam o glossário literalmente doze vezes, para dizer
  o que ele "afirma hoje" e o que precisava mudar. **Oito daquelas citações eram
  falsas no dia em que foram medidas:** três nomeavam verbetes que já tinham
  sido removidos, e cinco pediam correções que já tinham sido feitas. Se esta
  seção virasse trabalho, apagaria verbete que não existe e reverteria conserto
  já feito — e isso é pior que qualquer furo de argumento desta ADR, porque não
  erra uma afirmação: **erra uma ordem**, dada a um agente que não vai reler.
  **A causa é a mesma da varredura do contexto, e o conserto é o mesmo:** o
  glossário é registro vivo, a base do PR não o carrega, e citar o texto atual
  dele é escrever aqui uma contagem que envelhece na edição seguinte — com o
  agravante de que esta envelhece dando instrução. **Sai a citação e fica o
  critério.** O que esta ADR decide, e é tudo o que o glossário precisa do lado
  dela:
  - `status:` é a declaração do autor sobre a maturidade do conteúdo, e nada
    além — não é aprovação e não é derivabilidade (decisão 13, oitavo corte);
  - a fonte de derivação é a cópia que o review vai ver, indexada pelo **nome do
    arquivo**, com `draft` e `rejected` recusando no diff, e sem comando nenhum
    na mão do agente (decisão 13, quinto ao sétimo corte);
  - existe o **pai externo**, `depends_on: -`, e ele não é isenção (decisão 13,
    terceiro estado);
  - a supersessão tem alcance: não toca o que a base carrega em `rejected/` ou
    `archived/` (decisão 5);
  - `archived/` e `rejected/` são terminais, e o congelamento vale para o
    caminho além do conteúdo (decisão 1);
  - a aprovação é o merge, e não há campo que a registre — do que decorre que
    rebaixamento não existe (decisão 13);
  - `emenda aditiva`, `emenda substantiva`, `unidade protegida` e `desrejeição`
    deixam de ter referente (decisões 5 e 1).
  **Declaração de não-mudança, e é ela que substitui as quatro ordens:** lido o
  glossário inteiro na árvore de trabalho, os sete estão lá, e o décimo corte não
  acrescenta um oitavo — o limite sobre a entrada em `rejected/` declara
  ausência de gate e nomeia dono, e o `depends_on:` da nota que repropõe diz qual
  valor um campo já existente recebe. **Nada a acionar, e nenhum verbete é edição
  minha** — nem o batismo da nota nova que repropõe uma recusada, que a decisão 1
  não inventa. Quem quiser reconferir lê o arquivo: o veredito é de leitura, e a
  regra desta ADR é que o resultado dela não se escreve aqui.
  **E o que fica do maior arrependimento desta ADR não é a ordem, é a lição:**
  os três termos da máquina de emendas entraram no glossário pela regra certa —
  termo só depois da ADR aprovada — e saíram porque a ADR estava errada. A regra
  funcionou e não bastou, e nada além de executá-la mostrou isso.
- **A matriz de autoridade tem um bug medido e ele não é meu para consertar.**
  `squad.policies.json` não conhece a árvore de notas: medido por grep, zero
  ocorrências de `docs/notes` e zero das seis classes de nota, logo classe
  nenhuma tem escritor. (A metade que falava de sítios do contrato concedendo
  escrita morreu com o contrato novo, que declara não conceder nenhuma.) A decisão 14 recusa
  CODEOWNERS como substituto e a decisão 7(c) diz o que a matriz precisa ganhar;
  o conserto é do Invoker, e ele **trava a migração**, porque migrar sem a
  família de recursos por classe tira do Keeper a única superfície de escrita
  que ele tem. *Trava o PR de migração.*
- **O guard decide sobre o byte, e o contrato diz que o ato governado é o
  delta.** A detecção de status em `hooks/guard.mjs` lê só `new_string` ou
  `content` e nega quando casa uma linha de status governado ali; o `old_string`
  chega no mesmo payload e não é lido. O caso que ela bloqueia é um dever deste
  contrato: o Keeper anexando `## QA Notes` numa story `approved` com a linha de
  status dentro da janela do Edit, preservada byte a byte. A mesma edição passa
  quando a janela não alcança a linha — o veredito depende do tamanho da janela,
  não do que foi concedido. Não é decisão desta ADR e não muda regra nenhuma: é
  o motor divergindo do contrato. O contrato passa a escrever a comparação com a
  base como entrega pendente, no futuro e com dono. *Do Invoker, junto com o
  conserto da matriz.*
- **A proteção de `main` é configuração do GitHub e ninguém a versiona.** Os
  required status checks (decisão 14) e o `fetch-depth: 0` são o que torna os
  cinco gates exigíveis, e o primeiro não deixa rastro no repositório. *Do
  Disruptor, antes do PR dos gates; e vale dizer ao Founder que uma regra
  invisível é a coisa mais parecida com promessa que sobrou aqui.*
- **As specs que forem para `implemented/feature/` dizendo `in-review` não
  servem de pai.** Quantas são é medição do PR de migração, e por isso não está
  escrito aqui — nem em dígito nem em quantificador. Não trava esta ADR nem a
  migração — a tabela da decisão 1 admite a combinação e nenhum gate fica
  vermelho. Trava **quem derivar de spec**: o Jakiro, quando a próxima fase citar
  uma delas como pai, e o Lion, se a cadeia de produto entrar. A pergunta é do
  Founder e é uma: elas ficam `in-review` até serem revisadas uma a uma, ou há um
  subconjunto que ele já dá por bom? **Minha recomendação:** deixar como está e não inventar aprovação em
  lote — o rótulo está descrevendo a verdade, e a alternativa é escrever
  `approved` num arquivo para destravar outro, que é o defeito de origem desta
  ADR. *Do Invoker, ao Founder.*
- **A nota da cadeia (`ADR-11`) ganha um quarto item para declarar**, e ela ainda
  não existe: os caminhos que a árvore de notas substituiu neste repositório
  (`docs/adr/`, `docs/spec/`, `docs/LESSONS.md`), que saíram da escada do
  contrato pela decisão 11 item 8. Enquanto a `ADR-11` não nascer, a linha 2 da
  escada não tem a quem perguntar e a recusa desses três caminhos não é
  cobrável. **Ordem, e ela é dura:** a `ADR-11` nasce **no mesmo PR da migração**
  (decisão 10 item 3 já a produz a partir do `docs/spec/README.md`), e é por isso
  que a recusa da linha 2 é de criação — no intervalo não há criação a recusar
  porque não há árvore. *Do Rubick, dentro do PR de migração; fica escrito para
  não virar descoberta na hora.*
- **`require branches to be up to date before merging` entra na proteção de
  `main`**, junto com os required status checks. Sem ele, um veredito registrado
  em `main` depois do ponto de ramificação não é visto pelo gate, que julga
  contra a base do PR. É a mesma tela de configuração, o mesmo dono, e não deixa
  rastro no repositório. *Do Disruptor, junto com os checks obrigatórios e o
  `fetch-depth: 0`.*
- O contrato de artefatos é enviado a outros projetos que o squad serve; a
  decisão 11 muda o contrato para todos eles, não só para este repositório.
