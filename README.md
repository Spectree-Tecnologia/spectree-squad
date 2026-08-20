# spectree-squad

Plugin do Claude Code que monta um squad de agentes de IA em 3 camadas,
orquestrado pelo TechLeader **Invoker** — o único ponto de contato com o
Founder. Todo o estado do pipeline vive em artefatos versionados no
repositório (`docs/`).

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
aprovado pelo Founder. Lacunas de requisito viram perguntas organizadas por
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

## Spectree Runtime (Fase 1)

`spectree-runtime/` é o microkernel de execução do Spectree: cinco
primitivas — `Agent`, `AgentLoop`, `ToolRuntime`, `Session`, `EventBus` —
sem conhecer nenhum agente do Squad pelo nome. O Squad define quem o agente
é; o runtime define como um agente executa. Zero dependências; `npm test`
roda a suíte e `npm run example` demonstra o lifecycle completo.
Arquitetura em `docs/architecture/SPECTREE-RUNTIME.md`.

A Fase 2 adiciona o **sistema de autoridade**: `PolicyEngine`,
`PolicyRegistry` e `CapabilityRegistry`. Toda execução de tool passa por
uma decisão determinística — `allow`, `deny` ou `approval-required` — com
**default deny**: ausência de policy nunca concede acesso, e `deny` sempre
vence `allow`. A autoridade que antes era convenção de persona ("sou o
Oracle, posso mexer no banco") vira enforcement do runtime.
`npm run example:policy` demonstra os três cenários: allow, deny e
approval-required.

A Fase 3 fecha o ciclo do `approval-required`: o bloqueio vira uma
**ApprovalRequest** com estado explícito (`pending -> approved | denied |
expired | cancelled`, `approved -> resumed`), decidida por um humano via
**FounderGate** e retomada por `resume()` — que **revalida a Policy** com o
input original antes de executar. Aprovação humana autoriza uma operação
específica; nunca vira bypass, permissão permanente ou segunda autoridade.
`npm run example:approval` demonstra approve/resume, deny e a revalidação
bloqueando quando a policy mudou.

A Fase 4 dá braços ao runtime: **Capability Providers**. Tool é a operação
solicitável, Capability é o contrato do que o runtime sabe fazer, Provider
é como se faz de verdade — e o `CapabilityRegistry` virou gate: capability
não registrada bloqueia execução. O primeiro provider real é o
`LocalFilesystemProvider` (read/write/delete dentro de um workspace
injetado), com boundary de path, recusa de symlink e a garantia de que o
resource autorizado pela Policy é exatamente o executado.
`npm run example:provider` demonstra o ciclo completo até o arquivo real —
incluindo um path traversal morrendo na Policy antes de tocar o Provider.

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
```

Disciplina compartilhada mora em skill; agente carrega papel, autoridade e
critério de saída. Subagentes não compartilham contexto, então o disco é a
única memória comum do squad — e a skill é o que garante que todos leiam e
escrevam sob as mesmas regras, definidas uma vez só.
