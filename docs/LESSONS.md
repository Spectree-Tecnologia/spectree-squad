# LESSONS — licoes aprendidas (append-only)

Consultado por grep de area antes de trabalhar. Cada entrada: data, area,
a licao e a evidencia. Nunca editar entradas antigas; so acrescentar.

---

## 2026-08-20 · runtime/sandbox · Derivar do fato, nunca enumerar os casos

**Licao (Founder, review do PR #29):** piso novo se prova pelo caminho em
que ele NAO dispara, e regra sobre uma propriedade do disco se deriva do
disco — nunca se enumera.

**Evidencia — tres giros do mesmo review, tres instancias do mesmo
defeito:**

| Giro | Defeito | Forma enumerada | Forma derivada |
|---|---|---|---|
| #28 | veto de HOME | igualdade exata (`physical === home`) | relacao de ancestralidade (`isPathWithinOrEqual`) |
| #29 g1 | veto condicional | `if (homePath)` — veto com off-switch | ausencia de referencia = recusa tipada |
| #29 g2 | degrau da escada | rotulo validado em 2 de 3 valores | `statSync` decide; caminho inexistente recusado |

O runtime ja sabia disso em outros lugares — o R12 resolve o realpath do
ancestral em vez de listar caminhos suspeitos; o functionalProbe executa
em vez de confiar em `which` — mas a regra nao tinha chegado nestes tres
pontos. O codigo enumera o que alguem conseguiu imaginar; o fato (o
realpath, a ancestralidade, o stat) esta sempre disponivel e sempre e
mais curto.

**Como aplicar:** ao escrever um veto ou boundary novo, (1) escreva o
teste do caminho em que ele NAO dispara antes do teste em que dispara;
(2) se a regra fala de uma propriedade fisica (tipo de arquivo, caminho,
ancestralidade, existencia), busque a propriedade no sistema em vez de
validar um rotulo declarado.

---

## 2026-08-20 · runtime/sandbox · Bindar um diretorio nao binda o que os symlinks dele alcancam

**Licao (TechLeader, calibracao da F9):** `--ro-bind /etc /etc` promete
`/etc` e entrega symlinks apontando para fora do namespace. Um mount plan
so esta correto quando os ALVOS que ele precisa tambem estao dentro.

**Evidencia.** `/etc/resolv.conf` e symlink em praticamente todo host
moderno — `/mnt/wsl/resolv.conf` no WSL, `/run/systemd/resolve/
stub-resolv.conf` com systemd-resolved (Ubuntu 18.04+, Fedora, boa parte
do Debian, e o `ubuntu-latest` do CI). Nem `/mnt` nem `/run` estavam nas
roots bindadas, entao o DNS nao resolvia dentro do namespace.

**O que tornou caro:** o sintoma era TIMEOUT, nao erro. A escada de
calibracao viu `runner-failure` em dois degraus e nao tinha como saber
por que. Quem nao tinha credencial falhava rapido na checagem de auth;
quem tinha avancava ate a chamada de rede e travava. O padrao parecia
comportamento do CLI e era plano de montagem.

**Por que o CI nao pegou:** por construcao nossa. O conformance harness
da E3 e zero-rede — entao um DNS quebrado era invisivel para ele. A
calibracao era a unica coisa com rede real, e foi onde apareceu.

**Como aplicar:**
1. Falha que se manifesta como TIMEOUT merece suspeita de ambiente, nao
   de logica. Timeout nao se parece com erro, e por isso custa mais.
2. Boundary com um eixo deliberadamente NAO enforcado (aqui, rede) ainda
   precisa ser FUNCIONAL nesse eixo. "Nao confinamos rede" nao autoriza
   "quebramos rede sem avisar".
3. Se o teste que pegaria o defeito nao cabe na suite por uma propriedade
   dela (zero-rede), procure a assercao equivalente que CABE. Aqui:
   "`/etc/resolv.conf` resolve para arquivo existente dentro do
   namespace" e pergunta de filesystem, responde a mesma coisa, e nao
   custa a propriedade.
4. Corrigir nao basta: torne a condicao observavel. O estado de cada
   symlink de sistema agora viaja em `diagnostics().mountFidelity`, para
   a proxima quebra ser LIDA em vez de depurada.

---

## 2026-08-21 - runtime/sandbox - Degrau aprovado vira rotulo se o binding nao o re-deriva

**Licao (Keeper, review da calibracao commitada + wizard de binding):** a
granularity aprovada na calibracao (`file`) e derivada do disco no lado da
PROPOSTA (`credential-calibration.js`), e so ali. O record commitado carrega
`granularity: "file"` como texto, e o caminho record -> config de host ->
`SandboxProfileResolver` -> `createSandboxPolicy` -> `--ro-bind` nunca le esse
campo nem pergunta ao disco se o alvo e arquivo.

**Evidencia.** Binding de host apontando para um DIRETORIO passa inteiro e o
processo confinado le tudo sob ele:

```
policy aceitou o diretorio: /tmp/gran-.../home/.claude | isDirectory = true
LIDO DE DENTRO DO NAMESPACE: {".credentials.json":"...","transcript.jsonl":"TRANSCRIPT-DE-OUTRO-PROJETO"}
```

E exatamente o alcance que a secao 92 nomeia (credencial MAIS `projects/`), com
o record dizendo `file`.

**Por que nao apareceu antes:** o degrau so existia dentro de
`runCredentialCalibration`, que sempre deriva. O record commitado e o binding
de host sao os dois artefatos que fecham o circuito por FORA daquela funcao —
e chegaram juntos, cada um correto isolado.

**Como aplicar:** e a mesma regra do #29 giro 3, uma camada acima. Todo rotulo
que descreve propriedade fisica (granularity, tipo, tamanho, existencia) vale
como DOCUMENTACAO no record e como NADA no binding: quem monta pergunta ao
disco de novo. Vale o padrao E6 item 1 — proposta E binding vetam, sempre os
dois.

**Gatilho de releitura:** acrescentar campo novo ao record de calibracao, ou
qualquer novo escritor de `model-harness-bindings.json`.

---

## 2026-08-22 · runtime/harness · Forma "fechada" com `in` nao fecha nada

**Contexto (Keeper, reaferição do rework do #30):** o Item 2 substituiu o
predicado que enumerava formas de caminho de host por uma forma FECHADA do
record — campo desconhecido nao entra. O mecanismo e
`if (!(field in contract)) throw`, em `assertShape`
(`spectree-runtime/harness/credential-calibration.js`).

**Licao:** `in` anda pela cadeia de prototipo. Todo nome de
`Object.prototype` — `toString`, `constructor`, `valueOf`,
`hasOwnProperty`, `__proto__`, `isPrototypeOf` — responde `true` contra
qualquer objeto literal, entao esses campos passam como CONHECIDOS e
sobrevivem ate o record congelado:

```
loadCalibration(...) -> {"adapterId":"a@1", ..., "toString":"/home/gilso/.claude/.credentials.json"}
```

O allowlist em si estava certo: `physicalPath` e as cinco formas de caminho
sao recusadas. O que vazou foi o portao, nao a lista — e o codigo le como
correto, que e o que o torna caro de achar.

**Como aplicar:** portao de forma fechada usa `Object.hasOwn(contract, field)`
(ou `Object.keys(contract).includes`), nunca `in`. A mesma armadilha vale para
`obj[k]` em lookup de allowlist, quando `k` e `constructor` ou `__proto__`.

**Gatilho de releitura:** qualquer validador novo que decida "campo conhecido"
ou "chave permitida" consultando um objeto literal.

---

## 2026-08-21 · runtime/harness · Portao so vale para o objeto que ele mesmo constroi

**Contexto (Keeper, 3a afericao do Trabalho 1):** o rework substituiu
"validar em cada porta" por CUNHAGEM — `assertCalibrationRecord` congela
o record, registra num `WeakSet` privado, e `approvedRungs` recusa o que
nao foi cunhado. A troca e correta e fecha o furo anterior: o objeto com
a cara de record deixa de valer. Mas ela move TODA a confianca do sistema
para dentro do portao, e o portao continuou validando um objeto e
cunhando OUTRO.

**Licao — tres cunhagens forjadas, mesma raiz.** O portao le a chave com
semantica PROPRIA e o valor com semantica HERDADA, e le o valor mais de
uma vez:

1. **TOCTOU de getter.** `assertShape` le `record.resources`, o `forEach`
   le de novo, o `assertLadderOrder` de novo, e a cunhagem le pela
   quarta vez. Um getter devolve o array estreito nas tres primeiras e o
   largo na quarta — sai cunhado com `granularity: 'directory'` e com
   `physicalPath`, campo que o proprio portao recusa.
2. **Campo no prototipo.** `Object.keys(value)` (proprio) nao ve o campo,
   entao "campo desconhecido" nao dispara; `value[field]` (herdado) le o
   valor e aprova. `Object.create({...record})` sai cunhado com UMA chave
   propria — um record sem `adapterId` e sem `verdict`, que nao passaria
   no proprio portao se voltasse a ele.
3. **Escada-isca.** `approvedRungs` monta o mapa com `Object.fromEntries`
   sobre uma lista que ninguem conferiu por duplicidade: o MESMO
   `resourceId` em `file` e depois em `directory` passa a ordem da escada
   (ranks nao-decrescentes, `[0]` nao e `directory`) e o last-wins entrega
   o degrau MAIS LARGO. Chega pelo `calibration.json`, em JSON puro.

Evidencia fisica (bwrap real, WSL2): as forjas 1 e 3, com binding de host
no diretorio, devolvem
`{"credential":"CRED-REAL","transcript":"TRANSCRIPT-DE-OUTRO-PROJETO"}`
de dentro do namespace — o mesmo alcance da secao 92 que a rodada
anterior fechou.

**Como aplicar:** portao que cunha NORMALIZA primeiro e valida depois — a
copia sem prototipo (`Object.create(null)` / `structuredClone` de dados
crus), montada com UMA leitura de cada campo, e o unico objeto que o
portao valida e o unico que ele cunha. Validar o original e cunhar uma
releitura dele e TOCTOU por construcao. E lista que vira mapa exige a
regra da duplicidade explicita: sem ela, `Object.fromEntries` escolhe em
silencio, e escolhe o ultimo.

**Corolario que apareceu junto:** a guarda de escada no record commitado
recusa `resources[0].granularity === 'directory'` — mas a calibracao real
PODE aprovar o degrau `directory` (ADR-09, E6). O record legitimo desse
resultado e recusado pelo portao, e a unica forma de expressa-lo e
acrescentar a entrada-isca. Guarda que bloqueia o caso legitimo e passa
o forjado esta medindo posicao na lista onde deveria medir evidencia.

**Gatilho de releitura:** qualquer portao que devolva um valor cunhado /
marcado / assinado, e qualquer lista de configuracao que vire mapa de
lookup.

---

## 2026-08-21 · processo/memoria · `--find-renames` tem limiar, e abaixo dele o caminho antigo some

**Contexto (Keeper, rodada 7 da ADR-10):** a decisao 1 conserta a lavagem de
recusa indexando a fonte de derivacao pela IDENTIDADE da nota — se o PR
renomeia o pai, pergunta-se a `main` pelo caminho ANTIGO, e a ADR escreve que
`git diff --find-renames` "entrega o caminho antigo de graca". A mesma
heuristica sustenta a assercao do ramo 2 (o pai nascido no PR nao pode dizer
`draft` nem `rejected`), porque "nascido no PR" = "aparece como Added no diff".

**Licao — "de graca" custa 50% de similaridade.** `--find-renames` sem valor e
`-M50%`. Nota movida entre pastas de ciclo de vida E reescrita no mesmo PR cai
abaixo do limiar e o git reporta delete+add: o caminho antigo nao existe no
diff, `git show origin/main:<caminho novo>` responde `fatal`, e a regra conclui
"nasce neste PR" — que e exatamente a porta que a regra fechou. O risco e maior
justamente nas notas curtas (`bug-fix`, `simplification`, `testing`), e mover
nota entre pastas nao e excecao: e o que o ciclo de vida no caminho obriga.

## Laço vermelho
Comando (repo descartavel, indice = caminho antigo, worktree = caminho novo):
```
git add -N "$NEW"; git diff -M --find-renames --raw -- docs/
```
Vermelho: nota de 16 linhas, 5 preservadas e 11 reescritas, mesmo basename —
```
:000000 100644 0000000 a26b708 A  docs/notes/implemented/bug-fix/2026-08-10-mount-plan.md
:100644 000000 efd136d 0000000 D  docs/notes/proposed/bug-fix/2026-08-10-mount-plan.md
```
Varredura do limiar, mesmo par de arquivos: `-M50%` a `-M10%` nao detectam;
`-M5%` devolve `R005`. Com 12 de 16 linhas preservadas, `-M50%` devolve `R050`
— o limiar e a fronteira, e ela e de conteudo, nao de nome.

**Gatilho de releitura:** qualquer regra que peca o caminho antigo de um
arquivo ao `git diff`, e qualquer gate que decida "nasceu neste PR" lendo o
raw do diff. Detecção de rename e heuristica: ou se fixa o limiar e se declara
o que acontece quando ela falha, ou a regra depende de o revisor notar.

---

## 2026-08-22 · processo/memoria · Identidade por nome fecha o renome e deixa a supersessao aberta

**Contexto (Keeper, rodada 8 da ADR-10):** o setimo corte tirou a regra de
derivacao da mao do agente e a pos no `notes-tree`, trocando identidade por
caminho (que dependia de `--find-renames`, e o limiar dele e a licao de
2026-08-21) por identidade pelo **nome do arquivo**: 1 ocorrencia na base = e
o pai, 0 = nasce no PR, >1 = vermelho. Zero heuristica, zero limiar. O preco
declarado foi uma obrigacao nova — *"nota que a base carrega nao desaparece da
arvore"* — apresentada como a defesa contra renomear uma nota recusada para
lavar a recusa.

**Licao — a defesa cobre o renome e nao cobre a supersessao, que e o mesmo
ato com papelada.** Renomear a nota recusada e a lavagem ingenua: o nome novo
tem 0 ocorrencias, cai em "nasce no PR" e passa, mas o nome antigo sumiu e a
invariante fica vermelha. Ja **superseder** a nota recusada passa nos dois
lados ao mesmo tempo: move-se a recusada para `archived/` com
`status: superseded` e `superseded_by:`, escreve-se o conteudo sob nome novo
com `supersedes:`, e deriva-se dali. Nome intacto (invariante satisfeita),
`archived/`+`superseded` legal na tabela status×pasta, campos mutuos e
resolviveis, manifesto de congelamento so cresce, nome novo com 0 ocorrencias
na base. Verde em tudo, e uma recusa virou pai derivavel em um PR.

Duas coisas fazem esta a pior das portas, e nenhuma aparece em leitura:

1. **A assinatura no diff e byte a byte a da supersessao legitima.** A defesa
   residual escrita para o caso vizinho — "copiar a nota recusada aparece no
   diff como uma duplicata, e quem a pega e o review" — e falsa aqui: nao ha
   duplicata. O que o revisor ve e o ato que o proprio contrato manda praticar.
2. **Nao exige ma-fe.** Um agente que pensa "a proposta recusada foi
   retrabalhada, entao supersedo" produz o caso sozinho, cumprindo a regra que
   leu. A raiz e que nada proibia a transicao `rejected/` -> `archived/`: a
   tabela status×pasta admite o destino e nenhum texto qualifica a origem.

## Laço vermelho
Comando (a regra escrita implementada como operacao de conjunto sobre duas
arvores — nao precisa de git, e por isso roda sem commit):
```
node run.mjs   # rule.mjs = SKILL.md:333-339 (identidade por nome)
               #          + SKILL.md:341-347 (nao-desaparecimento)
```
Vermelho: quatro arvores de fixture sobre a mesma base (uma nota
`status: rejected` em `rejected/architecture/`):
```
A  git mv sancionado, nome intacto   DERIV VERMELHO   NAODESAP PASSA
B  renome puro (a lavagem ingenua)   DERIV PASSA      NAODESAP VERMELHO
C  renome + toco no nome antigo      DERIV PASSA      NAODESAP PASSA
D  supersessao (archived/, sup._by)  DERIV PASSA      NAODESAP PASSA
```
A e B sao a regra funcionando. **C e D lavam a recusa com os dois gates
verdes** — e D o faz com o diff parecendo rotina.

**Gatilho de releitura:** qualquer regra que decida **autoridade** a partir de
um par de campos mutuos (`supersedes:`/`superseded_by:`) ou a partir da
**pasta de destino**. Campo mutuo prova consistencia, nunca legitimidade: os
dois lados sao escritos pela mesma pessoa, no mesmo diff. E antes de declarar
que uma invariante fecha uma porta, construa a arvore em que ela e satisfeita
e a porta continua aberta.

---

## 2026-08-22 · processo/memoria · A ref de comparacao andou no meio do review

**Contexto (Keeper, rodada 8 da ADR-10):** eu media as afirmacoes da ADR sobre
o estado de `main` — quantos arquivos `docs/` tem la, quantos abrem com as
cercas `---`, quantos dizem `status: approved` dentro delas. Sao os numeros que
sustentam o quinto corte da decisao 13, a clausula de intervalo do cabecalho
pre-contrato e tres entradas de Alternativas descartadas.

**Licao — a medicao envelheceu dentro da janela do review, nao entre rodadas.**
No meio da sessao o PR #31 mergeou. `origin/main` foi de `9b55793` para
`5399316`, `docs/` passou de 13 para 21 arquivos, e todo numero mudou de valor
enquanto eu media:

| | main antes | main depois |
|---|---|---|
| arquivos em `docs/` | 13 | 21 |
| com cercas `---` | 0 | 10 |
| `status: approved` entre cercas | 0 | 1 |

O que caiu junto nao foi so a contagem: a **conclusao** construida sobre ela —
"nada em `main` e derivavel" — virou falsa, porque uma spec entrou em `main`
com cercas e `approved`, e passa a ser derivavel pela letra da regra, sem
clausula de intervalo nenhuma. A ADR ja tinha escrito a regra de redacao certa
("contagem some"; "estado de `main` so se afirma com a medicao junto") depois
de tres afirmacoes falsas em rodadas anteriores — e a regra se provou contra o
documento que a contem, no intervalo mais curto possivel.

O corolario que custou meia rodada: **duas medicoes divergentes de dois agentes
podem estar as duas certas.** O Rubick mediu cabecalho entre cercas no
`docs/spec/README.md` e eu medi a ausencia dele; ele lia a arvore de trabalho,
eu lia `main`, e o #31 colapsou a divergencia ao mergear uma na outra. Nao era
erro de ninguem: era falta de ref ao lado do numero.

## Laço vermelho
Comando (a mesma pergunta, duas vezes, com a ref explicita):
```
git reflog show origin/main | head -2
for f in $(git ls-tree -r --name-only <REF> -- docs/); do
  git show <REF>:$f | head -1; done | grep -c '^---$'
```
Vermelho: `9b55793` devolve `0`; `5399316` devolve `10`. Mesma pergunta, mesmo
comando, mesmo dia, respostas incompativeis — e o reflog mostra o `fetch` que
moveu a ref entre as duas execucoes.

**Gatilho de releitura:** qualquer medicao citada dentro de um artefato em
review sem a **ref** e a **data** ao lado; e qualquer divergencia entre dois
agentes sobre o estado do repositorio — antes de procurar quem errou, pergunte
contra qual ref cada um mediu. Numero sem ref nao e medicao, e lembranca.

---

## 2026-08-22 · processo/memoria · O congelamento proibe o ato que a arvore sanciona, e e ele que fecha a lavagem em dois PRs

**Contexto (Keeper, rodada 9 da ADR-10):** o oitavo corte fechou o caso D — a
supersessao de nota recusada — dando **alcance** a supersessao em vez de tornar
`rejected/` terminal. A razao escrita para nao torna-la terminal foi que
desrejeitar e ato **legitimo e visivel**: "ela sai de `rejected/` num PR
proprio, cujo conteudo inteiro e essa saida". Fui medir esse ato.

**Licao — o ato declarado legitimo nao passa em gate nenhum, e ninguem escreveu
que e ele que fecha a porta seguinte.** A decisao 6 diz tres coisas sobre o
`FROZEN.sha256`: todo congelado tem entrada, **todo hash bate**, e o manifesto
**so cresce** contra a base. Uma nota que sai de `rejected/` colide com as duas
ultimas ao mesmo tempo, e nao ha terceira saida:

| desfecho do manifesto no PR de desrejeicao | `notes-freeze` |
|---|---|
| linha intacta | VERMELHO — entrada aponta para caminho que nao resolve |
| linha removida | VERMELHO — o manifesto encolheu |
| caminho da linha reescrito para `proposed/` | VERMELHO — encolheu **e** hash nao bate |
| linha antiga mantida + linha nova | VERMELHO — a antiga continua sem resolver |

Duas consequencias, e a segunda e a que importa:

1. **`rejected/` e terminal de fato**, por acidente de um gate, enquanto o texto
   diz em tres lugares que nao e. Regra proibindo ato que outra regra sanciona.
2. **A lavagem em dois PRs morre por esse acidente, nao por defesa.** O PR 1
   (tirar de `rejected/`) passa o `notes-tree` inteiro — nao-desaparecimento
   verde, alcance verde, `proposed/`+`in-review` legal na tabela status×pasta —
   e so o `notes-freeze` o para. O PR 2 supersede a nota normalmente, agora que
   a base a carrega em `proposed/`: verde em tudo, e a recusa esta lavada. Quem
   consertar a colisao do manifesto pelo caminho obvio (deixar a linha sair)
   **reabre a lavagem sem tocar em nenhuma linha sobre supersessao.**

E o primeiro passo nao e distintivo: medido com `git diff -M`, o diff de
desrejeitar e `rename from <ciclo>/ ... rename to <ciclo>/ ...` mais uma linha
de `status:` — a mesma forma de um `proposed/` -> `implemented/` rotineiro, que
a decisao 1 torna obrigatorio e frequente. A defesa "o review pega" pede
vigilancia proporcional ao volume, que e a definicao que a propria ADR usa para
invariante sustentada por promessa.

## Laço vermelho
Comando (regra e manifesto implementados como operacao de conjunto sobre duas
arvores; nao precisa de git nem de commit):
```
node run.mjs        # rule.mjs   = SKILL.md:343-349, 351-357, 437-440, 328-341
node freeze-run.mjs # freeze.mjs = ADR-10 decisao 6 + SKILL.md:262-265
```
Vermelho (fixtures A-F sobre a mesma base, uma nota `status: rejected` em
`rejected/architecture/` com linha no `FROZEN.sha256`):
```
A  git mv sancionado          DERIV VERMELHO  -> bloqueado (regra funcionando)
B  renome puro                NAODESAP VERMELHO -> bloqueado
C  renome + toco no nome      tudo verde  -> lava a recusa; fica com o review, escrito
D  supersessao da recusada    ALCANCE VERMELHO  -> o conserto do 8o corte pega
E  supersessao de proposed/   tudo verde  -> o ato legitimo sobrevive ao conserto
F  desrejeitar                notes-tree TUDO VERDE, notes-freeze VERMELHO nos 4 desfechos
```
Verde depois: quando a colisao do manifesto for decidida, F tem de ficar verde
nos dois gates **e** a lavagem em dois PRs tem de continuar fechada por uma
linha que diga que fecha — hoje nao existe essa linha.

**Gatilho de releitura:** qualquer regra que declare um ato legitimo sem rodar
esse ato contra os cinco gates; e qualquer porta que se declare fechada sem
nomear **qual** regra a fecha. Porta fechada por acidente de outra regra reabre
no dia em que essa outra regra for consertada, e o conserto nao vai mencionar a
porta. Antes de aceitar "isso o review pega", meca a forma do diff contra a do
movimento rotineiro mais parecido: se forem iguais, a defesa e promessa.

---

## 2026-08-22 · processo/memoria · Lista de isencao que so encolhe transforma defeito de forma em permissao permanente

**Contexto (Keeper, rodada 9 da ADR-10):** medindo quais entradas do
`docs/LESSONS.md` migram sem laco vermelho — a lista exata que a decisao 10
item 7 manda o gate carregar — achei tres entradas que **tem** laco e o
escrevem `## Laco vermelho`, sem cedilha. A lista de titulos do contrato e
fechada e literal.

**Licao — o defeito de forma nao reprova: ele se converte em dispensa, e a
dispensa e vitalicia.** O caminho e curto e nenhum passo dele parece errado.
O `notes-tree` procura a secao pela forma exata, nao acha, e reporta secao
obrigatoria ausente. A migracao ve nota de `bug-fix` sem laco, aplica o
criterio que a delimita — "nota que a migracao produziu a partir de uma
entrada do `docs/LESSONS.md` e cujo laco nao foi recuperado" — e escreve o
caminho na lista de isencao. Fim: tres licoes com regressor reexecutavel
ganham dispensa de ter um, por um acento.

E a dispensa nao se corrige sozinha, porque **a lista so encolhe**. Quem tira
um caminho de la e quem *recupera* o laco daquela nota; ninguem varre a lista
procurando entrada que nunca precisou estar nela. A propriedade que existe
para matar a isencao — encolher ate sumir — e a mesma que impede a isencao
concedida por engano de ser revista.

O par que faz isto acontecer e generico: **um gate que decide por forma
literal, e uma lista de isencao construida a partir do que aquele gate nao
achou.** Nesse par, todo defeito de grafia vira permissao, e vira permissao
sem deixar vermelho em lugar nenhum — o gate ja deu o veredito dele, e a
lista o obedeceu.

## Laço vermelho
Comando:
```
grep -c '^## Laco vermelho' docs/LESSONS.md     # grafia fora da lista fechada
grep -c '^## Laço vermelho' docs/LESSONS.md     # a forma que o SKILL.md:196 cobra
```
Vermelho antes: `3` e `1` — tres entradas com laco que o gate nao acharia.
Verde depois: `0` e `4`; a lista de isencao continua com as **mesmas 5**
entradas, que sao as que genuinamente nao tem laco.

**Gatilho de releitura:** toda lista de isencao derivada de um gate — antes de
aceitar um caminho nela, rode o gate contra a **forma** e nao contra a
ausencia do conteudo, porque os dois vereditos sao iguais e as causas nao. E
toda lista que "so encolhe": a propriedade que a mata e a mesma que impede
corrigi-la, entao o momento de conferir e o de escrever, nunca depois.

### 2026-08-22 — Keeper of the Light — processo
**Contexto:** rodada 10 da ADR-10. A tabela do `## Contexto` foi reprovada
duas rodadas seguidas — primeiro por dígito, depois por quantificador. O
conserto desta rodada declarou o enquadramento ("a base deste PR vale para
toda afirmação desta ADR sobre o estado do repositório") e tirou a coluna
"Estado" da tabela.

**Lição:** o conserto foi aplicado **ao lugar onde o defeito apareceu**, não à
classe. A declaração de enquadramento é nova e correta; a varredura que ela
manda fazer nunca rodou contra o resto do artefato. Contra a base do PR
(`9b55793`): `docs/CONTEXT.md` não existe, e é linha da tabela e é citado em
mais oito sítios; nenhum arquivo sob `docs/` tem cabeçalho entre cercas, e a
linha `docs/adr/` afirma essa forma como um dos três "vivos ao mesmo tempo";
`docs/spec/` tem uma spec, e a medição que mata o campo `approved:` diz "das
nove specs". A mesma ADR já tinha registrado esse erro para `RUNTIME-F04/F06/F07`
(linha 1061) e o corrigiu **só naquelas três**. Declarar o frame não mede nada:
enquadramento novo é varredura a rodar, e a varredura é um comando —
`git cat-file -e <base>:<caminho>` por caminho citado.

**Gatilho de releitura:** todo artefato que declare um frame temporal ou de ref
("a base do PR", "`main`", "o estado de hoje"). Antes de aceitar a declaração,
enumere os caminhos e as contagens que o artefato cita e resolva cada um
**contra a ref declarada**, não contra o disco. O defeito reaparece por
sobrevivência: o parágrafo que se conserta é o que o review citou.

---

## 2026-08-22 · processo/memoria · Harness que fatia markdown por linha em branco mede o arquivo inteiro quando a árvore é CRLF

**Contexto (Keeper, rodada 12 da ADR-10):** a ADR passou a substituir as quatro
ordens ao glossário por uma **declaração de não-mudança** — "lido o glossário
inteiro, os sete critérios estão lá". Para medir isso escrevi um harness que
fatia `docs/CONTEXT.md` verbete a verbete (`indexOf('\n\n**')`) e casa cada
critério dentro do verbete certo. Ele devolveu 4/7. Fui depurar o critério do
pai externo, que eu tinha acabado de ler com os próprios olhos no arquivo.

**Lição — a fatia nunca aconteceu, e o modo de falhar foi o pior possível: ela
falhou para o lado do verde.** A árvore de trabalho deste repositório está em
CRLF (`core.autocrlf`), então `'\n\n**'` não casa nada: `indexOf` devolveu `-1`,
o `slice` devolveu **o resto do arquivo**, e cada asserção "dentro do verbete X"
virou asserção "em qualquer lugar depois de X". Cinco critérios passaram por
casar em outro verbete; os dois vermelhos eram falsos-negativos de regex que
não tolerava a quebra de linha do parágrafo. Corrigido — normalizar CRLF e
colapsar espaço em branco antes de casar — a medição virou 5/7, e os dois
vermelhos que sobraram são reais e de outra natureza.

Duas propriedades tornam isto caro. A primeira é que **o delimitador ausente
não dá erro**: `indexOf` que não acha devolve `-1`, e `slice(i, -1)` é uma fatia
válida. A segunda é que a fatia grande **contém** a fatia certa, então todo
critério que o arquivo satisfaz em qualquer lugar passa — o harness confirma a
afirmação que estava medindo em vez de tentar derrubá-la, que é exatamente o
vício que esta ADR registra sobre quem escreve a própria regra.

## Laço vermelho

```
node -e "
const fs=require('fs');
const t=fs.readFileSync('docs/CONTEXT.md','utf8');
console.log('CRLF no arquivo:', /\r\n/.test(t));
console.log('fatia por LF duplo casa:', t.indexOf('\n\n**') >= 0);
"
```

Vermelho quando a primeira linha diz `true` e a segunda `false` — é o par que
produz a fatia do arquivo inteiro. Verde depois de `t.replace(/\r\n/g,'\n')`.

**Gatilho de releitura:** todo harness que fatie um artefato de markdown por
delimitador de linha (`\n\n`, `^## `, `^- `) para afirmar que algo está **dentro**
de uma seção. Antes de acreditar no verde, force a fatia a ser não-vazia e menor
que o arquivo, e rode uma asserção-controle que **tem** de ficar vermelha —
casar um termo que só existe em outra seção. Fatia que engole o arquivo inteiro
responde verde a qualquer pergunta de presença, e presença é o que estas
varreduras perguntam.
