# ClickHouse

**Level:** 2 · **Versions tested in CI:** ClickHouse 24.8 (tested)

## Authentication and transport
user/password over HTTP(S)

## Capabilities
Queries, explorer, export, EXPLAIN (text). Rows are not editable (mutations are asynchronous)

## Type notes
Int64/UInt64 exact; dates as ISO strings

## Read-only enforcement
`readonly=2` enforced by the server

## External tools
none

## Driver license
@clickhouse/client (Apache-2.0)

## Table screen (filter, paging, column menu)
Verified against a real server in `apps/extension/src/lib/engines.integration.test.mts`: ClickHouse 24.8 (filter and paging only: columns are not altered from the grid on this engine).

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d <service>` then `RZ_ENGINES=clickhouse pnpm test` (see `test/compose/docker-compose.yml` for ports and `packages/test-engines` for the helpers).
