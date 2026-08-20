# ADR-01 — Runtime em JavaScript puro, zero dependências, contratos em JSDoc

O repositório era um plugin de markdown sem stack de código. Para a Fase 1
do Spectree Runtime escolhemos JavaScript ESM puro com contratos em JSDoc e
testes no `node:test`, com zero dependências — nada de `npm install`, nada
de build; `node --test` prova tudo, o que atende INV-008/009/010 por
construção.

## Alternativas descartadas

- **TypeScript** — contratos mais fortes, mas traria as primeiras
  dependências (`typescript`, runner) e um passo de build a um repo que
  hoje instala como plugin puro. A migração futura é mecânica porque os
  contratos já estão documentados em JSDoc; o gatilho para reabrir esta
  decisão é o runtime ganhar consumidores externos ao repo.
