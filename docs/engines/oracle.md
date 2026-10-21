# Oracle Database

**Level:** 1 · **Versions tested in CI:** Oracle Free 23ai (tested); 12c+ expected

## Authentication and transport
user/password via thin mode (no Oracle Client needed); wallet/Kerberos NOT implemented

## Capabilities
Same as PostgreSQL; EXPLAIN via PLAN_TABLE

## Type notes
NUMBER read as text and converted (exact); CLOB as text

## Read-only enforcement
No session read-only mode: client-side statement guard. `DBMS_SESSION.SLEEP` cannot be interrupted by cancel; CPU-bound queries can

## External tools
none (Data Pump needs vendor tools)

## Driver license
oracledb thin (Apache-2.0 OR UPL-1.0)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d <service>` then `RZ_ENGINES=oracle pnpm test` (see `test/compose/docker-compose.yml` for ports and `packages/test-engines` for the helpers).
