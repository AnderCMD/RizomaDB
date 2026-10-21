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
