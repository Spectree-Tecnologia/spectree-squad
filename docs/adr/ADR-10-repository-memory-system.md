---
status: in-review
owner: rubick
updated: 2026-08-21
approved: 2026-08-21 — Founder (reaprovacao apos a reescrita da decisao 5: emenda e ato com marca no disco, e a supersessao sai da maquina de emendas. Aprovacao original no mesmo dia: Q1 merge do PR da fase conta como aprovacao; Q2 mandato estrito, sem isencao)
depends_on: docs/spec/README.md
---

# ADR-10 — Sistema de memória do repositório

## Contexto

O Founder quer o squad reconstruindo o próprio repositório. Isso torna a
memória do repositório uma dependência de execução, não documentação: o que
não estiver em disco, num formato que um agente sem contexto compartilhado
consiga achar e confiar, não existe.

O que existe hoje, verificado:

| Artefato | Estado | Defeito |
|---|---|---|
| `docs/adr/` | 9 ADRs | ADR-01 a ADR-04 sem cabeçalho nenhum; ADR-05 a ADR-09 com cabeçalho sem as cercas `---` que o contrato exige. Três formatos vivos. |
| `docs/LESSONS.md` | 5 entradas | Arquivo único, escrita voluntária, sem cabeçalho. Fora de ordem cronológica, uma entrada datada no futuro. 3 de 5 têm gatilho de releitura. |
| `docs/spec/` | 1 spec + README | Declara a cadeia de derivação real do repo (Brief -> Spec -> ADR -> PR), que não é a do contrato de artefatos. |
| `docs/architecture/` | 1 doc, 973 linhas | 973 linhas de afirmações sobre o código, nenhuma verificada. |
| `docs/CONTEXT.md` | 56 termos, `approved: 2026-08-21` | Nasceu depois desta ADR começar; ficou fora do mapa até a decisão 10 item 5. |
| `skills/spectree-artifacts/SKILL.md` | contrato que todo agente carrega | Descreve nove artefatos canônicos dos quais sete não existem; omite `docs/spec/` e `docs/architecture/`, que existem. |

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

Esta ADR não tem spec normativa porque decide processo, não contrato de
runtime (ver decisão 1). Seu pai é o brief do Founder.

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
eixo. A pasta responde "isto descreve código que existe?"; o status
responde "este conteúdo está aprovado?". As combinações legais:

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

### 3. `LESSONS.md` vira classe `bug-fix`, uma nota por lição

Uma lição por arquivo em `docs/notes/implemented/bug-fix/`. O arquivo único
tem três defeitos que já se manifestaram: a cauda append-only é conflito de
merge garantido quando dois agentes aprendem no mesmo ciclo; a ordem
cronológica já quebrou; e "grep pela sua área" num arquivo de 200 linhas
devolve o arquivo inteiro, enquanto `grep -ril` numa pasta devolve os dois
arquivos que interessam.

### 4. Escrever é obrigatório, no mesmo PR

Todo diff que toca qualquer coisa fora de `docs/**` adiciona ou modifica ao
menos uma nota sob `docs/notes/**`, no mesmo PR. Sem isenção declarável.

**O mandato é estrito, e o argumento mais forte é que ele não é
aspiracional:** os PRs #28 e #29 já o cumpririam sem alteração nenhuma
(spec + ADR + lições no mesmo diff). Estamos travando comportamento
observado, não inventando um. Sem a regra, em oito dias temos cinco
entradas de novo — que é literalmente o que temos.

Isenção nenhuma porque isenção declarável é a promessa que o gate existe
para eliminar. O custo real: um PR genuinamente trivial paga um parágrafo.
A variante mais barata — mandato só no veredito de review — está em
Alternativas descartadas com o gatilho que a reabriria.

### 5. Emenda não se classifica: escolhe-se um ato, e o ato deixa marca no disco

O contrato tem um verbo só — editar — e por isso o adendo de fidelidade do
mount plan da ADR-07 não tinha nome: ele não muda nenhuma das 14 decisões das
quais a ADR-08 e a ADR-09 derivam, e mesmo assim o único preço que o contrato
sabia cobrar era o rebaixamento inteiro da nota.

O primeiro corte desta decisão separava emenda aditiva de emenda substantiva
perguntando "havia mais de um resultado possível?". Só quem editou responde
isso, e gate de repositório não pergunta a ninguém. Em uma semana a pergunta
falhou nas duas direções:

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

O defeito é anterior às duas saídas: **a decisão 5 tratava emenda como
classificação a fazer, quando ela é ato a executar.** Classificação mora na
cabeça de quem editou; ato deixa marca no disco. A partição nova é sobre a
marca.

| Ato | Marca, no mesmo diff | Preço |
|---|---|---|
| **Emenda aditiva** | toda linha alterada no corpo, retirados os links relativos e os símbolos colados neles, é byte a byte igual à linha da base; cada link novo resolve no commit de cabeça; e `updated:` fica igual ao da base | nenhum: preserva `approved:`, não rebaixa, não invalida derivação |
| **Emenda substantiva** | o cabeçalho, no commit de cabeça, diz `status: in-review`, e `updated:` mudou | reaprovação do Founder, que é o merge (item 6 da decisão 10) |
| **Supersessão** | a nota vai para `archived/` com `superseded_by:`, o mesmo diff traz a nota com `supersedes:`, e a linha entra em `FROZEN.sha256` | congelamento |

Nota que nunca foi aprovada, ou já rebaixada, se edita livre: não há o que
defender. O gatilho é o `status: approved` **no cabeçalho da base do PR**, e a
unidade que os três atos protegem é o **corpo** — tudo abaixo da cerca `---`
que fecha o cabeçalho, em qualquer artefato, com uma exclusão só (decisão 13).

**A supersessão sai da máquina de emendas.** Ela não é o preço da emenda
substantiva — é outro ato, com campos, pasta e manifesto próprios (decisões 1
e 6), e serve à nota que foi **substituída**, não à que foi corrigida.
Amarrar as duas foi o que produziu o absurdo: a supersessão virou a única
saída para "acrescentar decisão a documento aprovado que continua correto no
que já dizia", que é o caso mais comum de todos. **A máquina de emendas segue
com duas saídas e nenhuma delas congela coisa alguma** — o que saiu da máquina
foi o preço, não uma saída.

**A emenda substantiva volta a ser o que o contrato já dizia.** "Alterar
conteúdo aprovado rebaixa o `status:` para `in-review` na mesma edição, feita
por quem editou" é regra do contrato desde antes desta ADR. O primeiro corte
da decisão 5 a substituiu por supersessão sem dizer que a revogava — e criou o
absurdo ao apagar o padrão. O conserto é devolver o padrão: **edita-se e
rebaixa-se**, e o Founder reaprova no merge, que é o mesmo ato que já aprova
qualquer fase.

**Por que a emenda aditiva não some junto.** Porque o gate 3 obriga a editar:
o código move um caminho, a nota em `implemented/` que o cita fica vermelha, e
a correção deixa de ser opcional. Cobrar rebaixamento por obedecer a um gate
de repositório é cobrar por consertar o que o repositório mandou consertar — e
um refactor que move um arquivo rebaixaria toda nota que o cita, até a
aprovação virar ruído. **A emenda aditiva existe exatamente onde o gate obriga
a editar, e em lugar nenhum além.** Daí o teste ser o próprio texto alterado e
não um link ao lado: retirados os links, o que sobra tem de ser idêntico.
Trocar uma palavra de prosa junto fecha a rota. E é isso que fecha o carimbo
**sem enumerar classe nenhuma**: em nota `process`, a linha alterada não tem
link para retirar, o resto difere, e a rota nunca esteve aberta — derivar do
fato, nunca enumerar.

**Como este conserto se registra, e onde a máquina de ontem travou.** O
separador antigo, aplicado ao pé da letra a este próprio conserto: o texto
novo não é derivável de disco, símbolo ou teste verde — nenhum dos cinco gates
existe ainda — e escolher a partição foi escolha. Logo substantiva; logo "não
se edita: abre nota nova com `supersedes:`, e a antiga vai para `archived/`".
Essa saída dá três respostas diferentes para o mesmo diff:

1. **A letra não roda.** `archived/` e `FROZEN.sha256` são as decisões 6 e 10
   e não existem: a árvore de notas nasce na migração. A saída substantiva
   prescreve um ato num filesystem que ela mesma agenda para depois — toda
   emenda substantiva entre a aprovação desta ADR e a migração é inexecutável.
2. **A aproximação que roda é desproporcional.** Superseder no formato de hoje
   (`superseded_by:` sem mover) arquiva dez decisões que ninguém tocou e que
   são pai de derivação viva: a rodada 2 do contrato de artefatos e os dez
   termos de "Memória do repositório" do glossário. A unidade que uma emenda
   conserta é o item da lista; a unidade sobre a qual `supersedes:` opera é o
   arquivo. Consertar um item custa a aprovação de dez.
3. **A saída errada passa verde.** Bastava `## Emendas` com `tipo: aditiva` e
   um link para qualquer teste commitado. O gate 4, como a decisão 9 o
   especifica, não recusaria: certificaria a classificação falsa. Partição
   cuja saída correta não roda e cuja saída errada passa verde não é partição.

E as leituras discordam do próprio escopo: a decisão 5 fala de "conteúdo
aprovado", o gate 4 da decisão 9 fala de "nota em `implemented/`", e por essa
segunda a ADR-10 sequer está no escopo — o item 1 da decisão 10 a põe em
`proposed/` até o PR dos gates. O escopo novo é o cabeçalho, em qualquer
pasta, que é o que a tabela da decisão 1 já admite ao aceitar nota `approved`
em `proposed/`.

O que governa este diff, então, é a regra que já estava em vigor e que a
decisão 5 nunca revogou: editar conteúdo aprovado rebaixa para `in-review`. É
por ela — não pela partição nova — que este conserto edita a ADR-10 no lugar e
rebaixa o cabeçalho. Que a partição nova prescreva o mesmo ato não é
coincidência nem circularidade: ela é a devolução desse padrão.

A referência resolve isto em prosa ("facts only — not the decision itself"),
que é a pergunta de intenção com outra roupa. Nós fazemos gate (decisão 9,
gate 4).

### 6. Congelamento é fato: manifesto de hash

`docs/notes/FROZEN.sha256`, uma linha `<sha256>  <caminho>` por arquivo sob
`archived/` e `rejected/`. Gate: todo arquivo congelado tem entrada, todo
hash bate, e o manifesto só cresce em relação ao da base do PR.

Sem isto, "nunca editar nota arquivada" é promessa — e este projeto não
sustenta invariante por promessa. `node:crypto` é stdlib; zero dependência
continua valendo (ADR-01). Sem segunda língua (decisão 8), é um hash por
nota, não três.

### 7. Onde melhoramos a referência

**(a) O laço vermelho vai junto da nota.** Nota de `bug-fix` exige
`## Laço vermelho`: o comando exato, a saída vermelha antes, e um link
relativo para o teste de regressão commitado que a mantém verde. As notas
da referência carregam racional; nós produzimos rotineiramente algo mais
forte — cinco rodadas de review nesta semana produziram cinco laços — e
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
`docs/architecture/SPECTREE-RUNTIME.md`, 973 linhas de afirmações sobre o
código que hoje ninguém confere.

**A citação é o link, não a crase.** O gate só resolve o que está em link
relativo — o arquivo, e o símbolo quando o token entre crases está colado
no link (`` [`createSandboxPolicy`](...) ``). Token entre crases **sem
link não afirma nada** e o gate o ignora: é tipografia, e mais das vezes é
vocabulário. O `docs/CONTEXT.md` é a prova de que a distinção não é
teórica: por contrato ele não cita implementação nenhuma, e o que ele põe
entre crases são valores de domínio — `allow`, `deny`,
`approval-required`, `read-only`, `workspace-write`, `auth-ok`,
`outside-workspace`. Desses, um único (`timedOut`) existe como símbolo. Um
gate que lesse crase como símbolo nasceria reprovando o registro vivo mais
consultado do repositório, e o reprovaria por ele estar certo — rótulo
lido como fato, exatamente o defeito que esta ADR existe para não
repetir.

O buraco simétrico — citar caminho em prosa para escapar do gate — fecha
com um lint, não com um allowlist: token com `/` e extensão de código
(`spectree-runtime/....js`) fora de link falha pedindo que vire link.
Valor de vocabulário nunca tem essa forma, então a regra não precisa
saber o que é vocabulário para deixá-lo passar.

**(c) Autoria com autoridade.** A nota carrega `owner:`, e o gate pergunta
ao `PolicyEngine` real — pelo adapter oficial `adapters/policy-document.js`
— se aquele principal podia escrever aquela classe. A matriz ganha uma
família de recursos por classe de nota. Isso não existe no mundo de
referência, e é barato aqui porque a matriz e o motor já existem. Uma linha
não pode regredir na migração: o Keeper hoje tem `artifact-edit` sobre
`docs/LESSONS.md` e precisa ter sobre `docs/notes/*/bug-fix/*` — e nada
além.

**(d) A emenda não se classifica; o ato se lê no diff** — decisão 5,
mecanizada no gate 4. A referência resolve a emenda em prosa ("facts only —
not the decision itself"), que é a pergunta de intenção com outra roupa: quem
edita declara o que fez, e ninguém confere. Nós tiramos a pergunta. Cada ato
paga um preço com assinatura física — linha que resolve no código, cabeçalho
rebaixado, nota congelada — e o gate 4 lê a assinatura. Nenhuma das três é
declarável: ou está no diff, ou não está.

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

Todos `node:test`, zero dependência, no estilo dos três que já existem.

| Gate | Prova | Defeito real que ele pega hoje |
|---|---|---|
| `tests/notes-tree.test.js` | classe e ciclo de vida no conjunto fechado; forma do nome por classe; cabeçalho presente com status no conjunto; tabela status×pasta; datas não futuras; `supersedes`/`superseded_by` mútuos e resolvíveis; links entre notas resolvem; esqueleto por classe; ausência de índice | ADR-01 a ADR-04 sem cabeçalho; LESSONS com entrada datada no futuro; `superseded` declarado e nunca exercido |
| `tests/notes-freeze.test.js` | manifesto cobre `archived/` e `rejected/`; hashes batem; manifesto só cresce contra a base | "nota arquivada não se edita" hoje é promessa |
| `tests/notes-truth.test.js` | toda citação **em link** de nota `implemented/` e de registro vivo resolve no código (arquivo, e símbolo quando colado no link); crase sem link é vocabulário e não é claim; caminho em prosa fora de link falha pedindo link | 973 linhas de arquitetura não verificadas; e o glossário reprovado por citar vocabulário, se a regra fosse a crase |
| `tests/notes-mandate.test.js` | diff fora de `docs/**` traz nota no mesmo PR; mudança no **corpo** de artefato `approved` na base traz uma das três assinaturas da decisão 5; e `approved:` acrescentado ou alterado cita merge alcançável da base (decisão 13) | LESSONS voluntária: 5 entradas; emenda classificada por quem edita, que já falhou nas duas direções em uma semana; e `approved:` escrita antes de existir o merge que ela cita — a primeira violação medida fora da árvore |
| `tests/notes-authority.test.js` | `owner:` × classe decidido pelo `PolicyEngine` real | nada impede o principal errado escrever a classe errada |

O gate 1 inclui o esqueleto por classe. Para `architecture` e `process`,
`## Contexto` e `## Decisões` são obrigatórias — e isso **substitui a ADR de
um parágrafo pela ADR de um item**: a lista numerada é o endereço de que os
`depends_on` dos filhos derivam (ADR-08 e ADR-09 derivam das 14 decisões da
ADR-07). Uma ADR de um item continua sendo uma ADR completa. O esqueleto
**não** é mais o que o gate 4 protege: a decisão 13 tirou a proteção da seção
nomeada e a pôs no corpo, justamente porque nas outras quatro classes seção
nomeada não existe.

O gate 4 (`notes-mandate`) hospeda também a mecânica da decisão 5. **Gatilho:**
o diff toca o **corpo** de artefato cujo cabeçalho, **na base do PR**, diz
`status: approved` — a pasta não entra na conta, o cabeçalho decide, e a
unidade é a da decisão 13. Passa com uma das três assinaturas, e falha sem
nenhuma:

1. toda linha alterada, retirados os links relativos e os símbolos colados
   neles, é byte a byte igual à linha da base; cada link novo resolve no
   commit de cabeça; e `updated:` fica igual ao da base — **aditiva**;
2. o cabeçalho, no commit de cabeça, diz `status: in-review`, e `updated:`
   mudou — **substantiva**;
3. a nota está em `archived/` com `superseded_by:` e o mesmo diff traz a nota
   com `supersedes:` — **supersessão**.

Nenhuma das três é declarada pelo autor: as três se leem do diff, do cabeçalho
e do disco. Onde o `## Emendas` pedia uma classificação e um link ao lado, a
assinatura 1 compara o texto alterado consigo mesmo — e é por isso que ela não
se falsifica com prosa: uma palavra trocada fora do link derruba a comparação
e joga a emenda na assinatura 2. O gate continua sem julgar se valia a pena
tocar a nota; julga que o preço foi pago, e preço não se declara.

Os gates 2, 4 e 5 precisam da base do PR: o `checkout` do CI passa a exigir
`fetch-depth: 0`, e o gate **falha** quando não consegue computar a base —
nunca pula verde. Vale a regra da seção 99 já escrita no `ci.yml`: não
existe caminho "all skipped -> green".

### 10. Migração

Acontece num PR só, depois desta ADR aprovada, e o histórico é preservado
por `git mv`.

1. Esta ADR sai de `docs/adr/` para `docs/notes/proposed/process/ADR-10-repository-memory-system.md`
   ao ser aprovada, e migra para `implemented/` no PR que entrega os gates.
   O movimento é a primeira prova de que a pasta carrega informação.
2. `docs/adr/ADR-NN-*.md` -> `docs/notes/implemented/architecture/`, nomes
   preservados, todas em `implemented/` — o código das nove shipou. ADR-05 a
   ADR-09 já trazem cabeçalho com `status: approved` e migram como estão —
   inclusive a ADR-07, cujo `approved: 2026-08-21` registra a reaprovação do
   adendo de fidelidade do mount plan. ADR-01 a ADR-04 não têm cabeçalho
   nenhum e o ganham na migração, `approved`, com `approved:` reconstruído
   pela regra do item 6. As nove entram `approved`: **a migração não produz
   nenhuma instância de `in-review` em `implemented/`.** A linha da tabela da
   decisão 1 não perde por isso a razão de existir — ela cobre o intervalo
   entre uma emenda substantiva e o merge que a reaprova, que a decisão 5
   torna rotina —, mas perde o exemplo vivo: o intervalo que a ADR-07
   percorreu entre 2026-08-20 e 2026-08-21 fechou quando o Founder reaprovou,
   e é como intervalo fechado que as Consequências o registram.
3. `docs/spec/RUNTIME-F09-*.md` -> `docs/notes/implemented/feature/`.
   `docs/spec/README.md` -> `docs/notes/implemented/process/` como a nota
   que registra a cadeia de derivação; a regra operativa migra para o contrato
   (decisão 11).
4. `docs/LESSONS.md` -> 5 notas em `docs/notes/implemented/bug-fix/`,
   texto verbatim. Data do nome é a data da entrada, exceto quando ela
   postdata o último commit do arquivo — aí vale a do commit (a entrada de
   2026-08-22 é esse caso). O arquivo é removido; `git log -- docs/LESSONS.md`
   continua respondendo pela história.
5. `docs/architecture/SPECTREE-RUNTIME.md`, `docs/TEST-SEAMS.md` e
   `docs/CONTEXT.md` **não** entram na árvore: são **registros vivos** —
   reescritos continuamente, nunca congelados, sem data e sem ciclo de
   vida. Ficam na raiz de `docs/` e respondem ao gate 3. O critério que os
   separa de nota: nota é o registro de um momento (tem data, tem autor,
   tem ciclo de vida, congela); registro vivo é uma fotografia do estado
   atual, e congelá-lo o tornaria falso. O `docs/CONTEXT.md` nasceu depois
   do primeiro corte desta ADR (56 termos, `approved: 2026-08-21`) e é o
   caso mais claro: um glossário não decide nem ensina — descreve a
   linguagem de agora. Fica onde está, e passa no gate 3 por construção,
   pela regra da decisão 7(b): ele não cita código, cita vocabulário.
6. **Cabeçalho é retroativo, sem cláusula de avô, e a aprovação se deriva
   do fato.** O merge do PR da fase **é** o ato de aprovação do Founder: o
   que faltou foi o registro no arquivo, não a decisão. Então ADR-01 a
   ADR-04 e as lições ganham cabeçalho na migração com `updated:` = data do
   último commit do arquivo e `approved:` = data do merge do PR que entregou
   a fase — e o cabeçalho registra **de onde veio a data**, na forma
   `approved: <YYYY-MM-DD> (merge do PR #NN)`. Não se inventa aprovação;
   deriva-se do git, que é onde o fato está, e a citação viaja no arquivo
   para quem conferir depois. Irrecuperável = `approved: -` com
   `status: in-review`. Uma isenção permanente para artefato pré-contrato
   seria a promessa de novo; uma migração única é fato.
7. `## Laço vermelho` das 5 lições migradas: recupera-se o que for
   recuperável (várias já citam o teste commitado); o que não for leva a
   linha `não registrado — anterior à ADR-10`, e o gate aceita essa linha
   **apenas para a lista exata desses 5 caminhos**, no padrão de
   `tests/squad-surface.test.js` — nunca checagem de ausência, sempre a
   lista exata. A sexta nota de bug-fix precisa do laço.
8. Toda citação de `docs/adr/`, `docs/spec/` e `docs/LESSONS.md` em
   `README.md`, `agents/*.md`, `commands/techleader.md`, `skills/**` e
   `squad.policies.json` é reescrita no mesmo PR. Depois disso o gate 1
   mantém as citações honestas.

### 11. O que muda em `skills/spectree-artifacts/SKILL.md`

A edição é entrega separada; a decisão é esta. Sete mudanças:

1. **A cadeia de derivação passa a ser declarada por repositório**, não
   universal. Hoje o contrato afirma `PRD -> EPIC -> STORY -> ADR` como se
   fosse a única, e este repositório roda `Brief -> Spec -> ADR -> PR` — daí
   sete artefatos canônicos que não existem e dois que existem e não estão
   no contrato. Aplicada ao pé da letra, a regra "sem pai não se escreve o
   derivado" proibiria as 9 ADRs que existem. Os artefatos de pipeline
   (PRD, EPIC, stories, DESIGN) continuam corretos para projeto de produto:
   o contrato passa a separar o que é incondicional do que nasce com um
   pipeline, e cada repo declara sua cadeia de derivação em um lugar só.
2. **Caminhos canônicos** trocam `docs/adr/`, `docs/LESSONS.md` e o silêncio
   sobre `docs/spec/` pela árvore de notas, mais os três registros vivos.
3. **Cabeçalho** com as cercas `---` como forma única, conjunto de status
   incluindo `rejected`, e a tabela status×pasta.
4. **Emenda aditiva, emenda substantiva e supersessão** (decisão 5) entram no
   contrato como três atos com assinatura, não como classificação a declarar.
   É no contrato que a regra de rebaixamento mora, e a emenda substantiva
   **é** essa regra — não a exceção a ela. Saem junto a seção `## Emendas`
   com `tipo:` e a escalação de caso duvidoso ao Invoker: sem classificação
   não existe caso duvidoso. **A unidade é o corpo do artefato, e a exclusão é
   uma só** (decisão 13): o contrato não pode nomear seção nenhuma como
   unidade protegida, sob pena de recriar o caminho duplo que ele carrega hoje
   — "alterar conteúdo aprovado rebaixa" numa linha e uma seção nomeada na
   outra, com o gate implementando a estreita.
5. **O mandato de escrita por PR** (decisão 4) e os nomes dos cinco gates,
   para que um agente que quebre um saiba o que quebrou.
6. **"ADR de um parágrafo"** vira **"ADR de um item"** (decisão 9).
7. **O cabeçalho ganha regra por campo** (decisão 13). Quatro linhas do
   contrato mudam, e uma sai:
   - "Toda edição em um artefato atualiza a linha `updated:`" passa a valer
     para edição de **conteúdo aprovado**: emenda aditiva e append de build
     não movem `updated:`, porque nenhum dos dois muda o que foi aprovado.
   - "story em ciclo de build carrega `updated:` posterior por natureza, e
     isso não é violação" **sai**: com a linha acima, ela deixa de descrever
     caso nenhum. Uma exceção a menos, não uma a mais.
   - "`approved` só é setado pelo Invoker depois de aprovação explícita do
     Founder, que preenche `approved:` com a data no mesmo ato" passa a:
     `approved:` cita o merge que a aprovou, na forma
     `approved: <YYYY-MM-DD> (merge do PR #NN)`, e nunca se escreve no PR cujo
     conteúdo ela aprova. "Agente nenhum aprova o próprio artefato" fica onde
     está — e deixa de ser só prosa.
   - A regra de derivação passa a exigir `status: approved` **além de**
     `updated:` igual ou anterior a `approved:`.

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
   pai de cada um, e o prefixo de fase do repositório. Não lista notas —
   listar seria índice.
3. **Sintaxe do token de fase:** `<PREFIXO>-F`, com `<PREFIXO>` casando
   `[A-Z][A-Z0-9]*`; a nota da classe `feature` chama-se
   `<PREFIXO>-FNN-<english-slug>.md`, e repositório que não declarou prefixo
   não escreve nota `feature`. A alternativa — cair na data quando não há
   token — dava duas formas legais de nome para a mesma classe, e forma de
   nome que aceita duas coisas não classifica nada.
4. **`notes-tree` ganha uma invariante:** árvore de notas não vazia tem
   exatamente uma nota da cadeia. Vazia não tem, e é isso que faz o bootstrap
   existir: a nota da cadeia é a primeira nota de um repositório, e o
   `depends_on:` dela é `-` porque o pai é o brief do Founder. Sem esse piso,
   "leia a nota da cadeia antes de escrever" seria inexecutável no primeiro
   artefato de qualquer repositório novo.

### 13. A unidade protegida é o corpo; o cabeçalho tem regra por campo, e `approved:` cita o merge

O primeiro corte desta decisão deu a unidade como `## Decisões` na nota e o
arquivo inteiro fora dela. As duas metades foram medidas contra o repositório
real e as duas caíram — pelo mesmo defeito, em direções opostas.

**Dentro da árvore, a unidade é vazia em quatro das seis classes.** O esqueleto
da decisão 9 só obriga `## Decisões` em `architecture` e `process`. Em
`feature`, `bug-fix`, `simplification` e `testing` não existe seção nomeada, e
o gate só dispara sobre ela. Medido no artefato mais normativo que este
repositório tem: `docs/spec/RUNTIME-F09-governed-model-harness.md` é
`status: approved`, tem 120 seções numeradas, 8 invariantes, os critérios de
aceite no §97, e um cabeçalho que registra "rebaixada e re-aprovada três vezes
sob a regra 'aprovação pertence ao conteúdo'". Zero ocorrências de
`## Decisões`. Depois da migração ele é nota `feature`: reescrever o §97 não
tocaria unidade protegida nenhuma, e **os três rebaixamentos que o próprio
arquivo registra viram zero**. Seis specs novas entram na mesma condição. Isso
não é lacuna nova — é regressão contra a regra que já estava em vigor, e o
caminho duplo resultante ("alterar conteúdo aprovado rebaixa" numa linha, seção
nomeada na outra) tinha o gate implementando a estreita.

**Fora da árvore, a unidade não coexiste com o `updated:` obrigatório.** Três
linhas que não fecham: toda edição atualiza `updated:`; a unidade era o arquivo
inteiro e o cabeçalho não estava nas exclusões; e a rota aditiva exige que toda
linha alterada, retirados os links, seja byte a byte igual à base.
`updated: 2026-08-21 -> 2026-08-22` não tem link para retirar e não é igual.
Consequências medidas: **toda** correção obrigada pelo gate 3 em registro vivo
aprovado vira substantiva — o oposto exato do que esta decisão prescrevia — e
**todo** append em `## Dev Log` ou `## QA Notes` de story aprovada fica
vermelho, porque a isenção cobre a seção e o `updated:` está fora dela.

Os dois buracos são o mesmo erro: **enumerar onde o conteúdo mora.** O conserto
é subtração, não uma quarta categoria.

**A unidade protegida é o corpo do artefato** — tudo abaixo da cerca `---` que
fecha o cabeçalho —, em nota, registro vivo e artefato da cadeia, sem
distinção de classe, de pasta nem de seção. O gatilho não muda: o cabeçalho,
**na base do PR**, diz `status: approved`. Exclusão, uma só: `## Dev Log` e
`## QA Notes` da story, que registram execução e não mudam o que foi aprovado.
As "transições sancionadas de status" saem da lista de exclusões sem serem
revogadas — são cabeçalho, e cabeçalho não é corpo.

**O cabeçalho não é conteúdo aprovado: é o registro sobre a aprovação.** Cada
campo tem regra própria, e nenhuma delas é a do corpo.

- **`status:`** — o rebaixamento é a **assinatura** da emenda substantiva, e
  assinatura não pode morar dentro da coisa que ela protege: quem paga o preço
  estaria, pelo próprio ato de pagar, violando a unidade. As transições
  sancionadas do ciclo de build param de precisar de exclusão pela mesma razão.
- **`updated:`** — a data da última mudança no **conteúdo aprovado**, não do
  último byte gravado. Emenda aditiva e append de build não a movem; emenda
  substantiva move. Quem data byte é o `git log`, e um `updated:` que o
  duplicasse seria um `git log` pior — o registro paralelo que esta ADR existe
  para não criar. Com isso `updated:` igual ou anterior a `approved:` passa a
  ser verdadeiro por construção, e a exceção do contrato ("story em ciclo de
  build carrega `updated:` posterior por natureza") deixa de descrever caso
  nenhum: uma exclusão a menos.
- **`approved:`** — abaixo, e é a pergunta que sustenta os dois buracos.

**Quem escreve `approved:`, e quando.** A decisão 10 item 6 diz que a aprovação
se deriva do merge; a decisão 5 diz que o preço da emenda substantiva é a
reaprovação no merge. Se as duas valem, a linha `approved:` **registra um
merge, e não pode ser escrita antes de ele existir** — escrevê-la no mesmo diff
que muda o conteúdo é assinar um fato que ainda não aconteceu, que foi
exatamente como a primeira aprovação fora da árvore saiu violação. Fica
decidido:

1. **Forma única:** `approved: <YYYY-MM-DD> (merge do PR #NN)`, prosa livre
   depois. A forma da decisão 10 item 6 deixa de ser cláusula de migração e
   passa a ser a única legal. Sem merge citado não há aprovação registrável;
   não aprovado e irrecuperável continuam `approved: -`.
2. **Gate:** um diff só acrescenta ou altera `approved:` se o merge citado for
   alcançável a partir da **base do PR**. Este repositório faz squash com
   `(#NN)` no assunto, e é isso que o gate resolve — no git, não no rótulo.
3. **Consequência direta:** `approved:` nunca se escreve no PR cujo conteúdo
   ela aprova. "Agente nenhum aprova o próprio artefato" para de ser prosa do
   contrato e vira impossibilidade física: no instante em que a linha seria
   escrita, o merge não existe.
4. **"Quem" não é pergunta que um gate responde.** Neste repositório Founder e
   agente assinam commit com a mesma identidade, então autoria não separa nada
   — e perguntar "quem" é ler rótulo. *Quando* é fato no disco. A regra é sobre
   o quando, e é por isso que ela roda.

O caso legítimo não é atingido, e o repositório já o pratica: as specs
`RUNTIME-F01` a `RUNTIME-F04` trazem `approved:` citando merge que já
aconteceu, com PR, squash e tag — e são hoje as únicas cuja aprovação um gate
consegue conferir. Como na decisão 4, travamos comportamento observado. As que
trazem data nua (`ADR-05` a `ADR-09`) ou prosa escrita no mesmo ato da
aprovação ganham a citação pela regra da decisão 10 item 6, na migração.

**Escrever `approved:` e `status: approved` anda um PR atrás do merge, e não
custa um PR próprio:** quem deriva do artefato é quem registra a aprovação, no
primeiro commit do PR que deriva — nesse ponto o merge aprovador já é ancestral
da base. Enquanto ninguém deriva, ninguém precisa da linha. O intervalo entre
merge e registro é o mesmo `in-review` em `implemented/` que a tabela da
decisão 1 já admite.

**A regra de derivação passa a ler o `status:`.** Hoje ela testa só datas, e um
artefato rebaixado no mesmo dia da aprovação tem `updated:` igual a `approved:`
e certifica-se derivável. Era canto; a decisão 5 tornou rebaixamento rotina e o
canto virou rota. Derivar passa a exigir `status: approved` **e** `updated:`
igual ou anterior a `approved:`. As duas condições ficam porque nenhuma basta
sozinha nesta ADR: `status:` é rótulo, e esta ADR abre dizendo para não
acreditar em rótulo; data sozinha mente, como acabou de mentir.

**O que sobra da decisão 5 fora da árvore continua valendo, agora sem
enumeração.** A rota aditiva existe onde o gate 3 obriga a editar: cobrar
rebaixamento por obedecer a um gate de repositório é o mesmo absurdo dentro e
fora da árvore, e a assinatura que o evita é a mesma. Onde o gate 3 não alcança
— o artefato da cadeia, que não cita código — a rota se fecha sozinha, sem
precisar ser proibida: não há link para retirar, o resto da linha difere, e a
emenda é substantiva. Derivar do fato, nunca enumerar.

A supersessão continua fora: fora da árvore não há `archived/` nem manifesto,
e congelar uma fotografia a tornaria falsa (decisão 10, item 5). Registro vivo
e artefato da cadeia aprovados têm duas saídas, não três.

**A regra roda no maior diff que vem por aí, que é a migração.** O `git mv` das
nove ADRs não toca corpo — nenhuma assinatura é exigida. O cabeçalho retroativo
de `ADR-01` a `ADR-04` (item 6) é cabeçalho, e também não. Só o item 8 toca
corpo de nota aprovada, reescrevendo citações de `docs/adr/`, `docs/spec/` e
`docs/LESSONS.md`: linha alterada, retirados os links, idêntica à base;
`updated:` parado; assinatura 1. A migração inteira passa sem rebaixar nada, e
sem que nenhuma classe precise ser nomeada em lugar nenhum.

## Alternativas descartadas

- **Manter o que existe: `docs/adr/` plano, status só no cabeçalho,
  `LESSONS.md` único, escrita voluntária.** É o estado que produziu os cinco
  defeitos da tabela de contexto. Gatilho que a reabriria: nenhum.
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
  por PR. Mais barato e cobre a origem das 5 lições atuais, mas deixa
  passar decisão e simplificação. Gatilho: se `simplification` e `process`
  encherem de notas sem conteúdo, o mandato por PR falhou e este é o
  fallback.
- **Manifesto de hash cobrindo todas as notas, não só as congeladas.**
  Gatilho: aparecer nota aprovada editada sem nenhuma das três assinaturas da
  decisão 5 — hoje o gate 4 cobre isso pelo diff, que é mais barato.
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
  aditiva ser usada para passar prosa — o teste do resto idêntico é o que
  fecha isso, e se furar, este é o fallback.
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
  `docs/CONTEXT.md`** (todo termo do glossário é isento; o resto é
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
  cobraria a reescrita das seis specs e o esqueleto de toda nota futura, para
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
- **Derivação por `status: approved` apenas, sem o teste de datas.** Uma
  condição a menos e volta a acreditar no rótulo. Gatilho: nenhum.
- **`## Alternativas descartadas` substituindo a pasta `rejected/`.** As
  duas coexistem e cobrem casos diferentes: alternativa que perdeu dentro de
  uma decisão mora junto de quem a venceu; proposta que morreu sem decisão
  vencedora não tem onde morar e vai para `rejected/`.

## Consequências

- **PR trivial passa a custar um parágrafo.** É deliberado (decisão 4).
- **A ADR de um parágrafo acaba.** Passa a exigir `## Contexto` e
  `## Decisões` com ao menos um item — o preço de dar aos filhos um endereço
  citável em `depends_on`. Não é mais o preço de proteger a seção: a decisão 13
  protege o corpo inteiro, e protegeria a ADR de um parágrafo do mesmo jeito.
- **O gate prova que uma nota foi tocada, não que valia a pena tocá-la.**
  Qualquer satisfator pode ser cumprido com uma edição vazia; quem julga
  valor é o review. Gate que tentasse medir sinceridade seria o próximo
  rótulo a se descolar do fato.
- **`fetch-depth: 0` no CI** vira requisito de correção, não de conveniência:
  sem a base, três gates não têm o que comparar, e passar verde nessa
  condição seria exatamente o "all skipped -> green" que o `ci.yml` proíbe.
- **A matriz de autoridade muda junto.** `docs/LESSONS.md` some de
  `squad.policies.json` (linha 115) e do `tests/squad-policy-reachability.test.js`
  (linha 115) e do `tests/squad-guard.test.js` (linha 215); a família de
  recursos por classe de nota entra. Migração que esquecer isso tira do
  Keeper a única superfície de escrita que ele tem.
- **Citação em comentário de código continua não verificável.** O runtime
  cita `LESSONS 2026-08-20` como token em prosa, em pelo menos seis
  arquivos. O gate 3 verifica link, não prosa. Gatilho para reabrir:
  comentário citando nota que não existe mais.
- **A seção `## Emendas` deixa de existir.** Ela carregava o `tipo:` e o link
  que sustentavam a classificação; sem classificação, não sobra o que ela
  carregue. Quem mudou o quê e quando é `git log -p`, `updated:` e `owner:` —
  que é o disco. Registro paralelo do que o git já diz é exatamente o rótulo
  que esta ADR existe para não criar.
- **A rota aditiva prova que o caminho novo existe, não que é o certo.**
  Trocar um link por outro que resolve passa sem preço. É o buraco que sobra,
  e ele é menor que o carimbo que substitui: como o resto da linha não pode
  mudar, a troca aparece no diff como troca de caminho, que é o que o review
  lê. Gatilho para apertar: emenda aditiva que aponte uma decisão para arquivo
  que existe e não é o dela.
- **Rebaixar passa a ser rotina, e é para ser.** A emenda substantiva é a
  saída comum, não a excepcional, e seu preço é uma linha de cabeçalho mais o
  próximo merge. O repositório já rodou esse ciclo sem dano e sem nome: a
  ADR-07 recebeu o adendo de fidelidade em 2026-08-20 e o Founder o reaprovou
  em 2026-08-21, e o `approved:` dela registra os dois atos. Travamos
  comportamento observado, como na decisão 4. A tabela da decisão 1 admite
  `in-review` em `implemented/` justamente para o intervalo entre um e outro.
- **Corrigir typo em nota aprovada rebaixa.** A unidade é o corpo inteiro, e
  prosa em `## Contexto` é corpo: custa uma linha de cabeçalho e o próximo
  merge. É o preço de uma fronteira que um gate aplica sem consultar a intenção
  de quem editou, e é o mesmo preço que a decisão 5 já chamou de rotina. A
  alternativa — enumerar quais seções "são conteúdo" — é literalmente o que
  esvaziou a unidade em quatro das seis classes.
- **O registro da aprovação anda um PR atrás do merge que a produz.** Não custa
  PR próprio (decisão 13), e o intervalo é o `in-review` que a tabela da
  decisão 1 já admite. Gatilho para reabrir: artefato que precise estar
  `approved` sem que nenhum PR derive dele — hoje não existe, porque quem não é
  derivado não é usado.
- **O `approved:` desta ADR e o de `ADR-05` a `ADR-09` são ilegais na forma
  nova**: prosa sem merge citado, e data nua. Ganham a citação na migração,
  pela regra da decisão 10 item 6 — que deixa de ser cláusula de migração e
  vira a forma única.
- **A primeira violação medida foi fora da árvore de notas, e foi do Founder.**
  O `approved:` do `docs/CONTEXT.md` escrito no mesmo diff que mudou o
  conteúdo, revertido no mesmo dia. Dentro da árvore as três assinaturas
  aguentaram o diff real desta ADR — assinatura 2, verde. Fica registrado
  porque a regra de `approved:` nasce dessa medição, não de hipótese: o
  primeiro exercício real fora da árvore foi violação, e nenhum dos cinco gates
  a pegava.
- **Três defeitos ficam regidos por esta ADR**, e dois deles são consertados
  depois dela, não agora: (1) ADR-09 se contradiz — a decisão 8 (linha 51) diz
  "`~/.claude` inteiro nunca é candidato (INV-906)" e o adendo E6
  (linhas 101-102) declara "a saída do `~/.claude` da proibição nominal". O
  primeiro corte da decisão 5 chamava isso de emenda **aditiva** ("alinha o
  texto ao que shipou, ninguém escolheu nada"); pelo teste novo é
  **substantiva**, e é a resposta certa das duas: a linha não é caminho nem
  símbolo, retirados os links o que sobra difere, e alguém escolheu — no E6 —
  tirar `~/.claude` da proibição nominal. Conserta-se editando a decisão 8 e
  rebaixando a ADR-09 para `in-review`, reaprovada no merge seguinte.
  (2) ADR-01 a ADR-04 e `LESSONS.md` sem cabeçalho, resolvido pela decisão 10
  item 6. (3) O slug fixo `ADR-NN-derivation-chain.md` e a invariante nova do
  `notes-tree`, que a rodada 2 do contrato de artefatos escreveu sem que
  nenhuma derivasse da decisão 2 — pai estendido sem emenda. **Consertado
  aqui:** é a decisão 12, acrescentada com rebaixamento, que é exatamente o
  ato que esta linha prescrevia. A decisão 13 entra pelo mesmo caminho, e o
  seu primeiro corte foi corrigido pelo mesmo — desta vez com o Keeper medindo
  as três assinaturas contra o diff real, dentro e fora da árvore. **O padrão
  vale a pena registrar:** as três emendas desta ADR que custaram rebaixamento
  vieram de execução, não de leitura. A regra que só é lida não mostra o
  buraco; a regra rodada mostra em uma tentativa.

## Open Questions

### Not blocking this stage

- `docs/TEST-SEAMS.md` ainda não existe, e esta ADR o pressupõe como
  registro vivo sujeito ao gate 3. É entrega do Rubick, e o mapa precisa
  nascer para o gate ter o que verificar nele.
- **O `docs/CONTEXT.md` contradiz a decisão 5 nova, e trava a Lina.** Os dois
  verbetes foram derivados do primeiro corte: `Substantive amendment` afirma
  "se a emenda exigiu uma escolha entre resultados possíveis, é esta. Não se
  edita: abre-se nota nova que supersede, e a antiga é congelada" — o teste
  de intenção e o preço que esta decisão trocou —, e o `_Avoid_` dele proíbe
  "edição", que é agora literalmente o que a emenda substantiva é.
  `Additive amendment` carrega o mesmo teste ("sem que ninguém tenha
  escolhido nada") e um "alinhamento ao que shipou" largo demais, que é o que
  fazia o caso E6 da ADR-09 passar por aditivo. Falta ainda o termo do
  terceiro ato: **Supersession** (supersessão), que hoje só existe como os
  campos `supersedes:`/`superseded_by:` e como a propriedade `Freeze`. A
  correção é da Lina, com esta ADR como fonte. *(A `Supersession` já entrou; o
  parágrafo abaixo acrescenta o que a decisão 13 muda nos outros dois.)*
- **A decisão 13 contradiz mais três pontos do `docs/CONTEXT.md`, e é a decisão
  que está certa.** (a) `Additive amendment` define a marca como "toda linha
  alterada em `## Decisões`" — passa a ser **no corpo**; (b) o mesmo verbete diz
  "muda `updated:`, preserva `approved:`" — a emenda aditiva **não** move
  `updated:`, e é isso que a mantém sem invalidar derivação; (c)
  `Substantive amendment` define o gatilho como "acrescentar, remover ou
  alterar um item de `## Decisões`" — passa a ser qualquer mudança no corpo. Os
  três vieram de a unidade ser uma seção nomeada, e caem juntos com ela. E a
  pergunta que o glossário deixou aberta — "correção obrigada pelo gate 3 em
  registro vivo aprovado: rebaixa?" — fecha com **não**: é emenda aditiva, e a
  marca dela agora se lê no corpo, que registro vivo tem. Correção da Lina, com
  esta ADR como fonte.
- **Falta um termo no glossário que a decisão 13 precisa: `Protected unit`
  (unidade protegida)** — o corpo de um artefato aprovado, tudo abaixo da cerca
  `---` que fecha o cabeçalho; é sobre ele que os três atos operam, e o
  cabeçalho não é ele. Sem o termo, "corpo" e "arquivo" circulam como sinônimos
  e é dessa confusão que os dois buracos nasceram. `_Avoid_` candidatos:
  arquivo, documento, conteúdo (sem qualificar), seção. Escrita da Lina, depois
  desta ADR aprovada — a mesma regra que segurou os doze termos anteriores.
- O contrato de artefatos é enviado a outros projetos que o squad serve; a
  decisão 11 muda o contrato para todos eles, não só para este repositório.
