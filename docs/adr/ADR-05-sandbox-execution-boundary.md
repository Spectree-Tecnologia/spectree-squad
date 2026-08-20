# ADR-05 — Sandbox como execution boundary

status: approved
owner: rubick
updated: 2026-08-20
approved: 2026-08-20
depends_on: docs/architecture/SPECTREE-RUNTIME.md

## Contexto

Ate a Fase 4 o runtime respondia "o Agent pode fazer isso?" — Policy,
Approval e Capability. A partir do `LocalFilesystemProvider`, porem, um
`ALLOW filesystem.write` passou a significar acesso ao filesystem do
host limitado apenas pelas invariantes do proprio Provider. Autorizacao
e isolamento fisico viraram a mesma coisa, e nao sao.

## Decisao

1. **Sandbox e uma camada separada da Policy.** A Policy responde
   "pode?"; o Sandbox responde "dentro de quais limites fisicos?". Um
   Sandbox jamais transforma `deny` em `allow` (INV-501).
2. **Sandbox e uma camada separada do Provider.** O SandboxProvider
   RESTRINGE; o CapabilityProvider EXECUTA. As invariantes do Provider
   (R12, resource binding, protecao da raiz) continuam valendo com
   Sandbox ativo — o Sandbox nao as substitui.
3. **Default fail-closed.** Sem backend capaz de garantir o boundary
   pedido, a execucao nao acontece: `SandboxUnavailableError`. Nunca
   degradar em silencio para um modo mais permissivo.
4. **`full`, `partial` e `none` sao estados explicitos.** Um backend
   declara o que entrega. Verificacao em JavaScript dentro do processo e
   `partial` — chamar isso de `full` seria mentir, e `full` fica
   reservado para isolamento de kernel.
5. **`danger-full-access` nao bypassa Policy.** Ele significa apenas
   que o Sandbox nao acrescenta fronteira; Policy, Approval e
   invariantes do Provider seguem no caminho.
6. **Escalonamento de sandbox nao e retry automatico.** O seam existe
   (`SandboxEscalationRequest`), a execucao automatica nao. Uma escalada
   futura sera de uma invocacao, nunca permissao permanente.
7. **O primeiro backend e filesystem.** Provar a arquitetura com o
   provider que ja existe, em vez de perseguir uma demonstracao mais
   chamativa com Shell ou container.
8. **Tool self-provided nao escapa da fronteira (R13).** Toda tool com
   `execute()` proprio declara `execution: 'pure'` ou `'physical'`.
   Physical passa pelo mesmo Sandbox da rota provider-backed; pure fica
   explicitamente fora; sem classificacao, nao registra em runtime com
   sandbox. O efeito fisico nao muda de natureza pela rota de execucao.
9. **O backend especifico de SO e substituivel.** Landlock, Restricted
   Token e container entram pelo mesmo contrato
   (`sandboxProviderContract`), sem tocar Tool, Agent ou Policy.

## Alternativas descartadas

**Sandbox como Capability.** Faria o isolamento ser solicitavel pelo
Agent — exatamente o que INV-507 proibe. Descartada.

**Sandbox dentro do Provider.** Cada Provider novo reimplementaria a
fronteira, e a divergencia entre eles seria invisivel. Descartada: o
gatilho para reconsiderar seria um Provider cujo isolamento nao pudesse
ser expresso pelo boundary comum.

**Aceitar `partial` como se fosse `full` para simplificar.** Descartada
por ser a unica alternativa que produz uma falsa sensacao de seguranca;
o custo de `fail-closed` e operacional, o custo da mentira e um incidente.

## Consequencia

O runtime passa a ter cinco dimensoes: identidade, autorizacao, decisao
humana, capacidade e fronteira de execucao. A proxima capability de
risco — Process/Subprocess — nasce dentro de uma fronteira que ja
existe, em vez de precisar inventa-la sob pressao.
