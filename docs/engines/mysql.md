# MySQL / MariaDB

**Level:** 1 · **Versions tested in CI:** MySQL 8.4 and MariaDB 11 (tested)

## Authentication and transport
user/password, TLS, SSH tunnel

## Capabilities
Same as PostgreSQL; admin locks use MySQL 8 views (MariaDB locks view not implemented)

## Type notes
BIGINT exact, DECIMAL as string, JSON as JSON, BIT/BLOB as bytes

## Read-only enforcement
Session `READ ONLY` transaction mode on read-only connections

## External tools
`mysqldump`, `mysql` (detected on PATH)

## Driver license
mysql2 (MIT)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d <service>` then `RZ_ENGINES=mysql pnpm test` (see `test/compose/docker-compose.yml` for ports and `packages/test-engines` for the helpers).

## TiDB
The MySQL driver passes the full conformance kit (15/15) against TiDB v8.5.1 (single node, `pingcap/tidb`, unistore storage; `RZ_TIDB_PORT`, default 14000). TiDB only implements `SET ... READ ONLY` as a no-op, so for TiDB the driver does **not** trust it: read-only connections are enforced in the driver with a default-deny statement check (reads, `SHOW`, `EXPLAIN`, `WITH ... SELECT`; everything else, multi-statement input, `FOR UPDATE` and `INTO OUTFILE` rejected). That is a client-side guarantee; for a server-side one use a TiDB user with SELECT-only grants. Not tested: TiKV clusters, TiDB Cloud, TLS, placement rules, TiDB-specific DDL in the schema designer.
