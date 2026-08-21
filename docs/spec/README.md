---
status: in-review
owner: Rubick
depends_on: docs/adr/ADR-10-repository-memory-system.md
---

# Spectree Runtime — Normative Specifications

Uma spec por fase do Runtime: o contrato verificável do que MUST valer, com
seções numeradas e invariantes `INV-NNN`. As nove specs das Fases 1 a 9 estão
preservadas aqui — `RUNTIME-F01` a `RUNTIME-F09`.

## Mapa das fases

Seções e invariantes medidas nos arquivos desta pasta; a coluna `Código` é onde
as invariantes daquela fase são citadas em `spectree-runtime/`.

| Fase | Spec | Seções | Invariantes | Código |
|---|---|---|---|---|
| F01 Runtime Core | `RUNTIME-F01-runtime-core.md` | 47, contíguas 1–47 | `INV-001`–`INV-010` | `loop/`, `agent/`, `session/`, `events/`, `tools/` |
| F02 Policy Engine | `RUNTIME-F02-policy-engine.md` | 75, contíguas 1–75 | `INV-201`–`INV-215` | `policy/` |
| F03 Founder Gate | `RUNTIME-F03-founder-gate.md` | 98, contíguas 1–98 | `INV-301`–`INV-320` | `approval/` |
| F04 Capability Providers | `RUNTIME-F04-capability-providers.md` | 158, contíguas 1–158 | `INV-401`–`INV-425` | `capabilities/`, `providers/local/filesystem-provider.js` |
| F05 Sandbox Runtime | `RUNTIME-F05-sandbox-runtime.md` | 186, contíguas 1–186 | `INV-501`–`INV-530` | `sandbox/` |
| F06 Process/Subprocess | `RUNTIME-F06-process-subprocess.md` | 180, contíguas 1–180 | `INV-601`–`INV-630` | `process/`, `providers/local/subprocess-provider.js` |
| F07 Linux Physical Sandbox | `RUNTIME-F07-linux-physical-sandbox.md` | 127, contíguas 1–127 | `INV-701`–`INV-730` | `sandbox/providers/linux-physical/` |
| F08 Execution Effects | `RUNTIME-F08-execution-effects.md` | 88, contíguas 1–88 | `INV-801`–`INV-810` | `effects/` |
| F09 Governed Model Harness | `RUNTIME-F09-governed-model-harness.md` | 55 numeradas de §1 a §120, com lacunas | `INV-901`–`INV-906` | `harness/` |
| F10 Shell | não existe | — | — | não existe |
| F11 Terminal/PTY | não existe | — | — | não existe |

**A numeração das fases futuras.** O Governed Model Harness é a F9; o Shell é a
F10; Terminal/PTY é a F11. A F09 já escreve essa fronteira nos três lugares:
`RUNTIME-F09-governed-model-harness.md:546` ("Shell pertence à F10"), a §119
`Fase 10 boundary` do mesmo arquivo ("A F9 NÃO cria Shell, PTY, Terminal,
interactive stdin") e `docs/adr/ADR-09-governed-model-harness.md:176` ("Shell e
PTY continuam sendo a F10").

**O Shell tem contrato e não tem código.** A F08 escreveu duas seções só para
ele — §57 `Shell preparation` e §58 `Shell não pode contornar Effects` — e
ambas chamam a fase do Shell de "F9", porque foram escritas antes desta
numeração. Sob a numeração vigente, leia "F10" onde elas dizem "F9". Não há
diretório `shell/`, `pty/` nem `terminal/` em `spectree-runtime/`.

## As citações do código

O código endereça as specs por `§NNN`/`secao NNN` e por `INV-NNN`. Medido no
estado atual desta árvore:

- **Invariantes: 145 linhas citam `INV-NNN`, 69 identificadores distintos, e
  todas resolvem.** O prefixo carrega a fase — `INV-0NN` é F01 e `INV-NNN` é
  F0N para N de 2 a 9 — e todo número citado cai dentro da faixa que a spec da
  fase declara. Uma citação de invariante não é ambígua.
- **Seções: 559 linhas citam `§NNN`/`secao NNN`** (556 em
  `spectree-runtime/**/*.js`, 3 em `.github/workflows/ci.yml`). Nenhuma cita
  número maior ou igual a 180. Como a F05 numera 1–186 e a F06 numera 1–180,
  ambas contíguas, **todo número de seção citado pelo código existe em pelo
  menos duas specs.** Não há citação de seção irresolvível por falta de seção.
- **Mas só 29 dessas 559 linhas nomeiam a fase.** As outras 530 escrevem o
  número sozinho, e um número sozinho é um endereço para nove documentos com
  numeração sobreposta.

Os dois exemplos que versões anteriores deste arquivo davam como "históricos e
não resolvíveis" resolvem hoje:

```
secao 127  ->  RUNTIME-F07-linux-physical-sandbox.md:599
               "127. Regra de ouro da Fase 7"
               citada em sandbox/providers/linux-physical/
                         linux-physical-sandbox-provider.js:25
INV-724    ->  RUNTIME-F07-linux-physical-sandbox.md:543
               "Functional probe é a autoridade para backend availability"
               citada em sandbox/providers/linux-physical/probe.js
```

### A ambiguidade custa caro, e já custou

`secao 143` aparece em seis lugares do código e não significa a mesma coisa nos
seis. Cinco apontam para a F05 §143 `Real enforcement backend`, cuja última
frase é "Nunca mascarar partial como full":

```
sandbox/sandbox-contract.js:46
sandbox/providers/local-filesystem-sandbox.js:42
sandbox/providers/test-sandbox-provider.js:33
tests/sandbox-contract.test.js:33
tests/sandbox-unit.test.js:283
```

O sexto, `tests/filesystem-provider.test.js:15`, cita `secao 143` e `secao 144`
como "workspace temporário real" e "limpo ao final" — que é a F04 §143 `Real
integration tests` e a F04 §144 `Cleanup`, não a F05. A F05 §144 é `DeepSeek
adaptation principle` e não tem relação com o comentário.

O preço já foi pago uma vez: a `RUNTIME-F07`, nas linhas 34–36, registra a
§143 como "citação órfã do código" por não existir na F07 — que termina em 127.
A seção existe; o que faltava era a fase no endereço.

**Regra para citação nova:** nomeie a fase junto com a seção — `spec Fase 5,
secao 143`, a forma que 29 linhas do código já usam. Corrigir as 530 antigas é
trabalho do dono do código, não deste arquivo.

## Processo

A partir da F9 a spec vem **antes** da implementação. Da F1 à F8 a spec foi
transcrita depois, a partir dos documentos do harness de planejamento do
Founder — a diferença é a ordem, não a existência: as nove estão versionadas
aqui.

```
Founder Brief
  -> Normative Spec
  -> Approval
  -> ADR
  -> Implementation
  -> TechLeader Review
  -> Merge
```

## Aprovação

A aprovação de uma spec é o merge do PR em `main` — ato do Founder, que nenhum
agente executa (`docs/adr/ADR-10-repository-memory-system.md`, decisão 5). Não
existe rebaixamento de status: editar conteúdo aprovado é editar, e o PR vai a
review como qualquer outro.

O `status:` que vale é o da cópia em `main`; o de uma branch não aprovou nada,
diga o cabeçalho o que disser. O cabeçalho não carrega `approved:` nem
`updated:` — o git responde quem aprovou, quando e em que merge, e campo que
duplica o git só acrescenta a possibilidade de mentir (ADR-10, decisão 13).

O texto commitado é o contrato real: implementação nunca acontece contra uma
versão "quase igual" vinda de conversa.

## Distinção

- `docs/spec/` — o contrato normativo verificável de cada fase.
- `docs/adr/` — as decisões arquiteturais duráveis e suas alternativas
  descartadas.
- `docs/architecture/SPECTREE-RUNTIME.md` — a visão consolidada das Fases 1 a 4,
  como o próprio título do arquivo declara. Não cobre F05 a F09.
