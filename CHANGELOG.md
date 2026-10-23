<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-horizontal-dark.svg">
    <img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-horizontal-light.svg" alt="RizomaDB" width="320">
  </picture>
</p>

# Changelog

English · [Español](CHANGELOG.es.md)

All notable changes are listed here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/). Nothing has been published yet.

## [1.1.1] — 2026-10-22

### Added
- **Edit a saved connection** (pencil on its card), including its password and tunnel or proxy settings.
- A **show/hide eye** on every password field.
- A `prod` connection can be switched between read-only and editable (with confirmation); policies that forbid writes still win.

### Fixed
- Oracle servers older than 12.1 now get a clear message instead of NJS-138.
- Slow start with open connections: the tree no longer reconnects restored nodes at startup, redraws once instead of once per connection, remembers each connection's answers, and the history file is trimmed 30 s after start without parsing every entry.

## [1.1.0] — 2026-10-22

### Added
- **Paste a JDBC URL** into the New connection form to fill the fields: Oracle (service name, SID, `user/password@…`, `DESCRIPTION`), PostgreSQL/CockroachDB/YugabyteDB, MySQL/MariaDB/TiDB, SQL Server, SQLite, DuckDB, ClickHouse, Trino, Cassandra, Elasticsearch/OpenSearch, Redis/Valkey, Neo4j and MongoDB. Passwords from the URL go to the password field only.
- Oracle can connect with a **SID** (old-style databases), not only a service name.
- Importing connections understands `jdbc:` URLs (including those inside DBeaver files).

### Notes
- Oracle OCI (thick) URLs, TNS aliases, TCPS and SQL Server integrated security are refused with an explanation. Connecting from a URL was tested against real PostgreSQL, MySQL, SQL Server and Oracle servers.

## [1.0.2] — 2026-10-22

### Fixed
- Removed two Marketplace badges that shields.io no longer serves.

## [1.0.1] — 2026-10-22

### Changed
- The Marketplace page was rewritten with screenshots of the main screens, an engine table, getting-started steps and the known limits.

### Fixed
- The documentation site now serves its logo, favicon and share images.
- The engine count is 25 (the 1.0.0 notes said 24).

## [1.0.0] — 2026-10-22

First release.

### Added
- A multi-engine database client for VS Code with 25 engines, a native SQL editor with Run buttons, an editable results grid with pending changes applied in one transaction, a table designer, ER diagrams, import/export and schema tools.
- Governance: layered policies where the strictest wins, one policy and audit point for every write, column masking, shared catalogs without secrets, and encrypted catalog files.
- Optional table paging by primary key (SQLite, PostgreSQL, MySQL, SQL Server, Oracle), editing of Redis stream entries, AWS profiles for DynamoDB and Google credential files for Firestore.
- A no-SQL query builder, a read-only user generator, favourites in the history and settings export/import.
- Per-platform packages that carry DuckDB's native library, and release steps for checksums, an SBOM and build provenance (not yet run).
- Interface and documentation in English and Spanish.

### Fixed
- Abandoning a large result no longer blocks the next statement on MySQL and SQL Server; a late cancel no longer hits the next statement on MySQL, PostgreSQL and Oracle.
- Several redaction, SQL Server default-constraint and HydraDB abort issues found by testing against real servers.

### Known limits
- Real cloud accounts (AWS, Google Cloud, MongoDB Atlas, managed PostgreSQL/MySQL services) have never been tested. Redshift, Snowflake and BigQuery are not implemented. The package is on the VS Code Marketplace and attached to this release; it is not on Open VSX yet. See [docs/release/v1-checklist.md](docs/release/v1-checklist.md).
