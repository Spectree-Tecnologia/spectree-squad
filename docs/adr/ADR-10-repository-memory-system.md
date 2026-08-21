---
status: approved
owner: rubick
updated: 2026-08-21
approved: 2026-08-21 — Founder (Q1: merge do PR da fase conta como aprovacao; Q2: mandato estrito, sem isencao)
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
| `docs/spec/` | 1 spec + README | Declara a trilha real do repo (Brief -> Spec -> ADR -> PR), que não é a do contrato de artefatos. |
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
| `feature` | `RUNTIME-FNN-<english-slug>.md` |
| `bug-fix`, `simplification`, `testing` | `YYYY-MM-DD-<english-slug>.md` |

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

### 5. Emenda aditiva e emenda substantiva são coisas diferentes

O contrato tem um verbo só — editar — e por isso a cadeia ADR-07 (`in-review`)
-> ADR-08 -> ADR-09 (ambas `approved`) está suja pela regra e limpa pelo
conteúdo: o adendo de fidelidade do mount plan não muda nenhuma das 14
decisões das quais os filhos derivam.

- **Emenda aditiva** — muda apenas fato: caminho, nome, símbolo, estrutura,
  ou alinha o texto ao que efetivamente shipou dentro da decisão que já
  valia. É **obrigatória, não proibida**: nota em `implemented/` que
  descreve um caminho que o código moveu está errada, e corrigi-la é
  manutenção. Não rebaixa status, não invalida derivação, não reaprova.
  Muda `updated:`, preserva `approved:`.
- **Emenda substantiva** — muda, remove ou acrescenta item na lista de
  decisões, ou troca a razão que sustenta um. Não se edita: abre nota nova
  com `supersedes:`, e a antiga vai para `archived/` com `superseded_by:`.

**O teste que separa, e ele é o do próprio repositório:** a emenda é
aditiva se o texto novo é **derivável do que já existe** — o disco, o
símbolo, o teste verde decidem, e ninguém escolheu nada. Se a emenda exigiu
uma **escolha** (havia mais de um resultado possível), é substantiva. É a
mesma regra de "derivar do fato, nunca enumerar", aplicada à prosa. Teste
operacional equivalente: a emenda responde "o que existe?" (aditiva) ou
muda a resposta a "por quê?" (substantiva).

**Quem classifica:** quem edita, não. Toda emenda entra numa seção
`## Emendas` da própria nota, datada, com `tipo:` e `owner:`. Caso duvidoso
sobe ao Invoker; se o Invoker é o autor da edição, sobe ao Founder. É a
mesma regra de "agente nenhum aprova o próprio artefato".

A referência resolve isto em prosa ("facts only — not the decision
itself"). Nós fazemos gate (decisão 9, gate 4).

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

**(d) A distinção aditiva/substantiva é gate, não prosa** — decisão 5,
mecanizada no gate 4.

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
| `tests/notes-mandate.test.js` | diff fora de `docs/**` traz nota no mesmo PR | LESSONS voluntária: 5 entradas |
| `tests/notes-authority.test.js` | `owner:` × classe decidido pelo `PolicyEngine` real | nada impede o principal errado escrever a classe errada |

O gate 1 inclui o esqueleto por classe. Para `architecture` e `process`,
`## Contexto` e `## Decisões` são obrigatórias — e isso **substitui a ADR de
um parágrafo pela ADR de um item**: a lista numerada é o que os `depends_on`
dos filhos derivam (ADR-08 e ADR-09 derivam das 14 decisões da ADR-07) e é a
seção que o gate 4 protege. Sem seção nomeada não há o que proteger. Uma ADR
de um item continua sendo uma ADR completa.

O gate 4 (`notes-mandate`) hospeda também a mecânica da decisão 5: diff que
altera linhas dentro de `## Decisões` de nota em `implemented/` é presumido
substantivo e falha — a menos que o mesmo PR adicione a nota que a supersede,
ou que a mesma nota ganhe entrada em `## Emendas` com `tipo: aditiva` e link
relativo para o código ou teste já commitado que sustenta o texto novo. O
gate não julga se o texto é factual; ele exige que exista o arquivo que
decide. É a diferença entre "confie em mim" e "aqui está o disco".

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
   preservados, todas em `implemented/` — o código das nove shipou. ADR-07
   mantém `status: in-review` (aguarda reaprovação), combinação legal pela
   tabela da decisão 1; as demais, `approved`, com `approved:` reconstruído
   pela regra do item 6.
3. `docs/spec/RUNTIME-F09-*.md` -> `docs/notes/implemented/feature/`.
   `docs/spec/README.md` -> `docs/notes/implemented/process/` como a nota
   que registra a trilha; a regra operativa migra para o contrato (decisão 11).
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

A edição é entrega separada; a decisão é esta. Seis mudanças:

1. **A cadeia de derivação passa a ser declarada por repositório**, não
   universal. Hoje o contrato afirma `PRD -> EPIC -> STORY -> ADR` como se
   fosse a única, e este repositório roda `Brief -> Spec -> ADR -> PR` — daí
   sete artefatos canônicos que não existem e dois que existem e não estão
   no contrato. Aplicada ao pé da letra, a regra "sem pai não se escreve o
   derivado" proibiria as 9 ADRs que existem. Os artefatos de pipeline
   (PRD, EPIC, stories, DESIGN) continuam corretos para projeto de produto:
   o contrato passa a separar o que é incondicional do que nasce com um
   pipeline, e cada repo declara sua trilha em um lugar só.
2. **Caminhos canônicos** trocam `docs/adr/`, `docs/LESSONS.md` e o silêncio
   sobre `docs/spec/` pela árvore de notas, mais os três registros vivos.
3. **Cabeçalho** com as cercas `---` como forma única, conjunto de status
   incluindo `rejected`, e a tabela status×pasta.
4. **Emenda aditiva vs. substantiva** (decisão 5) entra no contrato: é ali
   que a regra de rebaixamento mora hoje, e é ali que a distinção precisa
   morar. Sem isso a regra vira cerimônia (rebaixa por vírgula) ou letra
   morta (ninguém rebaixa) — estamos no primeiro caso agora.
5. **O mandato de escrita por PR** (decisão 4) e os nomes dos cinco gates,
   para que um agente que quebre um saiba o que quebrou.
6. **"ADR de um parágrafo"** vira **"ADR de um item"** (decisão 9).

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
  Gatilho: aparecer nota `implemented/` editada sem emenda declarada — hoje
  o gate 4 cobre isso pelo diff, que é mais barato.
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
- **`## Alternativas descartadas` substituindo a pasta `rejected/`.** As
  duas coexistem e cobrem casos diferentes: alternativa que perdeu dentro de
  uma decisão mora junto de quem a venceu; proposta que morreu sem decisão
  vencedora não tem onde morar e vai para `rejected/`.

## Consequências

- **PR trivial passa a custar um parágrafo.** É deliberado (decisão 4).
- **A ADR de um parágrafo acaba.** Passa a exigir `## Contexto` e
  `## Decisões` com ao menos um item — o preço de tornar a lista de decisões
  protegível por gate.
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
- **Dois defeitos ficam regidos por esta ADR e são consertados depois dela**,
  não agora: (1) ADR-09 se contradiz — a decisão 8 (linha 51) diz
  "`~/.claude` inteiro nunca é candidato (INV-906)" e o adendo E6
  (linhas 101-102) declara "a saída do `~/.claude` da proibição nominal";
  sob a decisão 5 isso é emenda **aditiva** (alinha o texto ao que shipou,
  ninguém escolheu nada) e é o caso de teste da distinção. (2) ADR-01 a
  ADR-04 e `LESSONS.md` sem cabeçalho, resolvido pela decisão 10 item 6.

## Open Questions

### Not blocking this stage

- `docs/TEST-SEAMS.md` ainda não existe, e esta ADR o pressupõe como
  registro vivo sujeito ao gate 3. É entrega do Rubick, e o mapa precisa
  nascer para o gate ter o que verificar nele.
- O contrato de artefatos é enviado a outros projetos que o squad serve; a
  decisão 11 muda o contrato para todos eles, não só para este repositório.
