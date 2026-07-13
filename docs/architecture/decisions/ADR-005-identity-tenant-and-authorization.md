# ADR-005 — Identidade, empresa e autorização

- **Status:** Aceito para a Fase 1A, com configuração de emissor como gate de implementação
- **Data:** 2026-07-13

## Contexto

`CompanyMembership` já associa usuário, empresa e papel. Não existe autenticação. Usuários podem pertencer a mais de uma empresa e nenhuma informação vinda da URL ou de header livre pode estabelecer identidade ou tenant por si só.

## Problema

Definir rotas multiempresa e um limite de autenticação seguro sem escolher prematuramente um provedor comercial ou permitir um atalho temporário em produção.

## Alternativas de rota

### A — empresa explícita na rota

URLs reproduzíveis e testes claros, com risco de IDOR se membership não for validada.

### B — empresa somente no contexto ativo

URL menor, mas introduz estado implícito e dificulta jobs, integrações e depuração.

### C — rotas mistas

Pode atender administração futura, mas cria duas semânticas antes de existir caso administrativo.

## Decisão de rota e tenant

Adotar a alternativa A para operações normais:

```text
/api/v1/companies/:companyId/payables
```

O `companyId` da rota é uma seleção solicitada, nunca uma autorização. Um guard valida a identidade e consulta `CompanyMembership`. Recursos de outra empresa respondem como não encontrados quando a distinção revelaria existência.

A interface troca de empresa navegando para a rota da empresa selecionada. Não haverá “empresa ativa” escondida em estado global do servidor. Serviços internos recebem um `TenantContext` já validado, contendo `companyId`, `userId`, `membershipId` e `role`; não recebem headers ou claims brutas.

Rotas administrativas globais serão decididas somente quando existir um papel administrativo real.

## Alternativas de autenticação

### A — provedor completo agora

Entrega login e gestão de sessão, mas exige uma decisão de produto/fornecedor que não é necessária para modelar contas a pagar.

### B — contratos e adaptador JWT verificável

Separa domínio de identidade do emissor e permite testes seguros, mantendo validação criptográfica real.

### C — autenticação temporária de desenvolvimento

É rápida, mas possui risco inaceitável de chegar à produção e cria falsa segurança multiempresa.

## Decisão de autenticação

Adotar a alternativa B:

- `IdentityProvider` valida o token e produz `AuthenticatedPrincipal`;
- um adaptador JWT inicial verifica assinatura, algoritmo permitido, `iss`, `aud`, `exp` e, quando presente, `nbf`;
- o principal contém `userId` interno, `subject`, `issuer` e metadados mínimos de rastreio;
- empresa e papel não são confiados de claims: são consultados em `CompanyMembership` a cada contexto autorizado ou por cache com invalidação explícita futura;
- a matriz inicial permite leitura a `OWNER`, `ADMIN` e `MEMBER`, e mutações somente a `OWNER` e `ADMIN`.

O mapeamento de `(issuer, subject)` para `User` pertence ao adaptador. Se o emissor não puder fornecer o UUID interno como `sub`, uma tabela de identidade deverá ser planejada em migration própria de autenticação antes da migration financeira; associação por e-mail não será usada como prova de identidade.

Testes substituem `IdentityProvider` por implementação in-memory via injeção de dependência no módulo de teste. O adaptador de teste não é registrado no módulo de produção. Runtime de produção proíbe identidade por `X-User-ID`, `X-Company-ID`, token sem assinatura, algoritmo `none` ou segredo padrão.

A escolha do emissor JWT permanece reversível e configurável. Issuer, audience, JWKS/chave e política de rotação precisam ser aprovados antes de iniciar a implementação da autenticação.

## Consequências

- A API explicita o tenant sem confiar nele.
- Troca de empresa não depende de sessão mutável no servidor.
- O domínio não depende de fornecedor comercial.
- Pode ser necessária uma migration de identidade anterior e separada da financeira.

## Riscos

- configuração incorreta de issuer/audience/chaves;
- cache futuro de membership ficar obsoleto;
- resposta diferente entre tenants revelar existência;
- adaptador de teste ser incluído por erro em produção.

## Itens adiados

- tela de login, recuperação e MFA;
- provedor comercial;
- administração global;
- cache de membership;
- RLS no PostgreSQL.

## Gatilhos para reavaliar

- escolha do provedor de identidade;
- necessidade de múltiplos emissores;
- administração cross-company;
- exigência de RLS ou volume que justifique cache.
