# A grade de resultados

Abrir uma tabela ou executar uma consulta mostra as linhas em uma grade feita para explorar. Cada botão é um ícone com um rótulo ao passar o mouse ou receber o foco.

## Anatomia
1. **Cabeçalho**: a conexão (logotipo, nome, ambiente), a tabela e um status como `1 000 linhas · 12 ms · há mais linhas`.
2. **Abas** (somente para tabelas): **Dados**, **Propriedades**, **Relações**, **DDL**.
3. **Linha de consulta**: a instrução que produziu as linhas. **É editável.**
4. **Barra de filtro** (tabelas dos motores suportados): filtra e ordena no banco de dados.
5. **Barra de ferramentas**: buscar, filtros por coluna, mostrar/ocultar colunas, painel de registro, linhas compactas, copiar, salvar, executar de novo, atalhos.
6. **Barra de edição** (resultados editáveis): editar, adicionar linha, excluir, desfazer, refazer, revisar o SQL, descartar, **Aplicar**.
7. **Grade** e, depois, um **rodapé** com a contagem de linhas, o tempo e as estatísticas da coluna selecionada.

## A linha de consulta
Altere o texto e pressione o botão de reproduzir ou **Ctrl/⌘+Enter** para executá-lo; **Esc** devolve o original. O texto editado é uma **nova consulta**: ela deixa de dizer qual tabela mostra, então seu resultado é somente leitura. Se houver edições pendentes, você é consultado antes de elas serem descartadas. O texto sem alterações apenas executa de novo a visão da tabela. Os outros dois botões copiam a consulta ou a abrem em um editor normal.

## Filtrar no banco de dados
Nas tabelas, uma barra sob a linha de consulta altera a própria instrução, então a paginação e a edição continuam funcionando:

| Motor | Caixa de filtro | Caixa de ordem |
|---|---|---|
| Motores SQL | uma condição: `age > 30 AND city = 'Lima'` | `name DESC` |
| MongoDB | uma consulta Mongo: `{ "status": "A" }` | uma ordenação: `{ "total": -1 }` |
| Elasticsearch / OpenSearch | texto de busca: `level:error` | `timestamp:desc` |
| Neo4j | uma condição sobre `n`: `n.age > 30` | `n.name` |

Pressione Enter (ou o botão de confirmar) para aplicar e **Esc** (ou o X) para limpar. O texto é colocado em uma instrução por uma única função verificada: `;`, comentários e parênteses sem par são recusados, e a instrução ainda passa pela política. Isso é diferente do **funil da barra de ferramentas**, que filtra apenas as linhas já carregadas.

## Trabalhar com colunas
Clique no nome de uma coluna para **ordenar** (crescente, decrescente, nenhuma). Arraste a borda para **redimensionar** (dois cliques ajustam ao conteúdo). O menu **⋮** de um cabeçalho, ou um clique com o botão direito nele, oferece: ordenar, limpar a ordenação, filtrar esta coluna, ajustar a largura, ocultar, **estatísticas da coluna…**, copiar o nome, copiar os valores. As *estatísticas da coluna* abrem um painel pequeno com o número de valores, nulos e valores distintos, o mínimo e o máximo (mais a média e a soma para números) e um gráfico de barras: os valores mais frequentes, ou um histograma para uma coluna numérica com muitos valores distintos. É calculado sobre as linhas mostradas na grade (os filtros se aplicam), não sobre a tabela inteira. As colunas ocultas voltam pelo botão de colunas. Larguras e colunas ocultas são lembradas por formato de resultado.

Nas tabelas SQL, o mesmo menu pode alterar a estrutura: **Renomear coluna…**, **Alterar tipo…**, **Alternar NOT NULL**, **Definir padrão…**, **Adicionar coluna…**, **Excluir coluna…**. Cada uma mostra o SQL exato e pede confirmação; as alterações destrutivas são sinalizadas e as políticas se aplicam. O SQLite não consegue alterar algumas coisas no lugar e avisa.

## Células, linhas e o painel de registro
- Clique com o botão direito em uma célula: copiar, copiar a linha como JSON, filtrar por este valor, abrir o painel de registro, editar, definir NULL, definir como texto vazio, excluir a linha.
- Clique no número à esquerda de uma linha para selecioná-la; Ctrl/⌘ alterna e Shift seleciona um intervalo. **Selecionar tudo** é a marca no canto.
- **Painel de registro** (Alt+Enter): uma linha como formulário, com anterior/próxima, copiar como JSON, botões de copiar e NULL por campo e formatação de JSON.
- Os booleanos mostram ✓/✗, os números ficam alinhados à direita, NULL e DEFAULT são marcados, e a chave (🔑) e NOT NULL (*) são marcados no cabeçalho.

## Copiar e salvar
Os botões de copiar e salvar exportam **o que você vê** (colunas visíveis, ordem e filtro atuais) ou apenas as linhas selecionadas, como **CSV, TSV, JSON ou Markdown**. Para resultados muito grandes, use **Exportar dados…**, que grava em um arquivo em fluxo contínuo.

## Paginação
Uma tabela abre com uma primeira página (`rizomadb.table.openRows`, 200); uma consulta começa com `rizomadb.query.pageSize` (1000). Se houver mais linhas, o rodapé mostra **Carregar mais N** e **Carregar tudo**; as novas linhas são acrescentadas sem perder sua ordenação, seus filtros nem sua seleção. `rizomadb.query.maxRows` (100 000) é o máximo de linhas mantidas em uma visão; acima disso, o rodapé diz para refinar a consulta ou exportar.

Como funciona, com honestidade: a consulta é executada de novo e as linhas já mostradas são puladas, o que funciona em **todos** os motores. O banco de dados refaz o trabalho até esse ponto, então as páginas muito profundas são mais lentas e, sem um `ORDER BY`, o motor não é obrigado a devolver as linhas na mesma ordem duas vezes. Para um resultado estável em uma tabela que muda, ordene-a. Se houver edições pendentes, você deve aplicá-las ou descartá-las antes de carregar mais.

Opcional e desativado por padrão: ative `rizomadb.query.keysetPaging` e a tabela abre ordenada por sua chave primária, e *Carregar mais* pede ao banco de dados as linhas **depois** da última chave em vez de pular linhas, então as páginas profundas continuam tão rápidas quanto a primeira. Foi testado no SQLite, PostgreSQL, MySQL, SQL Server e Oracle; os outros motores, as tabelas sem chave primária, as chaves que não são números nem texto e uma ordenação própria digitada na caixa de filtro continuam pulando linhas. Como a tabela fica ordenada por sua chave, a ordem das linhas difere da ordem natural do motor.

## Onde os resultados abrem
`rizomadb.results.location`: `bottom` (a metade inferior sob o editor, o padrão), `full` (toda a área do editor) ou `beside`.

## Atalhos
| Teclas | Ação |
|---|---|
| Setas, Home/End, PageUp/PageDown | Mover entre células |
| Shift + ↑/↓ | Estender a seleção de linhas |
| Espaço | Selecionar ou desmarcar a linha |
| Ctrl/⌘ + A | Selecionar todas as linhas |
| Enter, F2, dois cliques | Editar a célula |
| Delete | Definir NULL, ou excluir as linhas selecionadas |
| Ctrl/⌘ + Z / Y | Desfazer / refazer |
| Ctrl/⌘ + C | Copiar a célula ou as linhas selecionadas |
| Ctrl/⌘ + F | Buscar nos resultados |
| Alt + Enter | Painel de registro |
| Shift + F10 | Menu de contexto |
| Esc | Limpar a seleção |

O botão de teclado na barra de ferramentas os lista no aplicativo.
