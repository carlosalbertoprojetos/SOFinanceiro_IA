# Plano revisado — Fase 1A: domínio mínimo de contas a pagar

## 1. Decisão de planejamento

Classificação: **full plan**. A fatia afeta identidade, autorização, multiempresa, domínio financeiro, migration, API, interface e rollback. Este documento não autoriza implementação; a execução depende dos gates abaixo.

Estado incremental em 2026-07-13: Fase 1A.1 implementou identidade e tenant; Fase 1A.2 implementou domínio, persistência e cinco endpoints de mutação; Fase 1A.3 implementa consultas e interface mínima de contas a pagar. Calendário, projeção e as demais partes continuam pendentes; este status não marca toda a fase como concluída.

## 2. Objetivo observável

Um usuário autenticado e autorizado cria, consulta, edita e cancela uma conta a pagar de sua empresa, registra uma liquidação integral e pode estorná-la sem perda de histórico ou vazamento entre empresas.

## 3. Contexto confirmado

### Fatos

- A Fase 0 está no commit `258def6` e contém NestJS, Next.js, PostgreSQL e Prisma.
- O schema atual possui somente `Company`, `User` e `CompanyMembership`.
- `Company` possui `currencyCode` e `timezone`.
- Os papéis atuais são `OWNER`, `ADMIN` e `MEMBER`.
- Não existe autenticação, enforcement de tenant ou módulo financeiro.
- Existe uma única migration fundacional e não existem dados financeiros para backfill conhecido.

### Inferências

- Uma migration financeira aditiva pode ser aplicada sem transformar dados financeiros históricos, porque eles não existem no repositório.
- A autenticação precisa anteceder a exposição de qualquer endpoint financeiro.
- Conta financeira, calendário e projeção não são necessárias para provar o ciclo mínimo do título.

### Premissas seguras

- A primeira operação monetária usa BRL e duas casas decimais.
- O primeiro pagamento é sempre integral.
- Não há exclusão de empresa, usuário ou membership durante a Fase 1A; políticas definitivas de deleção precisam ser revistas antes de produção.

### Desconhecidos

- emissor JWT, audience, JWKS/chave e rotação;
- se o `sub` do emissor pode mapear diretamente para o UUID interno;
- política jurídica/contábil de retenção da auditoria;
- requisitos de backup, RPO/RTO e ambiente de produção.

## 4. Escopo

Incluído:

- autenticação verificável mínima e contexto de empresa;
- autorização por membership e papel;
- `Payable`, pagamento integral, estorno, auditoria e idempotência aplicável;
- API versionada;
- interface mínima;
- migration aditiva;
- testes e documentação.

Não escopo:

- calendário, previsão, saldo e conta financeira;
- contas a receber;
- contraparte cadastrada;
- pagamento parcial, parcelas, recorrência, juros, multas ou descontos;
- conciliação, contratos, cobrança, notificações, jobs, outbox e IA;
- autenticação temporária por headers livres;
- ledger, CQRS ou Event Sourcing.

## 5. Decisões incorporadas

As decisões normativas estão nos ADRs em `docs/architecture/decisions/` e no `FINANCIAL_DOMAIN_MODEL.md`.

| Elemento do plano anterior | Classificação | Revisão                                                       |
| -------------------------- | ------------- | ------------------------------------------------------------- |
| `Payable`                  | manter        | agregado específico e fonte de escrita                        |
| `PayablePayment`           | manter        | registro imutável de pagamento integral                       |
| `PayablePaymentReversal`   | alterar       | reversão imutável associada; pagamento original não muda      |
| `PayableAuditEvent`        | alterar       | armazenamento específico sob contrato `AuditRecorder`         |
| `IdempotencyRecord`        | alterar       | obrigatório somente em criar, pagar e estornar                |
| `payeeName`                | manter        | snapshot obrigatório; sem `Counterparty` agora                |
| `companyId` na URL         | manter        | seleção explícita validada por membership                     |
| autenticação verificável   | manter        | adapter JWT e principal abstrato; sem auth temporária         |
| `OPEN`, `PAID`, `CANCELED` | manter        | únicos estados persistidos                                    |
| `Money`                    | substituir    | campos no banco/API protegidos por objeto de valor no domínio |
| calendário e projeção      | remover da 1A | movidos para fatia posterior                                  |
| conta financeira e saldo   | adiar         | não necessários ao ciclo mínimo do título                     |
| liquidação parcial         | adiar         | rejeição explícita                                            |
| eventos/outbox             | remover da 1A | nenhum consumidor assíncrono atual                            |

## 6. Componentes e arquivos previstos

Os caminhos de implementação deverão ser confirmados imediatamente antes do código. Alvos prováveis, coerentes com a árvore atual:

- `prisma/schema.prisma`;
- nova migration em `prisma/migrations/`;
- autenticação/identidade e tenant context em `apps/api/src/`;
- módulo de contas a pagar em `apps/api/src/payables/`;
- testes unitários próximos ao código e integração em `apps/api/test/`;
- rota e componentes em `apps/web/src/app/companies/[companyId]/payables/`;
- documentação em `docs/`.

Não criar `packages/shared` ou `packages/config` enquanto não houver consumo real por mais de uma aplicação.

## 7. Modelo e migration futura

### Tabelas

- `Payable`;
- `PayablePayment`;
- `PayablePaymentReversal`;
- `PayableAuditEvent`;
- `IdempotencyRecord`.

Uma tabela de identidade só será criada em migration separada se o emissor JWT exigir mapeamento `(issuer, subject)` para usuário interno.

### Constraints e índices mínimos

- `amount > 0` e `DECIMAL(19,2)`;
- moeda com três caracteres maiúsculos;
- `version >= 0`;
- coerência entre `CANCELED` e metadados de cancelamento;
- estorno único por pagamento;
- relações financeiras compostas por `companyId`;
- índices por `companyId, status, dueDate` e por relações;
- unicidade de `(companyId, actorUserId, operation, idempotencyKey)`;
- políticas `RESTRICT` para impedir remoção acidental de empresa/ator com histórico financeiro, sujeitas à revisão de retenção.

O valor do pagamento igual ao título e a coerência entre `PAID` e pagamento ativo atravessam tabelas: serão garantidos pelo caso de uso transacional e por testes, não por uma `CHECK` impossível.

### Compatibilidade

- migration aditiva, sem backfill financeiro;
- aplicar primeiro em banco limpo e depois sobre uma base da Fase 0;
- inspecionar SQL gerado, locks, índices e FKs;
- validar Prisma generate, migrate e ausência de drift;
- aplicação da Fase 0 deve continuar funcionando com as tabelas adicionais.

## 8. API futura

Base:

```text
/api/v1/companies/:companyId/payables
```

Endpoints:

- `POST /` — criar; `Idempotency-Key` obrigatório;
- `GET /` — listar com paginação por cursor;
- `GET /:payableId` — consultar;
- `PATCH /:payableId` — editar título `OPEN` com `If-Match` ou `version`;
- `POST /:payableId/payments` — pagar integralmente; idempotência obrigatória;
- `POST /:payableId/payments/:paymentId/reversal` — estornar; idempotência obrigatória;
- `POST /:payableId/cancellation` — cancelar com versão e motivo.

Não haverá `DELETE`.

Contratos:

- dinheiro como string decimal;
- datas civis como `YYYY-MM-DD`;
- valor e moeda do pagamento definidos pelo servidor;
- erros estruturados para validação, autenticação, autorização, inexistência, estado, versão e idempotência;
- recursos cross-company tratados sem revelar existência.

## 9. Interface futura

Rota proposta:

```text
/companies/[companyId]/payables
```

Fluxo mínimo:

- selecionar/navegar para empresa permitida;
- listar por vencimento;
- criar e consultar;
- editar somente quando `OPEN`;
- confirmar pagamento integral;
- cancelar ou estornar com motivo;
- mostrar loading, vazio, erro, sem permissão e sucesso;
- remover/desabilitar ações não autorizadas sem depender disso para segurança;
- acessibilidade básica de labels, teclado, foco e mensagens.

Não incluir calendário, cards de previsão, saldo, gráficos ou IA.

## 10. Sequência executável e gates

### Etapa 1 — Gate de identidade

**Precondição:** issuer, audience, método de chave/JWKS e mapeamento de `sub` aprovados.

**Ações:** implementar `IdentityProvider`, adaptador JWT, `AuthenticatedPrincipal`, resolução de usuário, `TenantContext` e política de roles.

**Validação:** tokens válidos e inválidos; assinatura, issuer, audience e expiração; usuário sem membership; IDOR; impossibilidade de registrar adapter de teste em produção.

**Gate:** nenhum endpoint financeiro é registrado ou acessível sem principal verificável e membership.

### Etapa 2 — Caracterização da Fase 0

**Ações:** preservar testes de health, banco e interface; adicionar somente testes que documentem integrações tocadas pela nova fase.

**Gate:** baseline oficial passa antes da migration financeira. Falha pré-existente interrompe a fase.

### Etapa 3 — Migration e persistência

**Ações:** modelar tabelas, constraints, índices e relações; gerar uma migration financeira aditiva.

**Validação:** aplicação em banco limpo e base Fase 0; inspeção SQL; constraints tenant-safe; sem drift.

**Gate:** nenhum caso de uso antes de a migration ser revisada e reproduzível.

### Etapa 4 — Domínio

**Ações:** implementar `Money`, datas civis, estados, transições e regras de pagamento/estorno/cancelamento.

**Validação:** testes unitários com valores exatos, escala inválida, datas limite e todas as transições.

**Gate:** domínio não importa controller, DTO, Next.js ou Prisma.

### Etapa 5 — Aplicação e transações

**Ações:** casos de uso e repositório com tenant obrigatório; auditoria e idempotência; locking/updates condicionais.

**Validação:** rollback integral, retries, payload divergente, concorrência e ausência de consulta sem empresa.

**Gate:** pagamento duplicado e associação cross-company falham deterministicamente.

### Etapa 6 — API

**Ações:** DTOs, controller, versionamento, erros e paginação.

**Validação:** contrato HTTP, autorização positiva/negativa, dinheiro em string, datas e headers idempotentes.

**Gate:** API não aceita identidade ou tenant por header livre.

### Etapa 7 — Interface

**Ações:** menor fluxo completo e estados de UX definidos.

**Validação:** componentes, integração frontend-backend real e acessibilidade básica.

**Gate:** nenhuma visualização de calendário ou projeção entra no diff.

### Etapa 8 — Revisão adversarial e documentação

**Ações:** procurar vazamento de tenant, arredondamento, duplicidade, race condition, mass assignment, auditoria excessiva e alteração fora do escopo.

**Validação:** gates oficiais e revisão de diff/migration.

**Gate:** riscos residuais aceitos antes de qualquer dado real.

## 11. Testes obrigatórios

- domínio: dinheiro, moeda, datas, estados e transições;
- banco: checks, FKs compostas, unicidade e política de deleção;
- aplicação: transação, concorrência, idempotência e rollback;
- segurança: JWT, roles, membership, IDOR e mass assignment;
- API: DTOs, erros, paginação, versionamento e serialização;
- interface: loading, vazio, erro, permissão, criação, edição, pagamento, cancelamento e estorno;
- migration: banco limpo e upgrade da Fase 0;
- regressão: health check, lint, typecheck, testes, build e segurança pelos comandos oficiais.

Exemplos financeiros mínimos:

- `0.01 BRL` aceito;
- `10.10 BRL` preservado exatamente;
- `10.101 BRL` rejeitado;
- `0.00` e negativos rejeitados;
- duas requisições concorrentes de pagamento produzem um pagamento;
- estorno preserva valor e data do pagamento original.

## 12. Auditoria, privacidade e observabilidade

- logs estruturados com request ID e company ID, sem token ou payload financeiro integral;
- métricas de erro, conflito de versão, conflito idempotente e falha de autorização;
- auditoria append-only conforme ADR-004;
- política legal de retenção permanece gate para produção;
- IA não aplicável.

## 13. Rollout e rollback

Ordem de rollout:

1. backup e restauração comprovados no ambiente alvo;
2. migration aditiva;
3. backend;
4. frontend;
5. smoke test autenticado em empresa de teste.

Rollback antes de dados reais pode recriar ambiente descartável. Depois do primeiro título real:

- reverter aplicação para a Fase 0 ou versão anterior;
- manter tabelas e dados;
- não executar down migration destrutiva;
- corrigir schema por migration posterior;
- não apagar pagamentos, estornos ou auditoria.

O primeiro dado real é o ponto de não retorno para remoção automática da migration.

## 14. Riscos e mitigação

| Risco                          | Mitigação/gate                                              |
| ------------------------------ | ----------------------------------------------------------- |
| identidade não definida        | aprovar contrato JWT antes do código                        |
| vazamento entre empresas       | tenant context, FKs compostas e testes IDOR                 |
| dinheiro virar `number`        | `Money`, string na API e revisão de boundary                |
| dupla liquidação               | lock/update condicional e idempotência                      |
| status divergir de pagamento   | única transação e testes de integridade                     |
| auditoria coletar dados demais | allowlist e proibições do ADR-004                           |
| abstração prematura            | agregado específico e sem eventos/outbox                    |
| migration difícil de reverter  | aditiva, aplicação antiga compatível e sem down destrutivo  |
| deleção de ator/empresa        | `RESTRICT` inicial e política de retenção antes de produção |

## 15. Critérios de aceite

1. principal JWT é verificado e membership é consultada no backend;
2. `OWNER`/`ADMIN` podem mutar e `MEMBER` somente ler;
3. outra empresa não consulta nem altera o título;
4. dinheiro usa decimal exato no banco/domínio e string na API;
5. conta é criada `OPEN` com competência e vencimento distintos;
6. edição usa versão e somente ocorre em `OPEN`;
7. pagamento integral transiciona para `PAID` uma única vez;
8. estorno preserva o pagamento e retorna o título a `OPEN`;
9. cancelamento de `OPEN` preserva histórico e é terminal;
10. auditoria reconstrói todas as mutações relevantes;
11. retries de criar, pagar e estornar não duplicam efeitos;
12. migration passa em banco limpo e sobre a Fase 0 sem drift;
13. interface cobre o fluxo e seus estados mínimos;
14. todos os gates oficiais passam com evidência;
15. nenhum item fora do escopo foi implementado.

## 16. Pontos de parada

Parar se:

- o emissor não puder ser verificado com contrato seguro;
- o mapeamento de identidade exigir schema não planejado;
- surgir regra de pagamento parcial, aprovação ou moeda com outra escala;
- a migration implicar perda ou transformação de dados inesperados;
- o baseline da Fase 0 falhar sem relação com a fatia;
- isolamento cross-company não puder ser demonstrado;
- o escopo real exigir calendário, saldo ou conciliação.

## 17. Próxima decisão

Antes da implementação, aprovar:

1. issuer/audience e distribuição/rotação de chave JWT;
2. mapeamento de `sub` para o usuário interno;
3. política de retenção da auditoria;
4. ambiente alvo, backup e restauração.

Depois desses gates, a primeira ação de código será a fundação de identidade e tenant — não a migration financeira.
