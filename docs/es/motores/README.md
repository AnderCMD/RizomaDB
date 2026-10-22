# Motores

Qué admite cada motor de un vistazo: la [matriz de capacidades](../referencia/matriz-de-motores.md) (generada a partir del código). Los límites, las versiones probadas y las instrucciones de prueba están en la página de cada motor.

| Motor | Nivel | Documento |
|---|---|---|
| PostgreSQL (y CockroachDB, YugabyteDB, probados) | 1 | [postgres.md](postgres.md) |
| MySQL / MariaDB (y TiDB, probado) | 1 | [mysql.md](mysql.md) |
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
| Apache Cassandra (y ScyllaDB, probado) | 2 | [cassandra.md](cassandra.md) |
| Google Cloud Firestore | 2 | [firestore.md](firestore.md) |
| Trino | 2 | [trino.md](trino.md) |

HydraDB es **experimental**: un motor joven con un subconjunto estrecho de Cypher, que se mantiene pequeño y no se amplía.

No implementados: Redshift, otros motores con protocolo PostgreSQL/MySQL (no se afirma compatibilidad salvo que figuren arriba) y todos los motores de Nivel 3. El puente JDBC/ODBC no está implementado.
