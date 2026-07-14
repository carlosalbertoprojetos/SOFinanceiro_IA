# API e interface de contas a pagar

## Escopo da Fase 1A.3

A rota web `/companies/:companyId/payables` consome exclusivamente a API tenant-safe. O `companyId` vem da rota e nunca concede acesso sem JWT, identidade e `CompanyMembership` válidos.

## Consultas

```text
GET /api/v1/companies/:companyId/payables
GET /api/v1/companies/:companyId/payables/:payableId
```

`OWNER`, `ADMIN` e `MEMBER` podem consultar. Recursos de empresa inacessível respondem `404` sem revelar existência.

Filtros allowlisted: `status`, `dueFrom`, `dueTo`, `query`, `overdue` e `sort`. As ordenações aceitas são `due_asc`, `due_desc` e `created_desc`; campos arbitrários são rejeitados.

Paginação usa cursor keyset opaco, página padrão de 20 e máximo de 50. A ordem padrão é `dueDate ASC, createdAt ASC, id ASC`. Cursor inválido ou usado com outra ordenação retorna `400`. `nextCursor: null` encerra a navegação. Não existe contagem total.

## Serialização

- dinheiro como string decimal canônica;
- datas civis em `YYYY-MM-DD`;
- instantes em ISO 8601 UTC;
- `overdue` derivado de estado, vencimento e timezone da empresa;
- `activePayment` contém o pagamento sem estorno ou `null`;
- `payments` preserva histórico e eventual estorno;
- `permissions.canMutate` reflete o papel atual.

Auditoria, idempotência, atores internos, headers e detalhes do banco não são expostos.

## Interface e segurança

A autenticação usa sessão Auth0 server-side no Next.js. O navegador chama o BFF same-origin, que anexa o access token somente no servidor. Não existe campo manual, token hardcoded, `localStorage` ou `sessionStorage`. A empresa continua explícita na URL e validada pelo NestJS.

Criação, pagamento e estorno mantêm uma `Idempotency-Key` por tentativa lógica. Edição usa `expectedVersion`. Pagamento não recebe valor. Estorno preserva o pagamento. Cancelamento preserva o título. `MEMBER` recebe interface somente leitura; o backend continua sendo autoridade.

Erros `401`, `403`, `404`, `409`, validação, timeout, rede e indisponibilidade são traduzidos em mensagens acionáveis. Formulários preservam dados quando a API falha.

## Health checks

`/health/live` não depende de banco ou Auth0. `/health/ready` verifica banco e configuração local do verifier, sem consultar Auth0 em toda chamada. Configuração OIDC ausente mantém liveness, retorna readiness `503` e deixa rotas protegidas fechadas, conforme ADR-007.

## Rollback

Reverter aplicação web e endpoints GET. Preservar schema, migrations e registros financeiros. A Fase 1A.3 não adiciona migration.

## Evidências da Fase 1A.3

Validação final em 13 de julho de 2026: Prisma Client gerado, schema válido, migrations atualizadas e sem drift; lint e typecheck aprovados; 87 testes da API e 22 testes web aprovados; build Nest/Next aprovado; cliente web tipado exercitado contra a API e autenticação reais; auditoria de dependências sem vulnerabilidades conhecidas; `git diff --check` aprovado.
