# Estado atual do Sistema Operacional Financeiro com IA

> **Fotografia histórica:** este documento registra o estado encontrado antes da Fase 0, em 13 de julho de 2026. A fundação executável criada depois dessa auditoria está descrita em `docs/architecture/FOUNDATION.md` e nas evidências da Fase 0 em `docs/implementation/IMPLEMENTATION_PLAN.md`. As classificações financeiras abaixo permanecem válidas porque a Fase 0 não criou recursos financeiros.

## Escopo da auditoria

Esta auditoria cobre a árvore de trabalho observada em 13 de julho de 2026. Ela descreve somente evidências existentes no repositório e não atribui capacidades de software à visão de produto registrada no `README.md`.

## Resumo executivo

O repositório está em estágio **greenfield documental**. Há definição resumida do produto, regras de trabalho e uma skill de planejamento, mas não há aplicação, dependências, banco de dados, contratos, interface, infraestrutura ou suíte de testes. Consequentemente, nenhuma funcionalidade financeira está implementada e não existe arquitetura de aplicação vigente a preservar.

## Evidências observadas

| Evidência                      | Constatação                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `README.md`                    | Define propósito e diferencial do produto em linguagem conceitual.                                                                                                 |
| `AGENTS.md`                    | Define processo, restrições arquiteturais e invariantes financeiros.                                                                                               |
| `.gitignore`                   | É derivado do ecossistema Python e menciona ferramentas como Django, Flask e Celery; isso não comprova adoção de nenhuma delas.                                    |
| `.codex/skills/create-plan/`   | Contém a única skill local, voltada a planejamento. Não é código do produto.                                                                                       |
| `git ls-files`                 | Não apresenta arquivos de aplicação além dos documentos e da skill.                                                                                                |
| Busca por manifests            | Não encontrou `pyproject.toml`, arquivos `requirements`, `package.json`, lockfiles, `Dockerfile`, Compose, `Makefile`, `manage.py`, projetos .NET ou equivalentes. |
| Busca por testes               | Não encontrou testes ou especificações fora da skill.                                                                                                              |
| Busca por recursos financeiros | Encontrou somente regras no `AGENTS.md` e visão no `README.md`; não encontrou classes, funções, rotas ou migrations.                                               |

## Arquitetura observada

### Fatos

- Não existe arquitetura de aplicação implementada.
- Não existem módulos de backend ou frontend.
- Não existem contratos de API, schemas, filas, jobs ou eventos.
- Não há banco configurado, migrations, seeds ou fixtures.
- Não há configuração de implantação ou observabilidade.

### Inferência limitada

O `.gitignore` sugere que Python foi considerado em algum momento, mas não há evidência suficiente para declarar linguagem, framework ou versão. A seleção de stack continua aberta.

### Recomendação, não estado atual

Iniciar com um monólito modular e um banco relacional reduz o custo de consistência transacional, auditoria e operação. A stack concreta deve ser decidida antes do scaffold e registrada como decisão arquitetural. Microserviços, CQRS, Event Sourcing e EDA não possuem justificativa observável neste estágio.

## Stack e versões

| Item                   | Estado         |
| ---------------------- | -------------- |
| Linguagem              | Não definida.  |
| Backend                | Não definido.  |
| Frontend               | Não definido.  |
| Banco de dados         | Não definido.  |
| Filas/jobs             | Não definidos. |
| Cache                  | Não definido.  |
| Runtime e versões      | Não definidos. |
| Infraestrutura/hosting | Não definidos. |

## Estrutura e capacidades existentes

| Área auditada                   | Estado observado | Evidência                                            |
| ------------------------------- | ---------------- | ---------------------------------------------------- |
| Módulos de produto              | Inexistentes     | Árvore rastreada sem diretórios de aplicação.        |
| Entidades e migrations          | Inexistentes     | Nenhum modelo ou arquivo de migration.               |
| Autenticação e autorização      | Inexistentes     | Nenhum código ou configuração correspondente.        |
| Isolamento multiempresa         | Inexistente      | Apenas obrigação declarada em `AGENTS.md`.           |
| Contas financeiras e saldos     | Inexistentes     | Nenhuma entidade ou regra localizada.                |
| Contas a pagar/receber          | Inexistentes     | Nenhuma entidade, rota, serviço ou teste localizado. |
| Calendário/agenda               | Inexistente      | Somente visão conceitual em `README.md`.             |
| Contratos                       | Inexistentes     | Somente menção conceitual em `README.md`.            |
| Notificações                    | Inexistentes     | Nenhum canal, template ou serviço localizado.        |
| Filas e jobs                    | Inexistentes     | Nenhuma dependência ou configuração localizada.      |
| Conciliação/importação bancária | Inexistente      | Nenhum parser, formato, integração ou teste.         |
| Alertas                         | Inexistentes     | Somente intenção de produto.                         |
| Projeções                       | Inexistentes     | Somente intenção de produto.                         |
| Integrações externas            | Inexistentes     | Nenhum cliente, segredo de exemplo ou contrato.      |
| Documentação                    | Inicial          | `README.md`, `AGENTS.md` e material da skill.        |

## Comandos oficiais

Não existem comandos oficiais documentados ou inferíveis com segurança para:

- instalação;
- execução;
- testes;
- lint;
- type checking;
- build;
- migrations;
- segurança;
- implantação.

Esse vazio deve ser resolvido no ciclo de fundação, antes de qualquer fatia funcional.

## Git

- Branch observada: `main`.
- Estado da árvore antes da documentação: limpo.
- Relação com remoto: `main` estava dois commits à frente de `origin/main`.
- Commits observados: commit inicial, preparação do agente e integração da skill `create-plan`.
- Não foram executados commit, push, reset ou ações destrutivas.

## Qualidade de testes

Não avaliável: não há aplicação nem testes. A ausência da suíte é um bloqueador para a implementação de regras monetárias, autorização e isolamento por empresa.

## Comandos executados na auditoria

As durações abaixo são tempos de parede observados no ambiente local e devem ser tratadas como aproximações, não benchmarks.

| Comando                                             |          Duração | Código | Resultado                                                                     |
| --------------------------------------------------- | ---------------: | -----: | ----------------------------------------------------------------------------- |
| `Get-Content -Raw -LiteralPath 'AGENTS.md'`         |            0,4 s |      0 | Instruções lidas integralmente.                                               |
| Listagem recursiva de `SKILL.md` em `.codex/skills` |            0,8 s |      0 | Apenas `create-plan` localizada.                                              |
| `Get-Content` da skill e referências obrigatórias   | 4,2 s acumulados |      0 | Workflow, template e checklists lidos.                                        |
| `git status --short --branch`                       |            0,9 s |      0 | `main` limpa e dois commits à frente do remoto antes dos documentos.          |
| `git log --oneline --decorate --graph --all -n 10`  |            0,9 s |      0 | Três commits localizados.                                                     |
| `git ls-files`                                      |            0,8 s |      0 | Somente documentos, `.gitignore` e skill.                                     |
| Listagem recursiva de arquivos fora de `.git`       |            0,9 s |      0 | Nenhum arquivo de aplicação oculto.                                           |
| `Get-Content -Raw -LiteralPath 'README.md'`         |            0,3 s |      0 | Somente visão de produto.                                                     |
| Busca por manifests, lockfiles, Docker e projetos   |            0,5 s |      1 | Nenhuma correspondência; código 1 é o resultado esperado do `rg` sem matches. |
| Busca por testes/specs fora de `.codex`             |            0,2 s |      1 | Nenhuma correspondência; código 1 é o resultado esperado do `rg` sem matches. |
| `git grep` por recursos e invariantes financeiros   |            0,9 s |      0 | Somente menções em `README.md` e `AGENTS.md`.                                 |

Testes, lint, type checking, build, migrations e verificações automatizadas de segurança não foram executados porque não existem aplicação, manifests ou comandos oficiais. O risco residual é total ausência de validação executável do produto até a Fase 0.

## Limitações e débitos arquiteturais

Como não há arquitetura implementada, os itens abaixo são **lacunas de fundação**, e não débitos de código legado:

1. stack e versões não decididas;
2. ausência de modelo central e glossário financeiro;
3. ausência de política monetária, temporal e de arredondamento;
4. ausência de identidade, permissões e isolamento multiempresa;
5. ausência de trilha de auditoria e política de retenção;
6. ausência de contratos de API e estratégia de compatibilidade;
7. ausência de toolchain, testes e CI;
8. ausência de estratégia operacional, observabilidade, backup e recuperação;
9. ausência de decisões para integrações bancárias e canais de notificação;
10. ausência de limites claros entre cálculos determinísticos e uso de IA.

## Fatos, premissas e desconhecidos

### Fatos

- O produto pretendido atende PMEs e tem o calendário financeiro como diferencial declarado.
- Os invariantes do `AGENTS.md` são obrigatórios para futuras mudanças.
- Nenhum dos recursos-alvo possui implementação.

### Premissas provisórias para o plano

- O primeiro mercado é um único país e uma única moeda operacional por empresa. Essa premissa exige confirmação e não autoriza fixar BRL no código.
- O primeiro release pode operar como monólito modular. Essa é uma recomendação reversível, não uma decisão aprovada.
- A primeira fatia pode limitar recorrência, parcelas, integrações e automação, desde que essas exclusões sejam visíveis.

### Desconhecidos bloqueadores

- país, moeda, escala decimal e regra de arredondamento;
- timezone por empresa e definição de datas de competência, vencimento, liquidação e contabilização;
- papéis, matriz de permissões e método de autenticação;
- origem do saldo inicial e autoridade sobre saldos;
- regras de estorno, cancelamento, liquidação parcial e reabertura;
- requisitos legais, fiscais, contábeis e de retenção;
- stack, ambiente de implantação, RPO/RTO e requisitos de escala;
- bancos, formatos de extrato e provedores de cobrança/notificação prioritários;
- necessidade real e limites da IA.
