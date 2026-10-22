# Solução de problemas

**Não consigo editar uma célula.** Somente tabelas com chave primária (ou documentos do MongoDB, chaves do Redis) abertas pela árvore são editáveis. Views, consultas personalizadas, uma linha de consulta que você editou e conexões somente leitura não são; a grade explica qual caso se aplica. Verifique se a conexão não é somente leitura e se o ambiente não é `prod` com proteção somente leitura.

**A conexão falha em localhost com um erro de TLS.** Para `localhost`, o formulário desmarca o TLS por padrão. Se você salvou uma conexão antes com o TLS ativado, edite-a ou crie-a de novo. Servidores reais normalmente precisam do TLS ativado; veja a página do motor.

**«Carregar mais» nunca aparece.** Não há mais linhas, ou o limite de linhas (`rizomadb.query.maxRows`) foi atingido; o rodapé diz qual. As instruções que não são leituras não devolvem linhas para paginar.

**As páginas repetem ou pulam linhas.** A paginação executa a consulta de novo e pula as linhas já mostradas, então, sem um `ORDER BY`, o motor pode devolver as linhas em outra ordem. Ordene o resultado na consulta ou na caixa de ordem.

**Um filtro é recusado.** O texto não pode conter `;`, comentários nem parênteses sem par. Escreva apenas uma condição.

**A árvore não mostra tabelas do HydraDB.** O HydraDB não consegue listar rótulos. Escreva os rótulos que quiser no campo *Rótulos a mostrar na árvore* da conexão.

**O HydraDB responde «internal query execution error».** Quase sempre é um **ID da célula** errado; o HydraDB não consegue listar células, então pergunte ao operador.

**Tudo ficou somente leitura depois de editar um arquivo de política.** Um arquivo de política que não pode ser lido faz todas as gravações falharem de forma segura. Abra o canal de saída *RizomaDB policy* para ver o erro.

**Uma tela está no idioma errado.** Defina `rizomadb.language`; reabra as telas abertas. Os nomes de comandos e configurações seguem o idioma do VS Code.

Ainda travado? O canal de saída *RizomaDB policy* e a barra de status mostram o que está bloqueando uma ação. Abra um issue com o motor, a versão e os passos.
