/**
 * Every engine the "New connection" screen offers. Several entries share one driver (MariaDB speaks the MySQL protocol,
 * CockroachDB the PostgreSQL one…): `driver` picks the code, `defaults` only presets the form.
 * Logos are original monogram tiles drawn by RizomaDB, not the vendors' trademarks.
 */
export type EngineFamily = "relational" | "analytics" | "document" | "keyvalue" | "search" | "graph" | "timeseries" | "widecolumn";

export interface Engine {
  key: string;
  driver: string;
  name: string;
  family: EngineFamily;
  /** Tile background / monogram colour (each pair keeps a contrast ratio of at least 4.5:1). */
  color: string;
  fg: string;
  mark: string;
  defaults?: Record<string, string | number | boolean>;
  /** Young or narrow engine: shown with an Experimental badge. */
  experimental?: boolean;
}

const W = "#ffffff";
export const ENGINES: readonly Engine[] = [
  { key: "postgres", driver: "postgres", name: "PostgreSQL", family: "relational", color: "#336791", fg: W, mark: "Pg", defaults: { host: "localhost", port: 5432, database: "postgres", user: "postgres" } },
  { key: "mysql", driver: "mysql", name: "MySQL", family: "relational", color: "#00677F", fg: W, mark: "My", defaults: { host: "localhost", port: 3306, user: "root" } },
  { key: "mariadb", driver: "mysql", name: "MariaDB", family: "relational", color: "#1F4E79", fg: W, mark: "Ma", defaults: { host: "localhost", port: 3306, user: "root" } },
  { key: "sqlite", driver: "sqlite", name: "SQLite", family: "relational", color: "#0B5A85", fg: W, mark: "Sq" },
  { key: "mssql", driver: "mssql", name: "SQL Server", family: "relational", color: "#A91D22", fg: W, mark: "Ss", defaults: { host: "localhost", port: 1433, database: "master", user: "sa" } },
  { key: "oracle", driver: "oracle", name: "Oracle Database", family: "relational", color: "#B2341F", fg: W, mark: "Or", defaults: { host: "localhost", port: 1521, service: "FREEPDB1", user: "system" } },
  { key: "cockroach", driver: "postgres", name: "CockroachDB", family: "relational", color: "#5A2DCC", fg: W, mark: "Cr", defaults: { host: "localhost", port: 26257, database: "defaultdb", user: "root" } },
  { key: "yugabyte", driver: "postgres", name: "YugabyteDB", family: "relational", color: "#A84300", fg: W, mark: "Yb", defaults: { host: "localhost", port: 5433, database: "yugabyte", user: "yugabyte" } },
  { key: "tidb", driver: "mysql", name: "TiDB", family: "relational", color: "#B71F33", fg: W, mark: "Ti", defaults: { host: "localhost", port: 4000, user: "root" } },
  { key: "clickhouse", driver: "clickhouse", name: "ClickHouse", family: "analytics", color: "#1A1A1A", fg: "#FFCC01", mark: "Ch", defaults: { host: "localhost", port: 8123, database: "default", user: "default" } },
  { key: "duckdb", driver: "duckdb", name: "DuckDB", family: "analytics", color: "#1A1A1A", fg: "#FFF000", mark: "Dk" },
  { key: "trino", driver: "trino", name: "Trino", family: "analytics", color: "#A81D68", fg: W, mark: "Tr", defaults: { host: "localhost", port: 8080, user: "trino" } },
  { key: "mongodb", driver: "mongodb", name: "MongoDB", family: "document", color: "#1F7A3D", fg: W, mark: "Mo", defaults: { host: "localhost", port: 27017 } },
  { key: "dynamodb", driver: "dynamodb", name: "Amazon DynamoDB", family: "document", color: "#2E5AAC", fg: W, mark: "Dy" },
  { key: "firestore", driver: "firestore", name: "Firestore", family: "document", color: "#A04A00", fg: W, mark: "Fs" },
  { key: "redis", driver: "redis", name: "Redis", family: "keyvalue", color: "#B3261E", fg: W, mark: "Re", defaults: { host: "localhost", port: 6379 } },
  { key: "valkey", driver: "redis", name: "Valkey", family: "keyvalue", color: "#7A2E8E", fg: W, mark: "Va", defaults: { host: "localhost", port: 6379 } },
  { key: "elasticsearch", driver: "elasticsearch", name: "Elasticsearch", family: "search", color: "#00695C", fg: W, mark: "El", defaults: { host: "localhost", port: 9200 } },
  { key: "opensearch", driver: "elasticsearch", name: "OpenSearch", family: "search", color: "#1565A8", fg: W, mark: "Os", defaults: { host: "localhost", port: 9200, user: "admin" } },
  { key: "neo4j", driver: "neo4j", name: "Neo4j", family: "graph", color: "#176B9B", fg: W, mark: "N4", defaults: { host: "localhost", user: "neo4j", database: "neo4j" } },
  { key: "hydradb", driver: "hydradb", name: "HydraDB", family: "graph", color: "#0F766E", fg: W, mark: "Hy", experimental: true, defaults: { host: "localhost", port: 8443, graph: "default", cell: "cell-0" } },
  { key: "influxdb", driver: "influxdb", name: "InfluxDB 2", family: "timeseries", color: "#5A2FC2", fg: W, mark: "In", defaults: { host: "localhost", port: 8086 } },
  { key: "influxdb3", driver: "influxdb3", name: "InfluxDB 3", family: "timeseries", color: "#7A27AF", fg: W, mark: "I3", defaults: { host: "localhost", port: 8181 } },
  { key: "cassandra", driver: "cassandra", name: "Apache Cassandra", family: "widecolumn", color: "#0F6F93", fg: W, mark: "Ca", defaults: { host: "localhost", port: 9042, localDataCenter: "datacenter1", user: "cassandra" } },
  { key: "scylla", driver: "cassandra", name: "ScyllaDB", family: "widecolumn", color: "#2A2F7E", fg: W, mark: "Sc", defaults: { host: "localhost", port: 9042, localDataCenter: "datacenter1", user: "cassandra" } },
];

export const FAMILY_ORDER: readonly EngineFamily[] = ["relational", "analytics", "document", "keyvalue", "search", "graph", "timeseries", "widecolumn"];
