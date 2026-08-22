---
status: in-review
owner: lina
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
aprovada, é contrato: o texto em `main` é o contrato real.
_Avoid_: documento de requisitos, RFC, design doc, PRD (PRD é produto; spec é
fase do Runtime), proposta

**ADR** (ADR, decisão de arquitetura):
O registro de UMA decisão difícil de reverter, com o porquê e as alternativas
descartadas. É a nota das classes `architecture` e `process`: corrigi-la é
editá-la, sem ato nem preço; substituí-la inteira é supersessão.
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
ou `rejected`. Mora no caminho porque pasta é fato do filesystem, e é o eixo que
responde "isto descreve código que existe?". O outro eixo é o `status:` do
cabeçalho, que é a declaração do autor sobre a maturidade do conteúdo — quão
pronto ele diz que aquele texto está —, e nada além. Nenhum dos dois é aprovação,
e nenhum dos dois é derivabilidade: essa quem responde é a fonte de derivação.
_Avoid_: status (status é o rótulo do cabeçalho), estado, fase, etapa, workflow

**Living record** (registro vivo):
O artefato reescrito continuamente que fotografa o estado atual: sem data, sem
ciclo de vida, nunca congelado. Congelá-lo o tornaria falso, e por isso ele fica
fora da árvore de notas — este glossário é um. Não responde à regra de derivação:
ler a cópia da base devolveria a fotografia anterior à mudança de quem a está
lendo.
_Avoid_: nota, documento vivo, wiki, referência, snapshot

**Derivation chain** (cadeia de derivação):
A ordem de derivação que um repositório declara como sua: quais artefatos ele
produz e qual é pai de qual. Não existe uma universal — cada repositório declara
a sua uma vez, numa nota de classe `process`, e a de um produto não é a de um
runtime. Chamou-se "trilha" no contrato e não se chama mais: `trilha` é o
português de Audit, e quem quer aquele sentido está no verbete errado.
_Avoid_: trilha, trilha do repositório, nota de trilha, cadeia de artefatos,
pipeline, fluxo, esteira, workflow

**Derivation source** (fonte de derivação):
A cópia do artefato-pai que o review vai ver: dela saem, juntos, o `status:` que
se confere e o texto de que se deriva. É a da base do PR quando a base carrega o
pai — e lá ela tem de dizer `approved` —, e a do diff quando o pai nasce no PR,
onde a autoridade vem de ele estar no diff e o rótulo **confessa** em vez de
conceder: `draft` e `rejected` recusam, e rótulo nenhum autoriza. O pai é
identificado pelo **nome do arquivo**, nunca por caminho: uma ocorrência na base
é ele, esteja em que pasta estiver; nenhuma ocorrência é o pai que nasce no PR;
mais de uma é vermelho. É por isso que nota que a base carrega não desaparece da
árvore — sumindo o nome, some a identidade. Nada disso é promessa de um agente:
é asserção de gate de repositório. Fica de fora o texto que não chega a diff
algum.
_Avoid_: `main` sozinho, pai mergeado, caminho do pai (atual ou antigo), rename
detectado pelo git, cópia idêntica à de `main`, arquivo idêntico ao de `main`,
`updated:` anterior a `approved:` (os dois campos não existem mais)

**External parent** (pai externo):
O pai que não é arquivo do repositório — o brief do Founder, uma conversa, uma
fonte de fora. Escreve-se `depends_on: -`, não há fonte de derivação a ler porque
não há arquivo, e quem confere que o derivado é fiel a ele é o review. Não é
isenção: isenção é folga dada a um caso que a regra alcançaria, e esta não
alcança. É circunstância em qualquer nota, e impossibilidade só na nota da cadeia
de derivação.
_Avoid_: sem pai, órfão, raiz, bootstrap, pai implícito, pai não declarado, `-`
como isenção

**Supersession** (supersessão):
O ato de substituir uma nota inteira por outra: a substituída vai para
`archived/` com `superseded_by:`, o mesmo diff traz a nova com `supersedes:`, e
a linha entra no manifesto de hash. Existe porque o git não a registra — o
`git log` vê dois arquivos mudarem no mesmo commit e não sabe que um substituiu
o outro. Serve à nota que foi trocada, nunca à que foi corrigida: corrigir é
editar, e editar não tem ato nem nome. E tem alcance: troca a nota que **vale**
por outra, e o que a base carrega em `rejected/` ou `archived/` já não vale — não
há o que trocar, e de lá nada sai (ver congelamento). Mudar de ideia sobre uma
proposta recusada continua possível e não é este ato: é nota nova, que cita a
recusada por link relativo e diz o que mudou desde a recusa. A recusada não vira
`superseded`, porque não foi trocada — perdeu, e continua tendo perdido.
_Avoid_: emenda, emenda aditiva, emenda substantiva, revogação, deprecação,
invalidação, obsolescência, supersessão de nota recusada, `rejected/` ->
`archived/`, retrabalho de proposta recusada; e chamar de supersessão a nota nova
que repropõe uma recusada (ela não substitui coisa alguma — a recusa fica de pé
do outro lado do link)

**Mutual field** (campo mútuo):
Um par de campos de cabeçalho que se apontam de dois arquivos — hoje
`supersedes:` e `superseded_by:`. Prova consistência, nunca legitimidade: os dois
lados são escritos pela mesma pessoa, no mesmo diff, e nada que os dois fechem
autoriza coisa alguma.
_Avoid_: referência cruzada, backlink, par de campos, prova de supersessão,
atestado, campos que se resolvem

**Freeze** (congelamento):
A propriedade de uma nota fora de circulação — arquivada ou rejeitada — de não
mudar nunca mais: nem o conteúdo, nem o caminho. É fato provado por manifesto de
hash, não promessa: é o que tira "decisão registrada permanece" da disciplina.
Chega-se a ele por supersessão ou por rejeição, e por nenhum outro caminho; de lá
não se sai, porque `archived/` e `rejected/` são terminais. A metade do caminho é
o que fecha a lavagem de uma recusa em dois PRs — tirar a nota da pasta num PR e
supersedê-la no seguinte, quando o segundo já é indistinguível de uma supersessão
legítima —, e é ela nominalmente: o manifesto de hash recusaria aquele primeiro
PR por aritmética própria, e porta fechada por efeito colateral de outra regra
reabre no dia em que essa outra regra for consertada.
_Avoid_: arquivamento (arquivar é o movimento, congelar é a propriedade),
imutabilidade, lock, bloqueio, somente leitura; e desrejeição — sair de
`rejected/` não é ato deste repositório, e quem muda de ideia escreve nota nova

**Claim** (declaração):
Uma citação em link relativo dentro de uma nota ou de um registro vivo: afirma
que aquele arquivo existe e que o símbolo colado no link está definido lá.
Token entre crases sem link não afirma nada — é vocabulário, e é por isso que
este glossário não declara nada sobre código.
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
aprovação do Founder sobre um artefato não é esta — aquela é o merge do PR

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
- **As quatro primeiras ADRs e as lições pré-contrato não têm cabeçalho** —
  mesma situação: a decisão 10 (item 6) as cobre com cabeçalho retroativo, sem
  cláusula de avô, e agora com três campos só — `status:`, `owner:`,
  `depends_on:` —, sem data nenhuma a reconstruir. *Trava o Rubick pelo PR de
  migração.*
- **O vocabulário da ADR-10 entrou em 2026-08-21** — nota, classe, ciclo de
  vida, registro vivo, congelamento, declaração, mandato de escrita e gate de
  repositório, admitidos depois da aprovação da ADR e nunca antes; mais `cadeia
  de derivação` (decisão 11.1) e `supersessão`, que entrou quando a decisão 5 a
  tornou ato próprio. (A divergência do "trilha" que estava registrada aqui
  fechou: a ADR-10 não usa mais a palavra em lugar nenhum, e `trilha` volta a ser
  o português de Audit e de mais nada.)
- **O vocabulário que nasce no contrato retrabalhado espera a aprovação dele** —
  `instrução` (a terceira forma de documento, ao lado de nota e registro vivo),
  `token de fase`, e o `tipo`/`escopo` da convenção de commits só existem hoje
  no `SKILL.md`, que está em reaferição e não passou. Nenhum entra aqui antes
  de o contrato ser aprovado, pela mesma regra que segurou os termos da ADR-10
  até ela ser aprovada. Registrado para ninguém ler a ausência como
  esquecimento. *Volta para mim quando o contrato for aprovado.*
- **O contrato escreve "ferramenta" onde este glossário canoniza `tool`** — no
  princípio AI FIRST ("uma ferramenta ao seu alcance") e na descrição do
  `TEST-SEAMS.md`. É violação de `_Avoid_`, não colisão de sentido: aqui está
  certo, o texto de lá é que diverge. Anterior ao retrabalho, logo não é
  regressão dele. *Correção do Rubick, no arquivo que é dele.*
- **Três verbetes saíram porque a lei que os exigia deixou de existir** —
  `emenda aditiva`, `emenda substantiva` e `unidade protegida` nomeavam peças de
  uma máquina de classificar edições. A decisão 5 tirou o preço que a movia (todo
  PR merge, então o rebaixamento era um bilhete pedindo o que ia acontecer de
  qualquer jeito) e a decisão 13 tirou os campos `approved:` e `updated:` que a
  sustentavam. Sem preço não há duas emendas a distinguir; sem preço a proteger
  não há unidade a nomear. Os três entraram pela regra certa — termo só depois da
  ADR aprovada — e a ADR estava errada: a regra funcionou e não bastou, porque só
  executá-la mostrou o buraco. Ficaram `supersessão` e `congelamento`, que
  descrevem o que o git não sabe registrar. E a pergunta que este glossário
  deixou aberta — *correção obrigada pelo gate 3 em registro vivo aprovado
  rebaixa?* — fecha por dissolução, não pela resposta que eu tinha dado: não
  rebaixa porque rebaixamento não existe. Corrige-se, o PR merge, e `main` passa
  a dizer `approved` sobre o texto corrigido. Registrado para ninguém
  reintroduzir os três daqui a um mês achando que faltavam.
- **O sétimo corte da decisão 13 mudou a natureza de `fonte de derivação`, e não
  o detalhe** — a regra saiu da mão do agente e virou asserção de gate de
  repositório, e a identidade do pai passou a ser o **nome do arquivo**: uma
  ocorrência na base é ele, nenhuma é pai nascido no PR, mais de uma é vermelho.
  Some do verbete todo o vocabulário de caminho — inclusive o "pergunta a `main`
  pelo caminho antigo" que o sexto corte tinha escrito nele e que este bullet
  repetia: **caminho antigo não é mais a resposta certa, é regra revogada**, e um
  `_Avoid_` que só proibisse `caminho atual do pai` ensinaria que o antigo vale.
  Entrou `caminho do pai (atual ou antigo)` no lugar dos dois, mais `rename
  detectado pelo git`, que é a heurística que o sétimo corte matou. As três
  linhas removidas na rodada anterior — `cópia local`, `working copy`, `a sua
  cópia` — continuam fora, e a frase que as substituiu (*fica de fora o texto que
  não chega a diff algum*) continua verdadeira nos três estados. Nenhum verbete
  descreve comando, e nenhum deve: metade do squad não tem shell.
  **Contagem ao fim daquela rodada:** 68, o mesmo de antes dela — nenhuma
  entrada nasceu nem morreu; três foram reescritas. (A contagem de agora está no
  bullet da rodada 9, abaixo.)
- **Os cinco vizinhos foram reconferidos, e três não mudaram** — `pai externo`:
  sobrevive intacto à troca de caminho por nome, porque ele nunca falou de
  caminho: não há arquivo, logo não há nome a procurar na base, e o que confere
  fidelidade continua sendo o review; `cadeia de derivação`: define a ordem de
  derivação, não como se identifica um pai, e recusado pela quarta vez.
  **`ciclo de vida` sobreviveu, e é o que mais parecia envenenado:** ele diz que
  o `status:` lido é o da fonte de derivação, "nunca o de uma cópia que não entra
  em diff nenhum" — e isso é sobre *qual cópia*, não sobre *quem lê*. O sétimo
  corte mudou o leitor (agente -> gate) e não mudou a cópia, então o verbete
  segue. (Sobreviveu ao sétimo corte e caiu no oitavo, por outra razão: mudou o
  dono da pergunta que o campo responde — ver o bullet da rodada 9 abaixo.) **Mudou `aprovação`:** a cauda dizia que o merge do PR é o ato "que só o
  Founder executa", e isso é afirmação no presente sobre o estado deste
  repositório — a própria ADR-10 (decisão 5) mede que hoje quem sustenta isso é a
  matriz, pelo `no-direct-push-main`, e que a proteção de branch nativa ainda não
  existe. Cortada a cauda: o verbete `Founder` já define a única autoridade de
  aprovação, e o glossário não precisa afirmar enforcement que não pode medir.
  **E `registro vivo` mudou uma palavra, por consistência comigo mesma:** ele
  dizia "ler a cópia de `main`", e o `_Avoid_` que esta rodada escreveu duas
  entradas acima proíbe ``main`` sozinho como nome da fonte. Virou "a cópia da
  base". A exclusão em si não mudou e não dependia da camada: a fotografia de
  agora inclui o PR que a muda, com gate ou sem.
- **A pergunta do `status:` tinha duas respostas em dois arquivos, e agora tem
  uma em um lugar só** — eu tinha deixado aqui a divergência (o contrato dizia
  "este conteúdo está aprovado?", a decisão 1 da ADR-10 dizia "este conteúdo
  serve para derivar?") com o contrafactual que derrubava as duas: o pai que
  nasce no PR com `in-review` serve para derivar e não está aprovado. A decisão
  13 respondeu com uma terceira, e a lição é que **as duas anteriores eram usos
  do campo, não definições dele** — e ter duas definições em dois arquivos foi o
  que produziu o defeito. Fica: `status:` é a declaração do autor sobre a
  maturidade do conteúdo, e nada além. Medido na árvore de trabalho desta
  worktree em 2026-08-22: a definição está na decisão 13 da ADR-10 e no bloco do
  cabeçalho obrigatório do `SKILL.md`, e a decisão 1 e o contrato citam em vez de
  redefinir. O `ciclo de vida` deste glossário passou a carregar a definição, não
  um dos dois usos. A pergunta está fechada; fica registrada para ninguém a
  reabrir com uma das formulações antigas. *Nada pendente do Rubick aqui — a
  correção dele já está nos dois arquivos.*
- **A fonte de derivação virou verbete, e o gatilho do nome fechou** — o rótulo
  que este bullet usava era "a cópia de `main` é a que vale", e ele envelheceu
  duas vezes: a cópia é a da **base**, e ela só decide quando a base carrega o
  pai. Fica o que o bullet registrava: eu
  tinha deixado aqui a condição de três formulações da mesma noção no contrato.
  Conferidas uma a uma nesta rodada, as três estão lá: a regra de derivação, o
  bullet da cadeia ("o pai é lido inteiro... na cópia de `main`") e o AI FIRST,
  que reserva ao Founder derivar de artefato que `main` ainda não aprova. O nome
  ficou `fonte de derivação`, e não o descritivo. Registrado para ninguém reabrir
  a pergunta do nome.
- **A rodada 9 mexeu em dois verbetes, e o segundo era uma porta** — `ciclo de
  vida` trocou um uso do `status:` pela definição dele (bullet acima), e saiu de
  lá a cauda "nunca o de uma cópia que não entra em diff nenhum": ela respondia
  derivabilidade, que deixou de ser pergunta do campo, e quem a responde é `fonte
  de derivação`, que já a carrega inteira. Repeti-la aqui seria a segunda
  definição em segundo arquivo, que é exatamente o defeito que esta rodada
  fechou. **`supersessão` ganhou o alcance da decisão 5:** ela não alcança o que
  a base carrega em `rejected/` ou `archived/` — nota que já não vale não tem o
  que trocar. Sem o alcance o verbete ensinava, passo a passo, o ato que **lava
  uma recusa**, e a defesa que se poderia supor ("a lavagem aparece no diff como
  duplicata, e o review pega") é falsa para esta espécie: a assinatura no diff é
  byte a byte a da supersessão legítima, e nenhuma leitura humana distingue as
  duas. Não exige má-fé — o agente que pensa "a proposta recusada foi
  retrabalhada, então supersedo" produz o caso sozinho, cumprindo a regra que o
  verbete lhe ensinava. O verbete também passou a dizer que **`rejected/` não é
  terminal**: sai-se de lá num PR próprio, que o merge aprova; o que a supersessão
  não pode é alcançar de lá, e isso é diferente de dizer que de lá não se sai.
- **Entrou um verbete novo, `campo mútuo`, e ele não é sobre supersessão** — é a
  frase do Keeper que generaliza o furo da rodada: *campo mútuo prova
  consistência, nunca legitimidade — os dois lados são escritos pela mesma
  pessoa, no mesmo diff*. Vale além de `supersedes:`/`superseded_by:`, e é por
  isso que virou verbete em vez de ficar dentro de `supersessão`: o próximo par
  de campos que alguém inventar vai parecer prova de autoridade pela mesma razão
  errada. Entrou pela mesma regra que admitiu o resto do vocabulário da ADR-10, e
  na mesma condição — se a ADR mudar de ideia, ele sai com ela.
  **Contagem:** `grep -c '^\*\*[^*]\+\*\* ('` no `docs/CONTEXT.md` desta worktree
  devolve **69** — 68 antes desta rodada, mais `campo mútuo`; dois verbetes
  reescritos, nenhum removido.
- **Os seis vizinhos foram varridos, e cinco não mudaram** — `nota`: já dizia que
  quem responde "descreve código que existe" é a pasta e não a linha `status:`, e
  a decisão 13 confirma esse eixo em vez de mexer nele; `cadeia de derivação` e
  `pai externo`: nenhum dos dois fala de status nem de supersessão, e foram
  recusados de novo; `registro vivo`: fica fora da regra de derivação, e nenhum
  `status:` o alcança; `aprovação`: continua dizendo que a aprovação do Founder
  sobre um artefato é o merge do PR, e a decisão 13 reforça isso em vez de mudar.
  **`congelamento` não mudou naquela rodada, e a pergunta que eu deixei aberta
  está respondida — fica como registro, não apagada.** Eu tinha escrito que não
  reescreveria o verbete porque a colisão entre "não mudar nunca mais" (decisão
  6), a saída de `rejected/` (decisão 1, versão de então) e o manifesto que só
  cresce exigia decidir *qual das duas cede*, e que a decisão era do Rubick.
  Respondida na rodada seguinte: **nenhuma das duas cede — cai o ato.** A saída
  de `rejected/` deixa de existir, o congelamento continua sendo "não mudar nunca
  mais" e o manifesto continua só crescendo. *Nada pendente do Rubick aqui.*
- **A rodada 10 mexeu em dois verbetes, e o que mudou neles foi o ato, não a
  redação** — a terminalidade de `archived/` e `rejected/` (decisão 1) tirou o
  referente de três linhas que eu tinha escrito. (a) A cauda de `supersessão`
  dizia que a nota recusada "sai de `rejected/` num PR próprio" e que `rejected/`
  "não é destino terminal": as duas caem, e a segunda inverte. No lugar, a forma
  que sobreviveu — nota nova que cita a recusada por link relativo —, que não é
  supersessão porque não substitui nada. (b) O `_Avoid_` dela listava
  "desrejeição (sair de `rejected/` é ato próprio, e não esta)", e isso
  **promovia a desrejeição a ato** ao proibir confundi-la com esta: quem lesse
  aprendia que existiam dois atos e que precisava escolher o nome certo. O termo
  saiu daqui e entrou no `_Avoid_` de `congelamento`, que é o verbete que agora
  carrega a terminalidade — continua achável por grep, e a linha ensina que o ato
  não existe em vez de ensinar qual é o outro. No lugar dele, em `supersessão`,
  ficou o que de fato é proibido: chamar de supersessão a nota nova que repropõe
  uma recusada. (c) `congelamento` passou a valer para o **caminho** além do
  conteúdo, e leva junto a razão, sem a qual a proibição parece arbitrária: **é a
  terminalidade, nominalmente, que fecha a lavagem em dois PRs** — o manifesto de
  hash recusa o primeiro PR por aritmética própria, e porta fechada por efeito
  colateral de outra regra reabre quando aquela outra regra é consertada. É a
  quinta redação de `supersessão`, e nenhuma das quatro anteriores estava errada
  quando foi escrita: o ato mudou cinco vezes. **`ciclo de vida` ficou como
  está** — ele descreve os quatro estados sem afirmar transição nenhuma, e a
  terminalidade é propriedade de quem já chegou, que é o verbete `congelamento`.
  Repeti-la lá seria a segunda definição em segundo lugar, defeito que a rodada 9
  fechou.
  **Contagem:** `grep -c '^\*\*[^*]\+\*\* ('` no `docs/CONTEXT.md` desta worktree
  devolve **69**, o mesmo de antes desta rodada — três verbetes reescritos,
  nenhum criado, nenhum removido.
- **"Lista que só encolhe" não vira verbete, e a recusa é medida** — a
  propriedade é real e o Keeper a nomeou bem: a garantia de que a dívida morre
  sozinha é a mesma que impede rever uma entrada que entrou errada, porque
  ninguém varre uma lista de isenção procurando quem nunca deveria estar lá.
  Recuso por duas razões. **A primeira é de medição:** `grep -c 'só encolhe'` na
  ADR-10 desta worktree devolve **1** — a lista de laço não recuperado da decisão
  10 item 7, um caso —, e `só cresce` devolve 7, todas sobre o mesmo objeto, o
  `FROZEN.sha256`. São duas ocorrências de uma propriedade geral em dois objetos,
  em direções opostas; não é noção que o repositório repita. **A segunda é de
  regra:** monotonicidade de lista é conceito geral, da mesma família de
  `timeout` e `cache`, que este glossário mantém fora por contrato. E não há
  `_Avoid_` a escrever — não existe sinônimo rejeitado, porque ninguém está
  usando outra palavra para isso. Se o repositório passar a declarar listas
  monótonas como classe, com mais de um objeto e nome próprio no gate, eu
  reabro. *Registrado para não parecer esquecimento; a decisão é minha e está
  tomada.*
- **O que eu não consigo medir, e digo em vez de afirmar** — não tenho `Bash`
  (medido em `agents/*.md`, campo `tools:`, e é a mesma constatação da decisão 13,
  sétimo corte). Toda medição deste bullet e dos de cima foi feita por leitura da
  **árvore de trabalho da worktree `.worktrees/memory`** em 2026-08-22, nunca
  contra `origin/main`, que andou na última rodada com o merge do PR #31. Onde
  este arquivo precisar de um fato sobre uma ref do git, o fato é de quem tem
  shell.
