# PostgreSQL

**Nível:** 1 · **Versões testadas no CI:** 17 (testada); 12–16 devem funcionar, mas não estão no CI

## Autenticação e transporte
usuário/senha, TLS (arquivo de CA ou repositório do sistema), túnel SSH

## Capacidades
Tudo do conjunto de recursos SQL: fila de edição, designer de esquema, ER, comparação, importação/exportação, backup (pg_dump), administração, EXPLAIN (JSON, ANALYZE com confirmação)

## Notas sobre tipos
int8 → exato (bigint além de 2^53), jsonb → visualizador JSON, arrays como arrays; streaming com pg-cursor

## Imposição do somente leitura
`default_transaction_read_only` no servidor nas conexões somente leitura; `pg_stat_statements` opcional para consultas lentas

## Ferramentas externas
`pg_dump`, `pg_restore` (detectados no PATH, nunca incluídos; PostgreSQL License)

## Licença do driver
pg (MIT), pg-cursor (MIT)

## Tela da tabela (filtro, paginação, menu da coluna)
Verificada contra um servidor real em `apps/extension/src/lib/engines.integration.test.mts`: PostgreSQL 17 (filtro, paginação, renomear/tipo/padrão/NOT NULL/adicionar/excluir coluna).

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d <serviço>` e depois `RZ_ENGINES=postgres pnpm test` (veja `test/compose/docker-compose.yml` para as portas e `packages/test-engines` para os auxiliares).

## CockroachDB
O driver PostgreSQL passa o kit de conformidade completo (15/15, incluindo o cancelamento de consultas) contra o CockroachDB v24.3.4, nó único, modo inseguro (`RZ_COCKROACH_PORT`, padrão 26257; `docker compose ... up -d cockroach`). O servidor é detectado a partir de `version()` e as consultas são canceladas com `CANCEL QUERIES` da sessão em vez de `pg_cancel_backend`. Não testado: clusters seguros com certificados de cliente, clusters de vários nós, CockroachDB Cloud, o tratamento de retentativas de serialização (40001) além de relatar o erro e o DDL específico do Cockroach (o designer de esquema usa a sintaxe do PostgreSQL). As alterações de esquema levam segundos no CockroachDB.

## YugabyteDB
O driver PostgreSQL passa o kit de conformidade completo (15/15, incluindo o cancelamento) contra o YugabyteDB 2025.2.7 (YSQL, nó único, `yugabyted`; `RZ_YUGABYTE_PORT`, padrão 15433; `docker compose ... up -d yugabyte`, precisa de cerca de 2 GB de RAM). O servidor é reconhecido a partir de `version()` (`-YB-`). Não testado: clusters de vários nós ou distribuídos geograficamente, YugabyteDB Aeon (nuvem), YCQL (use o driver do Cassandra por sua conta e risco: não testado), TLS e erros de nova tentativa de transação além de relatá-los. As alterações de esquema são lentas no YugabyteDB.
