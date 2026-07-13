---
name: create-plan
description: Transformar mudanças complexas, ambíguas ou de alto risco em plano executável baseado no repositório, com sequência, gates e rollback; não usar para tarefas triviais e locais.
---

# Create Plan

## Objective

Investigar estado real e transformar mudança complexa em plano proporcional, ordenado e verificável, sem implementar código quando a entrega solicitada é somente planejamento.

## Use this skill when

- Mudança cruza módulos, arquitetura, contratos, dados, migração ou integração externa.
- Há risco material de segurança, privacidade, operação, finanças ou IA.
- Deployment, compatibilidade, rollout ou rollback exigem coordenação.
- Requisito relevante é ambíguo e precisa de investigação antes da execução.

## Do not use this skill when

- Tarefa é typo, renomeação local, ajuste cosmético, comentário ou documentação simples.
- Correção é isolada, reversível, de baixa complexidade e sem consumidor externo.
- Pedido é pergunta conceitual sem mudança a executar.
- Checklist leve ou execução direta resolve com segurança.

## Required inputs

- Solicitação, repositório ou contexto, restrições, objetivo e definição conhecida de sucesso.

## Optional inputs

- Prazo, stack, riscos, ADRs, requisitos regulatórios, consumidores, contexto financeiro, contexto de IA e dependências externas.

## Expected outputs

- Decisão explícita entre plano completo, lightweight plan ou execução direta.
- Plano baseado em evidências usando template apropriado em `assets/templates/`.
- Fatos, inferências, premissas, desconhecidos, recomendações e decisões separados.
- Sequência executável com precondições, validação, critérios de aceite e rollback quando aplicável.

## Workflow

1. Determinar se planejamento é necessário com `assets/checklists/planning-readiness.md`.
2. Recomendar execução direta ou lightweight plan quando complexidade e risco forem baixos.
3. Ler `AGENTS.md`, instruções locais, ADRs e contratos relevantes.
4. Inspecionar estado atual, rotas, módulos, dados, comandos e artefatos reais.
5. Coletar evidências e registrar origem; não inferir arquivo ausente.
6. Classificar fatos, inferências, premissas, desconhecidos, recomendações e decisões.
7. Definir objetivo, sucesso, escopo, não escopo, restrições, stakeholders e consumidores.
8. Mapear arquitetura, contratos, dados, dependências e invariantes afetados.
9. Consultar Skills especializadas somente quando adicionarem restrição material.
10. Comparar alternativas e trade-offs; escolher abordagem proporcional.
11. Ordenar implementação por precondições, dependências, migração e compatibilidade.
12. Definir testes, observabilidade, deployment, rollback, riscos e mitigações.
13. Aplicar checklists financeiro e de IA quando relevantes.
14. Revisar com `assets/checklists/plan-quality.md` e entregar próxima ação executável.

## Mandatory rules

- Investigar antes de planejar; não inventar arquivos, arquitetura, execução ou conformidade.
- Não implementar código quando a tarefa for somente planejamento.
- Não aplicar DDD, CQRS, Event Sourcing ou EDA sem problema e custo demonstrados.
- Não usar plano extenso para tarefa trivial nem confundir quantidade de etapas com qualidade.
- Registrar desconhecidos; investigar antes de fazer pergunta que o repositório pode responder.
- Assumir somente condições seguras e reversíveis, marcando-as como premissas.
- Identificar perguntas realmente bloqueadoras e decisões que exigem autoridade do usuário.
- Ordenar etapas por dependência e associar gates, evidências e critérios de aceite.
- Incluir migração, compatibilidade, segurança, privacidade, rollout e rollback quando aplicáveis.
- Em finanças, considerar moeda, precisão, arredondamento, datas, timezone, idempotência, duplicidade, reversão, reconciliação e auditabilidade.
- Em IA, considerar dados, avaliação, revisão humana, drift, rollback, observabilidade e custo de erro; não inventar confiança.
- Marcar seções não aplicáveis em vez de preenchê-las com conteúdo genérico.

## Good practices

- Nomear arquivos e comandos somente após inspeção.
- Vincular cada risco a mitigação e evidência de validação.
- Separar dependência obrigatória, consulta opcional e referência compartilhada.
- Preferir fases pequenas, reversíveis e verificáveis.

## Common errors

- Planejar sem mapear estado atual ou listar atividades sem ordem e gate.
- Omitir consumidores externos, dados históricos ou ponto de não retorno.
- Tratar segurança, finanças e IA como anexos genéricos.

## Stop and escalation conditions

- Parar se decisão material ausente mudar a abordagem e não puder ser descoberta com leitura segura.
- Escalar conflito com ADR, ação destrutiva, obrigação regulatória sem fonte ou ponto sem rollback aceito.
- Não parar por mera complexidade; registrar lacunas e continuar partes não bloqueadas.

## Validation

- Sempre usar `planning-readiness.md` e `plan-quality.md`.
- Usar checklists financeiro/IA e migration template somente quando aplicáveis.
- Confirmar arquivos reais, etapas ordenadas e critérios verificáveis.
- Consultar `evals/` e `examples/` para fronteiras e adversariais.

## References

- Ler `references/planning-model.md` para classificação, aplicabilidade, dependências e saída.
- Usar template completo, leve ou de migração conforme risco.
