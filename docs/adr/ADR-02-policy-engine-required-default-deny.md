# ADR-02 — PolicyEngine obrigatorio no ToolRuntime, com default deny

A Fase 2 exigia que nenhuma Tool executasse sem decisao de Policy (secao
63: seguranca por construcao). Decidimos tornar `policyEngine` dependencia
obrigatoria do construtor do `ToolRuntime` — um runtime sem engine lanca
`PolicyConfigurationError` — e fazer `createRuntime()` nascer com registry
vazio, que nega tudo por default.

## Alternativas descartadas

- **Engine opcional com fallback allow** — preservaria os testes da Fase 1
  sem edicao, mas criaria uma rota permanente de bypass: bastaria construir
  o ToolRuntime "esquecendo" o engine. O custo real foi pequeno (testes
  registram policies explicitas por tool, secao 55) e o ganho e que o
  bypass e impossivel por construcao, nao por disciplina.
- **Allow-all de desenvolvimento** — proibido pela spec (secao 55): um
  default conveniente em dev viraria o default de producao no primeiro
  copy-paste.
