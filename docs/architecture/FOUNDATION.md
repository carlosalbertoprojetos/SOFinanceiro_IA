# Fundação executável

## Decisão arquitetural

A Fase 0 adota um monorepo TypeScript com NestJS, Next.js, PostgreSQL e Prisma, organizado inicialmente como monólito modular. A decisão prioriza transações locais, operação simples e um único ciclo de validação enquanto o produto ainda não possui domínio financeiro implementado.

Microserviços, CQRS, Event Sourcing e infraestrutura distribuída foram deliberadamente rejeitados nesta fase porque não existe carga, equipe ou limite de domínio observado que justifique seus custos.

## Limites

A fundação contém somente:

- aplicações mínimas de API e frontend;
- health check com estado separado do banco;
- configuração validada por ambiente;
- PostgreSQL local;
- modelos `Company`, `User` e `CompanyMembership`;
- lint, typecheck, testes, build e CI.

Não contém módulos financeiros, autenticação completa, rotas administrativas, jobs, integrações ou IA.

## Matriz de versões e compatibilidade

As versões abaixo são releases estáveis e foram resolvidas em conjunto pelo lockfile. A validação local foi realizada com Node.js 24.15.0; o contrato do projeto aceita qualquer Node.js `>=24.0.0 <25`, sem fixar patch.

| Componente        | Versão selecionada | Compatibilidade verificada                                                                        |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| pnpm              | 11.12.0            | Fixado exclusivamente em `packageManager`; gerencia o workspace e o lockfile.                     |
| NestJS            | 11.1.28            | Requer Node.js 20 ou superior; pacotes `common`, `core` e `platform-express` usam a mesma versão. |
| Next.js           | 16.2.10            | Requer Node.js 20.9 ou superior e aceita React 19.                                                |
| React             | 19.2.7             | `react` e `react-dom` usam a mesma versão exigida pelos peers.                                    |
| Prisma            | 7.8.0              | Requer Node.js 24 ou linhas compatíveis e TypeScript 5.4 ou superior.                             |
| TypeScript        | 5.9.3              | Satisfaz Prisma e a faixa `<6.1.0` do typescript-eslint.                                          |
| ESLint            | 9.39.5             | Satisfaz a faixa ESLint 9 do typescript-eslint 8.63.0.                                            |
| Vitest            | 4.1.10             | Aceita Node.js 24 e resolve Vite 8.1.4.                                                           |
| plugin React/Vite | 6.0.3              | Aceita Node.js 24 e Vite 8.1.4.                                                                   |

A consulta aos metadados do registro e a instalação congelada não indicaram versões RC, beta, canary ou pacotes selecionados marcados como obsoletos.

## Estratégia multiempresa

`CompanyMembership` representa explicitamente a associação entre usuário e empresa, com unicidade por par e papéis `OWNER`, `ADMIN` e `MEMBER`. Recursos financeiros futuros deverão conter uma referência obrigatória à empresa e todas as consultas e mutações deverão aplicar o contexto de tenant no backend.

A Fase 0 não implementa middleware de tenant porque ainda não existe fluxo de autenticação capaz de estabelecer esse contexto com segurança. Adicionar um header de empresa sem identidade verificada criaria uma falsa garantia de isolamento.

Antes da primeira fatia financeira, a estratégia deverá definir:

1. como a identidade é autenticada;
2. como a empresa ativa é selecionada e validada;
3. quais papéis autorizam cada operação;
4. quais defesas adicionais serão aplicadas no banco;
5. testes positivos e negativos de IDOR e vazamento entre empresas.

## Moeda e timezone

Empresas nascem com `currencyCode = BRL` e `timezone = America/Sao_Paulo`. Ambos são persistidos na empresa para impedir que padrões de implantação se tornem regras implícitas universais.

A Fase 0 não armazena valores monetários. Modelos financeiros futuros deverão usar tipos decimais explícitos no TypeScript/Prisma/PostgreSQL, com precisão, escala e arredondamento aprovados antes da migration correspondente. `number` binário não será fonte oficial para dinheiro.

## Configuração e segurança

- Variáveis obrigatórias são validadas na inicialização da API.
- `.env` é ignorado; `.env.example` contém somente valores locais seguros.
- CORS aceita exclusivamente `WEB_ORIGIN` e apenas o método necessário nesta fase.
- O health check não expõe credenciais ou detalhes de falha do banco.
- Não há rotas de escrita ou administrativas.

## Operação local

O Docker Compose gerencia somente PostgreSQL, com volume persistente e health check. API e frontend executam no host para manter feedback rápido. A CI usa um serviço PostgreSQL isolado e aplica a mesma migration versionada.

## Itens deliberadamente adiados

- autenticação e autorização operacional;
- resolução e enforcement de tenant;
- auditoria de mudanças financeiras;
- lançamentos, contas, liquidações e estornos;
- calendário e projeção;
- filas, jobs, notificações e integrações;
- observabilidade distribuída;
- infraestrutura cloud;
- qualquer uso de IA.

Esses itens só entram em fatias próprias, com critérios e rollback específicos.
