# ADR-07 — Linux Physical Sandbox

status: approved
owner: rubick
updated: 2026-08-20
approved: 2026-08-20
depends_on: docs/adr/ADR-05-sandbox-execution-boundary.md, docs/adr/ADR-06-process-subprocess-capability.md

## Contexto

A Fase 6 fechou com o R14: sem enforcement fisico, modo que promete
confinement nao executa processo. A divida ficou declarada — e a Fase 7
paga exatamente essa divida: o primeiro backend em que o SISTEMA
OPERACIONAL participa da enforcement boundary.

## Decisoes

1. **Linux e a primeira plataforma fisica.** Windows native (Restricted
   Token/AppContainer) e macOS ficam reservados.
2. **WSL2 e ambiente de desenvolvimento, nao sandbox.** O WSL2 e o
   execution host onde o Linux roda; o confinement e do
   bubblewrap/Landlock DENTRO do Linux (INV-723). WSL2 nao bloqueia
   /mnt/c por si so — o profile e que nao o monta.
3. **Bubblewrap e o runner preferencial.** Mount namespace com
   visibilidade explicita: fora do workspace nao e "negado" — fora NAO
   EXISTE no namespace. Sem exigir root (user namespaces).
4. **Landlock e o fallback do chain.** O backend existe como SEAM formal
   (identidade, locate controlado, forma da invocacao, participacao no
   chain — tudo travado por teste). O launcher NATIVO que ele exige
   (secao 54: pequeno, isolado, fail-closed) nao acompanha esta fase;
   sem helper instalado, locate() = unusable com razao.
5. **Functional probe e obrigatorio e e a autoridade (INV-724).**
   `which bwrap` nao prova nada. O probe executa um processo confinado
   num mundo descartavel e verifica: allowed read passa, outside read
   falha, write conforme o modo. Com timeout — probe pendurado nao
   bloqueia o Runtime.
6. **Fail-closed e obrigatorio (INV-726).** Chain esgotado =
   SandboxUnavailableError com o diagnostico de CADA backend (secao 20).
   Nunca `spawn original argv` como consolo.
7. **`full` depende do effect set real (INV-710).** Probe reprovado =
   backend fora, mesmo que a configuracao diga full. `enforcement`
   comeca 'none' e so muda depois do probe.
8. **`partial` e estruturalmente distinto (INV-711).** Landlock com ABI
   incompleta reporta partial; profile exigindo full o rejeita em vez de
   degradar.
9. **danger-full-access bypassa confinement explicitamente.** Nenhum
   backend e chamado; a execucao nao confinada continua sendo escolha
   auditavel (decisao 13 do ADR-06).
10. **Network e process visibility NAO entram no SandboxMode desta
    fase.** `bwrap --unshare-net` existir nao autoriza o vocabulary a
    crescer (secoes 42-43).
11. **Containers/microVMs/remotes nao sao providers deste seam.** Sao
    execution environments inteiros, nao outro backend de sandbox local.
12. **O backend e por invocation, nao modo global (INV-708).** Cada
    apply() recebe a policy da chamada; Sessions concorrentes rodam
    read-only e workspace-write simultaneamente no mesmo Runtime.
13. **Process e filesystem compartilham execution world (INV-717).** O
    workspace e bound no MESMO caminho dentro do namespace: o arquivo
    que o processo confinado cria e o arquivo que o filesystem provider
    le, sem traducao.
14. **O consumidor nao conhece o mecanismo (INV-702/703/730).** O
    SandboxHandle ganhou a porta generica `confineProcess(argv, cwd)` ->
    argv confinado (launcher + `--` + argv original INTACTO). O
    LocalSubprocessProvider usa a porta; nenhum `if bwrap` fora do
    diretorio linux-physical.

## Alternativas descartadas

**Reimplementar namespaces/seccomp em JavaScript.** O Runtime constroi
`policy -> backend invocation` e observa; quem confina e o kernel.

**Declarar full por nome de backend.** `backend == bubblewrap -> full`
seria configuracao vestida de fato; o probe funcional e quem promove.

**Fallback unconfined quando o chain esgota.** Explicitamente proibido
(secao 60) — e exatamente a mentira que o R14 eliminou.

**sandboxCommand arbitrario.** Um runner customizado sem assinatura
conhecida nunca poderia ser full automaticamente; fica fora ate ter
contrato proprio (secao 53).

## Consequencia

O R14 encontra o backend que faltava: `workspace-write` volta a parir
processo — agora FISICAMENTE confinado, com o kernel negando o que o
modo promete negar. A Fase 8 (Execution Effects / Resource Model) pode
nascer sem a divida, e o Shell (F9) herda uma boundary provada.
