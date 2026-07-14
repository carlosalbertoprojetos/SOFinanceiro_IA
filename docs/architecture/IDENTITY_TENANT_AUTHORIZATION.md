# Identidade, sessão, tenant e autorização

## Fluxo operacional

```text
Browser -> Next.js/Auth0 SDK -> cookie de sessão criptografado HttpOnly
        -> BFF Next.js -> access token Bearer -> NestJS
        -> OIDC Discovery/JWKS -> (issuer, subject) -> UserIdentity
        -> User -> CompanyMembership -> autorização
```

Auth0 autentica e mantém sessão. Não define empresa, papel ou permissão. O BFF
desativa `/auth/access-token`; access e refresh tokens não ficam disponíveis ao
JavaScript do navegador. ID token não é usado para acessar o NestJS.

## Validação OIDC/JWKS

A API aceita somente `RS256` e valida assinatura, `iss`, `sub`, `aud`, `exp` e
`iat`. Discovery e JWKS são carregados do issuer configurado. Discovery e chaves
são cacheados; `kid` desconhecido força atualização para suportar rotação.

| Variável                       | Finalidade                                  |
| ------------------------------ | ------------------------------------------- |
| `AUTH0_ISSUER`                 | issuer exato, incluindo barra final         |
| `AUTH0_AUDIENCE`               | identificador exclusivo da API SOFIA        |
| `AUTH0_JWKS_CACHE_TTL_SECONDS` | validade fresca do JWKS; padrão 600 s       |
| `AUTH0_JWKS_STALE_TTL_SECONDS` | limite de contingência do cache; padrão 1 h |

Se o JWKS estiver indisponível, uma chave previamente validada pode ser usada
somente até o limite stale. Sem chave confiável a API falha fechada. Não há
download por requisição nem chave RSA estática no repositório.

## Sessão Next.js

O SDK oficial usa cookie criptografado `HttpOnly`, `SameSite=Lax` e `Secure` em
produção. A sessão é rolling, expira após 24 horas de inatividade e possui limite
absoluto de sete dias. O SDK valida state, nonce e PKCE quando aplicável. URLs de
retorno externas ou protocol-relative são substituídas por `/companies`.

As variáveis `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`,
`AUTH0_SECRET`, `APP_BASE_URL` e `API_INTERNAL_URL` são exclusivas do servidor.
Nenhum segredo usa prefixo `NEXT_PUBLIC_`.

## Identidade e provisionamento

`UserIdentity` associa `(issuer, subject)` a um `User`. E-mail e nome podem mudar
no Auth0 sem alterar a identidade. Login sem vínculo retorna
`IDENTITY_NOT_PROVISIONED`; não cria usuário, empresa ou membership.

Para vincular uma identidade a um usuário interno existente:

```powershell
corepack pnpm auth:link-identity -- --user-id <uuid> --confirm-user-id <uuid> --issuer <issuer-exato> --subject <sub-exato>
```

O comando exige confirmação repetida do UUID, usa parâmetros SQL, é idempotente
para o mesmo vínculo e rejeita identidade já ligada a outro usuário. Execute-o
somente em terminal administrativo com `DATABASE_URL` do ambiente correto.

## Empresas e autorização

`GET /api/v1/me/companies` não recebe `userId` e retorna somente `id`, `name`,
`currencyCode`, `timezone` e o papel atual vindo de `CompanyMembership`. A
preferência de empresa é cookie `HttpOnly` do BFF e não concede acesso. Toda rota
`/api/v1/companies/:companyId/...` consulta a membership novamente; vínculo
removido deixa de autorizar imediatamente.

## Health

- `GET /health/live`: processo ativo, sem banco ou Auth0;
- `GET /health/ready`: banco, issuer/audience e inicialização local do verifier.

Configuração OIDC ausente permite liveness, mas readiness retorna `503` e rotas
protegidas falham fechadas. Readiness não consulta Auth0 em cada chamada.

## Testes e rollback

Testes criam chaves RSA efêmeras e um OIDC/JWKS local, sem internet, tenant ou
credenciais reais. Não existe bypass de identidade em `AppModule`.

Rollback preserva `UserIdentity`, `CompanyMembership` e dados financeiros. O
token manual não retorna à produção. Consulte ADR-005 e ADR-007.
