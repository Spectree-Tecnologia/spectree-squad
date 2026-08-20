---
name: spectree-artifacts
description: Contrato de artefatos do squad Spectree - onde vivem PRD.md, EPIC.md, STORY, ADR e DESIGN.md, qual o formato de cada um e como registrar handoff entre agentes. Use sempre que for ler ou escrever qualquer artefato do squad.
---

# Contrato de artefatos do squad

Todo estado do pipeline vive em arquivos no repositório. Subagente não
compartilha contexto com subagente — o disco é a única memória comum.

## Princípio AI FIRST

Execute, não peça. Se a tarefa pode ser concluída com uma ferramenta ao seu
alcance — CLI (`gh`, `npm`, `psql`, ...), MCP server conectado, script que
você mesmo escreve — faça você mesmo, agora. Devolver ao Founder uma lista
de passos manuais que você poderia ter executado é falha de entrega. Só há
duas razões válidas para parar: um gate de aprovação deste contrato (status
`approved`, operação destrutiva) ou informação que nenhuma ferramenta
responde. Se falta uma ferramenta (CLI não instalado, MCP não conectado),
diga exatamente qual, em vez de degradar para instrução manual.

## Matriz de autoridade

Quem pode o quê vive em `squad.policies.json`, na raiz do plugin — default
deny: o que a matriz não concede, nenhum agente tem. A prosa dos agentes
resume a matriz; em conflito, a matriz vence. Esbarrou em autoridade que
não é sua, reporte ao Invoker em vez de contornar.

## Convenção de nomes

**Identificador em inglês, prosa em português.**

Inglês técnico: pasta, arquivo, símbolo de código, tabela, coluna, rota,
campo de header, nome de branch, slug de artefato e todo título de seção
que este contrato define.

Português: o conteúdo da documentação, os critérios de aceite, o corpo da
mensagem de commit e os comentários de código.

Um ADR mora em `ADR-025-invite-code-rotation.md` e o texto dentro dele é
português. Uma migration chama `create_channels_table.sql`, e o comentário
dentro explica em português por que a constraint existe.

## Caminhos canônicos

```
docs/
  PRD.md                        # Lina  (Product Manager)
  EPIC.md                       # Lion  (Scrum Master)
  adr/
    ADR-NN-english-slug.md      # Rubick, uma decisão por arquivo
  DESIGN.md                     # Zeus  (UI/UX)
  CONTEXT.md                    # glossário do domínio - Lina mantém, todos escrevem
  TEST-SEAMS.md                 # Rubick - onde cada classe de critério se prova
  INFRA.md                      # Disruptor - o que existe, onde, como subir do zero
  LESSONS.md                    # todos - licoes aprendidas, append-only
  stories/
    STORY-NNN-english-slug.md   # Lion define; Jakiro e Keeper anexam seções
```

**Largura do número.** O número no nome do arquivo usa **a mesma largura
com que o identificador é citado no texto do projeto**. É isso que torna
`ADR-11` localizável por grep — e é por isso que `ADR-011` no arquivo,
com `ADR-11` na citação, quebra a regra em vez de cumpri-la. Projeto novo
começa em `ADR-NN` e `STORY-NNN`; alargar depois exige renomear o conjunto
inteiro de uma vez, porque largura misturada é pior que qualquer uma das
duas.

Nunca crie variação de caminho (`PRD/`, `prd.md`, `docs/product/PRD.md`).
Se o arquivo pai não existir, o artefato derivado não pode ser escrito —
reporte o bloqueio em vez de inventar o conteúdo do pai.

## Cabeçalho obrigatório

Todo artefato começa com este bloco:

```markdown
---
status: draft | in-review | approved | in-progress | done | superseded
owner: <nome do agente>
updated: <YYYY-MM-DD>
approved: <YYYY-MM-DD da aprovação do Founder, ou "-">
depends_on: <caminho do artefato pai, ou "-">
---
```

`approved` só é setado pelo Invoker depois de aprovação explícita do Founder,
que preenche `approved:` com a data no mesmo ato — a trilha de *qual*
conteúdo foi aprovado é o `updated:` daquele momento. Agente nenhum aprova o
próprio artefato. Toda edição em um artefato atualiza a linha `updated:` —
header desatualizado é bug.

**A aprovação pertence ao conteúdo, não ao arquivo.** Editar um artefato
`approved` rebaixa o `status:` para `in-review` na mesma edição, feita por
quem editou — não existe editar e deixar `approved` de pé. Derivar trabalho
de um artefato exige `updated:` igual ou anterior a `approved:`; divergência
significa conteúdo que ninguém aprovou, e volta ao Invoker para reaprovação.
(Regra espelhada do runtime: aprovação nunca sobrevive à mudança do que foi
aprovado.)

`in-progress` e `done` valem só para stories (ciclo de build abaixo):
`in-progress` é setado pelo Jakiro ao começar a implementar; `done` só pelo
Invoker, depois de veredito APROVADO do Keeper e PR aberto pelo Disruptor.

Stories levam um campo a mais no header:

```markdown
blocked_by: STORY-003, STORY-007   # ou "-" quando nada trava
```

Liste apenas bloqueio **genuíno e direto**: a story não pode *começar* sem
aquela outra pronta. Nada de dependência transitiva (se B trava C e C trava
D, D lista só C), nada de "seria melhor depois". Dependência descrita em
prosa no corpo da story é invisível para quem sequencia — se trava, é
header.

## Cadeia de derivação

```
PRD.md -> EPIC.md -> stories/STORY-*.md -> adr/ADR-*.md + DESIGN.md -> código
                                            adr/ADR-*.md -> INFRA.md
```

Antes de escrever, leia o artefato pai inteiro. Cada seção que você criar deve
rastrear para algo no pai: story cita o épico, ADR cita a story, código cita a
story. Se você precisa de algo que não está no pai, isso é um gap — liste como
`## Open Questions` no seu artefato e reporte ao Invoker. Não preencha
lacuna de requisito com suposição sua.

Organize essa seção por **fronteira**, não em lista achatada — o Invoker
pergunta ao Founder na ordem que você deixar:

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

Pergunta cuja resposta existe no repositório, no ambiente ou numa
ferramenta ao seu alcance não entra aqui: descubra você (princípio AI
FIRST). Esta seção é só para o que mora exclusivamente na cabeça do
Founder — preferência, prioridade, restrição de negócio.

## Formato mínimo por artefato

- **PRD.md** — Problema, Usuário-alvo, Escopo (fora do escopo explícito),
  Requisitos funcionais numerados (`RF-01`), Métricas de sucesso.
- **EPIC.md** — Lista de épicos (`EP-01`), cada um com objetivo, RFs cobertos
  e critério de pronto.
- **STORY-*.md** — `Como <papel>, quero <ação>, para <valor>`, épico de origem,
  critérios de aceite em Gherkin, estimativa relativa.
- **adr/ADR-NN-english-slug.md** — Uma decisão por arquivo, numeração
  sequencial na largura que o projeto cita (ver "Largura do número"); o slug
  é o que permite achar a decisão certa sem abrir nenhuma. Formato mínimo, e
  ele basta na maioria das vezes:

  ```markdown
  # ADR-11 — Título curto da decisão

  <1 a 3 frases: qual era o contexto, o que foi decidido, e por quê.>
  ```

  Seções opcionais entram só quando pagam a própria linha: **Alternativas
  descartadas** quando a rejeição é não óbvia e alguém vai propor de novo em
  seis meses; **Consequências** quando o efeito colateral surpreende. Um ADR
  de um parágrafo é um ADR completo — o valor está em registrar *que* se
  decidiu e *por quê*.

  Decisão registrada permanece como está. Mudou de ideia, abra um ADR novo
  com `supersedes:` no header e marque o antigo `status: superseded` com
  `superseded_by:`. Assim o histórico continua legível e o grep
  encontra as duas pontas.

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
  documentação falam. `_Avoid_` recolhe os rejeitados nas duas línguas.

  A linha `_Avoid_` é o que faz o glossário funcionar: quem ia escrever
  "participante" encontra a palavra proibida e a substituição no mesmo
  lugar. Sem ela, sobra um dicionário que ninguém consulta.

  Quatro regras:
  - **Defina o que a coisa é**, não o que ela faz. Uma ou duas frases.
  - **Só termo específico deste domínio.** `timeout`, `cache` e `retry` são
    conceitos gerais de programação e ficam de fora, por mais usados que
    sejam aqui.
  - **Zero implementação.** Nome de tabela, rota e biblioteca pertencem às
    ADRs; glossário que vira spec deixa de ser consultável.
  - **Escreva no instante em que o termo se resolve**, nunca em lote — lote
    não acontece. Qualquer agente escreve; a Lina mantém a consistência.

  Leia o glossário antes de escrever artefato ou código, e **tire dele os
  nomes**: variável, função, arquivo, tabela e rota usam o termo canônico em
  inglês; a prosa usa o português. É assim que oito agentes sem contexto compartilhado convergem
  para a mesma linguagem.

  O arquivo nasce quando o primeiro termo se resolve. Glossário escrito
  antes da primeira decisão é chute com aparência de autoridade.
  Índice em `docs/adr/README.md` é opcional e **lista, nunca decide**.
  Convenção de projeto que passa no portão das três condições é ADR, não
  nota de índice: convenção que só existe num README não é achada por quem
  faz grep — é folclore com endereço.
- **TEST-SEAMS.md** — Owner Rubick. O mapa de onde cada classe de critério
  se prova para valer: a costura, o que ela cobre, a ferramenta, e o que
  deliberadamente fica de fora. É **registro vivo**, não decisão: cresce a
  cada classe nova de critério, e por isso não cabe num ADR, que se decide
  uma vez e se substitui. Decisão *individual* de costura, quando é dura de
  reverter, continua sendo ADR — e o mapa aponta para ela.
- **DESIGN.md** — Fluxos de tela, estados (vazio/carregando/erro), tokens de
  design, e acessibilidade mínima por tela.
- **INFRA.md** — Owner Disruptor, deriva das ADRs. O que existe (serviços,
  ids, domínios), o que acontece no deploy, variáveis de ambiente (nomes e
  origem, nunca valores) e como subir o ambiente do zero.
- **LESSONS.md** — Append-only, qualquer agente escreve. Entrada curta:

  ```markdown
  ### <YYYY-MM-DD> — <agente> — <área: db|api|web|infra|auth|processo>
  **Contexto:** o que estava acontecendo, em 1-2 linhas.
  **Lição:** o que aprendemos — a armadilha, o bug, a causa real.
  **Gatilho de releitura:** que mudança futura torna isto relevante de novo.
  ```

  Antes de trabalhar, faça grep no LESSONS.md pela sua área — não releia o
  arquivo inteiro. Perdeu tempo com algo que outro agente vai tropeçar
  depois? Registre. Sessão de debug perdida sem entrada no LESSONS é
  desperdício em dobro.

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
editadas nem apagadas: o histórico de reprovações é parte do registro.

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
