# Análise de lacunas

> **Contexto temporal:** esta análise foi produzida sobre a fotografia anterior à Fase 0. A fundação técnica já existe, mas nenhum dos nove recursos financeiros foi implementado; por isso, suas classificações de maturidade não foram promovidas.

## Critério de classificação

- **Inexistente:** não há implementação localizada.
- **Protótipo:** existe demonstração sem fluxo completo ou garantias essenciais.
- **Parcialmente implementado:** partes do fluxo existem, mas não entregam uso ponta a ponta.
- **Funcional com lacunas:** fluxo utilizável, porém com lacunas conhecidas para produção.
- **Pronto para produção:** fluxo validado, operável, seguro, observável e documentado.

Menções de intenção no `README.md` não contam como implementação. Na árvore auditada não há arquivos de aplicação, classes, funções, rotas, migrations ou testes a citar.

## Matriz de maturidade

| Recurso                           | Estado atual    | Evidência                                                          | Estado desejado                                                                                        | Lacuna principal                                             | Dependências                                                                            | Prioridade | Complexidade relativa | Recomendação                                                                                                                |
| --------------------------------- | --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Calendário financeiro inteligente | **Inexistente** | Visão conceitual em `README.md`; nenhum componente, rota ou teste. | Visão operacional de compromissos, liquidações e impacto projetado, com filtros por empresa/permissão. | Todo o fluxo e modelo temporal.                              | Modelo financeiro, contas, projeção, timezone, autorização, auditoria.                  | P1         | Alta                  | Entregar visualização mínima dentro da primeira fatia; inteligência avançada depois.                                        |
| Contas a pagar                    | **Inexistente** | Nenhuma entidade, migration, API, interface ou teste.              | Ciclo de criação, alteração controlada, vencimento, liquidação, estorno e auditoria.                   | Todo o domínio e fluxo.                                      | Fundação, empresa, permissões, conta financeira, dinheiro, estados, auditoria.          | P0         | Alta                  | Usar como primeiro fluxo vertical e limitar inicialmente recorrência e parcelas.                                            |
| Contas a receber                  | **Inexistente** | Nenhuma entidade, migration, API, interface ou teste.              | Ciclo equivalente ao pagar, com recebimento e estorno rastreáveis.                                     | Todo o domínio e fluxo.                                      | Invariantes validados em contas a pagar e modelo compatível de lançamentos.             | P1         | Média/Alta            | Implementar após estabilizar o primeiro fluxo; compartilhar invariantes sem generalização prematura.                        |
| Previsão simples de caixa         | **Inexistente** | Somente intenção de projeção em `README.md`.                       | Projeção determinística e reproduzível por data, separando realizado, confirmado, previsto e simulado. | Fonte de saldo, motor, política temporal e testes numéricos. | Conta financeira, eventos rastreáveis, pagar/receber, timezone, estados.                | P1         | Alta                  | Incluir cálculo mínimo na primeira fatia; cenários e probabilidades ficam para depois.                                      |
| Alertas inteligentes              | **Inexistente** | Somente intenção de identificar riscos em `README.md`.             | Alertas explicáveis com evidência, impacto, prazo e ação recomendada.                                  | Regras, dados, avaliação, ciclo de vida e observabilidade.   | Projeção confiável, jobs idempotentes, auditoria e preferências.                        | P2         | Alta                  | Começar com regras determinísticas versionadas; IA generativa apenas como explicação opcional e nunca como cálculo oficial. |
| Conciliação bancária              | **Inexistente** | Nenhum importador, integração, entidade ou teste.                  | Importação idempotente, correspondência assistida, exceções, confirmação e trilha de auditoria.        | Todo o domínio de extrato e matching.                        | Contas, liquidações, identificadores externos, idempotência, filas, formatos bancários. | P2         | Muito alta            | Começar por um formato/provedor e conciliação manual assistida antes de automação ampla.                                    |
| Gestão financeira de contratos    | **Inexistente** | Contratos aparecem apenas na definição do produto.                 | Contrato versionado gerando compromissos rastreáveis sem perder vínculo e histórico.                   | Modelo contratual, versionamento e geração idempotente.      | Modelo financeiro, recorrência, auditoria, permissões e jobs.                           | P3         | Muito alta            | Implementar depois que compromissos e recorrências estiverem estáveis.                                                      |
| Cobrança automática               | **Inexistente** | Cobranças aparecem apenas na definição do produto.                 | Orquestração idempotente de cobrança, retries, webhooks, cancelamento e reconciliação.                 | Integração externa, segurança, estados e operação.           | Recebíveis, provedor escolhido, segredos, webhooks, jobs, idempotência, conciliação.    | P3         | Muito alta            | Integrar um provedor por vez; manter o lançamento financeiro como autoridade interna.                                       |
| Notificações multicanal           | **Inexistente** | Nenhum canal, template, job ou teste.                              | Entrega auditável por canais aprovados, consentimento, preferências, retries e fallback.               | Infraestrutura, governança de dados e canais.                | Eventos, outbox/job, templates, consentimento, retenção, provedores e observabilidade.  | P3         | Alta                  | Iniciar com notificações internas; adicionar canais externos separadamente.                                                 |

## Dependências transversais reais

Na fotografia original, nenhuma dependência técnica estava implementada. A Fase 0 concluiu a fundação executável e criou a associação estrutural usuário-empresa; autenticação, autorização e enforcement de tenant continuam pendentes. A ordem abaixo permanece uma **recomendação derivada dos invariantes** para as próximas fases.

1. **Decisões de fundação:** stack, banco, ambientes, comandos oficiais e CI.
2. **Identidade e empresa:** autenticação, associação usuário-empresa, papéis e escopo obrigatório de consultas/mutações.
3. **Política monetária e temporal:** moeda, representação decimal, escala, arredondamento, timezone e semântica das datas.
4. **Modelo financeiro central:** conta financeira, compromisso, estados, liquidação, reversão e auditoria.
5. **Projeção determinística:** saldo de origem rastreável e composição por eventos classificados.
6. **Eventos e execução assíncrona:** somente quando alertas, importações, cobranças ou notificações exigirem retries e idempotência.
7. **Integrações:** banco, cobrança e canais após contratos internos estáveis.
8. **IA:** apenas sobre dados e regras validados, com avaliação, supervisão e fallback determinístico.

## Invariantes que bloqueiam implementação segura

### Dinheiro

- Não usar `float` binário.
- Definir moeda e unidade por valor.
- Decidir precisão, escala e momento do arredondamento antes da primeira migration.
- Cobrir fórmulas com exemplos numéricos e resultados exatos.

### Estados e liquidação

- Separar compromisso previsto de evento realizado.
- Definir transições autorizadas e impedir atualização destrutiva de liquidados.
- Modelar liquidação parcial sem sobrescrever histórico.
- Usar estorno ou compensação para reversão.

### Tempo

- Distinguir competência, vencimento, evento, efetivação, liquidação e contabilização quando aplicáveis.
- Armazenar instantes de forma não ambígua e exibir no timezone autorizado da empresa.
- Definir horário de corte para projeção, jobs e alertas.

### Segurança e multiempresa

- Aplicar escopo da empresa no backend e no banco quando suportado.
- Testar IDOR, mass assignment e consultas sem filtro de empresa.
- Exigir autorização explícita para criação, edição, liquidação, estorno, importação e automação.
- Não registrar dados financeiros sensíveis desnecessariamente.

### Idempotência e auditoria

- Definir chaves idempotentes para imports, jobs, webhooks e geração de recorrências.
- Registrar ator, empresa, origem, instante, valores anteriores/novos e motivo, com proteção adequada contra alteração.
- Tratar concorrência em liquidação e conciliação de forma transacional.

## Riscos bloqueadores

| Risco                    | Efeito                                                                              | Mitigação/gate                                                    |
| ------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Stack não decidida       | **Resolvido na Fase 0:** monorepo TypeScript, NestJS, Next.js, PostgreSQL e Prisma. | Manter a matriz de compatibilidade e os gates documentados.       |
| Sem política monetária   | Saldos e liquidações podem divergir.                                                | Aprovar moeda, precisão, escala e arredondamento antes do modelo. |
| Sem modelo temporal      | Calendário e projeção podem usar datas incompatíveis.                               | Aprovar glossário temporal e timezone antes da primeira fatia.    |
| Sem matriz de permissões | Risco de fraude e vazamento entre empresas.                                         | Definir papéis e casos negativos de autorização.                  |
| Saldo sem fonte oficial  | Projeções não serão auditáveis.                                                     | Definir fonte, momento e reconciliação do saldo-base.             |
| Automação precoce        | Duplicidade de cobrança, notificação ou lançamento.                                 | Estabilizar estados e idempotência antes de jobs externos.        |
| IA precoce               | Recomendações não reproduzíveis ou sem evidência.                                   | Alertas determinísticos primeiro; avaliação formal antes de IA.   |

## Prioridade consolidada

1. Concluído — fundação executável e associação estrutural usuário-empresa; permissões e invariantes financeiros permanecem P0 antes da Fase 1.
2. P0 — primeira fatia vertical de conta a pagar com calendário, projeção, liquidação e auditoria.
3. P1 — contas a receber e ampliação segura da projeção/calendário.
4. P2 — alertas determinísticos e conciliação bancária assistida.
5. P3 — contratos, cobrança automática e notificações multicanal.
6. Posterior — recursos generativos, condicionados a necessidade e avaliação reproduzível.
