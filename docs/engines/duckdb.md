# DuckDB

**Level:** 2 · **Versions tested in CI:** DuckDB 1.5 (tested)

## Authentication and transport
file path or :memory:

## Capabilities
Full SQL feature set. The native library is platform-specific and is NOT included in the VSIX: the driver reports a clear error until a platform build is shipped

## Type notes
HUGEINT exact, DECIMAL as string, LIST/STRUCT as JSON

## Read-only enforcement
Client-side statement guard

## External tools
none

## Driver license
@duckdb/node-api (MIT)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d <service>` then `RZ_ENGINES=duckdb pnpm test` (see `test/compose/docker-compose.yml` for ports and `packages/test-engines` for the helpers).
