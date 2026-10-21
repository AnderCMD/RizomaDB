# MongoDB

**Level:** 1 · **Versions tested in CI:** MongoDB 7 (tested)

## Authentication and transport
user/password, URI, TLS; Atlas SRV via URI (untested against Atlas)

## Capabilities
Collections as tables, document edit queue with optimistic concurrency, schema analyzer, per-stage pipeline preview (text), index create/drop, import/export, mongodump/mongorestore

## Type notes
ObjectId as hex string, Long exact, Decimal128 as string, nested documents as JSON

## Read-only enforcement
Client-side guard (allow-list of read commands); use a read-only database user for a server-side guarantee

## External tools
`mongodump`, `mongorestore` (MongoDB Database Tools, detected)

## Driver license
mongodb (Apache-2.0)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d <service>` then `RZ_ENGINES=mongodb pnpm test` (see `test/compose/docker-compose.yml` for ports and `packages/test-engines` for the helpers).
