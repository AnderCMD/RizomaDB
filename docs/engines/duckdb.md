# DuckDB

**Level:** 2 · **Versions tested in CI:** DuckDB 1.5 (tested)

## Authentication and transport
file path or :memory:

## Capabilities
Full SQL feature set. The native library is platform-specific. It is included in the per-platform VSIX files (darwin-arm64/x64, linux-x64/arm64, win32-x64/arm64; about 38 MB each) and NOT in the universal VSIX, where the driver reports a clear error. Only the darwin-arm64 package was run here, plus the linux-x64 one in CI; the other platforms are built by the release workflow, which has never run, so they are not tested

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
