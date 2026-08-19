---
name: spectree-testes
description: Costuras de teste do projeto - onde o teste mora, quem decide e o que conta como prova. Use ao definir estrategia de teste, escrever teste ou validar entrega.
---

# Costuras de teste

Uma **costura** é a fronteira pública onde o comportamento se observa. Teste
mora em costura, e a lista de costuras do projeto vive na sua própria ADR —
`docs/adr/ADR-NNN-costuras-de-teste.md`. Para o formato do arquivo, Call
the Skill tool with "spectree-artifacts".

## Quem decide, quem escreve, quem confere

- **Rubick decide.** A ADR de costuras é obrigatória antes do primeiro
  código: quais costuras existem (unit, integração, e2e), o que cada uma cobre, qual
  ferramenta, e o que deliberadamente fica de fora em cada camada. Ela vai
  ao Founder antes de a ADR fechar — estratégia de teste errada só dá sinal
  no veredito do QA, quando o custo já foi pago.
- **Jakiro escreve** na costura que o ADR manda. Costura certa inexistente é
  bloqueio para o Rubick, não escolha do dev.
- **Keeper procura evidência** nas mesmas costuras. Se precisou de sonda
  própria para validar, a costura está faltando: reporte junto com o
  veredito.

## O que conta como prova

Comando executado, com saída. Cada critério de aceite fecha com teste que
roda verde; leitura de código e inspeção visual sustentam entendimento, não
veredito.
