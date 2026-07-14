# Produto web

## Register

product

## Público

Proprietários e gestores de PMEs, responsáveis financeiros e administrativos e profissionais que executam contas a pagar sem exigir formação financeira especializada. A interface atende decisão e operação diária.

## Propósito da experiência

Permitir identificar rapidamente o que precisa ser pago, quando vence, quanto custa, qual é o estado atual, quais ações são permitidas e o resultado de cada operação. A experiência deve reduzir erros e transmitir controle, previsibilidade e segurança financeira.

## Personalidade e linguagem

Sóbria, clara, confiável, profissional, moderna, objetiva e acolhedora sem informalidade. Textos usam português direto, evitam jargão desnecessário e explicam como corrigir problemas sem expor detalhes internos.

## Princípios de UX

1. Tornar vencimento, valor, favorecido e status imediatamente legíveis.
2. Evidenciar a próxima ação válida sem esconder contexto ou histórico.
3. Prevenir erros com validação, confirmação proporcional ao risco e feedback conclusivo.
4. Manter listagem, detalhe e formulários consistentes e responsivos.
5. Reduzir esforço cognitivo sem omitir informação financeira essencial.

## Acessibilidade e inclusão

WCAG 2.2 nível AA é a referência. A interface deve oferecer contraste adequado, navegação por teclado, foco visível e previsível, labels e mensagens de erro associadas, nomes acessíveis, alvos adequados, semântica correta e alternativas textuais para qualquer significado comunicado por cor. Diálogos devem controlar e restaurar foco.

## Estados obrigatórios

Carregando, vazio, sucesso, validação, conflito, sem autenticação, sem acesso, recurso inexistente, indisponibilidade e falha de rede devem ser explícitos e orientar a ação seguinte. Estados financeiros nunca dependem apenas de cor.

## Padrões de interação

- empresa é explícita na rota;
- token de desenvolvimento permanece somente em memória e nunca é versionado ou persistido pelo navegador;
- criação, pagamento e estorno mantêm uma chave idempotente estável por tentativa lógica;
- edição informa conflito de versão e nunca sobrescreve silenciosamente;
- pagamento solicita apenas data e confirmação;
- estorno e cancelamento exigem motivo e confirmação;
- ações indisponíveis são removidas ou explicadas conforme papel e estado;
- confirmações usam diálogo somente para operações financeiras de risco.

## Evitar

ERP antigo, densidade excessiva, excesso de tabelas e divisórias, dashboards decorativos, gráficos sem ação, cores neon ou saturadas, gamificação, aparência bancária ou contábil genérica, jargão, excesso de modais, cor como único indicador, números fictícios apresentados como reais e abstrações que escondam vencimento, valor, favorecido ou status.

## Limites da Fase 1A.3

Somente consulta e interface mínima de contas a pagar. Não inclui calendário, timeline financeira, projeção, saldo, contas bancárias, contas a receber, fornecedores estruturados, categorias, centros de custo, anexos, pagamento parcial, parcelamento, recorrência, juros, multa, desconto, contratos, conciliação, cobrança, notificações, gráficos, dashboard ou IA.
