# ADR-08 — Execution Effects / Resource Model

status: approved
owner: rubick
updated: 2026-08-20
approved: 2026-08-20
depends_on: docs/adr/ADR-06-process-subprocess-capability.md, docs/adr/ADR-07-linux-physical-sandbox.md

## Contexto

Ate a Fase 7 a autorizacao respondia "este processo pode nascer neste
workspace?" — com o cwd carregando, implicitamente, a responsabilidade
de representar tudo o que a execucao pode afetar. Isso nao sobrevive a
uma operacao expressiva (ler N recursos, escrever M, renomear, linkar,
spawnar) e nao sobrevive ao Shell da F9.

## Decisoes

1. **ExecutionEffectSet e a unidade normativa (INV-801).** Toda execucao
   fisica governada possui um conjunto explicito de efeitos
   {kind, operation, resource} — deduplicado, ordenado
   deterministicamente e com fingerprint sha256.
2. **cwd nao e efeito (INV-802).** cwd = onde o processo inicia. O que
   ele pode afetar = o Effect Set. `process.spawn` declara DOIS efeitos:
   o execution world (cwd canonico, preservando a defesa de traversal da
   F4) e a identidade do executavel (`executable/<nome>`). Autorizar so
   o world deixou de bastar.
3. **Autorizacao e do conjunto (INV-804).** Cada efeito passa pelo
   PolicyEngine existente; qualquer DENY nega tudo; APPROVAL vence
   ALLOW; nao existe autorizacao parcial.
4. **A capability que governa um efeito e o KIND dele.** Um spawn que
   declara efeitos de filesystem e julgado pelas policies de filesystem —
   e a capability nao ganha kind que nao declarou (`effectKinds`,
   secao 55).
5. **Resolucao e deterministica e fail-closed (INV-805).** LLM nao
   participa; "provavelmente so afeta o workspace" nao existe. Plano
   incomplete nao executa e nunca vira `workspace/*` por conveniencia.
6. **A resolucao pertence a quem sabe (secao 56).** tool.resolveEffects
   -> tool.effects -> capability.resolveEffects; nunca um parser global.
   Tool sem rota segue o caminho legado single-resource das F1-7 — mas
   capability que declarou effectKinds nao regride.
7. **write != delete != create != rename != link.** rename e link sao
   compostos: source E destination participam da autorizacao, como
   efeitos distintos com o counterpart na identidade.
8. **Approval pertence ao conjunto (INV-807).** Uma unica approval
   carrega fingerprint + efeitos projetados; o resume recalcula o
   conjunto do input ORIGINAL e o fingerprint e a trava (INV-808):
   divergencia = EffectRevalidationError, approval permanece approved.
9. **Sandbox consome efeitos resolvidos (INV-809).** O modo fisico e
   derivado do CONJUNTO (o mais exigente vence) — os efeitos reduzem o
   teto, nunca ampliam; kind/operation sem perfil falha fechado.
10. **Identidade canonica preserva o vocabulario das F4-7.** O canonico
    continua `{type, id}` com id workspace-relativo — as policies
    existentes casam por construcao; a forma URI (`filesystem://...`) e
    a serializacao para fingerprint, evento e audit.
11. **Erros tipados novos**: EffectResolutionError (nao sei o efeito),
    EffectAuthorizationError extends PolicyDeniedError (conjunto negado,
    detalhe tipado preservado), EffectRevalidationError (fingerprint
    divergiu no resume).
12. **Pre-execution authorization permanece (secao 75).** Observed
    effects sao auditoria futura, nunca autorizacao retroativa — e a F8
    nao alega observabilidade completa do SO (secao 27).

## Alternativas descartadas

**Formato URI como identidade de matching.** Quebraria toda policy
existente sem ganho de autoridade; a URI e serializacao, nao matching.

**Efeito unico composto para rename/link.** Exigiria ensinar o
PolicyEngine a decidir sobre dois recursos numa decisao; dois efeitos
com counterpart na identidade usam o engine intacto.

**executeWithoutEffects() como rota de migracao.** Proibido pela spec
(secao 61) e travado por teste: a superficie publica nao tem a rota.

## Consequencia

O Shell (F9) nasce como parser -> EffectPlan -> este pipeline, sem rota
paralela de autorizacao. `filesystem.write(command.cwd)` como modelo de
autorizacao de shell esta explicitamente proibido (secao 58).
