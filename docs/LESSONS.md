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
