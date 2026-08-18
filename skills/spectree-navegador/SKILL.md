---
name: spectree-navegador
description: Dirigir a interface real e medir numero - Playwright para comportamento, Chrome DevTools para medicao. Use ao verificar tela, depurar UI, aferir tempo, contraste ou acessibilidade.
---

# Navegador ao vivo

Regra de escolha: **Playwright dirige, DevTools mede.** Comportamento se
prova com Playwright e com a suíte; número se mede com DevTools.

Suba o app antes (`npm run dev`) ou reaproveite o que já estiver de pé. Sem
o MCP no projeto, use a suíte via Bash e reporte a ausência.

## Dirigir — Playwright

- `browser_snapshot` é a leitura padrão: árvore de acessibilidade, barata e
  afirmável em texto. `take_screenshot` fica para verificação visual.
- O navegador encurta a depuração. A prova de que algo funciona continua
  sendo teste commitado rodando verde — o que passou só na tela some com a
  sessão.
- Exploração escreve no banco local. Conte ao Disruptor o que você criou, ou
  peça reset antes de medir.

## Medir — Chrome DevTools

- **Teto de tempo:** `performance_start_trace` +
  `performance_analyze_insight` acham onde o tempo vai;
  `list_network_requests` separa servidor (TTFB) de cliente (main thread).
  Percentil escrito à mão é estimativa; trace é medição.
- **Throttle antes de aprovar tempo:** meça também sob `emulate`, com CPU e
  rede degradadas. Teto aprovado só em stack local costuma mentir em
  produção.
- **Contraste e acessibilidade:** `lighthouse_audit` afere o que o
  `docs/DESIGN.md` especificou. Número documentado no DESIGN e reprovado
  aqui é violação dura.
- `take_heapsnapshot` entra sob suspeita de vazamento, fora da rodada
  padrão.

Gargalo que o trace localizar no banco é bloqueio para Oracle e Rubick.
