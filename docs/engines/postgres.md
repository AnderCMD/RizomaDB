# PostgreSQL

**Level:** 1 · **Versions tested in CI:** 17 (tested); 12–16 expected to work, not in CI

## Authentication and transport
user/password, TLS (CA file or system store), SSH tunnel

## Capabilities
Everything in the SQL feature set: edit queue, schema designer, ER, compare, import/export, backup (pg_dump), admin, EXPLAIN (JSON, ANALYZE gated)

## Type notes
int8 → exact (bigint when beyond 2^53), jsonb → JSON viewer, arrays as arrays; pg-cursor streaming

## Read-only enforcement
Server-side `default_transaction_read_only` on read-only connections; `pg_stat_statements` optional for slow queries

## External tools
`pg_dump`, `pg_restore` (detected on PATH, never bundled; PostgreSQL License)

## Driver license
pg (MIT), pg-cursor (MIT)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d <service>` then `RZ_ENGINES=postgres pnpm test` (see `test/compose/docker-compose.yml` for ports and `packages/test-engines` for the helpers).

## CockroachDB
The PostgreSQL driver passes the full conformance kit (15/15, including query cancellation) against CockroachDB v24.3.4, single node, insecure mode (`RZ_COCKROACH_PORT`, default 26257; `docker compose ... up -d cockroach`). The server is detected from `version()` and queries are cancelled through `CANCEL QUERIES` for the session instead of `pg_cancel_backend`. Not tested: secure clusters with client certificates, multi-node clusters, CockroachDB Cloud, serializable-retry (40001) handling beyond reporting the error, and Cockroach-specific DDL (the schema designer targets PostgreSQL syntax). Schema changes take seconds on CockroachDB.

## YugabyteDB
The PostgreSQL driver passes the full conformance kit (15/15, including cancellation) against YugabyteDB 2025.2.7 (YSQL, single node, `yugabyted`; `RZ_YUGABYTE_PORT`, default 15433; `docker compose ... up -d yugabyte`, needs about 2 GB of RAM). The server is recognised from `version()` (`-YB-`). Not tested: multi-node or geo-distributed clusters, YugabyteDB Aeon (cloud), YCQL (use the Cassandra driver at your own risk: untested), TLS, and transaction-retry errors beyond reporting them. Schema changes are slow on YugabyteDB.
