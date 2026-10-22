<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Elasticsearch / OpenSearch

**Level:** 2 · **Versions tested in CI:** Elasticsearch 8.15, OpenSearch 2.17 (tested)

## Authentication and transport
basic auth, API key, TLS

## Capabilities
REST console with comments and trailing commas, scroll streaming, mappings. Not editable in the grid

## Type notes
_source fields as columns; nested as JSON

## Read-only enforcement
Client-side guard (only read endpoints); use a read-only role for a server-side guarantee

## External tools
none

## Driver license
none (built on node:http)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d <service>` then `RZ_ENGINES=elasticsearch pnpm test` (see `test/compose/docker-compose.yml` for ports and `packages/test-engines` for the helpers).
