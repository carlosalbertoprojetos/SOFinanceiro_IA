# Sistema Operacional Financeiro com IA

## Purpose

Este repositório contém o Sistema Operacional Financeiro com IA.

Antes de alterar código, identifique a arquitetura, os módulos existentes, os comandos oficiais e as convenções já adotadas.

## Working rules

- Preserve alterações existentes.
- Faça a menor mudança suficiente.
- Não invente arquivos, módulos, APIs ou regras de negócio.
- Diferencie fatos encontrados, inferências, premissas e desconhecidos.
- Não declare testes executados sem apresentar evidência.
- Não faça commit, push ou alteração destrutiva sem solicitação explícita.

## Planning

Use `create-plan` antes de mudanças complexas, ambíguas, transversais ou de alto risco, especialmente quando envolverem:

- múltiplos módulos;
- arquitetura;
- contratos;
- banco de dados;
- migrações;
- integrações externas;
- segurança;
- privacidade;
- implantação;
- rollback;
- cálculos ou dados financeiros;
- Inteligência Artificial com impacto relevante.

Não use planejamento extenso para mudanças triviais, locais e facilmente reversíveis.

Quando o pedido for exclusivamente de planejamento, não altere código.

## Financial invariants

Toda mudança financeira deve avaliar, quando aplicável:

- moeda;
- unidade monetária;
- precisão;
- regra e momento do arredondamento;
- timezone;
- data do evento;
- data efetiva;
- data contábil;
- idempotência;
- duplicidade;
- reversão;
- cancelamento;
- conciliação;
- trilha de auditoria;
- autorização;
- isolamento entre tenants;
- retenção e privacidade.

Nunca use `float` binário para representar dinheiro sem justificativa técnica explícita.

## Architecture

Clean Architecture, DDD, arquitetura hexagonal, CQRS, Event Sourcing e EDA são opções condicionais, não requisitos automáticos.

Qualquer adoção deve explicar:

- problema resolvido;
- benefício;
- custo;
- alternativa mais simples;
- impacto de operação e manutenção.

## Validation

Antes de concluir uma alteração, utilize os comandos reais disponíveis no projeto para:

- testes;
- lint;
- type checking;
- build;
- migrações;
- verificações de segurança.

Se algum comando ainda não estiver documentado, investigue-o no repositório antes de planejar ou alterar código.