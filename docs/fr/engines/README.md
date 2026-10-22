# Moteurs

Ce que chaque moteur prend en charge en un coup d'œil : la [matrice des capacités](../reference/engine-matrix.md) (générée à partir du code). Les limites, les versions testées et les instructions de test figurent sur la page de chaque moteur.

| Moteur | Niveau | Doc |
|---|---|---|
| PostgreSQL (et CockroachDB, YugabyteDB, testés) | 1 | [postgres.md](postgres.md) |
| MySQL / MariaDB (et TiDB, testé) | 1 | [mysql.md](mysql.md) |
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
| Apache Cassandra (et ScyllaDB, testé) | 2 | [cassandra.md](cassandra.md) |
| Google Cloud Firestore | 2 | [firestore.md](firestore.md) |
| Trino | 2 | [trino.md](trino.md) |

HydraDB est **expérimental** : un moteur jeune avec un sous-ensemble étroit de Cypher, gardé petit et non étendu.

Non implémentés : Redshift, les autres moteurs au protocole PostgreSQL/MySQL (la compatibilité n'est pas affirmée sauf s'ils figurent ci-dessus) et tous les moteurs de niveau 3. Le pont JDBC/ODBC n'est pas implémenté.

## Cloud et services gérés non confirmés

RizomaDB n'a été testé qu'avec des moteurs tournant en local, dans des conteneurs ou dans un émulateur officiel. **Il n'a été testé avec aucun compte cloud réel**, donc le bon fonctionnement là-bas **n'est pas confirmé** :

- Amazon DynamoDB sur AWS (seul DynamoDB Local a été testé), Google Cloud Firestore sur Google Cloud (seul l'émulateur) et MongoDB Atlas.
- Les versions gérées de moteurs testés (par exemple Amazon RDS/Aurora, Google Cloud SQL, Azure Database, Neon, Supabase, PlanetScale), qui parlent le même protocole mais peuvent différer en TLS, authentification (les connexions par IAM ou jeton ne sont pas implémentées), limites et permissions.
- Redshift, Snowflake et BigQuery ne sont pas implémentés.

**Testez avant de vous y fier.** Avant d'utiliser un service cloud pour du travail réel, connectez-vous d'abord avec un utilisateur en lecture seule ou une base jetable, vérifiez que l'explorateur, une requête et le filtre fonctionnent, et n'activez les écritures qu'ensuite. Si quelque chose échoue, ouvrez un issue **Test report** avec le moteur, le service et le message ; un résultat confirmé (qui fonctionne ou non) aide tout le monde. Voir [Aidez à tester RizomaDB](../guides/help-test.md).
