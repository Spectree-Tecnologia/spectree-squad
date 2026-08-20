# ADR-06 — Process como Capability governada

status: approved
owner: rubick
updated: 2026-08-20
approved: 2026-08-20
depends_on: docs/adr/ADR-05-sandbox-execution-boundary.md

## Contexto

Depois do Sandbox, a pergunta inevitavel: como um agente executa um
comando? A resposta ingenua — uma tool `run_command(command: string)`
passando por um shell — reintroduziria de uma vez tudo o que as fases
1-5 eliminaram: autoridade ambiental, interpretacao implicita,
fronteira nenhuma.

## Decisao

1. **Process e uma Capability.** Passa por Policy, Approval, Capability
   gate e Sandbox como qualquer operacao fisica.
2. **Shell NAO faz parte desta fase.** Process executa argv; Shell
   interpreta linguagem. Um futuro ShellProvider CONSUMIRA process.
3. **`argv` nunca e shell-interpreted.** `argv[0]` = executavel, resto =
   argumentos literais. Nao existe `shell: true`.
4. **Process e separado de Terminal.** PTY, sessao interativa e resize
   pertencem a uma futura Terminal Capability.
5. **Sandbox e aplicado ANTES do spawn.** Nao existe rota
   spawn-primeiro-confina-depois; o confinamento existe antes da
   primeira instrucao do processo.
6. **A arvore pertence ao lifecycle.** `terminate()` escala
   graceful -> graceMs -> forcado e alcanca descendentes (process
   group no posix, taskkill /T no win32) — declarado best effort,
   nunca inflado a full.
7. **Ambiente e explicitamente controlado.** Allowlist minima, scrub de
   `SPECTREE_*` herdado, overrides explicitos, managed vars por ultimo.
   Credencial do host nao entra por default.
8. **Output e limitado.** `maxBytes` obrigatorio no collect;
   `truncated` explicito; spill opcional e limitado, dentro do mundo do
   Sandbox.
9. **`terminate()` e a unica API publica de encerramento**, tree-scoped
   quando o backend permite; kill/forceKill/signal nao sao superficie.
10. **Fail closed.** Sandbox exigido e indisponivel = zero processo.
11. **Process e Filesystem compartilham execution world.** O arquivo
    que o processo cria e o arquivo que o filesystem provider le — um
    unico mundo, preparando container/remote/microVM futuros.
12. **Self-provided nao bypassa.** A capability declara `providerOnly`
    e o ToolRuntime recusa tool de process com execute() proprio — o
    Provider e o gate unico.

## Alternativas descartadas

**`run_command(command: string)` com shell.** Reintroduz interpretacao
implicita e uma superficie de injecao inteira. Descartada em definitivo
— nem como conveniencia de exemplo.

**Handle exposto ao Agent.** O Agent aguardaria/pilotaria processos
diretamente, criando lifecycle fora da Session. Descartada: o handle e
seam interno; o Agent recebe outcome.

**Persistencia de processos atraves de crash do Runtime.** Fora de
fase; a mitigacao e cleanup por grupo/arvore, e a limitacao fica
declarada.

## Consequencia

A proxima camada (Shell) nasce como SEMANTICA sobre process — parser de
comando de um lado, `process.spawn` do outro — sem que o Provider de
processo cresca para virar um executor gigante. Depois dela, Terminal
= process + PTY + sessao interativa. A ordem e deliberada.
