# Neo4j

**Nível:** 2 · **Versões testadas:** Neo4j 5.26 Community (testada). As outras 5.x e Enterprise/Aura devem funcionar, mas **não estão testadas**; a 4.x não é suportada (não tem a Query API).

## Autenticação e transporte
Autenticação básica pela Query API HTTP (porta 7474, ou 7473 com TLS). O protocolo Bolt **não** é usado, então não há recursos exclusivos do Bolt (roteamento, bookmarks entre sessões). Use a porta HTTP no formulário da conexão.

## Capacidades
Editor Cypher (`.cypher`/`.cyp`, executa a instrução terminada em `;` sob o cursor), parâmetros posicionais vinculados como `$p1`, `$p2`…, transações explícitas (commit/rollback), rótulos como «tabelas» com os tipos de propriedades de `db.schema.nodeTypeProperties()`, índices de `SHOW INDEXES`. Não editável na grade.

## Notas sobre tipos
Os inteiros mantêm a precisão total de 64 bits (JSON tipado); nós, relacionamentos, caminhos, listas e mapas são mostrados como JSON; datas, durações e pontos voltam como texto formatado pelo servidor.

## Limites (com honestidade)
- O servidor devolve os resultados como uma única resposta, sem streaming: use `LIMIT`. `maxRows` trunca no cliente depois do download.
- Cancelar aborta a requisição HTTP; o servidor pode continuar executando a instrução até perceber a conexão fechada.
- Não há visualizador de plano `EXPLAIN`.

## Imposição do somente leitura
No cliente: um classificador de Cypher que nega por padrão (`assessCypher`) rejeita tudo o que não for reconhecido como leitura, incluindo procedimentos desconhecidos, `PROFILE`, `LOAD CSV` e requisições com várias instruções. Para uma garantia no servidor, use um papel somente leitura do Neo4j.

## Ferramentas externas
nenhuma

## Licença do driver
nenhuma (construído sobre node:http)

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d neo4j` e depois `pnpm --filter @rizomadb/driver-neo4j test` (porta HTTP 17474, substitua com `RZ_NEO4J_PORT`; as credenciais de teste estão no arquivo compose e no teste).
