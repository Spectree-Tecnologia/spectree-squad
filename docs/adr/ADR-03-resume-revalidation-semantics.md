# ADR-03 — Semantica de revalidacao e consumo no resume de approval

No resume de uma approval aprovada, a revalidacao de Policy considera a
exigencia satisfeita quando a decisao vigente e `allow` OU
`approval-required` vindo do MESMO policyId que originou o pedido; deny ou
policy nova bloqueiam com PolicyRevalidationError. O consumo atomico
`approved -> resumed` acontece DEPOIS da revalidacao e imediatamente antes
da execucao; falha de revalidacao deixa a approval em `approved`.

## Alternativas descartadas

- **So `allow` satisfaz** (leitura literal da spec secao 42): com a policy
  inalterada, a decisao continua `approval-required` e nenhuma approval
  seria jamais executavel — contradiz o cenario 1 da secao 95
  ("revalidate -> allow"). A aprovacao humana satisfaz exatamente a
  exigencia que a criou; policyId igual e o vinculo.
- **Consumir antes de revalidar**: falha de revalidacao queimaria a
  approval (resumed sem execucao), e `approval.resumed` mentiria — a spec
  secao 31 define o evento como "reabriu apos aprovacao E revalidacao".
- **Marcar a approval como falha apos revalidacao negada**: nao existe
  estado para isso na maquina minima; deixa-la `approved` permite retry do
  operador sem loop automatico (secao 21), e o deny vigente da Policy
  continua bloqueando qualquer tentativa.
