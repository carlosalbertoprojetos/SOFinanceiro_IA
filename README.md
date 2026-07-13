# Sistema Operacional Financeiro com IA — SOFIA

O SOFIA é uma plataforma para PMEs que organizará compromissos financeiros, antecipará o comportamento do caixa e apoiará decisões rastreáveis. A Fase 0 entrega somente a fundação executável; nenhum recurso financeiro está implementado.

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

| Comando            | Finalidade                                                          |
| ------------------ | ------------------------------------------------------------------- |
| `pnpm dev`         | Inicia API e frontend em modo de desenvolvimento.                   |
| `pnpm dev:api`     | Inicia somente a API.                                               |
| `pnpm dev:web`     | Inicia somente o frontend.                                          |
| `pnpm lint`        | Executa ESLint estrito e verificação de formatação.                 |
| `pnpm typecheck`   | Executa TypeScript sem emissão.                                     |
| `pnpm test`        | Executa testes de API, banco e frontend. Requer PostgreSQL migrado. |
| `pnpm build`       | Gera o Prisma Client e compila as aplicações.                       |
| `pnpm security`    | Verifica vulnerabilidades moderadas, altas e críticas.              |
| `pnpm db:up`       | Inicia o PostgreSQL local.                                          |
| `pnpm db:down`     | Encerra a infraestrutura local sem remover o volume.                |
| `pnpm db:generate` | Gera o Prisma Client.                                               |
| `pnpm db:migrate`  | Aplica migrations versionadas.                                      |

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

## Limitações da Fase 0

- não há autenticação;
- não há middleware de tenant;
- não há contas a pagar/receber, calendário ou projeção;
- não há integrações externas, jobs ou IA;
- os modelos fundacionais não constituem cadastro administrativo público;
- BRL e `America/Sao_Paulo` são padrões iniciais configuráveis por empresa, não regras financeiras completas.

Consulte [a arquitetura da fundação](docs/architecture/FOUNDATION.md) e [o plano incremental](docs/implementation/IMPLEMENTATION_PLAN.md).
