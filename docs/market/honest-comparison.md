# Honest comparison

Based on `competitive-analysis.md` (verified 2026-10-20) and on what RizomaDB actually passes in its own tests. "Not verified" means we did not confirm it from a primary source.

| | RizomaDB (this repo) | DBCode | Database Client | SQLTools |
|---|---|---|---|---|
| License | Apache-2.0, all code open | Proprietary product | New versions closed | MIT |
| Paid tiers | None | Pro/Team | Not verified | None |
| Telemetry | None; asserted by a zero-socket test | Anonymous (follows VS Code setting) | Anonymous, own opt-out | Not found |
| Maturity | Pre-1.0, never run in the Marketplace, not tested by real users | Widely used | Widely used | Widely used |
| Engines with real-engine tests | SQLite, PostgreSQL, MySQL/MariaDB, SQL Server, Oracle, MongoDB, Redis/Valkey, ClickHouse, Elasticsearch/OpenSearch, DuckDB | "90+" per their listing | See listing | Many via drivers |

## Where RizomaDB is not (yet) competitive
- Engine breadth: Cassandra, Neo4j, DynamoDB, Firestore, InfluxDB and Tier 3 engines are not implemented.
- Never exercised in a real VS Code UI by a human; screen-reader pass pending.
- No HTTP/SOCKS proxy support; DuckDB needs a platform-specific native module that the VSIX does not ship.
- Community, docs site, translations beyond es/en: none yet.

## Where it differs by design
Verifiable license and zero telemetry, a single policy/audit choke point for every write path, enterprise controls without a paid tier, and an opt-in read-only MCP server with guardrails.
