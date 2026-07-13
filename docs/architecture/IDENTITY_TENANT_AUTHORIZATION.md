# Identidade verificável, tenant e autorização

## Estado

Esta documentação descreve a implementação da Fase 1A.1. Ela não cria autenticação de usuário final, tela de login ou permissões financeiras.

## Fluxo protegido

```text
Authorization: Bearer <JWT>
        |
        v
JwtAuthenticationGuard
        |
        +-- TokenVerifier: RS256, assinatura, iss, aud, exp e iat
        |
        +-- IdentityResolver: (issuer, subject) -> UserIdentity -> User
        |
        v
CompanyAccessGuard
        |
        +-- companyId da rota + userId interno
        +-- consulta CompanyMembership e papel atual
        |
        v
RoleAuthorizationGuard
        |
        +-- AllowedRoles + AuthorizationPolicy
        |
        v
Controller
```

O JWT não é autoridade para empresa ou papel. O papel é carregado de `CompanyMembership` em cada resolução de contexto.

## Contratos

### `AuthenticatedPrincipal`

```typescript
type AuthenticatedPrincipal = {
  userId: string;
  issuer: string;
  subject: string;
};
```

### `TenantContext`

Contém `companyId`, `userId`, `membershipId` e `role`, todos derivados após autenticação e consulta ao banco.

### Claims obrigatórias

- `iss`;
- `sub`;
- `aud`;
- `exp`;
- `iat`.

O único algoritmo aceito inicialmente é `RS256`. Tokens sem assinatura, com algoritmo diferente, malformados, expirados ou emitidos no futuro são rejeitados.

## Configuração

| Variável                     | Finalidade                                      |
| ---------------------------- | ----------------------------------------------- |
| `AUTH_JWT_ALGORITHM`         | deve ser `RS256`                                |
| `AUTH_JWT_ISSUER`            | issuer exato aceito                             |
| `AUTH_JWT_AUDIENCE`          | audience exata da API                           |
| `AUTH_JWT_PUBLIC_KEY_BASE64` | chave pública RSA SPKI/PEM codificada em base64 |

A API inteira, inclusive o health check, falha na inicialização quando a configuração obrigatória não existe ou a chave não é RSA válida. O comportamento fail-fast é intencional: esta fase não admite operação parcial sem o limite de autenticação configurado. A chave privada não pertence ao repositório nem à API.

A implementação inicial usa uma chave pública estática. Rotação exige atualizar a configuração e reiniciar a API de forma coordenada. JWKS remoto fica adiado até existir um emissor operacional que o justifique.

## Identidades externas

`UserIdentity` associa `(issuer, subject)` a um `User` interno. O par é único e o mesmo subject pode existir em issuers diferentes.

O FK usa `ON DELETE RESTRICT`: um usuário com identidade não pode ser removido silenciosamente. A desativação ou remoção futura deverá ser um fluxo administrativo explícito. E-mail nunca é usado como prova de identidade.

Não existe endpoint público, seed de identidade real ou auto-provisionamento.

## Tenant e enumeração

Rotas protegidas usam:

```text
/api/v1/companies/:companyId/...
```

O `companyId` é somente uma seleção. O backend exige membership do usuário autenticado. Empresa inexistente e empresa existente sem acesso produzem a mesma resposta `404`, evitando revelar outro tenant.

## Autorização

`AllowedRoles` declara papéis autorizados e `RoleAuthorizationGuard` usa `AuthorizationPolicy` sobre o papel atual do banco. Ausência de declaração ou de contexto validado é negada por padrão.

A rota temporária de validação técnica permite `OWNER`, `ADMIN` e `MEMBER`:

```text
GET /api/v1/companies/:companyId/access-check
```

Resposta mínima:

```json
{ "access": "granted", "role": "MEMBER" }
```

Ela não integra o contrato permanente da API e não retorna usuário, e-mail, membership ou dados da empresa. Deve ser removida quando os primeiros endpoints reais substituírem sua função de validação.

## Token local efêmero

O projeto oferece um comando CLI, sem endpoint e desabilitado quando `NODE_ENV=production`:

```powershell
corepack pnpm auth:issue-dev-token -- --issuer https://auth.local.sofia.test --audience sofia-api --subject dev-user-1
```

O comando gera um par RSA somente em memória e imprime:

- token com validade entre 60 e 3600 segundos;
- chave pública base64 para configurar a API;
- duração do token.

A chave privada não é impressa nem persistida. Para o acesso funcionar, deve existir previamente uma `UserIdentity` correspondente no banco; provisionamento administrativo permanece fora do escopo.

## Testes sem bypass

Testes JWT geram pares RSA efêmeros. O teste HTTP inicializa a aplicação real com a chave pública do teste e assina tokens com a chave privada mantida somente em memória.

Não existe provider de bypass registrado em `AppModule`, identidade por `X-User-ID`, seleção por `X-Company-ID` ou segredo padrão.

## Rollback

A migration é aditiva. Antes de dados reais, uma base descartável pode ser recriada. Depois de identidades persistidas:

- reverter a aplicação sem remover `UserIdentity`;
- não executar down migration destrutiva;
- corrigir schema por migration posterior;
- preservar o vínculo entre issuer, subject e usuário.

## Limitações e riscos residuais

- não há login, logout, refresh token, revogação ou MFA;
- não há JWKS nem rotação sem restart;
- não há provisionamento administrativo de identidade;
- não há cache de membership nem RLS;
- `iat` depende de relógios sincronizados;
- a rota `access-check` é temporária;
- a seleção do emissor operacional e gestão de chaves continuam decisões de implantação.
