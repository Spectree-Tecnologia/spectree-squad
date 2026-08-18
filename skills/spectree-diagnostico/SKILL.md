---
name: spectree-diagnostico
description: Loop disciplinado para defeito e regressao de desempenho - laco vermelho antes de hipotese, minimizar, hipotetizar, instrumentar, corrigir, limpar. Use quando algo esta quebrado, falhando, lento ou intermitente.
---

# Diagnóstico

A ordem é a disciplina inteira: **o laço vermelho vem antes da primeira
hipótese**. Ler código para formar teoria sem ter como observar a falha é
como o palpite entra no lugar do diagnóstico — e palpite repassado adiante
vira decisão de outro agente.

## 1. Construa o laço

Um comando executável que fica **vermelho neste defeito** e verifica a
correção depois. Escolha o mais barato que capture o sintoma real: teste
que falha, `curl` num script, invocação de CLI, navegador via Playwright,
trace do DevTools, harness descartável, bissecção do histórico.

O laço precisa ser **determinístico e rápido**. Intermitente: repita até
medir a taxa e suba-a acima de 50% controlando o ambiente (banco limpo,
concorrência fixa, relógio fixo) — só então ele serve de sinal.

**Pronto quando:** um comando reproduz a falha e você pode rodá-lo à
vontade.

## 2. Reproduza e minimize

Confirme que o laço pega **o sintoma que foi relatado**, não um parente
próximo. Depois encolha: remova um elemento por vez, rodando o laço a cada
corte, até cada peça restante ser necessária.

## 3. Hipotetize

Escreva **3 a 5 hipóteses falseáveis, ranqueadas, antes de testar qualquer
uma**. Cada uma no formato: *"se X causa isto, mudar Y faz o sintoma
sumir"*. Ranquear várias de uma vez é o que impede ancorar na primeira
plausível.

## 4. Instrumente

Teste **uma variável por vez**, com log dirigido, debugger ou medição de
linha de base — a instrumentação responde a uma hipótese nomeada. Marque
todo log temporário para remoção.

## 5. Corrija e prove

O teste de regressão vai na costura que a ADR de costuras define (skill
`spectree-testes`) e exercita **o caminho real do defeito**, não uma versão
rasa dele. Veja-o vermelho, aplique a correção, veja-o verde, e rode o
cenário original de novo.

Corrija onde todos os chamadores passam. Remendo no caminho que o relato
citou deixa os irmãos quebrados.

## 6. Feche

Repro original sumiu, instrumentação temporária removida, e a hipótese que
se confirmou registrada na mensagem de commit.

**Sem causa identificada?** Registre assim mesmo no `docs/LESSONS.md`: o
sintoma, as hipóteses descartadas com a medição que as descartou, e o
método para a próxima ocorrência. Um defeito que parou de aparecer continua
aberto — chamar de resolvido é como teste instável vira ruído tolerado, e
no dia em que a falha for real ninguém olha.
