# HydraDB

**Status:** experimental (mostrado com um selo Experimental). **Nível:** 2 · **Versões testadas:** `ghcr.io/hydra-db/hydradb:latest` (imagem construída em 2026-09-29, logs do HydraDB 0.1.x, API de consulta HTTP `v1`), nó único, texto simples. Outras versões, clusters e implantações com TLS **não estão testados**.

O HydraDB é um banco de dados de grafos sobre armazenamento de objetos que fala OpenCypher por Bolt e por uma API de consulta HTTP ([github.com/hydra-db/hydradb](https://github.com/hydra-db/hydradb), AGPL-3.0). Não deve ser confundido com o Hydra, o data warehouse baseado em Postgres.

## Autenticação e transporte
Token Bearer pela API de consulta HTTP (porta padrão 8443). A porta Bolt **não** é usada. Além de host, porta e token, o formulário pede o **grafo** (`default`) e o **ID da célula** (`cell-0`): o HydraDB não consegue listar células, e uma errada responde com um HTTP 500 opaco (o driver acrescenta uma dica). Um cabeçalho de namespace é opcional. Os servidores implantados exigem TLS (`Usar TLS`); o HTTP simples é para desenvolvimento local.

## Capacidades
Editor Cypher, parâmetros posicionais vinculados como `$p1`, `$p2`…, resultados em streaming como NDJSON (as linhas chegam à grade enquanto o servidor ainda as produz), cancelar (aborta a requisição e chama o endpoint de cancelamento do servidor), `maxRows`. Não editável na grade. Sem transações.

## Notas sobre tipos
As células são tipadas pelo servidor: `vertex_id` e `integer` mantêm a precisão total de 64 bits (os inteiros exatos são colocados entre aspas antes de analisar), floats, booleanos, strings e nulos mapeiam diretamente; as listas são mostradas como JSON; os caminhos são mostrados como o servidor os codifica.

## Limites (com honestidade)
- **A árvore só mostra os rótulos que você lista na conexão** («Rótulos a mostrar na árvore»). O HydraDB não tem `CALL db.labels()`, então rótulos, propriedades e tipos de relacionamento não podem ser descobertos. Abrir um rótulo executa `MATCH (n:Rótulo) RETURN n.id AS id`; escreva sua própria consulta para ver outras propriedades.
- O HydraDB aceita um **subconjunto** do OpenCypher: sem `RETURN n`, sem `RETURN *`, sem aritmética em `RETURN`, gravações só como padrões de aresta ou lotes `UNWIND`, e mais (veja o `USING-HYDRADB.md` do servidor). O driver repassa sua instrução e mostra a mensagem do servidor.
- As verificações de existência sobre ids soltos não são confiáveis por projeto do servidor (um `MATCH` ancorado em um id devolve uma linha fantasma): ancore em um rótulo.
- Sem visualizador de `EXPLAIN` e sem ferramentas de ER/design.

## Imposição do somente leitura
No cliente: o classificador de Cypher que nega por padrão rejeita tudo o que não for reconhecido como leitura (`MERGE`, `CREATE`, `SET`, `DELETE`, procedimentos desconhecidos, várias instruções). `algo.SPpaths`, `algo.SSpaths` e `algo.MSpaths` contam como leituras. Para uma garantia no servidor, use um token sem direitos de escrita, se a sua implantação tiver um.

## Ferramentas externas
nenhuma

## Licença do driver
nenhuma (construído sobre node:http)

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d hydradb` e depois `pnpm --filter @rizomadb/driver-hydradb test` (porta HTTP 18443, substitua com `RZ_HYDRADB_PORT`; o token de teste está em `test/compose/hydradb-auth-token`). O CI o executa no job `engines-extra`, que inicia o motor a partir do arquivo compose (a imagem precisa de um arquivo de token, então não pode ser um serviço do job).
