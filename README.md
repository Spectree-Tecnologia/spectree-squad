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

Sem argumentos, o Invoker apresenta o estado atual do pipeline e pergunta
o próximo passo.

## O squad

| Camada | Agente | Papel | Entrega |
|--------|--------|-------|---------|
| — | Invoker | TechLeader (command, thread principal) | orquestração |
| 1 · Discovery | Lina | Product Manager | `docs/PRD.md` |
| 1 · Discovery | Lion | Scrum Master | `docs/EPIC.md`, `docs/stories/STORY-*.md` |
| 2 · Design | Rubick | Arquiteto | `docs/ADR.md` |
| 2 · Design | Zeus | UI/UX | `docs/DESIGN.md` |
| 3 · Build | Oracle | Data Engineer — único com autoridade sobre o banco | schema, migrations, queries |
| 3 · Build | Jakiro | Dev Full Stack | código da aplicação |
| 3 · Build | Keeper of the Light | QA — valida, não conserta | veredito com evidência |
| 3 · Build | Disruptor | DevOps — único que executa git/GitHub | branch, PR, CI |

Fluxo:

```
/techleader -> Lina -> Lion -> [Rubick ∥ Zeus] -> Oracle -> Jakiro -> Keeper of the Light -> Disruptor
```

Artefatos derivam em cadeia (`PRD -> EPIC/STORY -> ADR + DESIGN -> código`) e
cada etapa só avança com o artefato pai aprovado pelo Founder.

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
.claude-plugin/plugin.json          # manifest
commands/techleader.md              # Invoker (orquestrador)
agents/*.md                         # os 8 agentes do squad
skills/spectree-artifacts/SKILL.md  # contrato de artefatos + princípio AI FIRST
```

O contrato de artefatos (caminhos canônicos, cabeçalho de status, formato
de handoff) é uma skill compartilhada por todos os agentes — subagentes não
compartilham contexto, então o disco é a única memória comum do squad.
