# Spectree Runtime — Normative Specifications

## Status

As Fases 1 a 8 foram implementadas antes da preservação das especificações
normativas neste repositório.

Consequentemente, referências históricas no código como `§127`, `INV-724`
e equivalentes podem apontar para documentos que não estão versionados
neste repositório. Essas referências são históricas e não resolvíveis.

A partir da Fase 9, a especificação normativa de cada fase passa a ser
versionada junto ao Runtime, separada dos ADRs.

## Distinção

- `docs/spec/` contém o contrato normativo verificável da fase.
- `docs/adr/` contém as decisões arquiteturais duráveis e suas
  alternativas descartadas.
- `docs/architecture/` contém a visão consolidada da arquitetura atual.

## Processo

A partir da Fase 9:

```
Founder Brief
  -> Normative Spec
  -> Approval
  -> ADR
  -> Implementation
  -> TechLeader Review
  -> Merge
```

Uma spec com `status: approved` é contrato. Alterar uma spec aprovada
rebaixa seu status para `in-review` e invalida a implementação
correspondente até nova aprovação.

O texto commitado é o contrato real: implementação nunca acontece contra
uma versão "quase igual" vinda de conversa.
