# Planning model

## Aplicabilidade

Use plano completo quando houver múltiplos módulos, persistência, contrato externo, migração, risco material, rollout ou rollback coordenado. Use lightweight plan para mudança limitada com algum risco ou consumidor. Recomende execução direta para tarefa local, reversível e trivial.

Tamanho do diff não mede risco: campo serializado, precisão monetária ou constante pública podem exigir planejamento.

## Classificação

- Fato: observado diretamente.
- Inferência: conclusão derivada de fatos, com limitação.
- Premissa: condição provisória e validável.
- Desconhecido: informação material ausente.
- Recomendação: abordagem proposta.
- Decisão: escolha autorizada ou necessária.
- Evidência: origem verificável que sustenta afirmação.

## Composição

- Dependência obrigatória: capacidade sem a qual workflow não funciona; declarar em `skill.yaml`.
- Consulta opcional: advisor/reviewer carregado somente quando agrega restrição material; não cria aresta.
- Referência compartilhada: conhecimento comum carregado sob demanda; não implica orquestração.

`create-plan` permanece principal. Consultivas não assumem plano nem efeitos colaterais.

## Aplicabilidade das seções

Não force 42 seções. Marque `não aplicável` com motivo curto quando seção é material ao template, mas ausente no caso. Omitir silenciosamente segurança, finanças, IA, migração ou rollback é proibido quando houver risco correspondente.

## Qualidade executável

Cada fase informa objetivo, precondição, arquivos ou componentes, ação, validação, evidência e critério de aceite. Risco possui mitigação. Pergunta bloqueadora muda materialmente abordagem; curiosidade não bloqueia plano.
