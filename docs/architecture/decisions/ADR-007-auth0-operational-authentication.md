# ADR-007 — Auth0 para autenticação operacional

- **Status:** Aceito para o MVP
- **Data:** 2026-07-13

## Contexto

A Fase 1A.1 estabeleceu autenticação JWT verificável, identidade por
`(issuer, subject)` e autorização baseada em `CompanyMembership`, mas deixou o
emissor operacional e a sessão do navegador em aberto. A Fase 1A.3 ainda exige
um token Bearer inserido manualmente. O MVP precisa de login, callback, sessão,
logout e seleção de empresa sem transferir domínio, tenant ou autorização para
um fornecedor de identidade.

## Alternativas avaliadas

- **Auth0:** boa integração OIDC e com Next.js, operação gerenciada e menor
  tempo para o MVP; implica custo crescente, transferência internacional e
  lock-in de fluxos e configuração.
- **ZITADEL:** boa alternativa OIDC, com opção gerenciada ou self-hosted e menor
  dependência comercial; exige mais decisões operacionais e uma integração de
  sessão menos direta para o estágio atual.
- **AWS Cognito:** integração natural em ambientes AWS e escala; experiência de
  configuração, sessão e interface menos simples para este MVP.
- **Keycloak ou solução self-hosted:** maior controle e portabilidade; transfere
  disponibilidade, correções, backups e segurança do IdP para a equipe.
- **Clerk e Supabase Auth:** boa experiência de implementação, mas maior
  acoplamento aos modelos próprios de sessão/plataforma sem benefício necessário
  para o contrato atual.

## Decisão

Adotar Auth0 no MVP exclusivamente como provedor de identidade, autenticação e
sessão. A integração usa uma aplicação Auth0 do tipo Regular Web Application e
uma API com audience exclusivo do SOFIA. O Next.js mantém sessão criptografada
em cookie `HttpOnly`, obtém access token no servidor e atua como BFF para a API
NestJS. ID token não autoriza chamadas à API.

O NestJS valida access tokens por OIDC Discovery e JWKS remoto, aceitando apenas
`RS256` e validando assinatura, `iss`, `aud`, `exp`, `iat` e demais restrições
temporais aplicáveis. As chaves são mantidas em cache e atualizadas para suportar
rotação; indisponibilidade remota usa somente chave confiável ainda válida pela
política de cache e falha fechada quando isso não for possível.

Auth0 não é fonte de `User`, `UserIdentity`, `Company`, `CompanyMembership`,
papéis, empresa ativa ou autorização financeira. O SOFIA continua soberano
sobre esses dados. O par `(issuer, subject)` é a única chave externa de
identidade; e-mail não é prova de identidade.

## Organizações e empresa ativa

Auth0 Organizations não será usado nesta fase. Organização do IdP não equivale
a empresa do domínio. `CompanyMembership` permanece a fonte exclusiva de
vínculo e papel. A empresa ativa é apenas preferência de navegação; cada rota de
empresa é revalidada no banco pelo backend.

## Provisionamento

O provisionamento é explícito. Uma identidade Auth0 autenticada sem
`UserIdentity` recebe estado de acesso não provisionado. O login não cria
automaticamente usuário, empresa, membership ou identidade. A vinculação é
feita por comando administrativo auditável e exige usuário interno existente,
issuer e subject exatos.

## Sessão e segurança de fluxo

O SDK oficial do Auth0 para Next.js é usado enquanto compatível com a versão do
framework. Ele controla `state`, `nonce`, PKCE quando aplicável, callback e
cookie de sessão. URLs de retorno são limitadas a caminhos locais permitidos.
Client secret, segredo de sessão, access token e refresh token permanecem no
servidor; não são enviados a código JavaScript nem persistidos em
`localStorage` ou `sessionStorage`.

## Health e disponibilidade

`/health/live` comprova apenas que o processo responde. `/health/ready` verifica
banco, configuração de issuer/audience e capacidade local de inicializar o
verificador, sem consultar Auth0 a cada chamada. Ausência de configuração OIDC
não deve impedir o processo de iniciar: liveness permanece disponível,
readiness falha e toda rota protegida permanece fechada.

Essa decisão substitui o fail-fast integral documentado no ADR-005. Ela permite
diagnóstico operacional sem permitir acesso não validado.

## Consequências

- login e sessão deixam de depender de token manual;
- rotação de chaves não exige reinício coordenado da API;
- chamadas do navegador passam pelo BFF, aumentando a responsabilidade do
  servidor Next.js;
- indisponibilidade do Auth0 pode impedir novo login ou renovação, mas tokens
  válidos podem continuar sendo verificados com cache dentro da política;
- domínio financeiro e dados existentes não exigem migration.

## Lock-in e gatilhos de reavaliação

O lock-in é limitado mantendo OIDC padrão, `issuer + subject`, autorização no
SOFIA e uma fronteira própria de sessão/BFF. Reavaliar Auth0 versus ZITADEL,
Cognito ou solução self-hosted quando ocorrer qualquer um destes gatilhos:

- custo projetado incompatível com usuários ativos ou MFA;
- exigência contratual de residência de dados não atendida;
- necessidade de operação offline, soberania ou hospedagem própria;
- padronização relevante da infraestrutura em AWS;
- indisponibilidade/SLA incompatível com o produto;
- customização de autenticação bloqueada pelo fornecedor;
- necessidade comprovada de múltiplos emissores ou portabilidade acelerada.

## LGPD

O Auth0 atua como operador/suboperador de dados de autenticação. Antes de piloto
externo ou produção comercial devem ser revisados DPA, suboperadores,
transferência internacional, residência, minimização, retenção, direitos do
titular e processo de incidente. Somente atributos mínimos de sessão devem ser
tratados. Esses itens não bloqueiam desenvolvimento e validação local, mas são
gate de produção comercial.

## Rollback

O rollback remove a integração Auth0/BFF e restaura um emissor de desenvolvimento
somente em ambiente local. `UserIdentity`, `CompanyMembership` e dados
financeiros são preservados. O campo manual de token não retorna à produção e
nenhuma migration destrutiva é necessária.
