---
status: in-review
owner: lina
updated: 2026-08-21
approved: 2026-08-21 — Founder (56 termos, todos ancorados em fonte do repositorio; homonimo `effect` e canonizacao de `seam` decididos antes da aprovacao)
depends_on: -
---

# CONTEXT — glossário do domínio

Termo canônico em inglês (é ele que vira símbolo de código); português entre
parênteses (é assim que o Founder e a documentação falam). A linha `_Avoid_`
recolhe os sinônimos rejeitados nas duas línguas.

## Linguagem

### Squad e pipeline

**Founder** (Founder):
A pessoa dona do produto e única autoridade de aprovação do pipeline. Não é
um agente e não executa trabalho — decide.
_Avoid_: cliente, usuário, stakeholder, PO, product owner, dono

**Invoker** (Invoker):
O agente que roda na thread principal, orquestra os oito agentes do squad e é
o único ponto de contato com o Founder. Não escreve artefato nem código.
_Avoid_: orquestrador, coordenador, maestro, agente zero, gerente

**TechLeader** (TechLeader):
O papel que o Invoker ocupa. É título de papel, nunca o nome de um agente
invocável.
_Avoid_: tech lead, líder técnico, arquiteto (arquiteto é o Rubick)

**Squad** (squad):
Os oito agentes de IA definidos em prompt, cada um com um papel, uma
autoridade declarada e um artefato de saída. Metade do plugin; a outra metade
é o Runtime.
_Avoid_: time, equipe, crew, swarm, pipeline de agentes

**Agent** (agente):
Uma identidade com instrução, autoridade declarada e critério de saída
verificável. No Runtime é abstração de composição que executa uma missão — não
é o modelo, não é o harness.
_Avoid_: bot, assistente, worker, LLM, persona (persona é a voz do agente,
não o agente)

**Artifact** (artefato):
Um arquivo versionado que carrega um estado do pipeline. Como subagente não
compartilha contexto com subagente, o artefato é a única memória comum do
squad.
_Avoid_: documento, entregável, deliverable, doc, output

**Handoff** (handoff):
O relato curto que um agente devolve ao Invoker ao terminar: o que fez, o que
bloqueou, quem age agora. Nunca repete o conteúdo do artefato.
_Avoid_: relatório, report, resumo final, entrega, sumário

**Spec** (spec, especificação normativa):
O contrato verificável de uma fase do Runtime — o que MUST valer, com
invariantes numeradas e critérios de aceite. É a nota da classe `feature`;
aprovada, é contrato: o texto commitado é o contrato real.
_Avoid_: documento de requisitos, RFC, design doc, PRD (PRD é produto; spec é
fase do Runtime), proposta

**ADR** (ADR, decisão de arquitetura):
O registro de UMA decisão difícil de reverter, com o porquê e as alternativas
descartadas. É a nota das classes `architecture` e `process`: alterar um item da
lista de decisões é emenda substantiva na própria nota, e substituir a nota
inteira é supersessão.
_Avoid_: design doc, RFC, spec, documentação técnica, proposta

**Lesson** (lição):
Uma nota da classe `bug-fix`: uma armadilha já paga, com o laço vermelho que a
prova e o gatilho que a torna relevante de novo. Uma lição por arquivo —
registra, não decide.
_Avoid_: postmortem, retro, changelog, observação, entrada append-only

**Test seam** (costura de teste):
A fronteira pública onde um comportamento se observa, e por isso o lugar onde
o teste dele mora.
_Avoid_: camada de teste, ponto de teste, test layer, cenário

**Laço vermelho** (laço vermelho):
Um comando executável que fica vermelho neste defeito e verifica a correção
depois — determinístico, rápido e já executado ao menos uma vez. É o que vem
antes da primeira hipótese, e é o que uma nota da classe `bug-fix` precisa
carregar junto.
_Avoid_: repro, reprodução, laço, red loop, teste que falha, caso de teste,
evidência
_Exceção consciente_: a forma canônica é o português. Este termo virou nome de
seção obrigatória verificada por gate de repositório, e nome de seção de
documento não vira código — a regra "identificador em inglês" existe para o que
vira símbolo de código, e não alcança este caso.

**Wizard** (wizard):
O script interativo que dirige o humano no passo que só ele pode dar —
capturando o valor e gravando onde ele pertence. É a fronteira do AI FIRST,
não uma fuga dele.
_Avoid_: tutorial, instruções, runbook, guia, passo a passo, checklist manual

### Memória do repositório

**Note** (nota):
O artefato que registra um momento: tem data, autor, classe e ciclo de vida, e
congela quando sai de circulação. Mora em `docs/notes/{lifecycle}/{class}/`, e é
a pasta — não a linha `status:` — que diz se ela descreve código que existe.
_Avoid_: doc, documento, entrada, página, registro (sem qualificar — registro
vivo é a outra metade da memória, não sinônimo)

**Note class** (classe):
O assunto de que uma nota trata — `feature`, `architecture`, `bug-fix`,
`process`, `simplification` ou `testing`. É conjunto fechado em código: decide a
forma do nome do arquivo e quem tem autoridade para escrevê-la.
_Avoid_: categoria, tipo, tag, área, pasta (a pasta carrega a classe, não é a
classe)

**Note lifecycle** (ciclo de vida):
Onde uma nota está em relação ao código — `proposed`, `implemented`, `archived`
ou `rejected`. Mora no caminho porque pasta é fato do filesystem; convive com o
`status:` do cabeçalho, que responde a outra pergunta.
_Avoid_: status (status é o rótulo do cabeçalho), estado, fase, etapa, workflow

**Living record** (registro vivo):
O artefato reescrito continuamente que fotografa o estado atual: sem data, sem
ciclo de vida, nunca congelado. Congelá-lo o tornaria falso, e por isso ele fica
fora da árvore de notas — este glossário é um.
_Avoid_: nota, documento vivo, wiki, referência, snapshot

**Derivation chain** (cadeia de derivação):
A ordem de derivação que um repositório declara como sua: quais artefatos ele
produz e qual é pai de qual. Não existe uma universal — cada repositório declara
a sua uma vez, numa nota de classe `process`, e a de um produto não é a de um
runtime. Chamou-se "trilha" no contrato e não se chama mais: `trilha` é o
português de Audit, e quem quer aquele sentido está no verbete errado.
_Avoid_: trilha, trilha do repositório, nota de trilha, cadeia de artefatos,
pipeline, fluxo, esteira, workflow

**Additive amendment** (emenda aditiva):
O ato de editar nota aprovada em que toda linha alterada em `## Decisões`,
retirados os links relativos e os símbolos colados neles, continua byte a byte
igual à da base — e cada link novo resolve. Existe onde o gate de repositório
obriga a corrigir e em lugar nenhum além: muda `updated:`, preserva `approved:`
e não invalida derivação.
_Avoid_: correção, ajuste, typo, atualização, emenda (sem qualificar)

**Substantive amendment** (emenda substantiva):
O ato de editar nota aprovada no lugar, quando o texto alterado não passa no
teste da emenda aditiva — acrescentar, remover ou alterar um item de
`## Decisões`, ou trocar a razão que sustenta um. A marca é o cabeçalho
rebaixado para `in-review` no mesmo diff, e o preço é a reaprovação do Founder
no merge; é a saída comum, não a excepcional.
_Avoid_: revisão, atualização, correção, emenda (sem qualificar), supersessão
(a supersessão substitui a nota; a emenda corrige a nota que fica)

**Supersession** (supersessão):
O ato de substituir uma nota inteira por outra: a substituída vai para
`archived/` com `superseded_by:`, o mesmo diff traz a nova com `supersedes:`, e
a linha entra no manifesto de hash. Serve à nota que foi substituída, nunca à
que foi corrigida — não é preço de emenda nenhuma, e emenda nenhuma a dispara.
_Avoid_: emenda, emenda substantiva, revogação, deprecação, invalidação,
obsolescência

**Freeze** (congelamento):
A propriedade de uma nota fora de circulação — arquivada ou rejeitada — de não
mudar nunca mais. É fato provado por manifesto de hash, não promessa: é o que
tira "decisão registrada permanece" da disciplina. Chega-se a ele por
supersessão ou por rejeição, e por emenda nenhuma.
_Avoid_: arquivamento (arquivar é o movimento, congelar é a propriedade),
imutabilidade, lock, bloqueio, somente leitura

**Claim** (declaração):
Uma citação em link relativo dentro de uma nota: afirma que aquele arquivo
existe e que o símbolo colado no link está definido lá. Token entre crases sem
link não afirma nada — é vocabulário, e é por isso que este glossário não
declara nada sobre código.
_Avoid_: citação (a citação é a forma, a declaração é o que ela afirma),
referência, menção, link, crase

**Write mandate** (mandato de escrita):
A regra que exige de todo diff que toca qualquer coisa fora da documentação ao
menos uma nota adicionada ou modificada no mesmo PR. Não tem isenção
declarável, porque isenção declarável é a promessa que o gate de repositório
existe para eliminar.
_Avoid_: obrigação de documentar, política de documentação, checklist de PR,
definition of done, boa prática

**Repository gate** (gate de repositório):
O teste executável que recusa a violação de uma invariante do repositório, em
vez de confiar que ninguém a viole. Homônimo de Founder Gate: os dois nomes
ficam como estão, e a forma qualificada é obrigatória — `gate` sozinho não
identifica nenhum dos dois.
_Avoid_: `gate` sozinho, gate (sem qualificar), Founder Gate, CI check, lint,
validação, portão

### Autoridade

**Runtime** (Spectree Runtime):
O microkernel que governa como uma execução de agente acontece: quem autoriza,
quem aprova, sob quais limites físicos. Não conhece nenhum agente do squad
pelo nome.
_Avoid_: framework, engine, SDK, plataforma, orquestrador

**Policy** (policy):
A regra que responde "pode?". A decisão é determinística e a ausência de regra
nega; nenhuma policy concede limite físico.
_Avoid_: permissão, regra de acesso, ACL, RBAC, autorização (autorização é o
resultado, não a regra), política

**Policy effect** (efeito da policy):
O veredito que uma policy carrega: `allow`, `deny` ou `approval-required`.
Homônimo de Execution Effect: os dois nomes ficam como estão, e a forma
qualificada é obrigatória — `effect` sozinho não identifica nenhum dos dois.
_Avoid_: `effect` sozinho, efeito (sem qualificar), ação, permissão,
resultado, decisão (Policy Decision é o objeto que carrega o veredito)

**Principal** (principal):
A identidade contra a qual uma policy é avaliada. Principal ausente é a thread
principal; principal presente e desconhecido é fail closed.
_Avoid_: usuário, ator, role, papel, caller; e "thread principal" (main
thread) não é o principal de uma policy

**Authority matrix** (matriz de autoridade):
O documento único que declara quem pode o quê no squad. Existe exatamente uma,
tem um caminho de carga só, e quando a prosa de um agente diverge dela, ela
vence.
_Avoid_: config de permissões, ACL, lista de acessos, permissionamento,
arquivo de policies

**Guard** (guard):
O processo separado que, a cada invocação de tool no host, pergunta à matriz o
que ela decide e bloqueia ou escala. Nunca concede — só nega, escala ou
silencia.
_Avoid_: hook (hook é o mecanismo do host que o dispara), interceptor,
middleware, validador, firewall

**Permission** (permissão):
O mecanismo do host que autoriza uma tool fora do Runtime. É a última palavra
sobre o que o guard não detecta, e o guard jamais a amplia.
_Avoid_: approval, aprovação, policy, autorização do runtime

**Approval** (aprovação):
O pedido formal de decisão humana criado quando a policy responde
`approval-required` — estado explícito, decisão única, terminal.
_Avoid_: permissão, permission, confirmação, autorização, sinal verde; e a
aprovação do Founder sobre um artefato não é esta — aquela é o fato registrado
em `approved:`, derivado do merge

**Founder Gate** (gate do Founder):
O ponto em que a execução para e espera a decisão do Founder, e o contrato
entre o Runtime e o mecanismo externo que apresenta essa decisão (CLI, TUI,
web). Homônimo de Repository gate, e a forma qualificada é obrigatória nos dois.
_Avoid_: `gate` sozinho, gate (sem qualificar), checkpoint, portão,
human-in-the-loop, prompt de confirmação, validação

**Resume** (resume):
A re-entrada de uma invocação aprovada, que revalida a policy com o input
original antes de executar. Aprovação não é bypass: se a regra mudou no
intervalo, nada executa.
_Avoid_: retry, reexecução, continuação, replay, liberação

**Audit** (auditoria, trilha):
O registro projetado das decisões tomadas — nunca o comando bruto, o input ou
o segredo. É observabilidade: falha de escrita jamais altera uma decisão.
`trilha` é o português desta e de mais nada: a cadeia de derivação usou o mesmo
nome no contrato e não usa mais, então quem procura a ordem de derivação está no
verbete errado.
_Avoid_: log, histórico, rastreamento, evento (evento é o que o bus publica),
telemetria, cadeia de derivação (é o outro sentido que `trilha` já teve)

### Execução

**Tool** (tool):
A operação concreta que um agente pode pedir. É o pedido; a Capability é a
família a que ele pertence.
_Avoid_: função, comando, ação, ferramenta, skill

**Capability** (capability):
A família de operações que o Runtime sabe executar. Descreve o que se sabe
fazer, nunca quem pode fazer.
_Avoid_: permissão, feature, habilidade, skill, módulo

**Provider** (provider):
A implementação que produz o efeito real no mundo para uma capability. Não
conhece Policy, Agent nem Tool.
_Avoid_: driver, executor, implementação, serviço, backend (backend é o
mecanismo de confinamento do Sandbox)

**Adapter** (adapter):
A peça que traduz uma fonte concreta para um contrato do Runtime — e é o único
lugar onde os literais dessa fonte podem viver.
_Avoid_: wrapper, integração, bridge, conector, plugin

**Seam** (seam):
Uma fronteira declarada do Runtime onde uma implementação futura entra sem
alterar o contrato. É promessa de forma, não implementação — e não é a costura
de teste. É este o nome canônico: "extension point" descreve a mesma coisa e
fica proibido.
_Avoid_: extension point, ponto de extensão, hook, gancho, plugin point,
costura (costura é teste)

**Session** (session, sessão):
Uma execução concreta: identidade, missão, máquina de estados, e a dona de
tudo que ela criou. É estado de runtime em memória, nunca estado de projeto.
_Avoid_: sessão de usuário, conversa, thread, run, job, execução (ambíguo)

**Outcome** (outcome):
Os fatos finais de uma execução física — código de saída, sinal, duração,
saída coletada, `timedOut`. Código de saída diferente de zero é outcome, não
erro do Runtime.
_Avoid_: resultado, erro, falha, exit status, retorno

### Efeitos e recursos

**Execution effect** (efeito de execução):
Uma intenção declarada de afetar o mundo: kind, operação e recurso canônico. É
a unidade que se autoriza — o diretório de partida do processo não é efeito.
Homônimo de Policy Effect, e a forma qualificada é obrigatória nos dois.
_Avoid_: `effect` sozinho, efeito (sem qualificar), side effect, efeito
colateral, ação, permissão, policy effect, operação (operação é um campo do
efeito)

**Execution effect set** (conjunto de efeitos):
O conjunto completo, deduplicado e ordenado dos efeitos de uma execução.
Autoriza-se o conjunto inteiro ou nada: não existe autorização parcial.
_Avoid_: lista de permissões, escopo, scope, plano (o plano é o resultado da
resolução), pacote

**Fingerprint** (fingerprint):
O identificador determinístico de um conjunto de efeitos, que correlaciona
autorização, aprovação, sandbox, execução e auditoria sem expor o conteúdo. É
a trava do resume.
_Avoid_: hash, checksum, assinatura, id do conjunto, digest

**Resource** (recurso):
A identidade canônica daquilo que um efeito afeta. Deriva sempre da metadata
da tool, nunca do que o agente mandou no pedido.
_Avoid_: path, caminho, alvo, target, arquivo, objeto

**Workspace** (workspace):
A raiz injetada que delimita o que uma execução governada pode alcançar. O que
sai dela vira `outside-workspace`, que nenhuma policy de workspace casa.
_Avoid_: projeto, repo, diretório de trabalho, cwd, root, pasta raiz

**Execution world** (mundo de execução):
O ambiente físico único em que filesystem e processo enxergam os mesmos
arquivos: o que o processo cria é o que o provider de filesystem lê, sem
tradução.
_Avoid_: ambiente, host, contexto, máquina, namespace (namespace é o mecanismo
de um backend)

**Project** (projeto):
A identidade que escopa uma policy, derivada da raiz do repositório. Policy
sem projeto é global; policy com projeto só vale nos projetos nomeados e nunca
vaza para fora — nem para conceder nem para negar.
_Avoid_: repo, workspace, escopo, ambiente, tenant

**Reserved vocabulary** (vocabulário reservado):
Um nome que existe no contrato sem operações — hoje, rede e ambiente como
kinds de efeito. Criar efeito de um nome reservado é erro, nunca permissão
implícita.
_Avoid_: não implementado, TODO, placeholder, futuro, stub

### Fronteira física

**Sandbox** (sandbox):
A segunda fronteira: responde "dentro de quais limites físicos?" depois que a
Policy respondeu "pode?". Restringe; jamais autoriza, jamais transforma `deny`
em `allow`.
_Avoid_: jail, container, isolamento, policy, permissão, ambiente seguro

**Sandbox mode** (modo):
`read-only`, `workspace-write` ou `danger-full-access`. O modo É a promessa de
limite físico — modo restritivo sem quem o aplique não executa.
_Avoid_: nível, perfil (profile é outra coisa), permissão, política de sandbox,
privilégio

**Sandbox profile** (perfil):
A classificação declarativa que diz qual modo cada kind e operação exige.
Operação não classificada não executa — é assim que uma operação mutante nova
não nasce sem fronteira.
_Avoid_: modo, configuração, mapeamento, política, preset

**Execution boundary** (fronteira de execução):
Os limites por dimensão — filesystem, processo, rede, ambiente — que um modo
produz numa invocação. Dimensão declarada como não suportada é veto, não
rótulo.
_Avoid_: sandbox (o sandbox aplica a boundary), limite, escopo, perímetro,
restrição

**Enforcement** (enforcement):
O grau real de garantia que um backend entrega: `full` só quando o kernel
aplica, `partial` quando a verificação acontece dentro do nosso processo,
`none` quando não há nenhuma. É fato provado, nunca configuração.
_Avoid_: nível de segurança, garantia, strict, isolamento, modo de segurança

**Functional probe** (probe funcional):
A execução de teste, num mundo descartável, que prova que o backend realmente
aplica o modo. É ela — e não o nome do backend — que promove um enforcement a
`full`.
_Avoid_: health check, smoke test, checagem de disponibilidade, verificação de
instalação, credential probe

**Mount fidelity** (fidelidade do plano de montagem):
A propriedade de um plano de montagem entregar de fato o que promete. Um
diretório montado cujos symlinks apontam para fora do mundo confinado promete
e não cumpre — e a falha aparece como espera sem fim, não como erro.
_Avoid_: cobertura de mount, integridade, validade do sandbox, mount check,
consistência

### Harness de modelo e credencial

**Model harness** (harness de modelo):
O programa externo que roda o loop de conversa de um modelo. Para o Runtime é
um processo governado como qualquer outro — nunca um tipo especial de Agent.
_Avoid_: LLM agent, agente de modelo, cliente do modelo, wrapper do CLI,
harness (sem qualificar, colide com conformance harness)

**Launcher** (launcher):
A peça que transforma uma intenção de execução de harness numa especificação
de processo — argumentos, diretório e canais explícitos. Conhece o CLI; não
conhece Policy, Sandbox nem Approval.
_Avoid_: runner, executor, spawner, driver, invocador

**Conformance harness** (harness de conformidade):
O stand-in determinístico, sem rede e sem quota, que prova no CI que o contrato
de harness governado funciona fisicamente. Não valida nenhum CLI real.
_Avoid_: mock, fake, stub, harness de teste, simulador

**Credential** (credencial):
O material de autenticação de um harness, tratado como um recurso de tipo
próprio lido por um efeito de filesystem — nunca como um kind de efeito, nunca
como exceção.
_Avoid_: secret, segredo (segredo é o conteúdo, credencial é o recurso), token,
auth, chave

**Credential calibration** (calibração de credencial):
A operação deliberada do Founder que descobre o MENOR recurso de credencial
capaz de autenticar um harness. Produz proposta; nunca autoridade, nunca
montagem.
_Avoid_: setup, configuração automática, descoberta, provisionamento, auth
check

**Credential probe** (probe de credencial):
Uma rodada da calibração: executa o CLI real com um candidato e devolve
`auth-ok`, `auth-insufficient` ou `runner-failure`. Nunca roda no caminho
normal de execução.
_Avoid_: functional probe, teste de login, validação de credencial, health
check, tentativa

**Rung** (degrau):
Um degrau da escada de candidatos da calibração, do mais estreito ao mais
largo — arquivo, conjunto de arquivos, diretório. A largura é derivada do
disco, nunca um rótulo declarado.
_Avoid_: nível, etapa, granularidade (granularity é o campo; o degrau é a
posição na escada), candidato (o candidato é o recurso; o degrau é a largura
dele), tentativa

**Calibration record** (record da calibração):
O registro do que uma calibração provou: identidade canônica do candidato,
veredito, degrau aprovado e proveniência. Vale como documentação — quem monta
o binding pergunta ao disco de novo.
_Avoid_: config, resultado, log, provenance, binding, certificado

**Resource binding** (binding):
A configuração de host que diz ONDE um recurso autorizado vive fisicamente. Diz
onde; nunca diz o que pode — a autorização já veio do conjunto de efeitos.
_Avoid_: mount, montagem, permissão, path de credencial, autorização,
mapeamento

**Binding floor** (piso do binding):
A regra que recusa qualquer caminho amplo demais para ser bindável: a raiz do
filesystem, o HOME ou um ancestral dele, uma raiz de sistema já montada, ou
qualquer sobreposição com o workspace. Não tem interruptor: sem referência de
HOME, o binding é recusado.
_Avoid_: validação de path, blacklist, veto do HOME, allowlist, limite,
sanitização

## Open Questions

### Blocking now

Nenhuma. As duas que estavam aqui foram decididas em 2026-08-21 e vivem no
corpo: `policy effect` e `execution effect` coexistem com a forma qualificada
obrigatória, e `seam` é canônico sobre "extension point". O homônimo `gate`,
aberto pela decisão 9 da ADR-10, recebeu no mesmo dia o mesmo tratamento de
`effect` e também não está mais aqui.

### Waiting on an answer above

Nenhuma. A única entrada dependia da canonização de `seam`, que foi
confirmada — não inverte.

### Not blocking this stage

- **"Orbe" fica fora do glossário, e é decisão, não esquecimento** — é
  metáfora da persona do Invoker, não vocabulário do domínio: não nomeia
  nenhuma coisa que um agente precise identificar do mesmo jeito que outro.
  Registrado aqui para ninguém reabrir. (O par dele, "laço vermelho", entrou:
  virou nome de seção verificada por gate de repositório, e isso é símbolo.)
- **ADR-09 contradiz o próprio adendo sobre `~/.claude`** — a decisão 8 diz
  que o diretório inteiro "nunca é candidato", e o adendo E6 (item 2) declara
  o contrário: a proibição nominal saiu, substituída pela regra mecânica de
  HOME-ou-ancestral, e o degrau `directory` é resultado legítimo. Não
  harmonizei — a nota tem outro dono. A ADR-10 reaprovada classifica o caso
  como emenda **substantiva** (o primeiro corte da decisão 5 o chamava de
  aditivo): conserta-se editando a decisão 8 e rebaixando a ADR-09 para
  `in-review`, reaprovada no merge seguinte. *Trava o Rubick até lá — quem ler
  só a decisão 8 implementa um veto que a spec removeu.*
- **As quatro primeiras ADRs e as lições pré-contrato não têm cabeçalho** —
  mesma situação: a decisão 10 (item 6) as cobre com cabeçalho retroativo, sem
  cláusula de avô, e com `approved:` derivado do merge em vez de inventado.
  *Trava o Rubick pelo PR de migração.*
- **O vocabulário da ADR-10 entrou em 2026-08-21** — nota, classe, ciclo de
  vida, registro vivo, emenda aditiva, emenda substantiva, congelamento,
  declaração, mandato de escrita e gate de repositório: dez termos, admitidos
  depois da aprovação da ADR, nunca antes. A pergunta que estava aqui fecha.
  `cadeia de derivação`, da decisão 11.1, entrou no mesmo dia e pelo mesmo
  critério — onze. `supersessão` entrou com a reaprovação da decisão 5, que a
  tirou da máquina de emendas e a tornou ato próprio — doze.
- **A ADR-10 chama a cadeia de derivação de "trilha", e o texto dela vai
  divergir deste glossário** — a decisão 11.1 diz "cada repo declara sua trilha
  em um lugar só", e o mesmo uso está na tabela de contexto (linha de
  `docs/spec/`) e na decisão 10 item 3. `trilha` é o português de Audit desde a
  primeira versão deste glossário; o contrato retrabalhado já moveu para "cadeia
  de derivação", a ADR ainda não. Não harmonizei — a nota tem outro dono, e
  trocar palavra dentro de uma decisão aprovada não é edição minha. Pela decisão
  5 reaprovada é emenda **substantiva**, não aditiva: nas decisões 11.1 e 10.3 a
  troca é palavra de prosa, a linha alterada não fica byte a byte igual à da base
  depois de retirados os links, e a rota aditiva se fecha. (A ocorrência na
  tabela de contexto está fora de `## Decisões` e não dispara nada.) *Correção do
  Rubick, com rebaixamento; não trava ninguém agora.*
- **O vocabulário que nasce no contrato retrabalhado espera a aprovação dele** —
  `instrução` (a terceira forma de documento, ao lado de nota e registro vivo),
  `token de fase`, e o `tipo`/`escopo` da convenção de commits só existem hoje
  no `SKILL.md`, que está em revisão. Nenhum entra aqui antes de o contrato ser
  aprovado, pela mesma regra que segurou os termos da ADR-10 até ela ser
  aprovada. Registrado para ninguém ler a ausência como esquecimento. *Volta
  para mim quando o contrato for aprovado.*
- **O contrato escreve "ferramenta" onde este glossário canoniza `tool`** — no
  princípio AI FIRST ("uma ferramenta ao seu alcance") e na descrição do
  `TEST-SEAMS.md`. É violação de `_Avoid_`, não colisão de sentido: aqui está
  certo, o texto de lá é que diverge. Anterior ao retrabalho, logo não é
  regressão dele. *Correção do Rubick, no arquivo que é dele.*
- **Os três atos não alcançam registro vivo, e isso é decisão, não omissão** —
  o gatilho dos três é o diff tocar `## Decisões` de nota cujo cabeçalho, na
  base do PR, diz `status: approved`. Registro vivo não é nota e não tem essa
  seção: nenhum dos três dispara, e a supersessão menos ainda — congelar uma
  fotografia a tornaria falsa (decisão 10, item 5). O que governa aqui é a
  regra de status do contrato, que a decisão 5 reaprovada devolve ao centro:
  editar conteúdo aprovado rebaixa para `in-review` e o Founder reaprova no
  merge — que é o caminho desta própria edição. A seção `## Emendas` some junto
  com o `tipo:` que ela carregava, e não faz falta a quem nunca a teve.
  Registrado aqui para ninguém reabrir.
- **Correção obrigada pelo gate 3 em registro vivo aprovado: rebaixa?** — a
  emenda aditiva existe "exatamente onde o gate obriga a editar, e em lugar
  nenhum além", mas a marca dela se lê em `## Decisões`, que registro vivo não
  tem — e a decisão 5 não responde fora de nota. Este glossário não sente: por
  contrato ele não cita código, só vocabulário (decisão 10, item 5). Sentem o
  mapa de costuras e o doc de arquitetura do runtime, que respondem ao gate 3 e
  citam. *Trava o Rubick na edição do contrato (decisão 11, item 4), que é onde
  os três atos entram — e ele decide lá, não aqui.*
