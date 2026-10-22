# Redis / Valkey

**Level:** 1 · **Versions tested in CI:** Redis 7, Valkey 8 (tested)

## Authentication and transport
password/ACL user, TLS

## Capabilities
Key browser (SCAN with cursor handled for you; KEYS is refused), per-type viewer (OPEN), console, TTL/rename/delete with confirmation, and **Edit Key Value…** for strings (the expiry is kept), hash fields, list elements, set members (renamed: the new member is added before the old one is removed) and sorted-set scores (existing members only) (tested against a real Redis; text with quotes, newlines and emoji round-trips). and stream entries, which are never changed in place: **Edit Key Value…** on a stream adds an entry (XADD, automatic or explicit ID) or deletes one (XDEL), tested against a real Redis. NOT implemented: MONITOR/Pub-Sub, consumer groups, memory analysis

## Type notes
Strings exact; integer replies are JS numbers (beyond 2^53 may lose precision)

## Read-only enforcement
Client-side guard from a static command table; unknown commands count as writes. Use an ACL user with `+@read` for a server-side guarantee

## External tools
none

## Driver license
ioredis (MIT)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d <service>` then `RZ_ENGINES=redis pnpm test` (see `test/compose/docker-compose.yml` for ports and `packages/test-engines` for the helpers).
