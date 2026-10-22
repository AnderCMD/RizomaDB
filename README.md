<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo-horizontal-dark.svg">
    <img src="assets/brand/logo-horizontal-light.svg" alt="RizomaDB" width="420">
  </picture>
</p>

**All your databases, one place. Free.**

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/AnderCMD.rizomadb?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=AnderCMD.rizomadb) [![Installs](https://img.shields.io/visual-studio-marketplace/i/AnderCMD.rizomadb)](https://marketplace.visualstudio.com/items?itemName=AnderCMD.rizomadb) [![License](https://img.shields.io/github/license/AnderCMD/RizomaDB)](LICENSE)

English · [Español](README.es.md)

A multi-engine database client for VS Code (and VSCodium, Cursor, Windsurf): Apache-2.0, no telemetry, no accounts, no locked features. [Documentation site](https://andercmd.github.io/RizomaDB/en/)

> **Status: 1.0.0.** Available on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=AnderCMD.rizomadb) and as a VSIX attached to each [GitHub release](https://github.com/AnderCMD/RizomaDB/releases) (Open VSX is not published yet). It builds, installs and passes its tests against real engines, and the project owner did a manual screen-reader pass on macOS, Windows and Linux with no problems found. Some things are **not confirmed**, above all real cloud accounts: see the honest [acceptance checklist](docs/release/v1-checklist.md).

## What it does
- **Connect** to 25 engines from a screen of logos, with the usual host, port and user already filled in; environments (`dev`, `staging`, `prod` or your own) with protection; SSH tunnels and HTTP/SOCKS5 proxies; secrets only in VS Code's secret storage. Connections are grouped by type in the tree, with the active one and its database in the status bar.
- **Query** in each engine's language with a Run button above every statement, Run all, Explain, parameters, a searchable history screen and notebooks.
- **Explore and edit** in a results grid built for it: sort, filter (in the rows or in the database), resize, hide, record panel, copy/save as CSV/TSV/JSON/Markdown, paging with *Load more*, an editable query line, and **editing a cell in place** with pending changes you review and apply in one transaction. Rename, retype or drop a column from its menu.
- **Design and move data**: table designer, ER diagrams, schema compare and docs, import/export, backup/restore, data compare/sync and test-data generation.
- **Govern**: layered policies where the strictest wins, one policy and audit point for every write path, column masking, shared catalogs without secrets.
- **Optional extras**: an AI assistant (off by default, schema only) and a read-only MCP server with guardrails.
- **English and Spanish**, switchable inside the extension, and an interactive **guide** that walks you through it.

## Engines
Tested against real servers: PostgreSQL (and CockroachDB, YugabyteDB), MySQL/MariaDB (and TiDB), SQL Server, Oracle, SQLite, MongoDB, Redis/Valkey, ClickHouse, Elasticsearch/OpenSearch, DuckDB, Neo4j, DynamoDB (Local), InfluxDB 2 and 3, Cassandra/ScyllaDB, Firestore (emulator), Trino, and **HydraDB (experimental)**. What each one supports is in the [capability matrix](docs/reference/engine-matrix.md); limits are on each engine's page in [docs/engines](docs/engines/README.md). **Not confirmed:** real cloud accounts (AWS, Google Cloud, MongoDB Atlas and managed PostgreSQL/MySQL services) have never been tested, so test with a read-only user or a throwaway database before relying on them; Redshift, Snowflake and BigQuery are not implemented. See [Cloud and managed services](docs/engines/README.md#cloud-and-managed-services-not-confirmed).

## Install
Install **RizomaDB** from the VS Code Marketplace (search for "RizomaDB", or run `code --install-extension AnderCMD.rizomadb`), or download the `.vsix` from the latest [release](https://github.com/AnderCMD/RizomaDB/releases) and run `code --install-extension rizomadb-1.0.1.vsix`. To build it yourself:
```bash
pnpm install
pnpm --filter rizomadb package
code --install-extension apps/extension/rizomadb-1.0.1.vsix
```
Then click the RizomaDB icon, or run **RizomaDB: Open the Guide**. Full walk-through: [Getting started](docs/guides/getting-started.md).

## Documentation
[Getting started](docs/guides/getting-started.md) · [Connections](docs/guides/connections.md) · [The query editor](docs/guides/query-editor.md) · [The results grid](docs/guides/results-grid.md) · [Using the keyboard](docs/guides/keyboard.md) · [Editing data](docs/guides/editing-data.md) · [Language and settings](docs/guides/language-and-settings.md) · [Troubleshooting](docs/guides/troubleshooting.md) · [Help test RizomaDB](docs/guides/help-test.md) · [Settings](docs/reference/settings.md) and [commands](docs/reference/commands.md) reference · [Policies](docs/enterprise/policy.md) · [Threat model](docs/security/threat-model.md) · [CI/CD](docs/ci-cd.md) · [Design guide](docs/design/design-guide.md) · [AGENTS.md](AGENTS.md) · [Writing a driver](docs/drivers/authoring.md)

## Development
```bash
pnpm install
docker compose -f test/compose/docker-compose.yml up -d postgres   # or any engine you want to test
pnpm lint && pnpm build && pnpm typecheck && pnpm test
node scripts/gen-reference.mjs        # regenerates the settings/commands/engine reference pages
```
`dev` is the integration branch and `main` is what is deployed (the docs site); CI runs on both. See [CONTRIBUTING.md](CONTRIBUTING.md), [docs/ci-cd.md](docs/ci-cd.md).

## License
Apache-2.0. Third-party licenses: [docs/legal/third-party-licenses.md](docs/legal/third-party-licenses.md). [Code of conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md).
