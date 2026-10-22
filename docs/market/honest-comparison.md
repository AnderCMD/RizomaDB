# Honest comparison

Based on `competitive-analysis.md` (verified 2026-10-20) and on what RizomaDB actually passes in its own tests. "Not verified" means we did not confirm it from a primary source. Updated 2026-10-21.

| | RizomaDB (this repo) | DBCode | Database Client | SQLTools |
|---|---|---|---|---|
| License | Apache-2.0, all code open | Proprietary product | New versions closed | MIT |
| Paid tiers | None | Pro/Team | Not verified | None |
| Telemetry | None; asserted by a zero-socket test | Anonymous (follows VS Code setting) | Anonymous, own opt-out | Not found |
| Maturity | Pre-1.0, never published, not tested by real users | Widely used | Widely used | Widely used |
| Engines with real-engine tests | 18 drivers covering 24 engines: SQLite, PostgreSQL (+CockroachDB, YugabyteDB), MySQL/MariaDB (+TiDB), SQL Server, Oracle, MongoDB, Redis/Valkey, ClickHouse, Elasticsearch/OpenSearch, DuckDB, Neo4j, DynamoDB Local, InfluxDB 2 and 3, Cassandra/ScyllaDB, Firestore emulator, Trino, HydraDB (experimental) | "90+" per their listing | See listing | Many via drivers |

## Where RizomaDB is not (yet) competitive
- **Breadth**: fewer engines than DBCode's listing; real AWS and Google Cloud services and Redshift were not tested; Level 3 engines and a JDBC/ODBC bridge do not exist.
- **Little human testing so far**: the automated end-to-end test activates it in a real VS Code and checks the commands and editor lenses, the screens pass axe in light and dark, and the owner did a manual screen-reader pass on macOS, Windows and Linux with no problems found; there is no independent accessibility audit.
- **Not published**: no Marketplace or Open VSX listing, no signed release yet.
- **DuckDB** needs a platform-specific native module that the VSIX does not ship.
- Community and translations beyond English and Spanish: none yet.
- Some features are young: HydraDB is experimental; paging works on every engine by re-running the query and skipping rows, which is slower for very deep pages than a native cursor.

## Where it differs by design
Verifiable license and zero telemetry; a single policy and audit choke point for every write path; enterprise controls (layered policy, custom environments with protection, masking, audit) without a paid tier; editing in place with pending changes applied in one transaction and conflict detection; an opt-in, schema-only AI assistant and an opt-in read-only MCP server with guardrails; and an interactive guide plus English/Spanish interface switchable inside the extension.
