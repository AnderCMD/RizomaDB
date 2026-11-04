<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-horizontal-dark.svg">
    <img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-horizontal-light.svg" alt="RizomaDB" width="320">
  </picture>
</p>

# Changelog

English · [Español](CHANGELOG.es.md)

All notable changes are listed here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/). Nothing has been published yet.

## [Unreleased]

## [1.2.5] — 2026-11-04

### Added
- The *Release* workflow has a `marketplace` job that publishes the universal VSIX to the VS Code Marketplace through trusted publishing (OIDC, no token). It runs only for tags and waits for the owner's approval of the `marketplace` environment. Tested with the `v1.2.5` release. The extension is on the Marketplace as `AnderCMD.rizomadb-client`.

### Changed
- Connections show their real state (connecting, connected, disconnected) in the explorer, the status bar and the connection picker, and have *Connect*, *Disconnect* and *Disconnect all* commands. A connection nobody has used for 30 minutes (setting `rizomadb.connections.idleMinutes`, 0 = never) is closed automatically, never while a statement is running, and reconnects on next use.

### Fixed
- The status text of the results panel ("5 rows · 10 ms", "1 rows affected") was grey on the blue badge and could not be read; it now uses the badge's own text colour.
- Disconnecting an expanded connection in the explorer reconnected it at once when the tree redrew; it now collapses.
- The *Connections* group of the settings screen showed its raw id instead of a translated title.
- A driver that ignored *Cancel* (or the query timeout) used to leave the extension "running" forever, so every run button answered that a query was already running. After 1.5 s the run is abandoned, the interface is freed and that connection is dropped (it reconnects on the next run).
- Oracle: reading the data dictionary (schema, completion, explorer) is now limited to 30 s per call instead of queueing the user's statements behind a slow one, and a failed or slow schema read is not retried on every keystroke (2 minutes pause).
- SQL files larger than 1 MB (data dumps, generated scripts) are no longer analysed for error underlining and completion on every keystroke, which could stall the extension host for seconds on a slow machine.

## [1.2.4] — 2026-10-23

### Fixed
- Query editors showed the connection and Run lenses twice; they now appear once.
- Opening a table on an Oracle server with a very large data dictionary is faster (the primary key is looked up with one query restricted to the table instead of one per column); checked on 19,000 tables across 120 schemas and a 3-million-row table.

## [1.2.3] — 2026-10-23

### Fixed
- The policy and shared-connection files of the workspace are read through VS Code's file service instead of Node's, so a folder on a network drive or cloud sync that stops answering can no longer tie up the extension host's file threads and make VS Code report it as unresponsive.
- Start-up no longer waits for the policy and shared-connection files: the extension's commands and screens are ready at once (writes stay blocked until the policy has been read), a file on an unavailable folder is given up on after 8 s, and the "RizomaDB policy" output says how long each step took. Connections in the tree are no longer re-expanded (and so connected) automatically when VS Code restarts.

### Changed
- Documentation and site: the home page now has a gallery of screenshots (results grid, pending changes, JDBC form, saved connections, ER diagram, plans, history, light theme); the troubleshooting page covers old Oracle servers, the VS Code service-worker error and huge databases; the screenshots are retaken with the compact header (`scripts/take-screenshots.mjs`).

## [1.2.2] — 2026-10-23

### Fixed
- Switching to another editor tab while creating or editing a connection (or a table design, settings, history or the guide) no longer sends that screen back to its first page: it keeps what you had typed.
- Very large databases no longer freeze the extension: a node lists at most 2,000 tables (the rest are reached with **Open Table Data**, which now works from the command palette and searches every table), and completion reads only table names, not every column, when a schema has more than 1,500 tables.
- VS Code no longer connects to the databases of restored editors at startup just to underline errors, and a server that never answers is given up on after 45 s (20 s for the Oracle network connection) instead of leaving the extension waiting forever.

### Changed
- **A more compact results header**: the title and the table tabs share one row, the query line is slimmer, the search tools and the edit buttons share one row, and the database filter (condition and order) stays folded behind a button until you need it. An active filter keeps it open. The results start about half as far down the screen.
- The connection picker marks the one in use, the connected ones and the read-only ones, and works without an editor open.

## [1.2.1] — 2026-10-22

### Changed
- **Paging by primary key is now on by default** (`rizomadb.query.keysetPaging`): *Load more* on a big table no longer reads and discards every row already shown. Tables open sorted by their key; set the option to `false` for the engine's natural order.

### Fixed
- Oracle servers with many schemas: reading the columns of a schema no longer runs one dictionary query per column, and completion loads only your own schema plus a few instead of up to 25.

## [1.2.0] — 2026-10-22

### Added
- **Pin** in the results toolbar: keeps a results tab and the next query opens in a new one.
- **Edit a saved connection** (pencil on its card), including its password and tunnel or proxy settings.
- A **show/hide eye** on every password field.
- A `prod` connection can be switched between read-only and editable (with confirmation); policies that forbid writes still win.

### Fixed
- A JDBC URL with broken `%` escapes no longer raises an unexpected error.
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
- Real cloud accounts (AWS, Google Cloud, MongoDB Atlas, managed PostgreSQL/MySQL services) have never been tested. Redshift, Snowflake and BigQuery are not implemented. The package is attached to this release. See [docs/release/v1-checklist.md](docs/release/v1-checklist.md).
