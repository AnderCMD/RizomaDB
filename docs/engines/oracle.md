<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Oracle Database

**Level:** 1 · **Versions tested in CI:** Oracle Free 23ai (tested); 12c+ expected

## Authentication and transport
user/password via thin mode (no Oracle Client needed); wallet/Kerberos NOT implemented. Connect with a **service name** or, for old databases, a **SID**; both can be filled from a `jdbc:oracle:thin:` URL (see [Connections](../guides/connections.md#paste-a-jdbc-url)). TCPS (TLS), TNS aliases and OCI URLs are NOT supported. Needs Oracle Database **12.1 or later** (older servers fail with NJS-138; the Oracle Client "thick" mode is NOT supported). Tested against Oracle Free 23ai by service name, SID and descriptor

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

## Table screen (filter, paging, column menu)
Verified against a real server in `apps/extension/src/lib/engines.integration.test.mts`: Oracle Free 23ai (filter, paging, column rename/type/default/NOT NULL/add/drop; names are the upper-case ones Oracle stores).

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d <service>` then `RZ_ENGINES=oracle pnpm test` (see `test/compose/docker-compose.yml` for ports and `packages/test-engines` for the helpers).
