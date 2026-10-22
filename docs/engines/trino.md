<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Trino

**Level:** 2 · **Versions tested:** Trino 470, single node, `memory` catalog (tested). Starburst, Athena (Trino-based but a different service), Presto and secured clusters (OAuth, Kerberos, client certificates) are **not** tested.

## Authentication and transport
User name (`X-Trino-User`) over HTTP or HTTPS; optional password (HTTP basic, accepted only over TLS). OAuth2, Kerberos, JWT and client certificates are **not** supported.

## Capabilities
SQL editor (ANSI dialect), `?` parameters (sent as `PREPARE`d statement + `EXECUTE ... USING` with escaped literals), streaming of result pages, catalog/schema selection, schemas, tables, views and columns in the explorer (from `information_schema` of the configured catalog), text `EXPLAIN`. Not editable in the grid.

## Type notes
`bigint` stays exact (needs a runtime with `JSON.parse` source access: VS Code 1.100+ qualifies); `decimal` is text; arrays, maps and rows are JSON; `varbinary` is bytes; dates and timestamps arrive as the server's text.

## Limits (honest)
- Only the configured catalog is browsed; cross-catalog queries work by writing `catalog.schema.table`.
- No primary or foreign keys exist in Trino: the explorer shows none and the schema designer/diff tools are not supported for Trino.
- No transactions; no query-progress display; the query is cancelled with `DELETE` on the statement URI.
- Prepared statements are per request; a very large parameter list is sent as literals.

## Read-only enforcement
Client-side: only `SELECT`, `WITH`, `VALUES`, `SHOW`, `DESCRIBE` and `EXPLAIN` (not `EXPLAIN ANALYZE` of a write) pass on a read-only connection; everything else, including multi-statement input, is rejected. For a server-side guarantee use Trino access-control rules.

## External tools
none

## Driver license
none (built on node:http)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d trino` (about a minute to start) then `pnpm --filter @rizomadb/driver-trino test` (port 18081; override with `RZ_TRINO_PORT`).
