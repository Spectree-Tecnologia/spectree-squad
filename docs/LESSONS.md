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
