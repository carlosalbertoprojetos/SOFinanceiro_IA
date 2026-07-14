# Configuração Auth0 para desenvolvimento

## Recursos

Crie no tenant de desenvolvimento:

1. uma **Regular Web Application**;
2. uma **API** com audience exclusivo, por exemplo
   `https://api.sofia.local`, e algoritmo de assinatura `RS256`.

Não habilite Auth0 Organizations. Empresa, membership e papel pertencem ao
SOFIA.

## URLs locais

- Allowed Callback URL: `http://localhost:3000/auth/callback`
- Allowed Logout URL: `http://localhost:3000`
- Allowed Web Origin: `http://localhost:3000`

Registre URLs exatas por ambiente. Não use wildcard em callback e não aceite
return URL arbitrária.

## Variáveis

Copie `.env.example` para `.env` não versionado. Preencha `AUTH0_DOMAIN`,
`AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `AUTH0_ISSUER` e
`AUTH0_AUDIENCE`. Gere `AUTH0_SECRET` local com `openssl rand -hex 32`. Nunca
copie valores reais para documentação, teste, CI ou variável `NEXT_PUBLIC_*`.

Habilite Offline Access na API de desenvolvimento para renovação server-side.
O BFF desativa o endpoint browser-side de access token.

## Provisionamento

Após o primeiro login, obtenha `iss` e `sub` pelo log administrativo seguro do
tenant, confirme o usuário interno correto e execute:

```powershell
corepack pnpm auth:link-identity -- --user-id <uuid> --confirm-user-id <uuid> --issuer <issuer-exato> --subject <sub-exato>
```

Não vincule por e-mail. Usuário sem vínculo verá o estado não provisionado;
usuário sem membership verá o estado sem empresa.

## Gate LGPD para piloto externo

Antes de produção comercial: revisar DPA, suboperadores, transferência
internacional, residência, minimização, retenção, direitos do titular e processo
de incidente. A validação local não substitui esse gate.
