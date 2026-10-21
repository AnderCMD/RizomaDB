# InfluxDB 2.x

**Level:** 2 · **Versions tested:** InfluxDB 2.7.12 OSS (tested). InfluxDB 3 (SQL/InfluxQL), InfluxDB 1.x and InfluxDB Cloud are **not** supported/tested.

## Authentication and transport
API token (Authorization: Token …) over HTTP or HTTPS, plus the organization name. Create a read-only token for read-only use.

## Capabilities
Flux editor (runs in the SQL editor mode), streaming of annotated CSV, typed columns (long, double, boolean, dateTime, base64Binary), buckets as "schemas" and measurements as "tables" with tag/field keys in the explorer. Not editable in the grid.

## Type notes
`dateTime` values are `Date`; 64-bit integers keep precision. Series with different tag sets give different columns: the first 2000 rows decide the column set (missing values are null); columns that first appear later are dropped with a message. Use `pivot()`/`keep()` to control the shape.

## Limits (honest)
- No positional parameters (Flux has none): write literals into the script.
- Introspection scans the whole retention (`start: 0`) and can be slow on big buckets.
- No writing from the grid, no line-protocol import, no tasks/alerts management.
- No plan viewer.

## Read-only enforcement
Client-side: scripts using `to()`, tasks, or packages that reach outside InfluxDB (http, sql, mqtt, secrets, notification endpoints) are rejected on a read-only connection. For a server-side guarantee use a read-only token.

## External tools
none

## Driver license
none (built on node:http)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d influxdb` then `pnpm --filter @rizomadb/driver-influxdb test` (port 18086, override with `RZ_INFLUXDB_PORT`; the test org/token are in the compose file).
