# DuckDB

**Nível:** 2 · **Versões testadas no CI:** DuckDB 1.5 (testada)

## Autenticação e transporte
caminho do arquivo ou :memory:

## Capacidades
Conjunto completo de recursos SQL. A biblioteca nativa depende da plataforma. Ela vem incluída nos arquivos VSIX por plataforma (darwin-arm64/x64, linux-x64/arm64, win32-x64/arm64; cerca de 38 MB cada) e NÃO no VSIX universal, onde o driver informa um erro claro. Só o pacote darwin-arm64 foi executado aqui, mais o de linux-x64 no CI; as outras plataformas são construídas pelo workflow de release, que nunca foi executado, então não estão testadas

## Notas sobre tipos
HUGEINT exato, DECIMAL como string, LIST/STRUCT como JSON

## Imposição do somente leitura
Proteção de instruções no cliente

## Ferramentas externas
nenhuma

## Licença do driver
@duckdb/node-api (MIT)

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d <serviço>` e depois `RZ_ENGINES=duckdb pnpm test` (veja `test/compose/docker-compose.yml` para as portas e `packages/test-engines` para os auxiliares).
