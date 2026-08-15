---
name: spectree-artifacts
description: Contrato de artefatos do squad Spectree - onde vivem PRD.md, EPIC.md, STORY, ADR.md e DESIGN.md, qual o formato de cada um e como registrar handoff entre agentes. Use sempre que for ler ou escrever qualquer artefato do squad.
---

# Contrato de artefatos do squad

Todo estado do pipeline vive em arquivos no repositório. Subagente não
compartilha contexto com subagente — o disco é a única memória comum.

## Caminhos canônicos

```
docs/
  PRD.md                        # Lina  (Product Manager)
  EPIC.md                       # Lion  (Scrum Master)
  ADR.md                        # Rubick (Arquiteto)
  DESIGN.md                     # Zeus  (UI/UX)
  stories/
    STORY-001-slug-curto.md     # Lion, uma story por arquivo
```

Nunca crie variação de caminho (`PRD/`, `prd.md`, `docs/product/PRD.md`).
Se o arquivo pai não existir, o artefato derivado não pode ser escrito —
reporte o bloqueio em vez de inventar o conteúdo do pai.

## Cabeçalho obrigatório

Todo artefato começa com este bloco:

```markdown
---
status: draft | in-review | approved
owner: <nome do agente>
updated: <YYYY-MM-DD>
depends_on: <caminho do artefato pai, ou "-">
---
```

`approved` só é setado pelo Invoker depois de aprovação explícita do Founder.
Agente nenhum aprova o próprio artefato.

## Cadeia de derivação

```
PRD.md -> EPIC.md -> stories/STORY-*.md -> ADR.md + DESIGN.md -> código
```

Antes de escrever, leia o artefato pai inteiro. Cada seção que você criar deve
rastrear para algo no pai: story cita o épico, ADR cita a story, código cita a
story. Se você precisa de algo que não está no pai, isso é um gap — liste como
`## Perguntas em aberto` no seu artefato e reporte ao Invoker. Não preencha
lacuna de requisito com suposição sua.

## Formato mínimo por artefato

- **PRD.md** — Problema, Usuário-alvo, Escopo (fora do escopo explícito),
  Requisitos funcionais numerados (`RF-01`), Métricas de sucesso.
- **EPIC.md** — Lista de épicos (`EP-01`), cada um com objetivo, RFs cobertos
  e critério de pronto.
- **STORY-*.md** — `Como <papel>, quero <ação>, para <valor>`, épico de origem,
  critérios de aceite em Gherkin, estimativa relativa.
- **ADR.md** — Um bloco por decisão (`ADR-01`): Contexto, Decisão,
  Alternativas descartadas, Consequências. Decisão tomada nunca é editada;
  é substituída por uma nova ADR marcada `supersedes: ADR-0X`.
- **DESIGN.md** — Fluxos de tela, estados (vazio/carregando/erro), tokens de
  design, e acessibilidade mínima por tela.

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
