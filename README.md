# spectree-squad

Plugin do Claude Code que monta um squad de agentes de IA em 3 camadas,
orquestrado pelo TechLeader **Invoker** — o único ponto de contato com o
Founder. Todo o estado do pipeline vive em artefatos versionados no
repositório (`docs/`).

O repositório carrega duas metades que se completam:

- **O Squad** (`commands/`, `agents/`, `skills/`) — quem são os agentes,
  o que cada um entrega e sob quais fronteiras. Autoridade descrita em
  prompt.
- **O Runtime** (`spectree-runtime/`) — como uma execução de agente é
  governada: policy, aprovação humana e capability. Autoridade aplicada
  em código.

O Squad diz *quem* é o agente; o Runtime diz *o que ele pode fazer de
verdade*. O runtime não conhece nenhum agente do Squad pelo nome.

## Instalação

Direto do GitHub (o repo é seu próprio marketplace):

```
/plugin marketplace add Spectree-Tecnologia/spectree-squad
/plugin install spectree-squad@spectree
```

Para desenvolvimento local (sem instalar):

```bash
claude --plugin-dir <caminho>/spectree-squad
```

## Uso

```
/spectree-squad:techleader quero construir <ideia>
```

O Invoker marca com 🧙🏻‍♂️ todo trecho em que **você precisa decidir** —
rodada de perguntas, gate de aprovação, confirmação de operação
destrutiva. Relato de andamento nunca leva o marcador: se ele não está
lá, é informação, não pedido.

Enquanto o squad trabalha ele fica em silêncio — no máximo uma linha
factual por invocação. A história da entrega é contada uma vez só, no
fechamento, com a voz do Invoker.

Sem argumentos, o Invoker apresenta o estado atual do pipeline e pergunta
o próximo passo.

## O squad

| Camada | Agente | Papel | Entrega |
|--------|--------|-------|---------|
| — | Invoker | TechLeader (command, thread principal) — persona: Kael, o Arquimago exilado de Avernus | orquestração |
| 1 · Discovery | Lina | Product Manager | `docs/PRD.md` |
| 1 · Discovery | Lion | Scrum Master | `docs/EPIC.md`, `docs/stories/STORY-*.md` |
| 2 · Design | Rubick | Arquiteto | `docs/adr/ADR-*.md` |
| 2 · Design | Zeus | UI/UX | `docs/DESIGN.md` |
| 3 · Build | Oracle | Data Engineer — único com autoridade sobre o banco | schema, migrations, queries |
| 3 · Build | Jakiro | Dev Full Stack; depura na UI real via Playwright MCP | código + `## Dev Log` na story |
| 3 · Build | Keeper of the Light | QA — valida, não conserta; dirige a UI real via Playwright MCP | `## QA Notes` na story, veredito com evidência |
| 3 · Build | Disruptor | DevOps — único que executa git/GitHub | branch, PR, CI, `docs/INFRA.md` |

Fluxo:

```
/techleader -> Lina -> Lion -> [Rubick ∥ Zeus] -> Disruptor (branch) -> Oracle -> Jakiro -> Keeper of the Light -> Disruptor (PR)
```

Artefatos derivam em cadeia (`PRD -> EPIC/STORY -> ADR + DESIGN -> código`,
com `INFRA.md` derivando das ADRs) e cada etapa só avança com o artefato pai
aprovado pelo Founder. A aprovação pertence ao conteúdo, não ao arquivo:
editar um artefato `approved` o rebaixa a `in-review` até reaprovação — a
mesma regra que o `resume()` do runtime aplica em código. Lacunas de requisito viram perguntas organizadas por
**fronteira** — o Invoker pergunta de uma vez tudo que já é respondível,
com recomendação para cada, e guarda o que depende de resposta anterior
para a rodada seguinte, até nada restar assumido em silêncio. Stories declaram `blocked_by:` no header (bloqueio direto, nunca
transitivo) — é por esse campo que o Invoker sequencia a camada 3, e
stories desbloqueadas e independentes correm em paralelo. Cada decisão de arquitetura é **uma ADR por arquivo** em `docs/adr/`, e só
vira ADR o que é difícil de reverter, surpreendente sem contexto e resultado
de trade-off real — uma ADR de um parágrafo é uma ADR completa. O `docs/TEST-SEAMS.md` é o mapa vivo
de onde cada classe de critério se prova — é ele que diz a Jakiro onde
escrever teste e a Keeper onde procurar evidência. Na camada 3 a story vira o registro vivo do
build: Jakiro mantém `## Dev Log` (checklist por critério de aceite +
notas datadas), Keeper anexa `## QA Notes` por rodada de review, e o
status percorre `approved -> in-progress -> done`. Lições aprendidas de qualquer
agente vão para `docs/LESSONS.md` (append-only, consultado por grep de área
antes de trabalhar).

O `docs/CONTEXT.md` é o glossário do domínio: cada termo com definição curta
e os sinônimos proibidos em `_Avoid_`. Subagentes não compartilham contexto,
então sem uma fonte única de vocabulário cada um inventa o seu — e o código
herda a divergência nos nomes. Qualquer agente escreve no instante em que um
termo se resolve; a Lina mantém a consistência.

Jakiro e Keeper têm acesso ao **Playwright MCP** e dirigem a interface real
— o Keeper para colher evidência que a suíte não dá (console, requisições,
estilo computado), o Jakiro para depurar enquanto constrói. Em nenhum dos
dois o navegador substitui teste commitado: o que não virou prova na suíte
não pega regressão amanhã.

Para número em vez de comportamento, os dois têm o **Chrome DevTools MCP**:
`lighthouse_audit` afere o contraste e a acessibilidade que o `DESIGN.md`
especificou, os traces de performance separam tempo de servidor de tempo de
cliente, e `emulate` mede sob throttle — porque teto aprovado só em stack
local costuma mentir em produção. Regra: **Playwright dirige, DevTools
mede.**

A matriz de quem-pode-o-quê vive em `squad.policies.json`, na raiz — no
mesmo shape que o `PolicyRegistry` do runtime aceita, e provada por teste
no motor real: `tests/squad-policies.test.js` carrega o arquivo no
`PolicyRegistry` e decide cada fronteira no `PolicyEngine` (banco é do
Oracle, main nega até o Disruptor, operação destrutiva é gate do Founder).
Policy sem `project` é global; policy com `project` só vale nos projetos
nomeados, e a identidade vem do basename da raiz do repo. O filtro mora
no adapter, então guard, runtime e testes aplicam o mesmo escopo por
construção — e uma policy escopada nunca vaza para fora do escopo, nem
para conceder nem para negar. A matriz continua dentro do plugin: nenhum
agente a alcança, e não existe arquivo local de policy que alguém pudesse
escrever para se autorizar.

Prosa e matriz em conflito, a matriz vence — e o caminho de carga é um
só: o adapter oficial (`spectree-runtime/adapters/policy-document.js`)
alimenta guard, runtime (`npm run example:policy` roda a matriz real no
runtime completo) e testes, e o teste de integração prova a mesma
decisão, com o mesmo policyId, nos três — além de travar que existe
exatamente uma matriz no repo.

A matriz também é aplicada em execução: o hook `PreToolUse`
(`hooks/guard.mjs`, requer `node` no PATH) inspeciona cada comando Bash e
pergunta ao `PolicyEngine` real o que a matriz diz — `deny` bloqueia
(push na main, `rm -rf` fora do workspace), `approval-required` vira o
prompt de confirmação na UI (force-push, `DROP` via CLI de banco). Dentro
de um subagente o payload do hook traz `agent_type`, e o guard decide com
o principal real: default deny vale — Jakiro rodando `psql` é negado, git
mutável fora do Disruptor é negado, enquanto `git log`/`diff`/`status` não
são governados e passam para todos. Principal ausente é a thread
principal — contexto do Invoker/Founder, valem só as policies
universais; principal desconhecido (subagente fora do squad) é fail
closed: o default deny nega as operações governadas. Cada `deny`/`ask`
vira uma linha em `~/.claude/spectree/policy-decisions.jsonl` sob a mesma
projeção do event bus — a decisão, nunca o comando bruto — e um teste de
alcançabilidade exige que toda policy da matriz declare qual consumidor a
alcança, provando a declaração ao executar o guard. A trilha distingue
pergunta de desfecho: `deny` é `final`, `ask` é `pending`, e o desfecho
de um `pending` chega como linha `executed` (hook `PostToolUse`, que só
dispara quando a operação executou) correlacionada pelo mesmo
`toolUseId` — dá para responder se um force-push aprovado no gate
aconteceu ou não.

O vocabulário de detecção acompanha o ferramental de cada projeto: além de
`git`, `gh` e `psql`, o guard governa `supabase` (`db push` aplica schema
em produção, `db reset`, `migration new`), enquanto leitura e ciclo de
vida local seguem livres. Ele não lê o conteúdo das migrations, então não
distingue aditiva de destrutiva — essa fronteira continua com a
verificação humana.

O guard lê o comando como texto: comando **citado** dentro de conteúdo de
arquivo (heredoc, string de teste) é detectado como se fosse executado.
Escreva esses arquivos por ferramenta de escrita, não por heredoc. O guard também
governa `Edit`/`Write`: subagente que tenta escrever `status:
approved|done` num artefato cai no default deny (aprovar é da thread
principal, onde vive o Invoker), e principal com superfície de edição
fechada na matriz — o Keeper — só edita o que ela concede (QA Notes e
LESSONS). O guard nunca responde `allow` — só nega, escala ou silencia:
o fluxo normal de permissão continua sendo a última palavra, e o hook
jamais amplia autoridade. O que ele não detecta segue o fluxo normal de
permissão. E a fronteira que o hook não alcança é
auditada na verificação: o Keeper reprova diff de banco sem handoff do
Oracle, e o Disruptor audita o `git log` da branch antes do PR.

Defeito não entra pelo PRD: relato de algo quebrado, lento ou intermitente
abre `fix/<slug>` e roda sob a skill `spectree-diagnostics` — laço que fica
vermelho antes de qualquer hipótese, com todo segredo redigido no que for
exibido, e entrega teste de regressão mais entrada no `LESSONS.md`. E quando o AI FIRST esbarra num passo que exige
mesmo um humano (painel de terceiro, cartão, aceite de termo), o Disruptor
gera um **wizard**: script bash interativo que abre a URL, captura o valor,
grava onde ele pertence e confirma antes do irreversível — em vez de
devolver um parágrafo de instruções.

## Convenção de nomes

**Identificador em inglês, prosa em português.** Pasta, arquivo, símbolo,
tabela, rota, campo de header, branch e slug de artefato seguem o inglês
técnico; a documentação, os critérios de aceite e os comentários de código
ficam em português. O `CONTEXT.md` é a ponte: termo canônico em inglês
(porque vira código), o português entre parênteses.

## Spectree Runtime

`spectree-runtime/` é o microkernel de execução do Spectree: JavaScript
ESM puro, zero dependências, testado com `node:test`. Ele responde a uma
pergunta que prompt nenhum responde — **quando um agente pede para fazer
algo, quem autoriza?**

No Squad a autoridade é convenção de persona: "sou o Oracle, o banco é
meu". Convenção depende do modelo obedecer ao próprio prompt. No Runtime a
mesma autoridade vira decisão determinística tomada fora do agente, e o
agente não tem como alcançá-la — o contexto que ele recebe expõe
exatamente `session`, `mission` e `runtime.requestTool`, e essa superfície
é travada por teste estrutural.

Todo pedido de tool percorre um único caminho:

```
runtime.requestTool(toolId, input)
  -> tool.requested
  -> Policy.decide  ->  policy.evaluated
       deny               nada executa (PolicyDeniedError)
       approval-required  ApprovalRequest -> FounderGate -> resume() revalida a Policy
       allow              Capability gate -> Provider -> efeito real no mundo
  -> tool.completed
```

As invariantes que esse caminho garante, todas cobertas por teste:

- **Default deny** — ausência de policy nunca concede acesso, e `deny`
  sempre vence `allow`.
- **Resource não é falsificável** — o recurso que a Policy julga é
  derivado da metadata da Tool, nunca do que o agente mandou no pedido.
- **O resource autorizado é o executado** — a Policy julga
  `filesystem/workspace/src/a.js` e é exatamente esse arquivo que o
  Provider toca; divergência é erro, não tolerância.
- **Aprovação humana não é bypass** — `resume()` revalida a Policy com o
  input original; se a policy mudou no intervalo, a aprovação já dada não
  executa nada.
- **O event bus não vaza payload** — por padrão o evento carrega o
  `toolId`, não o input nem o output.
- **Superfície de autoridade é congelada** — todo contexto que cruza uma
  fronteira de autoridade tem suas chaves fixadas por igualdade estrita,
  para que uma fase futura não amplie autoridade em silêncio. A regra
  alcança o Squad: o frontmatter `tools:`/`skills:` dos agentes — a única
  superfície onde o Claude Code aplica autoridade de verdade — é travado
  por `tests/squad-surface.test.js` com a mesma igualdade estrita.

O primeiro Provider real é o `LocalFilesystemProvider`: read, write e
delete dentro de um workspace injetado no construtor (nunca lido de
`cwd` ou de variável de ambiente), com boundary textual e **físico** — o
realpath do ancestral existente mais profundo precisa continuar dentro do
workspace, que é o que pega um diretório pai que virou symlink ou junction
para fora.

O adaptador `adapters/squad-agent.js` fecha o círculo entre as duas
metades: lê o markdown de um agente do Squad e devolve uma
`AgentDefinition` do runtime. O markdown é dado de entrada, nunca
dependência — nenhum agente precisou ser alterado.

### Como se chegou aqui

Cada fase entrou por especificação normativa, implementação contra ela e
review adversarial. As quatro passaram por REQUEST CHANGES antes do
APPROVED, e cada pacote de correção fechou uma classe real de brecha
(autoridade vazando pelo bus, spoofing de resource, escape por symlink em
diretório pai).

| Fase | Entrega | Pergunta que passou a ter resposta |
|------|---------|-------------------------------------|
| 1 | Runtime Core — `Agent`, `AgentLoop`, `ToolRuntime`, `Session`, `EventBus` | Como um agente executa? |
| 2 | Policy Engine — `PolicyRegistry`, `PolicyEngine`, `CapabilityRegistry` | O agente **pode** fazer isso? |
| 3 | Founder Gate — `ApprovalRequest`, `FounderGate`, `resume()` | E quando só um humano pode decidir? |
| 4 | Capability Providers — `CapabilityResolver`, `LocalFilesystemProvider` | Como isso vira efeito real no mundo? |
| 5 | Sandbox Runtime — `SandboxPolicy`, `SandboxResolver`, `LocalFilesystemSandboxProvider` | Sob quais limites físicos? |

O Sandbox fecha a quinta dimensão: a Policy responde *se pode*, o Sandbox
responde *dentro de quais limites físicos*. Três modos (`read-only`,
`workspace-write`, `danger-full-access`), e um enforcement declarado com
honestidade — o primeiro backend verifica dentro do processo e por isso
se declara `partial`, nunca `full`, que fica reservado para isolamento de
kernel. Pedir mais garantia do que o backend entrega falha fechado, em vez
de degradar em silêncio.

A próxima fronteira é o **Process/Subprocess Capability**: com a fronteira
pronta, a pergunta deixa de ser só "o agente pode executar este comando?"
e passa a incluir qual processo nasce, com qual filesystem, qual rede e
qual limite de vida.

### Rodando

```bash
npm test               # a suíte inteira
npm run example        # lifecycle completo de um agente
npm run example:policy # allow, deny e approval-required
npm run example:approval # approve/resume, deny e revalidação bloqueando
npm run example:provider # até o arquivo real, com traversal morrendo na Policy
npm run example:sandbox  # a mesma escrita permitida e negada, só mudando o boundary
```

Arquitetura em `docs/architecture/SPECTREE-RUNTIME.md`; as decisões que
custaram trade-off estão em `docs/adr/`.

## Premissas de projeto

1. **AI FIRST / CLI FIRST** — o squad executa tudo que estiver ao alcance
   via CLI (`gh`, `psql`, ...) e MCP servers. Devolver passo manual que o
   agente podia executar é falha de entrega. Só se volta ao Founder para
   gates de aprovação ou informação que nenhuma ferramenta responde.
2. **Premissa Anthropic** (harness descartável, modelo não) — agentes
   recebem missão + guardrails + critério de saída verificável, nunca
   passo a passo. Cada agente de build verifica o próprio trabalho antes
   do handoff (migrations executadas, suíte rodada, CI verde). Os prompts
   carregam só fronteiras de autoridade e contrato de coordenação; o
   *como* é do modelo, e os prompts devem encolher a cada geração.

## Estrutura

```
.claude-plugin/plugin.json           # manifest
commands/techleader.md               # Invoker: orquestração + persona
agents/*.md                          # os 8 agentes: papel, autoridade, critério de saída
skills/spectree-artifacts/SKILL.md   # contrato de artefatos + princípio AI FIRST
skills/spectree-testing/SKILL.md     # costuras de teste: quem decide, escreve, confere
skills/spectree-browser/SKILL.md     # Playwright dirige, DevTools mede
skills/spectree-diagnostics/SKILL.md # laço vermelho antes de hipótese
skills/spectree-wizard/              # o que só o humano faz vira script executável

spectree-runtime/
  agent/ loop/ session/ events/      # Fase 1: como um agente executa
  policy/                            # Fase 2: quem autoriza
  approval/                          # Fase 3: quando o humano decide
  capabilities/ providers/           # Fase 4: como vira efeito real
  sandbox/                           # Fase 5: sob quais limites físicos
  tools/tool-runtime.js              # o ponto onde as quatro se encontram
  adapters/squad-agent.js            # ponte Squad -> Runtime
  adapters/policy-document.js        # o caminho unico da matriz (Fase 4.5)
  tests/                             # a suíte; cada invariante tem seu teste

squad.policies.json                  # a matriz de autoridade, no shape do PolicyRegistry
hooks/hooks.json + hooks/guard.mjs   # a matriz aplicada em execução (PreToolUse)
tests/squad-surface.test.js          # a superfície de autoridade do Squad, travada
tests/squad-policies.test.js         # a matriz decidida pelo PolicyEngine real
tests/squad-guard.test.js            # o guard exercitado como o Claude Code o executa

docs/architecture/                   # a arquitetura do runtime, fase a fase
docs/adr/                            # as decisões que custaram trade-off
```

Disciplina compartilhada mora em skill; agente carrega papel, autoridade e
critério de saída. Subagentes não compartilham contexto, então o disco é a
única memória comum do squad — e a skill é o que garante que todos leiam e
escrevam sob as mesmas regras, definidas uma vez só.
