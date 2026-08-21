# ADR-07 — Linux Physical Sandbox

status: approved
owner: rubick
updated: 2026-08-20 (adendo: fidelidade do mount plan)
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

## Adendo — fidelidade do mount plan (2026-08-20)

Descoberto pela calibracao de credencial da F9, no primeiro momento em
que um processo confinado usou rede real.

**O defeito.** `--ro-bind /etc /etc` binda o DIRETORIO — nao o que os
symlinks dele alcancam. `/etc/resolv.conf` e symlink em praticamente
todo host moderno: para `/mnt/wsl/resolv.conf` no WSL, para
`/run/systemd/resolve/stub-resolv.conf` em qualquer distro com
systemd-resolved (Ubuntu 18.04+, Fedora, boa parte do Debian — inclusive
o `ubuntu-latest` do nosso CI). Nem `/mnt` nem `/run` estao em
`SYSTEM_RO_ROOTS`, entao o namespace recebia um symlink PENDURADO: o
mount plan prometia `/etc` e nao cumpria.

Nao e particularidade do WSL. O WSL foi apenas o primeiro lugar onde
alguem rodou rede real dentro do namespace e viu. O sintoma era TIMEOUT
de DNS, nao erro — o pior formato de falha possivel, porque nao se parece
com uma.

**A correcao.** `BubblewrapBackend.mountFidelity()` resolve o realpath
dos symlinks de sistema conhecidos e binda o ALVO, pontualmente
(`--ro-bind alvo alvo`), quando ele existe e nao esta coberto pelas roots
ja montadas. Derivado do disco: o alvo vem do realpath, o tipo vem do
`statSync` (so arquivo vira bind), e o alvo passa pelo MESMO piso dos
`declaredResources` (INV-906 — raiz, HOME, ancestral de HOME, root de
sistema). A lista de symlinks e enumerada de proposito e curta: varrer
`/etc` atras de todo symlink pendurado seria enumerar por varredura, com
um mount plan imprevisivel.

**Observabilidade.** O que custou uma sessao de depuracao nao foi o DNS
quebrado — foi ele ser invisivel. O status de cada symlink viaja em
`diagnostics().mountFidelity`, e o CI ganhou a assercao que o conformance
harness zero-rede CONSEGUE fazer: `/etc/resolv.conf` resolve para um
arquivo existente dentro do namespace? E pergunta de filesystem, nao de
rede.

**Nenhuma decisao deste ADR muda.** As 14 decisoes seguem de pe,
inclusive a decisao 10: rede e process visibility continuam fora do
vocabulario de SandboxMode. Este adendo e correcao de FIDELIDADE do plano
de montagem, nao mudanca de fronteira — a rede ja era deliberadamente
disponivel nesta fase (sem `--unshare-net`) e o material exposto pelo
bind e configuracao de DNS, nunca credencial. Quando uma fase futura der
enforcement ao eixo de rede, este bind passa a fazer parte da superficie
DAQUELA fase e e reavaliado la.
