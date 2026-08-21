# LESSONS — licoes aprendidas (append-only)

Consultado por grep de area antes de trabalhar. Cada entrada: data, area,
a licao e a evidencia. Nunca editar entradas antigas; so acrescentar.

---

## 2026-08-20 · runtime/sandbox · Derivar do fato, nunca enumerar os casos

**Licao (Founder, review do PR #29):** piso novo se prova pelo caminho em
que ele NAO dispara, e regra sobre uma propriedade do disco se deriva do
disco — nunca se enumera.

**Evidencia — tres giros do mesmo review, tres instancias do mesmo
defeito:**

| Giro | Defeito | Forma enumerada | Forma derivada |
|---|---|---|---|
| #28 | veto de HOME | igualdade exata (`physical === home`) | relacao de ancestralidade (`isPathWithinOrEqual`) |
| #29 g1 | veto condicional | `if (homePath)` — veto com off-switch | ausencia de referencia = recusa tipada |
| #29 g2 | degrau da escada | rotulo validado em 2 de 3 valores | `statSync` decide; caminho inexistente recusado |

O runtime ja sabia disso em outros lugares — o R12 resolve o realpath do
ancestral em vez de listar caminhos suspeitos; o functionalProbe executa
em vez de confiar em `which` — mas a regra nao tinha chegado nestes tres
pontos. O codigo enumera o que alguem conseguiu imaginar; o fato (o
realpath, a ancestralidade, o stat) esta sempre disponivel e sempre e
mais curto.

**Como aplicar:** ao escrever um veto ou boundary novo, (1) escreva o
teste do caminho em que ele NAO dispara antes do teste em que dispara;
(2) se a regra fala de uma propriedade fisica (tipo de arquivo, caminho,
ancestralidade, existencia), busque a propriedade no sistema em vez de
validar um rotulo declarado.
