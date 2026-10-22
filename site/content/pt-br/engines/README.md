# Motores

O que cada motor suporta, num relance: a [matriz de capacidades](../reference/engine-matrix.md) (gerada a partir do código). Os limites, as versões testadas e as instruções de teste estão na página de cada motor.

| Motor | Nível | Documento |
|---|---|---|
| PostgreSQL (e CockroachDB, YugabyteDB, testados) | 1 | [postgres.md](postgres.md) |
| MySQL / MariaDB (e TiDB, testado) | 1 | [mysql.md](mysql.md) |
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
| Apache Cassandra (e ScyllaDB, testado) | 2 | [cassandra.md](cassandra.md) |
| Google Cloud Firestore | 2 | [firestore.md](firestore.md) |
| Trino | 2 | [trino.md](trino.md) |

O HydraDB é **experimental**: um motor jovem com um subconjunto estreito de Cypher, mantido pequeno e sem ampliação.

Não implementados: Redshift, outros motores com protocolo PostgreSQL/MySQL (não se afirma compatibilidade a menos que apareçam acima) e todos os motores de Nível 3. A ponte JDBC/ODBC não está implementada.

## Nuvem e serviços gerenciados não confirmados

O RizomaDB só foi testado com motores rodando localmente, em contêineres ou em um emulador oficial. **Não foi testado com nenhuma conta real na nuvem**, então o funcionamento ali **não está confirmado**:

- Amazon DynamoDB na AWS (só o DynamoDB Local foi testado), Google Cloud Firestore no Google Cloud (só o emulador) e MongoDB Atlas.
- Versões gerenciadas de motores testados (por exemplo, Amazon RDS/Aurora, Google Cloud SQL, Azure Database, Neon, Supabase, PlanetScale), que falam o mesmo protocolo, mas podem diferir em TLS, autenticação (os logins com IAM ou token não estão implementados), limites e permissões.
- Redshift, Snowflake e BigQuery não estão implementados.

**Teste antes de depender.** Antes de usar um serviço na nuvem para trabalho real, conecte primeiro com um usuário somente leitura ou um banco de dados descartável, verifique se o explorador, uma consulta e o filtro funcionam e só então ative as gravações. Se algo falhar, abra um issue **Test report** com o motor, o serviço e a mensagem; um resultado confirmado (funcionando ou não) ajuda todo mundo. Veja [Ajude a testar o RizomaDB](../guides/help-test.md).
