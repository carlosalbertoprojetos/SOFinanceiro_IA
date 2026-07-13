# Edge case — campo opcional de moeda

Pedido:

> Adicione um campo opcional de moeda à resposta de um endpoint financeiro.

Resultado esperado:

1. investigar contrato, serialização e consumidores;
2. verificar se campo realmente é opcional para consumidores estritos;
3. aplicar invariantes de moeda e compatibilidade;
4. escolher lightweight ou full plan conforme alcance encontrado;
5. nunca assumir baixo risco apenas pelo tamanho do diff.
