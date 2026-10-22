# SQL Server

**Level:** 1 · **Versions tested in CI:** SQL Server 2022 (tested)

## Authentication and transport
SQL login, TLS, SSH tunnel (Windows/Kerberos/NTLM and Azure AD are NOT implemented)

## Capabilities
Same as PostgreSQL; EXPLAIN via SHOWPLAN_ALL

## Type notes
BIGINT exact; DECIMAL/NUMERIC arrive as JS numbers from the driver (tedious), so values beyond 2^53 lose precision

## Read-only enforcement
No session read-only mode exists: the driver rejects non-read statements (client-side guard)

## External tools
none (native backup needs vendor tools)

## Driver license
tedious (MIT)

## Table screen (filter, paging, column menu)
Verified against a real server in `apps/extension/src/lib/engines.integration.test.mts`: SQL Server 2022 (filter, paging, column rename/type/default/NOT NULL/add/drop; a default is changed by looking up and replacing its generated constraint).

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d <service>` then `RZ_ENGINES=mssql pnpm test` (see `test/compose/docker-compose.yml` for ports and `packages/test-engines` for the helpers).
