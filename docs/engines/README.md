# Engines

What each engine supports at a glance: the [capability matrix](../reference/engine-matrix.md) (generated from the code). Limits, versions tested and test instructions are on each engine's page.

| Engine | Level | Doc |
|---|---|---|
| PostgreSQL (and CockroachDB, YugabyteDB, tested) | 1 | [postgres.md](postgres.md) |
| MySQL / MariaDB (and TiDB, tested) | 1 | [mysql.md](mysql.md) |
| SQL Server | 1 | [mssql.md](mssql.md) |
| Oracle Database | 1 | [oracle.md](oracle.md) |
| SQLite | 1 | [sqlite.md](sqlite.md) |
| MongoDB | 1 | [mongodb.md](mongodb.md) |
| Redis / Valkey | 1 | [redis.md](redis.md) |
| ClickHouse | 2 | [clickhouse.md](clickhouse.md) |
| Elasticsearch / OpenSearch | 2 | [elasticsearch.md](elasticsearch.md) |
| DuckDB | 2 | [duckdb.md](duckdb.md) |
| Neo4j | 2 | [neo4j.md](neo4j.md) |
| HydraDB | 2 | [hydradb.md](hydradb.md) |
| Amazon DynamoDB | 2 | [dynamodb.md](dynamodb.md) |
| InfluxDB 2.x | 2 | [influxdb.md](influxdb.md) |
| InfluxDB 3 | 2 | [influxdb3.md](influxdb3.md) |
| Apache Cassandra (and ScyllaDB, tested) | 2 | [cassandra.md](cassandra.md) |
| Google Cloud Firestore | 2 | [firestore.md](firestore.md) |
| Trino | 2 | [trino.md](trino.md) |

HydraDB is **experimental**: a young engine with a narrow Cypher subset, kept small and not extended.

Not implemented: Redshift, Other PostgreSQL/MySQL-protocol engines (compatibility is not claimed unless listed above), and all Level 3 engines. The JDBC/ODBC bridge is not implemented.
