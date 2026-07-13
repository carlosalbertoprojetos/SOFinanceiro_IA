# ADR-006 — Estratégia de eventos internos

- **Status:** Aceito para a Fase 1A
- **Data:** 2026-07-13

## Contexto

Calendário, projeção, alertas e notificações podem no futuro reagir a mudanças financeiras. Na Fase 1A, porém, o único consumidor obrigatório é a própria operação transacional e sua auditoria.

## Problema

Decidir se o primeiro agregado precisa publicar eventos em memória ou outbox persistente antes de existir processamento assíncrono.

## Alternativas

### A — nenhum evento interno

Casos de uso atualizam estado e auditoria diretamente na mesma transação. É a solução com menor operação e menos semânticas concorrentes.

### B — eventos de domínio em memória

Desacopla consumidores síncronos, mas cria dispatcher, ordenação e tratamento de falhas sem segundo consumidor.

### C — outbox persistente

Garante entrega para consumidores assíncronos, porém exige worker, retries, monitoramento, retenção e idempotência de consumo.

## Decisão

Adotar a alternativa A na Fase 1A.

- não criar dispatcher, eventos em memória ou outbox;
- auditoria não é barramento de eventos nem fonte oficial do estado;
- o estado oficial permanece em `Payable`, `PayablePayment` e `PayablePaymentReversal`;
- calendário e projeção iniciais poderão consultar modelos de leitura derivados das tabelas oficiais;
- efeitos obrigatórios da Fase 1A são executados sincronicamente na mesma transação.

Uma outbox se torna necessária quando surgir o primeiro efeito assíncrono que precise sobreviver à queda do processo, como notificação externa, webhook, job de recorrência ou integração. Nesse momento, publicação do evento e mudança financeira deverão compartilhar a mesma transação, e consumidores precisarão de idempotência.

## Consequências

- Menos infraestrutura e menos modos de falha no MVP.
- Auditoria continua com objetivo próprio.
- Futuros consumidores não poderão depender retroativamente de eventos que nunca foram publicados; deverão iniciar de um marco ou fazer backfill explícito.

## Riscos

- acoplamento excessivo se efeitos futuros forem adicionados diretamente ao caso de uso;
- tentativa de usar auditoria como fila;
- introdução tardia de outbox sem plano de backfill.

## Itens adiados

- eventos `PayableCreated`, `PayablePaid` e equivalentes;
- outbox, worker, retries e dead-letter;
- contratos de eventos e versionamento.

## Gatilhos para reavaliar

- primeiro consumidor assíncrono;
- primeira integração externa;
- notificações ou recorrências;
- necessidade comprovada de desacoplar mais de um consumidor síncrono.
