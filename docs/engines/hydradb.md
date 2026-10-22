<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# HydraDB

**Status:** experimental (shown with an Experimental badge). **Level:** 2 · **Versions tested:** `ghcr.io/hydra-db/hydradb:latest` (image built 2026-09-29, HydraDB 0.1.x logs, HTTP query API `v1`), single node, plaintext. Other versions, clusters and TLS deployments are **not tested**.

HydraDB is a graph database on object storage that speaks OpenCypher over Bolt and over an HTTP query API ([github.com/hydra-db/hydradb](https://github.com/hydra-db/hydradb), AGPL-3.0). Not to be confused with Hydra, the Postgres-based warehouse.

## Authentication and transport
Bearer token over the HTTP query API (default port 8443). The Bolt port is **not** used. Besides host, port and token the form asks for the **graph** (`default`) and the **cell id** (`cell-0`): HydraDB cannot list cells, and a wrong one answers an opaque HTTP 500 (the driver adds a hint). A namespace header is optional. Deployed servers require TLS (`Use TLS`); plain HTTP is for local development.

## Capabilities
Cypher editor, positional parameters bound as `$p1`, `$p2`…, results streamed as NDJSON (rows reach the grid while the server is still producing them), cancel (aborts the request and calls the server's cancel endpoint), `maxRows`. Not editable in the grid. No transactions.

## Type notes
Cells are typed by the server: `vertex_id` and `integer` keep full 64-bit precision (exact integers are quoted before parsing), floats, booleans, strings and nulls map directly; lists are shown as JSON; paths are shown as the server encodes them.

## Limits (honest)
- **The tree only shows the labels you list in the connection** ("Labels to show in the tree"). HydraDB has no `CALL db.labels()`, so labels, properties and relationship types cannot be discovered. Opening a label runs `MATCH (n:Label) RETURN n.id AS id`; write your own query to see other properties.
- HydraDB accepts a **subset** of OpenCypher: no `RETURN n`, no `RETURN *`, no arithmetic in `RETURN`, writes only as edge patterns or `UNWIND` batches, and more (see the server's `USING-HYDRADB.md`). The driver passes your statement through and shows the server's message.
- Existence checks on bare ids are unreliable by design of the server (an id-anchored `MATCH` returns a phantom row): anchor on a label.
- No `EXPLAIN` viewer and no ER/design tools.

## Read-only enforcement
Client-side: the default-deny Cypher classifier rejects anything not recognised as a read (`MERGE`, `CREATE`, `SET`, `DELETE`, unknown procedures, several statements). `algo.SPpaths`, `algo.SSpaths` and `algo.MSpaths` count as reads. For a server-side guarantee use a token with no write rights, if your deployment has one.

## External tools
none

## Driver license
none (built on node:http)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d hydradb` then `pnpm --filter @rizomadb/driver-hydradb test` (HTTP port 18443, override with `RZ_HYDRADB_PORT`; the test token is in `test/compose/hydradb-auth-token`). CI runs it in the `engines-extra` job, which starts the engine from the compose file (the image needs a token file, so it cannot be a job service).
