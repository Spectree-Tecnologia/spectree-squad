---
name: spectree-wizard
description: Gerar um wizard bash interativo para os passos que so o humano pode dar - provisionar servico, capturar credencial, navegar painel de terceiro, executar cutover. Use quando o AI FIRST esbarra no limite do que o agente alcanca.
---

# Wizard

O princípio AI FIRST manda executar tudo que estiver ao alcance. **O wizard
é o que fazer com o resto** — o passo que exige um humano num painel de
terceiro, com um cartão, ou aceitando um termo. A resposta certa para isso é
um script executável, não um parágrafo de instruções que precisa ser
reexplicado a cada vez.

**Antes de escrever, confirme que o passo é mesmo humano.** CLI instalada,
MCP conectado ou API com credencial em mãos resolvem sozinhos — e aí o
wizard seria fuga do AI FIRST, não a fronteira dele.

## A biblioteca já existe

`${CLAUDE_PLUGIN_ROOT}/skills/spectree-wizard/template.sh` traz a UX pronta:
contador de etapas, tela limpa por etapa, abertura de URL multiplataforma
(Linux, macOS, WSL e Git Bash no Windows), entrada oculta para segredo,
upsert idempotente no `.env`, publicação via `gh secret`/`gh variable`,
confirmação antes de ação irreversível e resumo final.

Copie o arquivo e **edite apenas o bloco `STAGES`**. A biblioteca acima do
marcador é idêntica em todo wizard — a consistência é o ponto.

## Processo

**1. Escopo, lendo o repositório primeiro.** Levante cada passo manual e
cada valor capturado antes de perguntar qualquer coisa: `.env`,
`.env.example`, `README`, `docker-compose*`, config do framework e
`.github/workflows/*` — toda referência a `secrets.*` e `vars.*` é um valor
que o wizard precisa produzir. Depois mostre ao Founder a lista ordenada de
etapas e os valores de cada uma, para ele acrescentar, remover ou reordenar.

Para cada valor, saiba: onde a pessoa obtém, onde ele é gravado (`.env`,
secret do GitHub, os dois, ou lugar nenhum quando a etapa é pura ação), e se
é segredo.

**2. Trajeto de cada etapa.** Escreva o caminho exato: qual URL abrir, o que
fazer lá, onde o valor aparece — "Dashboard → Developers → API keys →
Reveal → copiar". Onde você desconhece a interface atual ou o comando
exato, diga isso e consulte a documentação ou o Founder; passo inventado
manda a pessoa procurar um botão que não existe.

**3. Autoria.** Uma chamada `stage` por etapa, em ordem de dependência,
`TOTAL_STAGES` ajustado. Abra a URL antes de pedir o valor dela, use
`ask_secret` para tudo que é segredo, `write_env` em todo valor persistido,
`set_secret` só no que o CI consome, e `confirm` antes de qualquer ação
irreversível. Cada `stage` limpa a tela: mantenha uma tarefa por etapa para
nada que a pessoa precisa ler sair de vista.

**4. Verificação e entrega.** `bash -n` no script, `shellcheck` se
disponível, `chmod +x`. **Confira estaticamente em vez de executar** — o
script abre navegador e bloqueia esperando digitação. O traço a conferir:
todo valor do passo 1 é capturado e vai para onde o passo 1 disse, e todo
`set_secret` casa com uma referência `secrets.*` no CI.

## Segredo

Valor de segredo entra por `ask_secret`, vai para `.env` (que o git ignora)
ou para o cofre do CI, e **não aparece em log, resumo, comentário nem
mensagem para o Founder**. O que se reporta é onde ele foi guardado e como
consultá-lo.

## Ciclo de vida

Wizard é efêmero por padrão: nasce para uma execução, mora em `scripts/` ou
num caminho descartável, e some quando o trabalho termina. Ele vira arquivo
versionado quando o Founder quiser um caminho de setup repetível — e aí o
`README` aponta para ele, para a próxima pessoa rodar o script em vez de
perguntar a uma IA.
