# SQLite

**Level:** 1 · **Versions tested in CI:** SQLite as bundled with the Node runtime (`node:sqlite`)

## Authentication and transport
file path

## Capabilities
Everything except admin tools; column ALTER needs a table rebuild (flagged as a manual step)

## Type notes
INTEGER exact (bigint beyond 2^53)

## Read-only enforcement
`PRAGMA query_only`

## External tools
built-in `VACUUM INTO` for backups

## Driver license
node:sqlite (no dependency); NOTE: availability inside VS Code's embedded Node is unverified

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d <service>` then `RZ_ENGINES=sqlite pnpm test` (see `test/compose/docker-compose.yml` for ports and `packages/test-engines` for the helpers).
