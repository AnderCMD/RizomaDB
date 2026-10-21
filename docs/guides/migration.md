# Migrating to RizomaDB

RizomaDB reads connection definitions from other tools through **RizomaDB: Import Connections**. Nothing is sent anywhere; files are parsed locally.

| Source | What is imported | What is NOT imported |
|---|---|---|
| Connection URI (`postgres://`, `mysql://`, `mongodb://`, `redis://`, ...) | host, port, database, user, TLS flag | — (password in the URI is offered for SecretStorage, never written to settings) |
| `~/.pgpass` | host, port, database, user, password | Wildcard (`*`) entries are skipped |
| `~/.my.cnf` | host, port, user, password | Option groups other than `client`/`mysql` |
| DBeaver `data-sources.json` | name, driver, host, port, database | User names and passwords (DBeaver encrypts them; enter them on first connect) |
| SQLTools `settings.json` (`sqltools.connections`) | name, driver, host, port, database, user | Drivers RizomaDB does not implement |

Passwords found in plain text are only stored after you confirm, and only in VS Code SecretStorage.

## From Database Client (cweijan) and DBCode
No import format is implemented for them: their connection storage was not verified against primary sources, so we do not guess. Use the URI importer or recreate the connections with the wizard.

## Concepts that differ
- **Edits are queued.** Grid edits become a pending change set you review and apply in one transaction; nothing is written on cell commit.
- **Policy.** `prod` connections are read-only by default; change this in the connection profile or policy files (`docs/enterprise/policy.md`).
- **No telemetry.** There is nothing to opt out of.
