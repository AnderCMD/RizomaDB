# MySQL / MariaDB

**Level:** 1 · **Versions tested in CI:** MySQL 8.4 and MariaDB 11 (tested)

## Authentication and transport
user/password, TLS, SSH tunnel

## Capabilities
Same as PostgreSQL; admin locks use MySQL 8 views (MariaDB locks view not implemented)

## Type notes
BIGINT exact, DECIMAL as string, JSON as JSON, BIT/BLOB as bytes

## Read-only enforcement
Session `READ ONLY` transaction mode on read-only connections

## External tools
`mysqldump`, `mysql` (detected on PATH)

## Driver license
mysql2 (MIT)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d <service>` then `RZ_ENGINES=mysql pnpm test` (see `test/compose/docker-compose.yml` for ports and `packages/test-engines` for the helpers).
