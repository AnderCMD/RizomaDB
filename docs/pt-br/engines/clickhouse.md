# ClickHouse

**Nível:** 2 · **Versões testadas no CI:** ClickHouse 24.8 (testada)

## Autenticação e transporte
usuário/senha sobre HTTP(S)

## Capacidades
Consultas, explorador, exportação, EXPLAIN (texto). As linhas não são editáveis (as mutações são assíncronas)

## Notas sobre tipos
Int64/UInt64 exatos; datas como strings ISO

## Imposição do somente leitura
`readonly=2` imposto pelo servidor

## Ferramentas externas
nenhuma

## Licença do driver
@clickhouse/client (Apache-2.0)

## Tela da tabela (filtro, paginação, menu da coluna)
Verificada contra um servidor real em `apps/extension/src/lib/engines.integration.test.mts`: ClickHouse 24.8 (somente filtro e paginação: as colunas não são alteradas pela grade neste motor).

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d <serviço>` e depois `RZ_ENGINES=clickhouse pnpm test` (veja `test/compose/docker-compose.yml` para as portas e `packages/test-engines` para os auxiliares).
