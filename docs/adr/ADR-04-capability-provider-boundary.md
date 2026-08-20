# ADR-04 — Fronteira Capability / Provider, e o catalogo como gate

A Fase 4 separou tres identidades que costumam colapsar numa so: Tool
(operacao solicitavel), Capability (contrato do que o runtime sabe fazer)
e Provider (implementacao fisica). A Tool nao conhece o Provider, o
Provider nao conhece a Policy, e o CapabilityRegistry deixou de ser
catalogo informativo para ser gate obrigatorio de execucao — capability
nao registrada bloqueia, inclusive o fallback de tool legada.

## Alternativas descartadas

- **Tool -> providerClass direto**: acoplaria a operacao a implementacao e
  impediria trocar local-filesystem por sandbox-filesystem sem tocar as
  Tools (secao 52).
- **Manter o catalogo informativo**: era a semantica da Fase 2, registrada
  no R11 como divida; com Provider real, capability fantasma viraria
  superficie de execucao sem contrato.
- **Gate de capability antes da Policy**: a spec lista essa ordem na secao
  20, mas a preferencia declarada (secao 108) e reduzir exposicao — o
  AuthorizationContext nao precisa do registry, e resolver depois do allow
  garante de graca que approval-required nao resolve Provider (secao 84).
