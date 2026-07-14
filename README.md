# Sistema Operacional Financeiro com IA — SOFIA

O SOFIA é uma plataforma para PMEs que organizará compromissos financeiros, antecipará o comportamento do caixa e apoiará decisões rastreáveis. A Fase 0 entrega a fundação executável, a Fase 1A.1 adiciona identidade JWT verificável, tenant e autorização, a Fase 1A.2 implementa o domínio e as mutações de contas a pagar e a Fase 1A.3 adiciona consultas e interface mínima.

## Stack da fundação

- monorepo TypeScript com pnpm;
- API NestJS;
- interface Next.js;
- PostgreSQL 17 para desenvolvimento local;
- Prisma;
- Vitest e Testing Library;
- GitHub Actions.

O projeto aceita a linha Node.js 24 LTS. O pnpm é fixado exatamente pelo campo `packageManager` de `package.json`.

## Requisitos

- Node.js 24 LTS (`>=24.0.0 <25`; validação local realizada com 24.15.0);
- Corepack;
- Docker com Docker Compose;
- portas 3000, 3001 e 5433 disponíveis, ou valores alternativos no `.env`.

## Preparação local

```powershell
corepack enable
Copy-Item .env.example .env
pnpm install
pnpm db:up
pnpm db:generate
pnpm db:migrate
```

Copie também a configuração JWT de `.env.example`. A API exige issuer, audience e uma chave pública RSA válida para iniciar. Sem essa configuração, a validação global falha e impede a inicialização de toda a API, inclusive do health check. Este comportamento fail-fast é intencional: a aplicação não opera parcialmente sem o limite de autenticação configurado.

Se o ambiente não permitir instalar o shim do Corepack, execute os mesmos comandos como `corepack pnpm <comando>`. O projeto continua usando a versão fixada no campo `packageManager`.

## Execução

Em dois terminais:

```powershell
pnpm dev:api
pnpm dev:web
```

Ou, para iniciar ambos:

```powershell
pnpm dev
```

- Frontend: `http://localhost:3000`
- Health check: `http://localhost:3001/health`

O health check retorna `status: ok` somente quando aplicação e PostgreSQL estão acessíveis. Quando o banco está indisponível, a API responde com HTTP 503 e estado degradado.

## Comandos oficiais

| Comando                            | Finalidade                                                          |
| ---------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev`                         | Inicia API e frontend em modo de desenvolvimento.                   |
| `pnpm dev:api`                     | Inicia somente a API.                                               |
| `pnpm dev:web`                     | Inicia somente o frontend.                                          |
| `pnpm lint`                        | Executa ESLint estrito e verificação de formatação.                 |
| `pnpm typecheck`                   | Executa TypeScript sem emissão.                                     |
| `pnpm test`                        | Executa testes de API, banco e frontend. Requer PostgreSQL migrado. |
| `pnpm build`                       | Gera o Prisma Client e compila as aplicações.                       |
| `pnpm auth:issue-dev-token -- ...` | Gera token e chave pública efêmeros somente para desenvolvimento.   |
| `pnpm security`                    | Verifica vulnerabilidades moderadas, altas e críticas.              |
| `pnpm db:up`                       | Inicia o PostgreSQL local.                                          |
| `pnpm db:down`                     | Encerra a infraestrutura local sem remover o volume.                |
| `pnpm db:generate`                 | Gera o Prisma Client.                                               |
| `pnpm db:migrate`                  | Aplica migrations versionadas.                                      |

## Estrutura

```text
apps/api/                 API NestJS e testes
apps/web/                 aplicação Next.js e testes
prisma/                   schema e migrations
docs/architecture/        decisões da fundação
docs/implementation/      baseline e plano incremental
.github/workflows/ci.yml  validação em ambiente limpo
```

Não foram criados pacotes compartilhados: a Fase 0 não possui código comum real que justifique essa abstração.

## Validação

Com o PostgreSQL iniciado e migrado:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm security
```

## Identidade e tenant

A API valida tokens `RS256` com `iss`, `sub`, `aud`, `exp` e `iat`. `(issuer, subject)` é resolvido por `UserIdentity`; empresa e papel são sempre consultados em `CompanyMembership`.

Para gerar um token efêmero sem endpoint ou chave privada versionada:

```powershell
corepack pnpm auth:issue-dev-token -- --issuer https://auth.local.sofia.test --audience sofia-api --subject dev-user-1
```

Copie `publicKeyBase64` para `AUTH_JWT_PUBLIC_KEY_BASE64`. O subject precisa estar previamente associado a um usuário por `UserIdentity`; esta fase não cria endpoint de provisionamento.

## Contas a pagar — Fase 1A.2

A API recebe dinheiro como string decimal e datas civis em `YYYY-MM-DD`. Moeda e valor do pagamento são definidos pelo servidor. `OWNER` e `ADMIN` podem mutar; `MEMBER` é rejeitado.

Endpoints implementados:

- `GET /api/v1/companies/:companyId/payables`;
- `GET /api/v1/companies/:companyId/payables/:payableId`;
- `POST /api/v1/companies/:companyId/payables`;
- `PATCH /api/v1/companies/:companyId/payables/:payableId`;
- `POST /api/v1/companies/:companyId/payables/:payableId/payments`;
- `POST /api/v1/companies/:companyId/payables/:payableId/payments/:paymentId/reversal`;
- `POST /api/v1/companies/:companyId/payables/:payableId/cancellation`.

Criação, pagamento e estorno exigem `Idempotency-Key`. Edição e cancelamento exigem `expectedVersion`. Não há `DELETE`.

A interface mínima está em `/companies/:companyId/payables`. Enquanto não existe login operacional, ela recebe um JWT válido e o mantém somente em memória. `MEMBER` consulta; `OWNER` e `ADMIN` também executam as mutações previstas. Consulte [o contrato da API e da interface](docs/architecture/PAYABLES_API.md).

## Limitações atuais

- não há login, refresh token, revogação, MFA ou provisionamento público de identidade;
- o tenant é validado no backend, mas ainda não há RLS no PostgreSQL;
- não há contas a receber, calendário ou projeção;
- contas a pagar não possuem pagamento parcial, parcelas, recorrência, juros, multa, desconto ou conciliação;
- não há integrações externas, jobs ou IA;
- os modelos fundacionais não constituem cadastro administrativo público;
- BRL e `America/Sao_Paulo` são padrões iniciais configuráveis por empresa, não regras financeiras completas.

Consulte [a arquitetura da fundação](docs/architecture/FOUNDATION.md), [identidade e tenant](docs/architecture/IDENTITY_TENANT_AUTHORIZATION.md) e [o plano incremental](docs/implementation/IMPLEMENTATION_PLAN.md).
