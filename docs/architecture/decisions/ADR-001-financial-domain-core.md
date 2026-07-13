# ADR-001 — Núcleo inicial do domínio financeiro

- **Status:** Aceito para a Fase 1A
- **Data:** 2026-07-13

## Contexto

O primeiro fluxo financeiro será contas a pagar. Contas a receber, calendário e projeção são evoluções conhecidas, mas ainda não possuem regras validadas. A fundação atual contém somente empresa, usuário e vínculo de empresa.

## Problema

É necessário escolher entre agregados específicos, uma tabela financeira genérica ou um núcleo persistente compartilhado sem criar uma abstração que imponha invariantes ainda desconhecidos.

## Alternativas

### A — `Payable` e, futuramente, `Receivable`

- domínio e API explícitos;
- menor quantidade de campos e estados condicionais;
- pode repetir campos comuns quando recebíveis forem introduzidos;
- unificação futura de calendário e projeção exige um modelo de leitura.

### B — `FinancialEntry` com discriminador

- facilita consultas unificadas no início;
- acopla pagar e receber a uma única máquina de estados;
- tende a acumular campos nulos, validações por tipo e permissões condicionais;
- torna alterações específicas mais arriscadas.

### C — núcleo persistente com especializações

- explicita campos compartilhados e permite detalhes específicos;
- introduz joins, cardinalidades e ciclo de vida compartilhado antes de existir um segundo agregado;
- tem custo próximo ao modelo genérico sem evidência suficiente de benefício no MVP.

## Decisão

Adotar a alternativa A: `Payable` será o agregado e a tabela de escrita da Fase 1A. `Receivable` será avaliado como agregado separado quando suas invariantes forem conhecidas.

Não será criada tabela `FinancialEntry`, hierarquia persistente, pacote compartilhado ou interface genérica sem segundo consumidor. Elementos realmente comuns podem existir dentro do módulo como tipos pequenos e consumidos imediatamente, como datas civis, estado e validação monetária.

O calendário e a projeção futuros consumirão um modelo de leitura unificado, inicialmente composto a partir de `Payable` e, depois, `Receivable`. Esse modelo de leitura não será a fonte de verdade das escritas.

## Estados mínimos

Persistir somente:

- `OPEN`;
- `PAID`;
- `CANCELED`.

`OVERDUE` será derivado de `OPEN` e `dueDate`. `DRAFT` não entra porque não há fluxo de rascunho. `ARCHIVED` é preferência de visualização. Aprovação, importação e pagamento parcial não criam estados antes de seus fluxos existirem.

## Dinheiro

O banco armazenará `amount` em `DECIMAL(19,2)` e `currencyCode` com três caracteres. O domínio utilizará um objeto de valor pequeno `Money`, independente do Prisma, com valor decimal canônico em string e moeda. A API receberá e devolverá o valor como string.

Na Fase 1A:

- o valor deve ser positivo;
- mais de duas casas decimais são rejeitadas, nunca arredondadas implicitamente;
- a moeda é copiada da empresa na criação;
- somente moedas com duas casas e explicitamente suportadas podem criar títulos;
- mudança posterior da moeda da empresa não reescreve o título.

Moedas com outra quantidade de casas exigirão revisão da escala e da política monetária antes de serem habilitadas. Aumentar a escala do decimal é uma evolução aditiva possível; não será simulada agora.

## Consequências

- O domínio de escrita permanece legível e pequeno.
- Calendário e relatórios precisarão de adaptação/read model, não de uma tabela central prematura.
- Alguns campos podem ser repetidos em `Receivable`; extração só ocorrerá com invariantes comprovadamente comuns.
- O status persistido e as liquidações deverão ser atualizados na mesma transação.

## Riscos

- Duplicação futura entre pagar e receber.
- Divergência entre read model futuro e tabelas de origem.
- `DECIMAL(19,2)` não atende automaticamente moedas com escala diferente.

## Itens adiados

- `Receivable`;
- modelo de leitura de calendário e projeção;
- pagamento parcial;
- recorrência, aprovação e importação;
- conta financeira e saldo;
- moedas com escala diferente de dois.

## Gatilhos para reavaliar

- início de contas a receber;
- três ou mais consumidores precisarem da mesma consulta financeira;
- necessidade aprovada de moedas sem duas casas;
- regras comuns comprovadas superarem as regras específicas.
