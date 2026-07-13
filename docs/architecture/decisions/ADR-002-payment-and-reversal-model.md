# ADR-002 — Pagamento e estorno

- **Status:** Aceito para a Fase 1A
- **Data:** 2026-07-13

## Contexto

A Fase 1A permite uma única liquidação integral. O histórico não pode ser apagado e um estorno deve preservar o pagamento original. Liquidação parcial, conciliação bancária e ledger contábil estão fora do escopo.

## Problema

Definir uma estrutura simples que impeça dupla liquidação e possa evoluir sem transformar o MVP em ledger ou Event Sourcing.

## Alternativas

### A — `PayablePayment` e `PayablePaymentReversal` específicos

É explícita e simples, mas pode incentivar regras duplicadas quando recebimentos surgirem se não houver revisão posterior.

### B — `FinancialMovement`

Unifica pagamento, recebimento, estorno e ajuste, mas introduz semântica de ledger, discriminadores e invariantes que a Fase 1A não necessita.

### C — pagamento imutável e registro associado de reversão

Mantém o conceito de pagamento no agregado, preserva o original e representa a correção sem apagar fatos.

## Decisão

Adotar a alternativa C com armazenamento específico:

- `PayablePayment` registra a liquidação integral e é imutável;
- `PayablePaymentReversal` é um registro imutável, associado ao pagamento original;
- cada pagamento admite no máximo um estorno na Fase 1A;
- não haverá `FinancialMovement`, ledger, partidas dobradas ou event sourcing.

A presença de um registro de estorno invalida financeiramente o pagamento sem modificá-lo. O título mantém `status` persistido para o workflow e para consultas. Pagamento, estorno, transição do título e auditoria são gravados na mesma transação.

## Transições

```text
OPEN --pay in full--> PAID
PAID --reverse payment--> OPEN
OPEN --cancel--> CANCELED
```

O estado `PAID` exige um pagamento sem estorno. `CANCELED` não pode receber pagamento. Divergências entre status e registros de liquidação são falhas de integridade, não estados tolerados.

## Duplicidade e concorrência

- operações de pagamento e estorno exigem chave idempotente;
- a transação bloqueia ou atualiza condicionalmente a linha de `Payable`;
- somente `OPEN` pode ser pago e somente `PAID` pode ser estornado;
- `version` detecta gravações concorrentes;
- `paymentId` é único em `PayablePaymentReversal`;
- valor e moeda do pagamento são copiados do título e não aceitos como autoridade do cliente.

Uma segunda liquidação após um estorno gera um novo `PayablePayment`; o pagamento anterior continua preservado.

## Evolução futura

Pagamento parcial poderá permitir vários pagamentos ativos e calcular valor liquidado e saldo em aberto. Essa evolução exigirá novos estados ou condições derivadas e constraints próprias. Conciliação poderá associar transações bancárias aos pagamentos sem transformar o pagamento em movimento bancário.

## Consequências

- Consultas permanecem diretas no MVP.
- O histórico de correção é reconstruível.
- A consistência entre status e pagamento depende de transação e testes, pois uma `CHECK` não valida outra tabela.
- Recebimentos futuros decidirão se compartilham infraestrutura depois que suas invariantes forem observadas.

## Riscos

- Código que atualize status fora do caso de uso transacional pode gerar divergência.
- Um estorno parcial futuro não cabe na cardinalidade atual.
- Conciliação futura exigirá associação adicional.

## Itens adiados

- pagamento e estorno parciais;
- juros, multa, desconto e ajuste;
- ledger e conta financeira;
- conciliação;
- recebimentos.

## Gatilhos para reavaliar

- primeira necessidade aprovada de pagamento parcial;
- associação com extrato bancário;
- introdução de contas a receber;
- necessidade contábil comprovada de movimentos ou partidas.
