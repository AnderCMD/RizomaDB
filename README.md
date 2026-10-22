<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo-horizontal-dark.svg">
    <img src="assets/brand/logo-horizontal-light.svg" alt="RizomaDB" width="420">
  </picture>
</p>

**All your databases, one place. Free.** · *Todas tus bases de datos, un solo lugar. Gratis.*

A multi-engine database client for VS Code (and VSCodium, Cursor, Windsurf): Apache-2.0, no telemetry, no accounts, no locked features. [Leer en español](README.es.md) · [Documentation site](https://andercmd.github.io/RizomaDB/)

> **Status: pre-release.** Nothing is published to the Marketplace, Open VSX or npm yet, and v1.0 is **not** ready: see the honest [acceptance checklist](docs/release/v1-checklist.md). The extension builds, installs and passes its tests against real engines, and the project owner did a manual screen-reader pass on macOS, Windows and Linux with no problems found.

## What it does
- **Connect** to 24 engines from a screen of logos, with the usual host, port and user already filled in; environments (`dev`, `staging`, `prod` or your own) with protection; SSH tunnels and HTTP/SOCKS5 proxies; secrets only in VS Code's secret storage. Connections are grouped by type in the tree, with the active one and its database in the status bar.
- **Query** in each engine's language with a Run button above every statement, Run all, Explain, parameters, a searchable history screen and notebooks.
- **Explore and edit** in a results grid built for it: sort, filter (in the rows or in the database), resize, hide, record panel, copy/save as CSV/TSV/JSON/Markdown, paging with *Load more*, an editable query line, and **editing a cell in place** with pending changes you review and apply in one transaction. Rename, retype or drop a column from its menu.
- **Design and move data**: table designer, ER diagrams, schema compare and docs, import/export, backup/restore, data compare/sync and test-data generation.
- **Govern**: layered policies where the strictest wins, one policy and audit point for every write path, column masking, shared catalogs without secrets.
- **Optional extras**: an AI assistant (off by default, schema only) and a read-only MCP server with guardrails.
- **English, Spanish, Portuguese (Brazil) and French** (the last two machine-assisted, not yet reviewed by native speakers), switchable inside the extension, and an interactive **guide** that walks you through it.

## Engines
Tested against real servers: PostgreSQL (and CockroachDB, YugabyteDB), MySQL/MariaDB (and TiDB), SQL Server, Oracle, SQLite, MongoDB, Redis/Valkey, ClickHouse, Elasticsearch/OpenSearch, DuckDB, Neo4j, DynamoDB (Local), InfluxDB 2 and 3, Cassandra/ScyllaDB, Firestore (emulator), Trino, and **HydraDB (experimental)**. What each one supports is in the [capability matrix](docs/reference/engine-matrix.md); limits are on each engine's page in [docs/engines](docs/engines/README.md). **Not confirmed:** real cloud accounts (AWS, Google Cloud, MongoDB Atlas and managed PostgreSQL/MySQL services) have never been tested, so test with a read-only user or a throwaway database before relying on them; Redshift, Snowflake and BigQuery are not implemented. See [Cloud and managed services](docs/engines/README.md#cloud-and-managed-services-not-confirmed).

## Install
```bash
pnpm install
pnpm --filter rizomadb package
code --install-extension apps/extension/rizomadb-0.0.1.vsix
```
Then click the RizomaDB icon, or run **RizomaDB: Open the Guide**. Full walk-through: [Getting started](docs/guides/getting-started.md).

## Documentation
[Getting started](docs/guides/getting-started.md) · [Connections](docs/guides/connections.md) · [The query editor](docs/guides/query-editor.md) · [The results grid](docs/guides/results-grid.md) · [Editing data](docs/guides/editing-data.md) · [Language and settings](docs/guides/language-and-settings.md) · [Troubleshooting](docs/guides/troubleshooting.md) · [Settings](docs/reference/settings.md) and [commands](docs/reference/commands.md) reference · [Policies](docs/enterprise/policy.md) · [Threat model](docs/security/threat-model.md) · [CI/CD](docs/ci-cd.md) · [Design guide](docs/design/design-guide.md) · [AGENTS.md](AGENTS.md) · [Writing a driver](docs/drivers/authoring.md)

## Development
```bash
pnpm install
docker compose -f test/compose/docker-compose.yml up -d postgres   # or any engine you want to test
pnpm lint && pnpm build && pnpm typecheck && pnpm test
node scripts/gen-reference.mjs        # regenerates the settings/commands/engine reference pages
```
`dev` is the integration branch and `main` is what is deployed (the docs site); CI runs on both. See [CONTRIBUTING.md](CONTRIBUTING.md), [docs/ci-cd.md](docs/ci-cd.md), the decision records in [docs/adr](docs/adr) and the running log in [docs/ai/STATE.md](docs/ai/STATE.md).

## License
Apache-2.0. Third-party licenses: [docs/legal/third-party-licenses.md](docs/legal/third-party-licenses.md).
