# Spectree Runtime v2 — F09 Governed Model Harness

status: in-review
owner: TechLeader
updated: 2026-08-20
approved: — (aguarda re-aprovacao do Founder: conteudo alterado pela E6 — regra "aprovacao pertence ao conteudo")
depends_on: F1 Runtime Core, F2 Policy Engine, F3 Founder Gate, F4 Capability Providers, F4.5 Squad/Runtime Integration, F5 Sandbox Runtime, F6 Process/Subprocess, F7 Linux Physical Sandbox, F8 Execution Effects / Resource Model

> Transcrito da proposta do TechLeader (2026-08-20) e aprovado com as
> cinco emendas normativas da seção final. O texto commitado é o
> contrato real (ver `docs/spec/README.md`).

## 1. Propósito

A F9 introduz o primeiro consumidor real do Spectree Runtime: um harness
de modelo executado como processo governado pelo Runtime.

O Runtime não implementa o loop de mensagens do modelo, a Messages API,
streaming de tokens, compaction, retry ou gerenciamento de contexto do
modelo. Essas responsabilidades pertencem ao harness.

O Runtime governa: Policy, Approval, Capability, Effects, Sandbox,
Process, Session, Lifecycle, Audit — e o harness é tratado como:
`ProcessSpawnSpec` + `ExecutionEffectSet` + Sandbox boundary +
ProcessRegistry lifecycle.

A tese normativa da F9: **o Runtime governa; o harness do modelo é um
processo governado.**

## 2. Resultado arquitetural

Caminho normativo:

```
Founder / Agent / Invoker
  -> ModelHarnessLauncher
  -> ToolRuntime
  -> EffectResolver
  -> Policy
  -> Founder Gate
  -> SandboxResolver
  -> Physical Sandbox
  -> LocalSubprocessProvider
  -> ProcessRegistry
  -> Model Harness
```

O harness não recebe acesso direto a: PolicyEngine, ApprovalManager,
SandboxProvider, CapabilityRegistry, ProviderRegistry, ToolRuntime,
FounderGate. O harness recebe somente o que um processo governado pode
receber: argv, cwd, controlled environment, stdin, stdout, stderr,
lifecycle, filesystem visibility.

## 3. Launcher independence

**INV-901 — Launcher agnostic.** O contrato do Runtime MUST ser
independente do launcher concreto. O Runtime MUST NOT possuir lógica
específica para `claude`, `claude-code`, `codex` ou outro CLI. O
launcher específico é um adapter do contrato.

**INV-902 — ModelHarnessLauncher.** Seam conceitual:
`launch(request) -> ProcessSpawnSpec`. O adapter transforma uma intenção
de execução de harness em um `ProcessSpawnSpec` estruturado. Pode
conhecer argv, output format, CLI flags e convenções de configuração;
não pode conhecer PolicyEngine, Sandbox internals, ApprovalManager,
implementação de Provider.

**INV-903 — Claude é primeira implementação.** A primeira implementação
concreta pode ser `ClaudeModelHarnessLauncher`, usando `claude`, `-p`,
`--output-format json`. Essas strings MUST permanecer confinadas ao
diretório do adapter e MUST NOT aparecer em Policy, Sandbox, Capability,
Process Provider, Agent ou Core. Isolamento travado por teste
estrutural.

## 4. O Runtime não é um LLM harness

A F9 explicitamente NÃO cria: LlmAgent, Messages API client, streaming
engine, context manager, compaction engine, retry engine, token
accounting, model conversation loop. A classe `Agent` permanece
abstração de composição do Runtime. O harness externo é um processo
físico independente.

## 5. Execução física

A F9 utiliza integralmente os contratos das F6/F7: ProcessSpawnSpec,
ProcessRegistry, confineProcess(), BubblewrapBackend, SandboxHandle,
AbortSignal, graceMs, OutputCollector. Nenhum segundo mecanismo de
processo deve ser introduzido.

## 6. Primeiro pré-requisito: classificação de process

O perfil atual de Sandbox não classifica `process`. A F9 MUST adicionar
a classificação necessária para `process.spawn`. Enquanto isso não
existir: `process.spawn -> não classificável -> não nasce`.

Para a execução Linux física da F9: `process.spawn -> workspace-write`,
ou modo menor quando o EffectSet completo puder provar que apenas
leitura é necessária. O modelo da F8 permanece soberano: o Effect Set
pode reduzir o teto do modo, mas nunca ampliá-lo.

## 7. Harness como processo governed

Uma execução de harness deve ser indistinguível, no seam de processo, de
qualquer outro processo governado: ProcessSpawnSpec com argv explícito,
cwd explícito, environment explícito, stdin/stdout/stderr explícitos,
lifecycle controlado. Não existe shell string no contrato.

## 8. Credential boundary

**INV-904 — Host HOME não é montado.** O `$HOME` do host MUST NOT ser
montado integralmente no namespace físico. Não existe `bind $HOME` como
comportamento padrão.

**INV-905 — HOME environment != HOME filesystem.** `HOME=/home/<user>`
no ambiente governado NÃO concede `/home/<user>` no filesystem do
namespace. Comportamento testado fisicamente: HOME definido + HOME não
montado = leitura falha.

**INV-906 — HOME nunca é recurso bindável (escopo corrigido, E6).** A
proibição pertence ao BINDING — `declaredResources`, o lado com
autoridade — e a calibração é apenas um dos consumidores dela. Um
`physicalPath` igual à raiz do filesystem, igual ao HOME OU A UM
ANCESTRAL do HOME (igual-ou-ancestral, nunca igualdade exata: `HOME/..`
morre também), ou igual a uma raiz de sistema que o backend já monta,
MUST ser recusado com erro tipado em `createSandboxPolicy` E na
calibração. Recurso declarado também não pode sobrepor o workspace (em
nenhuma direção): no bwrap o último bind vence, e o sombreamento seria
mudança de comportamento silenciosa. Se somente o HOME inteiro permitir
execução autenticada, o resultado é **C — confined harness
unavailable**, e não uma ampliação do namespace.

## 9. Credential Calibration Probe

O credential probe é operação de calibração deliberada, não gate de
`apply()`.

O Functional Probe da F7 é gratuito, hermético, sem rede, determinístico
e executado em apply/probe. O Credential Probe da F9 usa o CLI real,
pode usar rede, pode consumir quota, depende da credencial real do
Founder, tem latência externa e não é apropriado para CI. Logo:
**Credential Probe MUST NOT ser executado automaticamente em `apply()`
nem no caminho normal de execução do Runtime.**

## 10. Modelo de calibração

```
humano executa deliberadamente -> PROFILE-0 -> candidate N ->
candidate N+1 -> diagnóstico -> Founder escolhe/aprova ->
configuração declarada é commitada
```

O probe produz proposta, não autoridade.

## 11. PROFILE-0

O primeiro perfil não tem credential filesystem adicional e não monta
HOME nem `~/.claude`. A execução é idêntica ao adapter final exceto pela
ausência da declaração de credential resource.

## 12. Progressive candidates (escada normativa — corrigida no #29)

Candidatos testados um por vez, e a escada é NORMA, não convenção: o
degrau MAIS ESTREITO vem primeiro. Ordem normativa: (1) PROFILE-0 —
nenhum credential resource; (2) menor ARQUIVO candidato; (3) menor
conjunto de arquivos; (4) diretório — somente depois de os degraus
estreitos falharem. Cada candidato declara `granularity`
(`file | file-set | directory`), verificada contra o disco quando o
caminho existe; ordem violada é erro de configuração, nunca reordenação
silenciosa; e o record da calibração registra QUAL degrau foi aprovado.
A ordem concreta dos paths é propriedade do adapter/calibration data,
não do Core. Nenhuma etapa pode ampliar automaticamente `candidate N ->
candidate N + HOME` como fallback.

## 13. Credential candidate identity

O diagnóstico MUST representar o candidato por identidade canônica —
nunca por caminho absoluto que revele identidade pessoal. Exemplo:
`credential://claude/auth`.

## 14. Credential effect

O recurso de credencial usa o modelo da F8:

```json
{ "kind": "filesystem", "operation": "read",
  "resource": { "type": "credential", "id": "claude/auth" } }
```

Serialização: `filesystem:read:credential://claude/auth`. Essa forma
entra em EffectSet, fingerprint, approval, event e audit. A F9 MUST NOT
criar `effectKind: credential`.

## 15. Capability compatibility

O modelo funciona sem alterar `effectKinds` do process
(`["process","filesystem"]`). `resource.type` não determina
`effect.kind`: `filesystem.read(credential://claude/auth)` continua
`kind = filesystem`. O recurso identifica a sensibilidade.

## 16. Credential policy guard

Como `resources` omitido funciona como wildcard, uma policy genérica
`allow filesystem read` também casaria com `credential/*`. Isso é
proibido para credenciais do Founder. A F9 MUST adicionar:

```json
{ "id": "credential-founder-gate", "effect": "approval-required",
  "capability": "filesystem", "operations": ["read"],
  "resources": ["credential/*"] }
```

com teste de alcançabilidade.

## 17. Credential policy semantics

Precedência inalterada: deny > approval-required > allow. Portanto
`allow filesystem.read/*` + `approval-required credential/*` produz
approval-required para credential. A Policy não conhece Claude.

## 18. Credential probe sentinel

O credential probe MUST distinguir três estados:

- `auth-ok` — o CLI demonstrou autenticação suficiente.
- `auth-insufficient` — execução válida, mas o candidato de filesystem
  não foi suficiente.
- `runner-failure` — qualquer falha que impeça concluir autenticação de
  forma confiável (CLI inexistente, flag inválida, process failure,
  network failure, 429, timeout, malformed output, unexpected format).
  MUST ser runner-failure, e não auth-insufficient.

## 19. Probe sentinel

Ausência de sentinel/resultado confiável MUST significar
`runner-failure`, nunca `auth-insufficient`.

## 20. Credential probe e quota

O probe SHOULD usar, quando disponível, uma operação do CLI que
demonstre autenticação sem consumir quota de geração. A spec MUST NOT
assumir que tal operação existe; o adapter descobre empiricamente. Se
não existir, o probe consome a quota real do Founder — característica
declarada operacionalmente.

## 21. Calibration result

O probe MUST produzir: candidate identity, probe state, output behavior,
diagnostic reason. MUST NOT produzir: secret contents, token contents,
absolute host path, full environment.

## 22. Calibration commit

O resultado aprovado torna-se configuração declarada do adapter/profile.
O `apply()` NÃO chama credential probe: apenas consulta o resultado
commitado.

## 23. Probe nunca cria autoridade

```
credential probe -> candidate proven -> configuration ->
EffectResolver -> Policy -> Approval -> Sandbox
```

Nunca: `probe -> mount automatically`.

## 24. Resultado negativo da calibração

Três resultados válidos: **A** — harness confinado funciona sem
credential filesystem (PROFILE-0 suficiente). **B** — funciona com
credential resource mínimo declarado, que entra no EffectSet como
`filesystem.read(credential/...)` e passa pelo Founder approval. **C** —
confined harness impossible: nenhum perfil permitido prova execução
autenticada; `confined = unavailable` enquanto `danger-full-access =
governed-but-unconfined` continua legítimo.

## 25. Resultado C é uma entrega válida

No resultado C a F9 ainda MUST entregar: credential calibration probe,
diagnóstico por candidato, spec, ADR-09, seam do credential broker,
fail-closed path, testes. O CI prova: configuração de credencial
indisponível -> erro tipado -> zero spawn. Sem falso sucesso.

## 26. Credential broker seam

A F9 registra o seam futuro `CredentialBroker`: credencial fora do
namespace -> broker no host -> interface controlada (unix socket, host
proxy, ephemeral credential service). NÃO implementado na F9; registrado
como seam declarado.

## 27. Credential exfiltration limitation

Nesta fase `network` é vocabulário reservado sem operações e o
Bubblewrap segue sem `--unshare-net`. **Um harness confinado que receba
material de credencial pode ler e exfiltrar essa credencial. O
confinement da F9 é filesystem/process boundary, não secret boundary.**
Esta limitação MUST aparecer no ADR-09 e nas known limitations.

## 28. Environment

Ambiente mínimo derivado de `buildProcessEnvironment()`. POSIX: PATH,
HOME, TMPDIR, LANG, TZ como allowlist base. Nenhuma variável adicional
entra implicitamente porque o harness é Claude.

## 29. allowedEnvironmentKeys

Variável adicional MUST ser declarada via `allowedEnvironmentKeys`. Não
existe "Claude needs it, therefore copy host env".

## 30. Anthropic environment

`ANTHROPIC_*` não entra automaticamente. Se o adapter declarar alguma:
passa pelo allowlist, permanece sob o modelo de governança, aparece como
configuração explícita, não é copiada do host por default.

## 31. Managed Runtime environment

`SPECTREE_*` continua exclusivamente gerenciado pelo Runtime. O harness
não sobrescreve SPECTREE_SESSION_ID, SPECTREE_AGENT_ID,
SPECTREE_CAPABILITY, SPECTREE_SANDBOX ou futuras variáveis do namespace.

## 32. Environment versus filesystem

Invariável da F9: `ENV HOME != FILESYSTEM HOME`. Teste físico
obrigatório: HOME set + HOME ausente do namespace + read HOME path =
failure.

## 33. Output contract

Reutiliza `OutputCollector`. Default 1 MiB; hard ceiling 16 MiB.
Orçamento superior ao default MUST ser explícito. O adapter não eleva o
default para tornar o harness funcional.

## 34. Structured harness output

Para resposta estruturada (`--output-format json`), `truncated = true`
MUST ser tratado como structured-output failure, não como resposta
parcial válida. O adapter MUST NOT entregar JSON potencialmente truncado
como resultado normal.

## 35. Output result

O resultado distingue: complete, truncated, spill, parse-failure,
process-failure. Output estruturado acima do orçamento: `outcome =
failed`, `reason = structured-output-truncated` (ou erro tipado
equivalente).

## 36. Spill

Quando usado: bounded, sandbox-visible, cleanup-owned, explicitly
reported. Não é uma segunda resposta invisível.

## 37. Streaming output

Consumo interno em streaming é permitido; o contrato exposto continua
limitado por maxBytes. Não existe saída ilimitada.

## 38. Duration

A F9 introduz `maxLifetimeMs` como orçamento explícito de duração. Sem
timeout hard-coded no adapter.

## 39. Authority do maxLifetimeMs

`maxLifetimeMs` pertence ao teto do Runtime. A camada chamadora pode
pedir menos, nunca aumentar o teto. Monotonicidade preservada como em
Sandbox e Policy. (Emenda 2: requested > runtime ceiling -> reject.)

## 40. Lifetime model

```
deadline -> AbortSignal -> graceful termination -> graceMs ->
tree termination -> outcome
```

## 41. Timeout classification

Deadline expirado não é normal exit nem genericamente failed. O Runtime
preserva a distinção de timeout no outcome.

## 42. Process outcome

A superfície do ProcessHandle/outcome só amplia de forma explícita e
travada por R8. O novo estado é `timedOut` (fato persistido no outcome,
não inferido — Emenda 2): no contrato, no teste estrutural,
semanticamente distinto de exit normal. O adapter não infere timeout
olhando `signal`.

## 43-45. Termination, tree, Session ownership

O processo do harness pertence à Session; ProcessRegistry é a autoridade
de terminate e session shutdown; nenhum lifecycle paralelo. A
propriedade `best-effort-tree` continua e MUST NOT ser chamada de full.
Encerrar a Session encerra o harness (terminate -> tree best-effort ->
outcome).

## 46. Parent governance

O pai observa `process.*`, `effect.*`, `policy.evaluated`,
`sandbox.applied`. A ausência da auditoria do guard filho não torna o
processo invisível.

## 47. Child governance

O harness carrega seu próprio plugin/guard — defense in depth, não
decisão duplicada. O pai governa nascimento, ambiente, filesystem,
sandbox, lifecycle; o filho governa as operações que o próprio harness
tenta executar. Decisões independentes.

## 48-50. Guard audit

O sink `~/.claude/spectree/policy-decisions.jsonl` dentro do sandbox é
recurso físico independente. Se não existir no namespace: `audit =
unavailable` — o filho não reporta o que não persistiu. Disponibilidade
do sink é propriedade do execution environment, não promessa do Runtime.
Dar ao guard o próprio sink não cria permissões extras; se representado
como effect, passa pelo pipeline da F8.

## 51-53. Project identity

A F9 MUST provar `project(host) == project(child)` quando o workspace
físico é o mesmo — executando o guard dentro do harness confinado.
Divergência é falha de integração: uma policy escopada
(`project = spectree-squad`) não pode deixar de existir porque o
processo entrou no namespace; `outer deny + inner no-matching-policy`
seria bypass.

## 54-55. Governance matrix

O guard continua usando `squad.policies.json`; a F9 não cria segunda
matriz. Novas policies só com teste de alcançabilidade e necessidade de
autoridade real — `credential/* -> approval-required` é o primeiro caso.
(Emenda 4: `credential-founder-gate` é runtime-only; nenhum detector
artificial no guard.)

## 56. Guard surface limitation

A matriz interna cobre as operações atualmente detectadas pelo guard;
MCP, Read, WebFetch, Task e outros mecanismos não passam pelo mesmo
detector nesta fase. Formulação correta: o processo de harness é
governado pela fronteira externa; as operações que o guard conhece são
adicionalmente governadas pelo guard interno. Nunca "o agente está
completamente governado".

## 57. Harness execution effects

EffectSet antes do spawn. Mínimo: `process.spawn -> process://workspace`
e `process.spawn -> process://executable/<name>`; mais
`filesystem.read credential://...` quando a calibração declarada exigir.

## 58. Credential effect authorization

A credencial nunca entra automaticamente no Sandbox:

```
credential configuration -> EffectResolver ->
filesystem.read(credential/...) -> Policy -> approval-required ->
Founder approval -> Sandbox
```

## 59-60. Fingerprint e resume

O fingerprint correlaciona effects, decisões, approval, sandbox,
execution e audit. Mudança de credential resource altera o fingerprint.
Resume com credential alterado/removido -> EffectRevalidationError.

## 61. Sandbox physical enforcement

O functional probe da F7 continua sendo o gate físico. Credential
calibration não é prova de sandbox: calibration = "o harness funciona
com este recurso"; functional probe = "o backend aplica a boundary".

## 62-64. Linux / WSL2 / Windows / CI

F9 física é Linux-first (Linux e WSL2 sob o modelo da F7; WSL2 é
execution host, não security boundary). Windows: physical harness
confinement = expected unavailable. CI: `linux-physical-harness` executa
o caminho físico e FALHA se o functional probe não funcionar; Windows
registra expected unavailable. Não existe all-skipped -> green no Linux.

## 65-66. Example

`npm run example:model-harness` mostra launcher -> EffectSet -> Policy
-> Sandbox -> ProcessProvider -> harness -> outcome, sem depender do
Invoker. O exemplo não publica credencial, não imprime token, não copia
HOME, não usa shell string, não usa danger-full-access para esconder
incapacidade. Sem configuração de credencial: sai com "confined harness
unavailable" explícito em vez de desativar segurança.

## 67-69. Model harness output

O adapter transforma a saída do CLI em resultado normativo: collect ->
validate format -> parse -> report truncation -> return outcome. JSON
inválido sob formato declarado = structured-output-failure, nunca
resposta bem-sucedida. stderr permanece canal diagnóstico; stdout é
resposta somente quando o adapter prova o formato contratado.

## 70. Credential calibration versus CI

O credential probe não é requisito de `npm test` nem do Functional
Probe. O CI testa configured profile, physical enforcement, fail-closed.
A calibração real é operação deliberada do Founder.

## 71-73. Configuration provenance

A configuração da calibração registra: credential candidate identity,
probe date, probe verdict, CLI adapter version, output mode — sem
secret, token ou caminho absoluto. Calibração não é eterna: mudanças de
credential location, auth behavior, output contract ou CLI invocation a
invalidam. O record inclui identidade do adapter (ex.:
`claude-model-harness@1`); mudança incompatível exige recalibração.

## 74-76. Sem Invoker, sem Agent.run()

A F9 funciona sem o Invoker (testes chamam o launcher/adapter seam
diretamente) e não exige `Agent.run()`. O Runtime controla o envelope
físico e normativo, não a lógica interna do modelo.

## 77-78. No Shell

O harness executa por argv explícito. `sh -c "claude -p ..."` é proibido
como mecanismo interno. Nenhuma autorização deriva de
`filesystem.write(cwd)`: o EffectSet é declarado pelo adapter/Tool.
Shell pertence à F10.

## 79-80. Failure semantics

Categorias diferenciadas, nenhuma mascara outra: EffectResolutionError,
EffectAuthorizationError, EffectRevalidationError,
SandboxUnavailableError, SandboxDeniedError, ProcessSpawnError,
structured-output-failure, timed-out. O calibration runner produz
AUTH_OK / AUTH_INSUFFICIENT / RUNNER_FAILURE; não existe UNKNOWN
silencioso — sem classificação segura, RUNNER_FAILURE.

## 81-87. R8

- ModelHarnessLauncher: superfície pública travada estruturalmente.
- Adapter isolation: `claude`, `-p`, `--output-format` somente no
  adapter; teste estrutural falha fora dele.
- Calibration result: superfície mínima; sem hostPath, secret, token,
  environment, raw stderr/stdout sem contrato.
- Process outcome: `timedOut` entra com atualização do teste de
  superfície no mesmo PR.
- Agent isolation: Agent não conhece ModelHarnessLauncher.
- Provider isolation: LocalSubprocessProvider não conhece Claude,
  ModelHarness, CredentialProbe, calibration.
- Sandbox isolation: SandboxProvider não conhece Claude/OpenAI/
  Anthropic/model/harness; credential é abstraído pelo modelo de
  Effects.

## 88-91. Events e correlation

Reutiliza os eventos das F6/F7/F8; `harness.*` só se acrescentar
semântica real (caso contrário, `process.*`). Correlação por sessionId,
toolUseId/invocationId, effectSetFingerprint, sandboxInstanceId, process
invocationId. Nenhum evento publica argv completo, stdin, environment,
credential path absoluto, credential contents, model output inteiro ou
secret sem projeção segura. Mesmo com audit unavailable, o pai observa
`process.*`, `effect.*`, `policy.*`, `sandbox.*`.

## 92-93. Credential risk statement (alcance corrigido no #29)

**Nesta fase, um harness confinado pode ler e exfiltrar TUDO o que o
binding aprovado alcança. O confinamento da F9 é de filesystem/processo,
não de segredo.** O alcance é o do DEGRAU aprovado na calibração: um
binding de arquivo expõe aquele arquivo; um binding de DIRETÓRIO expõe
tudo sob ele — no caso de `~/.claude`, isso significaria credencial MAIS
`projects/` (o transcript de toda sessão de todo projeto da máquina),
plugins, config e memória. Por isso a escada é norma (§12) e o record
registra o degrau. Propriedade de segurança do sistema, não nota
operacional. `CredentialBroker` fica registrado como mecanismo futuro.

## 94-95. Sem network/environment effects

`network.*` e `environment.*` permanecem reservados. Controle de
ambiente continua ProcessSpawnSpec + allowedEnvironmentKeys +
buildProcessEnvironment.

## 96. Known limitations (mínimo declarado)

1. credential material pode ser exfiltrado pelo processo se montado;
2. network não possui enforcement adicional; 3. environment é allowlist,
não Effect kind; 4. credential probe é calibração manual; 5. calibration
depende do comportamento real do CLI; 6. output estruturado possui
orçamento; 7. truncation de output estruturado é falha; 8. tree
termination é best-effort; 9. observed effects do SO não existem;
10. guard cobre somente as superfícies que detecta; 11. MCP/Read/
WebFetch/Task fora da governança interna do guard; 12. Invoker não é
dependency; 13. Shell fora da fase; 14. Windows físico indisponível;
15. CredentialBroker não existe; 16. physical resource narrowing da F8
evolui nesta fase apenas para os recursos declarados (Emenda 1).

## 97. Acceptance criteria

1. `process` classificado no Sandbox Profile. 2. `ModelHarnessLauncher`
genérico. 3. Adapter concreto de Claude. 4. Literais do Claude isolados
estruturalmente. 5. Adapter produz ProcessSpawnSpec sem Shell.
6. EffectSet antes do spawn. 7. Credential resource = `filesystem.read`.
8. Policy `credential/* -> approval-required`. 9. Com teste de
alcançabilidade. 10. Calibration produz auth-ok / auth-insufficient /
runner-failure. 11. Calibration não roda em `apply()`. 12. Calibration
não publica segredo. 13. HOME inteiro nunca é candidato aprovado.
14. Resultado C produz fail-closed verificável. 15. HOME env não implica
filesystem HOME. 16. Environment adicional é explícito.
17. `maxLifetimeMs` controlado pelo Runtime. 18. Timeout com semântica
explícita. 19. Output default 1 MiB. 20. Hard ceiling 16 MiB. 21. Output
estruturado truncado falha. 22. Spill bounded. 23. ProcessRegistry dono
do lifecycle. 24. Session encerra o harness. 25. Guard interno como
defense in depth. 26. Guard audit unavailable explícito. 27. Project
identity host == child provada. 28. CI Linux executa fisicamente o
harness. 29. CI Windows registra expected unavailable. 30. Linux sem
backend físico = CI vermelho. 31. `npm run example:model-harness`
existe. 32. Exemplo não usa danger-full-access para mascarar.
33. `npm test` verde. 34. `claude plugin validate . --strict` verde.
35. F1–F8 verdes.

## 98. Testes obrigatórios

model-harness-contract, model-harness-launcher, credential-calibration,
credential-policy, model-harness-output, model-harness-lifecycle,
model-harness-project-identity, model-harness-surface,
model-harness-integration, linux-model-harness-physical.

## 99-114. Asserções obrigatórias

- **99**: Policy -> EffectSet -> Sandbox -> LocalSubprocessProvider ->
  Bubblewrap -> Model Harness sob workspace-write com process
  confinement full.
- **100**: same-world — a missão cria/altera arquivo no workspace e o
  host observa o mesmo recurso físico (F7 same-world + F8 resource
  identity + F9 harness numa única cadeia).
- **101**: outside filesystem negado fisicamente, não por JavaScript.
- **102**: HOME no env, leitura de caminho do HOME falha sem mount.
- **103**: credential resource visível SOMENTE depois de Policy +
  Founder approval + EffectSet + Sandbox.
- **104**: policy deny `credential/*` impede o spawn completamente.
- **105**: approval-required `credential/*` produz UMA approval com
  fingerprint + effects projetados, sem secret/raw input/host path.
- **106**: alterar o EffectSet entre approval e resume ->
  EffectRevalidationError sem execução.
- **107**: JSON acima do orçamento (`truncated = true`) ->
  structured-output-failure, nunca resposta parcial.
- **108**: `maxLifetimeMs` expira -> AbortSignal -> graceful -> graceMs
  -> terminate tree -> outcome identificado como timeout.
- **109**: encerrar a Session não deixa harness órfão no modelo de
  lifecycle controlável.
- **110**: guard dentro do namespace resolve o mesmo project identity do
  host.
- **111**: sink ausente -> audit unavailable + execução observável
  externamente.
- **112**: teste estrutural falha se `claude`/`-p`/`--output-format`
  aparecerem fora do adapter.
- **113**: launcher constrói `argv[]`, nunca shell command string.
- **114**: credential failure -> no spawn; sandbox unavailable -> no
  spawn; nenhum fallback para HOME/danger-full-access/unconfined.

## 115. Result matrix

**A**: credential not needed, confined harness works. **B**: minimal
credential proven + effect declared + approval + confined harness works.
**C**: confined harness impossible + fail-closed proved +
danger-full-access remains governed-but-unconfined. **Não existe D:
"relax security so the example works".**

## 116-118. Invariante arquitetural

Model Harness **is a process** — não "a special kind of Agent". Um
segundo harness entra criando apenas `AnotherModelHarnessLauncher` +
calibration + configuration + tests, sem alterar PolicyEngine,
SandboxProvider, LocalSubprocessProvider, Agent, ProcessRegistry. O
Invoker poderá usar o mesmo contrato; o Runtime não conhece o Invoker.

## 119. Fase 10 boundary

A F9 NÃO cria Shell, PTY, Terminal, interactive stdin. O contrato
permanece argv, stdin, stdout, stderr.

## 120. Definition of Done

A F9 estará CLOSED quando pudermos provar: "um harness real de modelo
nasceu como processo governado, teve seus efeitos autorizados, foi
fisicamente confinado em Linux, recebeu somente o ambiente declarado,
teve lifecycle pertencente à Session, produziu outcome limitado e
honesto, e seu guard interno não criou uma rota paralela de autoridade."
No caso de credencial: "o acesso não foi presumido; foi calibrado; foi
declarado como efeito; passou pela Policy; passou pelo Founder; e foi
montado somente depois." No caso de resultado C: "o Runtime provou que
não consegue confinar o harness com a fronteira disponível, e recusou
nascer em vez de mentir."

---

## Emendas normativas aprovadas (TechLeader, 2026-08-20)

**E1 — `declaredResources` (obrigatório).** Primeira implementação
concreta do physical resource narrowing da F8:

```
ExecutionEffectSet autorizado -> SandboxPolicy.declaredResources ->
physical backend -> --ro-bind pontual
```

Contrato: `readonly declaredResources: readonly [{ resourceId: string,
physicalPath: string, mode: "read" }]`. Invariantes: EffectSet
autorizado é a única fonte; physicalPath nunca fornecido por Agent/Tool;
read-only nesta fase; Object.freeze(); R8 obrigatório.
**declaredResources não é nova autoridade — é materialização física de
recursos já autorizados pelo EffectSet.**

**E2 — `maxLifetimeMs` por DI.** Runtime configuration -> Provider. O
ProcessSpawnSpec pode restringir (`requested <= ceiling`); `requested >
ceiling` -> reject. Sem default mágico no adapter. `timedOut` é fato
persistido no outcome, não inferido; R8 no mesmo PR.

**E3 — Conformance harness.** O CI usa um stand-in determinístico
(**conformance harness**: physical bubblewrap, zero network, zero quota)
que prova "o contrato Governed Model Harness funciona fisicamente". A
calibração real do Claude prova outra coisa: "este adapter concreto
consegue operar dentro do contrato". O teste físico não valida o Claude.

**E4 — `credential-founder-gate` runtime-only.** Matriz única
(`squad.policies.json`); alcançabilidade provada pelo Effect Pipeline da
F8; nenhum detector artificial no guard.

**E5 — Texto commitado é o contrato.** Spec -> arquivo commitado ->
Founder APPROVE -> implementação. Nunca implementar contra versão
"quase igual" da conversa.

**E6 — Piso do binding (reviews do Founder, PRs #28 e #29).** DUAS
mudanças, declaradas como duas:

1. *Correção de escopo*: o INV-906 estava enforçado na calibração — o
   lado sem autoridade. Corrigido: a invariante é do BINDING (ver
   INV-906 acima), com defense in depth no padrão da F4 (proposta E
   binding vetam), semântica igual-ou-ancestral nos dois lados, e um
   teste por recusa.
2. *Saída do `~/.claude` da proibição nominal*: a regra mecânica
   (HOME-ou-ancestral) substituiu a proibição por nome — o que tornou o
   diretório `~/.claude` INTEIRO um binding tecnicamente possível. A
   compensação é dupla e normativa: a escada por granularity (§12 —
   diretório só depois de os degraus estreitos falharem, degrau
   registrado no record) e o risk statement nomeando o alcance real do
   binding aprovado (§92).

E o piso não tem interruptor (Item 1 do #29): com `declaredResources`
não-vazio — ou calibração com candidatos — HOME irresolúvel é
`SandboxConfigurationError`, nunca um veto que silenciosamente não se
aplica. `homePath` é injetável no wiring (como o `workspaceRoot`), com
`os.homedir()` apenas como fallback.
