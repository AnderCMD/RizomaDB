# InfluxDB 3 (Core / Enterprise)

**Level:** 2 · **Versions tested:** InfluxDB 3 Core 3.12.1, single node, file object store, started with `--without-auth` (tested). Enterprise, Cloud Dedicated/Serverless and authenticated servers use the same HTTP API and a bearer token, but are **not** tested.

## Authentication and transport
Optional API token (`Authorization: Bearer …`) over HTTP or HTTPS. The database name is part of the connection.

## Capabilities
SQL editor (DataFusion dialect; the ANSI helpers apply), positional parameters (`$p1`, `$p2`…), JSON-lines streaming, tables and columns in the explorer (from `information_schema`), text `EXPLAIN`. InfluxQL and the write API (line protocol) are not used.

## Type notes
The server does not send result types: kinds are inferred from the values (integer vs float is decided by the JSON literal; timestamps arrive as ISO text and become dates only when they carry a time-zone suffix). 64-bit integers stay exact (needs a runtime with `JSON.parse` source access). The `time` column is shown first. Rows with different columns are unioned over the first 2000 rows.

## Limits (honest)
- Read-only by construction: the SQL endpoint rejects `INSERT`/`DELETE`/DDL, and the driver never calls the write endpoint. Writing data, retention, triggers and the processing engine are out of scope.
- One database per connection; no database switcher.
- No plan viewer beyond text `EXPLAIN`.

## Read-only enforcement
Server-side for the SQL path (the endpoint cannot modify data); tokens can additionally be restricted.

## External tools
none

## Driver license
none (built on node:http)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d influxdb3` then `pnpm --filter @rizomadb/driver-influxdb3 test` (port 18181; override with `RZ_INFLUXDB3_PORT`).
