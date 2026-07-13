# Plano incremental de implementação

## 1. Decisão de planejamento

Classificação: **full plan**. O produto combina persistência financeira, autorização, multiempresa, integrações, execução assíncrona e possível IA. Um plano leve ou execução direta não oferece gates suficientes.

Este documento é uma recomendação baseada em um repositório greenfield. Ele não registra arquitetura ou regras já aprovadas onde elas não existem.

## 2. Objetivo

Construir o produto em fatias verticais utilizáveis e reversíveis, começando por um único fluxo financeiro determinístico que prove isolamento por empresa, autorização, auditoria, calendário, projeção e liquidação antes de automações e integrações.

## 3. Escopo

Incluído no roadmap:

- calendário financeiro;
- contas a pagar e receber;
- previsão simples de caixa;
- alertas explicáveis;
- conciliação bancária;
- gestão financeira de contratos;
- cobrança automática;
- notificações multicanal;
- fundações obrigatórias de segurança, auditoria, testes e operação.

Não escopo até decisão explícita:

- contabilidade fiscal completa;
- emissão fiscal;
- folha de pagamento;
- crédito ou movimentação bancária direta;
- múltiplos provedores por recurso na primeira entrega;
- microserviços, CQRS, Event Sourcing, EDA ou Kubernetes;
- IA como fonte de cálculo, saldo ou decisão financeira oficial;
- alteração de dados liquidados sem estorno/compensação.

## 4. Estado e restrições confirmados

- Na fotografia que originou este plano, não existia aplicação a evoluir e o repositório era documental.
- A Fase 0 posteriormente definiu stack, banco, ambientes e comandos; o registro de conclusão abaixo e `docs/architecture/FOUNDATION.md` substituem essas duas premissas históricas.
- Não há evidência no repositório de migrations ou dados históricos. A existência de bancos externos deve ser reconfirmada antes de cada fase.
- `AGENTS.md` exige precisão monetária, auditabilidade, idempotência, autorização e isolamento entre tenants.
- A implementação deve parar ao final de cada fatia para validação e aprovação.

## 5. Arquitetura recomendada

### Abordagem

Adotar inicialmente um **monólito modular com banco relacional**, separando módulos por capacidade e mantendo regras financeiras no backend. Interface e API podem compartilhar o mesmo deploy ou ser separadas conforme a stack aprovada, sem distribuir o domínio em serviços independentes.

### Problema resolvido

- Transações de criação, liquidação, estorno e auditoria permanecem consistentes.
- Operação e observabilidade começam simples.
- Limites modulares permitem extração futura somente se houver evidência de necessidade.

### Alternativas

| Alternativa                                | Benefício                                           | Custo/risco                                                 | Decisão recomendada                     |
| ------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| Monólito modular                           | Menor custo operacional e transações locais.        | Exige disciplina de limites internos.                       | Recomendada.                            |
| Backend API e SPA separados desde o início | Autonomia de interface e contrato explícito.        | Dois toolchains, autenticação e deploy mais complexos.      | Somente se houver requisito confirmado. |
| Microserviços/eventos distribuídos         | Escala e autonomia por serviço em cenários maduros. | Consistência, idempotência e operação muito mais complexas. | Não adotar sem evidência.               |

### Componentes conceituais propostos

Os nomes finais dependem da stack e não correspondem a arquivos existentes:

- identidade e associação usuário-empresa;
- autorização;
- contas financeiras e fonte de saldo;
- compromissos a pagar/receber;
- liquidações, estornos e ajustes;
- calendário e projeção determinística;
- auditoria;
- eventos/jobs e outbox quando necessários;
- integrações bancárias, de cobrança e notificação;
- alertas e explicações.

### Arquivos prováveis

Não é seguro propor caminhos de código antes da escolha da stack. Os únicos arquivos confirmados nesta tarefa são os três documentos em `docs/implementation/`. Após a decisão da Fase 0, um plano específico deve nomear manifests, módulos, contratos, testes e arquivos de infraestrutura reais antes da implementação.

## 6. Invariantes antes da primeira migration

### Financeiros

1. Moeda acompanha todo valor relevante; não usar `float`.
2. Precisão, escala e regra de arredondamento são decisões versionadas e testadas.
3. Saldo é derivado de fontes rastreáveis, nunca de texto gerado por IA.
4. Realizado, confirmado, previsto, provável e simulado são estados/conceitos distintos.
5. Liquidação não apaga compromisso; estorno preserva a história.
6. Liquidações parciais compõem o total e não sobrescrevem eventos anteriores.
7. Operações críticas são transacionais e protegidas contra repetição e concorrência.

### Temporais

1. Definir competência, vencimento, ocorrência, efetivação, liquidação e data contábil.
2. Persistir instantes sem ambiguidade e converter no timezone autorizado da empresa.
3. Definir horário de corte de projeção e jobs.

### Segurança e privacidade

1. Toda consulta e mutação financeira possui contexto obrigatório de empresa.
2. Autorização é aplicada no backend e coberta por testes positivos e negativos.
3. Logs, auditoria e observabilidade minimizam dados pessoais e financeiros.
4. Segredos de provedores não entram no repositório.
5. Retenção e acesso à auditoria possuem política explícita.

## 7. Modelo de dados candidato

Esta seção orienta descoberta e não autoriza migrations. Os conceitos mínimos a validar são:

- **Empresa** e **vínculo de usuário/papel**;
- **conta financeira**, com moeda e origem de saldo rastreável;
- **compromisso financeiro**, inicialmente a pagar, contendo valor, moeda, competência, vencimento, estado, empresa e conta;
- **liquidação**, permitindo múltiplos eventos parciais;
- **estorno/ajuste compensatório**, vinculado ao evento original;
- **registro de auditoria**, com ator, origem, empresa, motivo e mudança;
- **chave idempotente** onde houver repetição possível.

Antes de criar qualquer migration, devem ser aprovados cardinalidades, estados, constraints, índices, precisão decimal e política de exclusão/retenção.

## 8. Sequência executável por fatias

As Fases 1 a 9 são fatias verticais. Cada uma deve cobrir, conforme aplicável e com evidência explícita: persistência/banco, domínio, serviço, API, interface, autorização, auditoria, testes e documentação. A descrição de cada fase destaca seu risco específico; a ausência de repetição textual de uma camada não a exclui da definição de pronto.

### Fase 0 — Fundação executável

**Objetivo:** transformar o repositório documental em uma aplicação mínima reproduzível, sem regra financeira.

**Versões selecionadas e justificativa de compatibilidade:** Node.js `>=24.0.0 <25` (validado com 24.15.0), pnpm 11.12.0, NestJS 11.1.28, Next.js 16.2.10, React 19.2.7, Prisma 7.8.0, TypeScript 5.9.3, ESLint 9.39.5 e Vitest 4.1.10. Os requisitos de engine e peers declarados pelos pacotes são compatíveis entre si; Vitest e o plugin React resolvem Vite 8.1.4. São releases estáveis, sem RC, beta ou canary. A matriz detalhada e suas faixas estão em `docs/architecture/FOUNDATION.md`.

**Precondições:** stack, versões, banco, estratégia de frontend, ambientes e arquitetura de autenticação aprovados.

**Entregáveis:**

- manifests e lockfiles;
- configuração segura por ambiente e exemplo sem segredos;
- conexão com banco e estratégia de migrations;
- estrutura modular mínima;
- health check;
- comandos oficiais de instalação, execução, teste, lint, typecheck, build e segurança;
- CI com os mesmos comandos;
- decisão arquitetural documentada.

**Validação:** instalação limpa, aplicação inicializável, teste mínimo, lint/typecheck/build e verificação de segredos/dependências.

**Critério de aceite:** um colaborador executa o projeto seguindo somente a documentação e obtém os mesmos gates.

**Ponto de parada:** revisar stack, superfície de ataque e custos operacionais antes de modelar finanças.

**Rollback:** remover o scaffold introduzido pela fase ou reverter seu conjunto isolado de mudanças; não há dados de negócio.

**Estado em 13 de julho de 2026:** **COMMITTED_AND_VALIDATED** no commit `258def6`, após revisão integral e validação local.

**Evidências:**

- monorepo pnpm com NestJS, Next.js, PostgreSQL e Prisma criado sem entidades financeiras;
- migration inicial aplicada tanto ao banco local quanto a um banco temporário limpo, depois removido;
- `GET /health` validado com banco disponível (`200`, `status: ok`) e indisponível (`503`, `status: degraded`);
- interface real validada por HTTP e por testes nos estados de carregamento, disponibilidade e indisponibilidade;
- `corepack pnpm install --frozen-lockfile`, `db:generate`, `db:migrate`, `lint`, `typecheck`, `test` e `build` concluídos com código zero;
- 9 testes passaram: 6 da API e 3 da interface;
- `corepack pnpm audit --audit-level moderate` não encontrou vulnerabilidades conhecidas após overrides transitivos;
- PostgreSQL do Compose confirmado como `healthy` em `127.0.0.1:5433`;
- 47 arquivos da Fase 0 consolidados no staging, sem arquivo necessário fora do índice e com `git diff --cached --check` aprovado;
- CI configurada com PostgreSQL isolado e os mesmos gates; execução remota ainda depende de push ou pull request, deliberadamente não realizados nesta fase.

**Ponto de parada atendido:** não iniciar a Fase 1 antes de aprovar glossário financeiro, precisão e arredondamento, datas, fonte do saldo, papéis e matriz de autorização.

### Fase 1A — Domínio mínimo de contas a pagar

**Objetivo:** provar o ciclo mínimo e seguro de uma conta a pagar: criar, consultar, editar enquanto aberta, pagar integralmente, estornar e cancelar, sempre com identidade verificável, isolamento multiempresa, autorização e auditoria.

**Decisão arquitetural:** usar o agregado específico `Payable`; não introduzir `FinancialEntry`, contraparte cadastrada, ledger, eventos ou outbox. O plano normativo e os critérios executáveis estão em `docs/implementation/PHASE-1A-PLAN.md`. O modelo conceitual está em `docs/architecture/FINANCIAL_DOMAIN_MODEL.md` e as decisões em `docs/architecture/decisions/`.

**Escopo removido desta fatia:** conta financeira, saldo, calendário e projeção. Esses consumidores serão construídos depois sobre modelos de leitura derivados das fontes oficiais.

**Precondições:** contrato JWT verificável, mapeamento do principal para usuário interno, membership e matriz de papéis, retenção de auditoria e política monetária/temporal aprovados.

**Critério de aceite resumido:** o fluxo completo funciona sem duplicidade, alteração destrutiva ou vazamento entre empresas; migration limpa e incremental e todos os gates oficiais passam.

**Rollback:** reverter a aplicação preservando as tabelas e os registros; depois do primeiro dado real, nenhuma down migration destrutiva é permitida.

### Fase 2 — Contas a receber e previsão bilateral

**Objetivo:** acrescentar recebíveis reutilizando invariantes comprovados, sem duplicar motor financeiro.

**Fluxo vertical:** banco, domínio, serviço, API, interface, autorização, auditoria, testes e documentação para criação, recebimento e estorno; calendário e projeção passam a combinar entradas e saídas.

**Dependências:** Fase 1 estável; decisão consciente entre um modelo comum com direção e modelos separados; regras de recebimento parcial.

**Critério de aceite:** saldos projetados e realizados são reproduzíveis com pagar/receber, inclusive casos de mesma data e timezone.

**Ponto de parada:** revisar fórmula, performance e linguagem de estados.

**Rollback:** ocultar/desabilitar recebíveis sem afetar contas a pagar; preservar dados criados.

### Fase 3 — Recorrências e calendário operacional ampliado

**Objetivo:** gerar compromissos recorrentes de modo idempotente e oferecer calendário utilizável em volume realista.

**Fluxo vertical:** regra de recorrência versionada, geração auditável, job com chave idempotente, API/interface de série e ocorrência, autorização, testes de timezone e documentação.

**Dependências:** estados e projeção bilaterais estáveis; política para editar uma ocorrência ou toda a série.

**Critério de aceite:** retries não duplicam ocorrências e alterações mantêm histórico.

**Rollback:** interromper geração futura; nunca apagar ocorrências já materializadas.

### Fase 4 — Alertas determinísticos e explicáveis

**Objetivo:** avisar riscos de caixa usando regras reproduzíveis.

**Fluxo vertical:** regra versionada, avaliação por empresa, persistência/ciclo de vida, job idempotente, API/interface com causa, impacto, prazo e ação, autorização, auditoria, testes e documentação.

**Dependências:** projeção confiável, calendário, jobs e observabilidade.

**Critério de aceite:** cada alerta referencia dados e regra que permitem reproduzir o resultado; falsos positivos possuem feedback mensurável.

**IA:** não aplicável ao cálculo inicial. Explicação generativa só entra em fase própria com dataset, baseline, revisão humana, fallback e versionamento.

**Rollback:** desativar versão da regra e preservar alertas/auditoria históricos.

### Fase 5 — Conciliação bancária assistida

**Objetivo:** importar um formato/provedor e conciliar transações com confirmação humana.

**Fluxo vertical:** importação idempotente, armazenamento de origem, matching determinístico, fila de exceções, API/interface de revisão, autorização, auditoria, testes com fixtures sintéticas e documentação operacional.

**Dependências:** contas, liquidações, identificadores externos, jobs e política de dados bancários.

**Critério de aceite:** reimportar o mesmo extrato não duplica eventos; toda associação/desassociação é rastreável; diferenças e tolerâncias são explícitas.

**Rollback:** suspender importação/matching automático, mantendo lotes e decisões para auditoria.

### Fase 6 — Gestão financeira de contratos

**Objetivo:** relacionar contratos versionados a compromissos financeiros.

**Fluxo vertical:** banco e domínio de versão contratual, geração idempotente de compromissos, API/interface, permissões, auditoria, jobs, testes e documentação.

**Dependências:** recorrência, compromissos maduros e política de anexos/retenção/LGPD.

**Critério de aceite:** cada compromisso gerado aponta para a versão e regra de origem; mudanças contratuais não reescrevem histórico.

**Rollback:** interromper novas gerações e preservar vínculos existentes.

### Fase 7 — Cobrança automática com um provedor

**Objetivo:** iniciar e acompanhar cobranças de recebíveis por um único provedor aprovado.

**Fluxo vertical:** adaptador, credenciais seguras, idempotência, webhook autenticado, estados, retries, API/interface, autorização, auditoria, testes contratuais e documentação de operação.

**Dependências:** recebíveis, conciliação, jobs, gestão de segredos e contrato do provedor.

**Critério de aceite:** retries/webhooks não duplicam cobrança ou recebimento; falhas são recuperáveis; o provedor não substitui a fonte interna de verdade.

**Rollback:** desativar novas cobranças, continuar recebendo/conciliando eventos pendentes e preservar referências externas.

### Fase 8 — Notificações multicanal

**Objetivo:** entregar notificações por canais adicionados um a um, começando por notificações internas.

**Fluxo vertical:** preferências e consentimento, template versionado, outbox/job, adaptador de canal, API/interface, autorização, auditoria, retries, observabilidade, testes e documentação.

**Dependências:** eventos estáveis, provedores aprovados, LGPD, políticas de opt-out e retenção.

**Critério de aceite:** entrega é rastreável, duplicidade é controlada, conteúdo respeita tenant/consentimento e falha de canal não altera transação financeira.

**Rollback:** desativar canal/template específico e preservar outbox/auditoria.

### Fase 9 — IA opcional para explicações e priorização

**Objetivo:** avaliar se IA agrega valor sobre alertas determinísticos sem assumir autoridade financeira.

**Precondições:** caso de uso aprovado, dados não sensíveis ou devidamente governados, dataset de avaliação, rubric, baseline, revisão humana, orçamento e fallback.

**Critério de aceite:** qualidade, segurança, latência e custo superam baseline aprovado; toda saída exibe evidências/premissas; modelo/prompt são versionados e reversíveis.

**Rollback:** desligar IA e retornar integralmente à explicação determinística.

## 9. Estratégia de testes transversal

Cada fatia deve executar, conforme aplicabilidade:

- testes unitários de regras e fórmulas;
- testes de integração e constraints do banco;
- testes transacionais, de concorrência e idempotência;
- testes de autorização e isolamento entre empresas;
- testes numéricos com valores exatos, bordas e arredondamento;
- testes de datas, timezone e horário de corte;
- testes de API/contrato e interface, incluindo erro, vazio e permissão;
- testes contratuais de integrações usando dados sintéticos;
- lint, typecheck, build, migrations e segurança;
- regressão da fatia anterior.

Os comandos reais definidos na Fase 0 estão no `README.md` e devem permanecer alinhados à CI.

## 10. Observabilidade e operação

- IDs de correlação e contexto de empresa sem expor dados sensíveis.
- Métricas para erros, latência, filas, retries, duplicidades e divergências.
- Logs estruturados com minimização de dados.
- Alertas operacionais separados dos alertas financeiros do produto.
- Runbooks para falha de jobs, webhook, importação, conciliação e provedor.
- Backup, restauração, RPO/RTO e teste de recuperação definidos antes de produção.

## 11. Deployment, compatibilidade e migrations

- Não há deployment de produção definido; existe uma única migration fundacional para `Company`, `User` e `CompanyMembership`.
- Cada futura migration deve ser revisada quanto a locks, defaults, backfill, constraints, compatibilidade e reversão.
- Mudanças de contrato devem ser aditivas quando possível e mapear consumidores.
- Rollout deve permitir feature flag ou outra contenção equivalente para integrações e automações.
- Nenhuma fase é pronta para produção sem monitoramento, backup/restauração e procedimento de rollback testado.

## 12. Definição de pronto por fatia

Uma fatia está pronta somente quando:

1. fluxo ponta a ponta e critérios de aceite foram demonstrados;
2. invariantes financeiros e transições estão documentados e testados;
3. autorização e isolamento multiempresa passaram em casos positivos e negativos;
4. auditoria reconstrói operações críticas;
5. idempotência, concorrência e rollback foram testados quando aplicáveis;
6. migrations foram revisadas e aplicadas em ambiente descartável;
7. lint, typecheck, testes, build e segurança passam pelos comandos oficiais;
8. observabilidade e runbook existem para falhas relevantes;
9. documentação e contratos estão atualizados;
10. diff não contém alterações fora de escopo;
11. riscos residuais foram aceitos explicitamente;
12. houve ponto de parada e aprovação antes da fatia seguinte.

## 13. Riscos e mitigações

| Risco                                 | Mitigação                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Generalizar pagar/receber cedo demais | Validar primeiro um fluxo de pagar; extrair abstração somente com invariantes comuns comprovados. |
| Saldos inconsistentes                 | Fonte rastreável, cálculo determinístico, constraints, transações e testes exatos.                |
| Vazamento entre empresas              | Escopo obrigatório no backend, testes IDOR e defesa adicional no banco quando disponível.         |
| Dupla liquidação/cobrança             | Chave idempotente, lock/controle de concorrência e unique constraints.                            |
| Histórico perdido                     | Eventos de liquidação/estorno e auditoria; proibir deleção destrutiva.                            |
| Jobs silenciosamente falhos           | Métricas, retries limitados, dead letter/exceções e runbooks.                                     |
| Dependência de provedor               | Adaptador interno, contratos testados e desativação por provedor/canal.                           |
| IA não confiável                      | Cálculo determinístico, baseline, avaliação reproduzível, revisão e kill switch.                  |

## 14. Evidências exigidas em cada ponto de parada

- diff e lista de arquivos;
- migrations e plano de reversão;
- comandos com duração, código de saída e resultado;
- casos de autorização/multiempresa;
- exemplos numéricos e fórmulas;
- evidência de idempotência/concorrência;
- atualização de contratos e documentação;
- riscos residuais e decisão de seguir/parar.

## 15. Decisões bloqueadoras

Resolvidas na Fase 0:

1. stack e versões suportadas;
2. PostgreSQL para desenvolvimento e CI;
3. API NestJS e frontend Next.js separados no mesmo monorepo.

O mecanismo de autenticação e o enforcement de tenant foram deliberadamente adiados e passam a ser bloqueadores da Fase 1.

Antes da Fase 1:

1. país/moeda inicial e suporte futuro a múltiplas moedas;
2. precisão, escala e arredondamento;
3. timezone e semântica das datas;
4. fonte e significado do saldo-base;
5. estados e transições de compromisso/liquidação/estorno;
6. liquidação parcial no primeiro release ou rejeição explícita;
7. papéis e matriz de permissões;
8. retenção, auditoria e requisitos legais/contábeis aplicáveis.

## 16. Próxima ação

A Fase 0 já está commitada no commit `258def6`. A revisão arquitetural da Fase 1A está registrada em `docs/architecture/decisions/`, `docs/architecture/FINANCIAL_DOMAIN_MODEL.md` e `docs/implementation/PHASE-1A-PLAN.md`.

Antes de implementar, aprovar a configuração do emissor JWT, o mapeamento do principal para o usuário interno, a retenção da auditoria e o procedimento de backup/restauração. A implementação deve começar pela identidade e pelo contexto de tenant, não pela migration financeira.
