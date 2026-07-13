# ADR-003 — Estratégia de contraparte

- **Status:** Aceito para a Fase 1A
- **Data:** 2026-07-13

## Contexto

O MVP precisa identificar a quem a obrigação será paga. Não existe cadastro de fornecedores, contratos, cobrança ou política aprovada para documentos pessoais e empresariais.

## Problema

Decidir se uma entidade de contraparte deve existir antes do primeiro título e como preservar o histórico quando nomes ou cadastros mudarem.

## Alternativas

### A — `payeeName`

Entrega o fluxo mínimo e mantém o título autossuficiente, mas não deduplica fornecedores recorrentes.

### B — `Counterparty` obrigatória

Melhora consistência cadastral, porém obriga CRUD, busca, deduplicação, privacidade e ciclo de vida sem uso imediato comprovado.

### C — referência opcional e snapshot obrigatório

É a evolução mais segura quando existir cadastro, mas criar a entidade agora deixaria infraestrutura sem consumidor real além de uma referência dispensável.

## Decisão

Adotar a alternativa A na Fase 1A:

- `payeeName` textual é obrigatório e armazenado no próprio `Payable`;
- não criar `Counterparty` nem `counterpartyId` nesta fase;
- não coletar documento fiscal sem requisito de negócio e privacidade aprovados.

Quando um cadastro de contraparte for necessário, evoluir para a alternativa C de forma aditiva: adicionar `counterpartyId` opcional e manter `payeeName` como snapshot obrigatório. Alterações no cadastro jamais atualizarão títulos históricos.

## Consequências

- Menor escopo de banco, API e interface.
- O usuário digita o favorecido e pode criar variações do mesmo nome.
- Relatórios iniciais agrupados por favorecido textual não terão identidade cadastral forte.
- A introdução futura de `Counterparty` não exige backfill destrutivo: vínculos antigos podem permanecer nulos ou passar por associação assistida.

## Riscos

- duplicidade e erro de digitação;
- busca e agrupamento menos precisos;
- conciliação e contratos futuros precisarão de associação explícita.

## Itens adiados

- cadastro e deduplicação de contrapartes;
- documento fiscal, contatos e dados bancários;
- associação com contratos;
- políticas LGPD específicas desses dados.

## Gatilhos para reavaliar

- usuários precisarem reutilizar favorecidos com frequência;
- contratos ou conciliação exigirem identidade estável;
- relatórios por contraparte não puderem tolerar agrupamento textual;
- cobrança futura exigir contatos ou documento.
