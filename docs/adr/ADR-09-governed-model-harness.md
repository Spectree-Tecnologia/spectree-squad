# ADR-09 — Governed Model Harness

status: approved
owner: rubick
updated: 2026-08-20
approved: 2026-08-20
depends_on: docs/spec/RUNTIME-F09-governed-model-harness.md, docs/adr/ADR-08-execution-effects.md

## Contexto

O Runtime precisava do primeiro consumidor real: um harness de modelo
(Claude CLI e sucessores) executando missoes. A tentacao obvia — tratar
o harness como um tipo especial de Agent com acessos especiais — criaria
uma rota paralela de autoridade.

## Decisoes

1. **O harness E UM PROCESSO** (secao 116) — ProcessSpawnSpec +
   EffectSet + Sandbox + ProcessRegistry. Nao existe LlmAgent, Messages
   client, streaming engine ou context manager no Runtime.
2. **Launcher agnostic** (INV-901): o contrato nao conhece CLI nenhum.
   `ClaudeModelHarnessLauncher` e adapter; os literais `claude`, `-p`,
   `--output-format` vivem SO no arquivo do adapter, travado por teste
   estrutural — e o adapter nao e re-exportado pelo index para manter o
   isolamento absoluto.
3. **declaredResources (E1)** — primeira materializacao fisica do
   resource narrowing da F8: EffectSet autorizado x bindings de host =
   ro-binds PONTUAIS no namespace. Nao e nova autoridade; e a
   materializacao de recursos ja autorizados. Read-only nesta fase;
   physicalPath nunca vem de Agent/Tool; credencial autorizada sem
   binding fisico falha fechado.
4. **Credencial e efeito, nao excecao** (secoes 14-15):
   `filesystem.read(credential://...)` — sem effectKind novo. A matriz
   unica ganhou `credential-founder-gate` (approval-required
   credential/*), runtime-only (E4): o guard nao detecta leitura de
   credencial e nao finge que detecta.
5. **Calibracao e operacao deliberada, nunca gate** (secoes 9-10, 22):
   PROFILE-0 -> candidatos minimos, um por vez, HOME jamais; vereditos
   auth-ok/auth-insufficient/runner-failure sem UNKNOWN silencioso; o
   record nao carrega segredo nem caminho absoluto; apply() consulta
   configuracao commitada e nunca chama o probe.
6. **Conformance harness no CI (E3)**: o teste fisico prova que o
   CONTRATO funciona (bubblewrap real, zero rede, zero quota); a
   calibracao real prova que o ADAPTER concreto opera dentro dele. CI
   deterministico, Claude nao e dependencia de teste.
7. **maxLifetimeMs e teto do Runtime (E2)**: DI no Provider; pedido
   acima do teto e reject, nunca clamp. `timedOut` e fato persistido no
   outcome — nunca inferido de signal.
8. **HOME env != HOME filesystem** (INV-904/905): o ambiente pode dizer
   HOME; o namespace nao o monta, e o teste fisico prova a leitura
   falhando. ~/.claude inteiro nunca e candidato (INV-906) — se so o
   HOME autentica, o resultado e C.
9. **Guard interno e defense in depth** (secoes 47, 56): o pai governa
   nascimento/ambiente/filesystem/lifecycle; o guard filho governa as
   operacoes que detecta. Identidade de projeto host == child provada
   fisicamente; sink de audit ausente = audit unavailable explicito, sem
   quebrar a decisao.
10. **Resultado A/B/C, nunca D** (secao 115): sem calibracao aprovada, o
    exemplo declara "confined harness unavailable" — jamais rebaixa para
    danger-full-access para parecer que funciona.

## Alternativas descartadas

**Harness como Agent especial.** Rota paralela de autoridade; violaria
R8/INV-716 e toda a arquitetura de fases.

**Montar ~/.claude para o exemplo funcionar.** E exatamente o resultado
D proibido; a calibracao existe para achar o MINIMO, e C e entrega
valida.

**Detector de credencial no guard.** Fingir alcancabilidade onde nao ha
detector real corromperia o teste de alcancabilidade da matriz (E4).

## Propriedade de seguranca declarada (secao 92)

**Nesta fase, um harness confinado que receba material de credencial
pode ler e exfiltrar essa credencial. O confinamento da F9 e de
filesystem/processo, nao de segredo** — network permanece vocabulario
reservado e o bubblewrap segue sem --unshare-net. O seam declarado para
reduzir essa exposicao e o `CredentialBroker` (credencial fora do
namespace, interface controlada: unix socket / host proxy / ephemeral
credential service) — NAO implementado nesta fase.

## Adendo (follow-up do review, E6)

O review do Founder no PR #28 encontrou o INV-906 enforcado so na
calibracao — o lado que propoe, nao o lado que monta. Corrigido no
padrao da F4 (defense in depth): `assertBindablePhysicalPath` vive em
`createSandboxPolicy` (autoridade) e a calibracao consome a MESMA regra.
Recusas tipadas: raiz do filesystem; HOME ou ancestral do HOME
(igual-ou-ancestral — `HOME/..` morre); raiz de sistema que o backend ja
monta; e sobreposicao com o workspace em qualquer direcao (no bwrap o
ultimo bind vence — sombreamento seria mudanca de comportamento
silenciosa). Um teste por recusa em
`tests/declared-resources-floor.test.js`.

Segundo giro do review (#29), dois fechos: (1) o piso NAO tem
interruptor — com declaredResources nao-vazio (ou calibracao com
candidatos), HOME irresoluvel e recusa tipada, nunca um veto que
silenciosamente nao se aplica; homePath e injetavel no wiring. (2) A E6
declara DUAS mudancas: a correcao de escopo E a saida do ~/.claude da
proibicao nominal — compensada pela escada normativa por granularity
(arquivo -> conjunto -> diretorio, degrau registrado no record e ordem
violada = erro) e pelo risk statement nomeando o alcance real: binding
de diretorio expoe tudo sob ele — em ~/.claude, credencial MAIS
projects/ (transcripts de todas as sessoes), plugins, config e memoria.

Terceiro giro (#29): a escada tinha dois degraus sem peso — 'file-set'
nao era verificado contra o disco (um diretorio entrava num degrau
estreito com o rotulo errado no record, tornando a secao 92 factualmente
errada) e 'directory' podia ser o primeiro candidato. Correcao pela
raiz: granularity DERIVADA do disco (caminho inexistente recusado;
diretorio exige 'directory'; nao-diretorio exige 'file'/'file-set') e
'directory' nunca primeiro. O padrao dos tres achados do review —
igualdade exata em vez de ancestralidade, veto condicional a homePath
truthy, rotulo enumerado em vez de derivado — virou licao permanente em
docs/LESSONS.md: derivar do fato, nunca enumerar os casos.

## Consequencia

Um segundo harness entra criando apenas outro launcher + calibracao +
testes (secao 117), sem tocar PolicyEngine, SandboxProvider,
LocalSubprocessProvider, Agent ou ProcessRegistry. O Invoker podera usar
o mesmo contrato sem que o Runtime o conheca (secao 118). Shell e PTY
continuam sendo a F10.
