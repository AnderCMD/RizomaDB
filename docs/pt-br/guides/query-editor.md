# O editor de consultas

**RizomaDB: Nova consulta** abre um editor na linguagem da conexão: SQL, shell do Mongo, comandos do Redis, Cypher (Neo4j, HydraDB), requisições REST para Elasticsearch/OpenSearch e o console JSON do Firestore, ou Flux e CQL onde esses motores se aplicam. Escolha a conexão com o item da barra de status ou com a primeira lente do editor.

## Montar uma consulta sem digitar SQL
Clique com o botão direito em uma conexão SQL e escolha **Montar uma consulta…**: escolha uma tabela, as colunas a mostrar, qualquer número de condições (coluna, operador, valor; `IN` recebe uma lista separada por vírgulas), a ordem e o limite de linhas. O RizomaDB abre o `SELECT` resultante em um editor vinculado a essa conexão; ele não o executa. Os valores viram literais do tipo da coluna (um valor que não cabe, como texto para um número, é recusado), os nomes são citados pelo driver e a instrução foi verificada com PostgreSQL e MySQL reais, incluindo aspas, barras invertidas e acentos em texto. Os outros motores SQL usam o mesmo código, mas não são cobertos por um teste.

## Executar
| Ação | Como |
|---|---|
| Executar a instrução sob o cursor | **Ctrl+Enter** (⌘+Enter), ou a lente **Executar** acima dela |
| Executar a seleção | **Ctrl+Shift+Enter** (⌘+Shift+Enter) |
| Executar todas as instruções | Lente **Executar tudo (N)** no topo do arquivo, ou **RizomaDB: Executar todas as instruções** |
| Explicar o plano (motores SQL que suportam) | Lente **Explicar**, ou **RizomaDB: Explicar o plano da consulta** |
| Cancelar | **RizomaDB: Cancelar a consulta em execução**, ou o botão de parar no cabeçalho dos resultados |

**Executar tudo** executa as instruções em ordem e para no primeiro erro. Fora de `dev`, pede confirmação antes, uma vez para o arquivo inteiro. Cada instrução ainda passa pela política e pelo log de auditoria por conta própria.

### Instruções
- O SQL é dividido por ponto e vírgula de nível superior (strings, comentários e dollar quotes do PostgreSQL são entendidos). O Cypher também divide em `;`.
- O shell do Mongo e o console dos motores de busca usam **blocos separados por linhas em branco**; o Redis usa **um comando por linha**. As linhas de comentário (`//`, `#`, `--`) são ignoradas.
- A instrução sob o cursor fica **destacada** (`rizomadb.editor.highlightStatement`). As lentes podem ser desativadas com `rizomadb.editor.codeLens`.

### Parâmetros
Marcadores como `:nome`, `$1`, `@nome` ou `?` pedem seus valores antes de executar. Os valores são tipados (`null`, `true`, números e `"texto entre aspas"`; qualquer outra coisa é texto), vinculados pelo driver e lembrados por conexão.

## Resultados
Os resultados abrem na metade inferior da janela (`rizomadb.results.location`). Cada execução substitui a mesma aba; **Fixar a aba de resultados** a mantém. A aba se chama `conexão.tabela` e tem o logotipo do motor. Veja [A grade de resultados](results-grid.md).

## Histórico
**RizomaDB: Abrir o histórico de consultas** abre uma tela com tudo o que você executou, do mais novo ao mais antigo, agrupado por dia. Busque no texto, filtre por status (todas, bem-sucedidas, com falha) ou por conexão e, para cada entrada, **abra em um editor**, **execute de novo** (quando a conexão ainda existe) ou **copie**. A estrela em cada entrada a adiciona aos seus **favoritos** (o filtro *Favoritas*): os favoritos ficam separados do histórico, então **Limpar** e a configuração de retenção nunca os removem (tire a estrela para excluir um). **Limpar** apaga o histórico. As instruções e os erros são guardados localmente com os segredos ocultados; `rizomadb.history.enabled` e `rizomadb.history.retentionDays` controlam isso.

## Notebooks
**Novo notebook SQL** cria um notebook `.sqlnb`: células SQL com seus resultados abaixo, salvo como JSON simples.

## Segurança
Cada instrução é classificada antes de ser executada. As leituras executam; as gravações seguem o ambiente (confirmação, aprovação, somente leitura); as instruções destrutivas (`DROP`, `TRUNCATE`, `UPDATE`/`DELETE` sem `WHERE`…) perguntam antes. O motivo é mostrado no seu idioma. Veja [Políticas](../enterprise/policy.md).
