<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Neo4j

**Level:** 2 · **Versions tested:** Neo4j 5.26 Community (tested). Other 5.x and Enterprise/Aura are expected to work but are **not tested**; 4.x is not supported (no Query API).

## Authentication and transport
Basic auth over the HTTP Query API (port 7474, or 7473 with TLS). The Bolt protocol is **not** used, so no Bolt-only features (routing, bookmarks across sessions) are available. Use the HTTP port in the connection form.

## Capabilities
Cypher editor (`.cypher`/`.cyp`, run the `;`-terminated statement under the cursor), positional parameters bound as `$p1`, `$p2`…, explicit transactions (commit/rollback), labels as "tables" with property types from `db.schema.nodeTypeProperties()`, indexes from `SHOW INDEXES`. Not editable in the grid.

## Type notes
Integers keep full 64-bit precision (typed JSON); nodes, relationships, paths, lists and maps are shown as JSON; dates, durations and points come back as server-formatted text.

## Limits (honest)
- Results are returned by the server as one response, not streamed: use `LIMIT`. `maxRows` truncates on the client after download.
- Cancel aborts the HTTP request; the server may keep running the statement until it notices the closed connection.
- No `EXPLAIN` plan viewer.

## Read-only enforcement
Client-side: a default-deny Cypher classifier (`assessCypher`) rejects anything not recognised as a read, including unknown procedures, `PROFILE`, `LOAD CSV` and multi-statement requests. For a server-side guarantee use a read-only Neo4j role.

## External tools
none

## Driver license
none (built on node:http)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d neo4j` then `pnpm --filter @rizomadb/driver-neo4j test` (HTTP port 17474, override with `RZ_NEO4J_PORT`; test credentials are in the compose file and in the test).
