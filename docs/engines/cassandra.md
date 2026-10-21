# Apache Cassandra / ScyllaDB

**Level:** 2 · **Versions tested:** Apache Cassandra 5.0 (tested). ScyllaDB 6.2.3 (single node, developer mode) passes the same 10 tests (`RZ_CASSANDRA_PORT=19043 RZ_CASSANDRA_EXPECT=ScyllaDB`); the driver detects it through `system.versions` and hides the hidden `<index>_index` materialized views Scylla creates for secondary indexes. Multi-node clusters, Scylla Cloud, Alternator (DynamoDB API) and Scylla-specific features are **not** tested.

## Authentication and transport
Username/password (PasswordAuthenticator) and optional TLS, through the Apache-2.0 `cassandra-driver`. The local data center is required. Kerberos, client certificates and Astra secure bundles are **not** supported.

## Capabilities
CQL editor (runs in the SQL editor mode), prepared parameters (`?`), paging with a bounded fetch size, keyspaces as schemas, tables, views, partition/clustering keys and secondary indexes in the explorer. Not editable in the grid.

## Type notes
`bigint` keeps 64-bit precision; `decimal` and `varint` are exact text; collections, tuples and UDTs are JSON; `uuid`, `inet`, `date`, `time` and `duration` are text; `timestamp` is `Date`.

## Limits (honest)
- Consistency level is the driver default (LOCAL_ONE); it cannot be changed yet.
- No batches/LWT helpers, no tracing, no materialized-view management.
- An empty result announces column names only when the server sends them (types may be `unknown`).
- Cancel stops reading and closes the stream; the coordinator may finish the request.

## Read-only enforcement
Client-side: only `SELECT`, `USE`, `DESCRIBE`, `LIST` run on a read-only connection (default-deny). For a server-side guarantee use a role limited to SELECT.

## External tools
none

## Driver license
Apache-2.0 (`cassandra-driver` 4.10.0)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d cassandra` (or `scylla`) (takes about a minute to accept connections) then `pnpm --filter @rizomadb/driver-cassandra test` (port 19042, data center `datacenter1`, override the port with `RZ_CASSANDRA_PORT`).
