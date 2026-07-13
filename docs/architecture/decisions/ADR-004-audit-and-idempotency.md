# ADR-004 — Auditoria e idempotência

- **Status:** Aceito para a Fase 1A
- **Data:** 2026-07-13

## Contexto

Mudanças financeiras devem ser reconstruíveis e retries não podem duplicar criação ou liquidação. Não há infraestrutura prévia de auditoria, jobs ou integrações.

## Problema

Evitar uma tabela genérica sem governança e, ao mesmo tempo, não consolidar contratos incompatíveis em cada módulo. Definir também onde idempotência oferece benefício material além do versionamento.

## Alternativas de auditoria

### A — `PayableAuditEvent`

Simples e consultável, mas pode duplicar infraestrutura em módulos futuros.

### B — `AuditEvent` genérico

Centraliza armazenamento, porém tende a receber payloads arbitrários, dados sensíveis e relações fracas antes de existir governança.

### C — contrato comum e armazenamento específico inicial

Estabelece campos mínimos sem antecipar uma tabela polimórfica.

## Decisão de auditoria

Adotar a alternativa C:

- definir dentro do módulo um contrato `AuditRecorder` consumido imediatamente;
- persistir inicialmente em `PayableAuditEvent` com FK explícita para `Payable`;
- não criar pacote compartilhado enquanto só houver um consumidor;
- um segundo módulo deverá reavaliar se extrai implementação compartilhada ou mantém tabelas específicas com contrato comum.

Contrato mínimo:

- `id`, `companyId`, `payableId`;
- `actorUserId`;
- ação enumerada;
- `occurredAt` em UTC;
- `requestId`/correlation ID;
- versão anterior e posterior quando aplicável;
- alterações permitidas e tipadas;
- motivo normalizado quando a ação exigir.

Campos permitidos no diff: `payeeName`, `description`, `amount`, `currencyCode`, `competenceDate`, `dueDate` e `status`. Valores monetários permanecem strings canônicas.

São proibidos: tokens, cookies, headers de autenticação, senhas, segredos, payload integral da requisição, stack traces, dados bancários e dados pessoais não necessários. Texto livre deve ter tamanho limitado e não ser duplicado indiscriminadamente no evento.

Eventos são append-only pela aplicação. Não haverá endpoint de edição ou exclusão. A política legal de retenção ainda precisa de aprovação; até lá não será criada rotina automática de descarte.

## Decisão de idempotência

Idempotência obrigatória somente para operações com risco material de duplicação por retry:

- criação de conta a pagar;
- pagamento;
- estorno.

Edição usa `version`/`If-Match`. Cancelamento usa transição condicional e versão; repetir o mesmo cancelamento retorna o estado atual sem criar nova auditoria, enquanto motivo conflitante retorna conflito. Operações administrativas futuras não herdam idempotência automaticamente.

Escopo da chave:

```text
companyId + actorUserId + operation + idempotencyKey
```

Persistir:

- hash canônico do payload;
- operação e escopo;
- estado do processamento;
- status HTTP;
- tipo e ID do recurso;
- resposta mínima necessária para replay;
- criação e expiração.

Retenção inicial: sete dias. Mesma chave e mesmo hash devolvem o resultado original; mesma chave e hash diferente responde `409`. A constraint única e a transação definem o vencedor concorrente. Falha com rollback não deixa uma conclusão idempotente falsa.

## Consequências

- Auditoria permanece relacional e governada.
- Idempotência não adiciona custo a toda edição.
- O cliente web precisa gerar chaves para três comandos.
- A extração de infraestrutura comum só ocorre com um segundo consumidor.

## Riscos

- retenção de auditoria ainda sem política jurídica;
- resposta idempotente pode conter dados demais se não for minimizada;
- canonicalização inconsistente do payload pode produzir hashes divergentes;
- cancelamento precisa impedir auditoria duplicada em retries.

## Itens adiados

- tabela global de auditoria;
- limpeza automática de idempotência;
- armazenamento externo imutável;
- idempotência para PATCH e administração.

## Gatilhos para reavaliar

- segundo módulo precisar de auditoria;
- introdução de jobs, webhooks ou integrações;
- requisito regulatório de retenção ou imutabilidade externa;
- clientes offline precisarem de replay prolongado.
