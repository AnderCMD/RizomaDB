import { describe, it, expect } from "vitest";
import { JDBC_DRIVERS, JdbcUrlError, parseJdbcUrl, NOTE_IGNORED, NOTE_ORACLE_FIRST, NOTE_PASSWORD } from "./jdbcUrl.js";

const v = (url: string) => parseJdbcUrl(url).values;
const err = (url: string) => { try { parseJdbcUrl(url); } catch (e) { return e as JdbcUrlError; } throw new Error("did not throw"); };

describe("Oracle JDBC URLs", () => {
  it("reads the service-name forms", () => {
    expect(parseJdbcUrl("jdbc:oracle:thin:@//db.example.com:1522/FREEPDB1")).toMatchObject({ driver: "oracle", values: { host: "db.example.com", port: 1522, service: "FREEPDB1" } });
    expect(v("jdbc:oracle:thin:@//db.example.com/ORCL")).toEqual({ host: "db.example.com", port: 1521, service: "ORCL" });
    expect(v("jdbc:oracle:thin:@db.example.com:1521/ORCL")).toEqual({ host: "db.example.com", port: 1521, service: "ORCL" });
  });
  it("reads the SID form", () => {
    expect(v("jdbc:oracle:thin:@db.example.com:1521:XE")).toEqual({ host: "db.example.com", port: 1521, sid: "XE" });
  });
  it("takes user and password written before the @", () => {
    const r = parseJdbcUrl("jdbc:oracle:thin:scott/tiger@//h:1521/svc");
    expect(r.values).toEqual({ host: "h", port: 1521, service: "svc", user: "scott", password: "tiger" });
    expect(r.secretKeys).toEqual(["password"]);
    expect(r.notes.map((n) => n.template)).toContain(NOTE_PASSWORD);
  });
  it("reads a DESCRIPTION and says when it lists several addresses", () => {
    const one = parseJdbcUrl("jdbc:oracle:thin:@(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=h1)(PORT=1530))(CONNECT_DATA=(SERVICE_NAME=svc)))");
    expect(one.values).toEqual({ host: "h1", port: 1530, service: "svc" });
    const rac = parseJdbcUrl("jdbc:oracle:thin:@(DESCRIPTION=(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=a)(PORT=1521))(ADDRESS=(PROTOCOL=TCP)(HOST=b)(PORT=1521)))(CONNECT_DATA=(SID=orcl)))");
    expect(rac.values).toEqual({ host: "a", port: 1521, sid: "orcl" });
    expect(rac.notes).toContainEqual({ template: NOTE_ORACLE_FIRST, args: ["2"] });
  });
  it("refuses what the driver cannot do, with a clear message", () => {
    expect(err("jdbc:oracle:thin:@tcps://h:2484/svc").message).toMatch(/TCPS/);
    expect(err("jdbc:oracle:thin:@MYALIAS").message).toMatch(/TNS alias/);
    expect(err("jdbc:oracle:oci:@h:1521:XE").message).toMatch(/OCI/);
    expect(err("jdbc:oracle:thin:@(DESCRIPTION=(ADDRESS=(PROTOCOL=TCPS)(HOST=h)(PORT=2484))(CONNECT_DATA=(SERVICE_NAME=s)))").message).toMatch(/TCPS/);
  });
});

describe("PostgreSQL and family", () => {
  it("reads host, port, database and query options", () => {
    const r = parseJdbcUrl("jdbc:postgresql://pg.example.com:5433/shop?user=ann&password=p%40ss&ssl=true&sslmode=verify-full&applicationName=x");
    expect(r).toMatchObject({ driver: "postgres", values: { host: "pg.example.com", port: 5433, database: "shop", user: "ann", password: "p@ss", ssl: true }, secretKeys: ["password"] });
    expect(r.notes.some((n) => n.template === NOTE_IGNORED)).toBe(false);
  });
  it("uses defaults and the short forms", () => {
    expect(v("jdbc:postgresql://localhost/postgres")).toEqual({ host: "localhost", port: 5432, database: "postgres" });
    expect(v("jdbc:postgresql:shop")).toEqual({ host: "localhost", port: 5432, database: "shop" });
    expect(v("jdbc:postgresql:///shop")).toMatchObject({ database: "shop" });
  });
  it("maps CockroachDB and YugabyteDB to the PostgreSQL driver", () => {
    expect(parseJdbcUrl("jdbc:yugabytedb://h:5433/yugabyte?user=yugabyte").driver).toBe("postgres");
  });
  it("uses the first of several hosts and reports options it ignores", () => {
    const r = parseJdbcUrl("jdbc:postgresql://a:5432,b:5433/db?fancyOption=1");
    expect(r.values).toMatchObject({ host: "a", port: 5432 });
    expect(r.notes).toContainEqual({ template: NOTE_ORACLE_FIRST, args: ["2"] });
    expect(r.notes).toContainEqual({ template: NOTE_IGNORED, args: ["fancyoption"] });
  });
  it("reads IPv6 hosts and credentials in the authority", () => {
    expect(v("jdbc:postgresql://u:pw@[::1]:5432/d")).toEqual({ host: "::1", port: 5432, database: "d", user: "u", password: "pw" });
  });
});

describe("MySQL and MariaDB", () => {
  it("reads options and TLS settings", () => {
    expect(parseJdbcUrl("jdbc:mysql://my.example.com/shop?user=root&password=x&sslMode=REQUIRED&serverTimezone=UTC").values).toEqual({ host: "my.example.com", port: 3306, database: "shop", user: "root", password: "x", ssl: true });
    expect(v("jdbc:mysql://h:3307/d?useSSL=false")).toMatchObject({ port: 3307, ssl: false });
    expect(v("jdbc:mysql://h/d?useSSL=true&verifyServerCertificate=false")).toMatchObject({ ssl: true, sslVerify: false });
    expect(parseJdbcUrl("jdbc:mariadb://m:3306/db?user=a").driver).toBe("mysql");
  });
});

describe("SQL Server", () => {
  it("reads the semicolon properties", () => {
    expect(parseJdbcUrl("jdbc:sqlserver://sql.example.com:1434;databaseName=Sales;user=sa;password=Str0ng;encrypt=true;trustServerCertificate=true;applicationName=x").values)
      .toEqual({ host: "sql.example.com", port: 1434, database: "Sales", user: "sa", password: "Str0ng", ssl: true, sslVerify: false });
    expect(v("jdbc:sqlserver://localhost;database=db")).toEqual({ host: "localhost", port: 1433, database: "db" });
  });
  it("says what it does with an instance name and refuses integrated security", () => {
    const r = parseJdbcUrl("jdbc:sqlserver://h\\SQLEXPRESS;databaseName=d");
    expect(r.values).toMatchObject({ host: "h", port: 1433 });
    expect(r.notes.length).toBeGreaterThan(0);
    expect(err("jdbc:sqlserver://h;integratedSecurity=true").message).toMatch(/integrated security/);
  });
});

describe("file databases", () => {
  it("reads SQLite and DuckDB paths", () => {
    expect(parseJdbcUrl("jdbc:sqlite:/tmp/data.db").values).toEqual({ path: "/tmp/data.db" });
    expect(v("jdbc:sqlite::memory:")).toEqual({ path: ":memory:" });
    expect(v("jdbc:sqlite:C:\\data\\app.db")).toEqual({ path: "C:\\data\\app.db" });
    expect(parseJdbcUrl("jdbc:duckdb:/tmp/a.duckdb").driver).toBe("duckdb");
    expect(v("jdbc:duckdb:")).toEqual({ path: ":memory:" });
  });
});

describe("the other engines", () => {
  it("ClickHouse", () => {
    expect(v("jdbc:clickhouse://ch.example.com:8123/analytics?user=default&password=x")).toEqual({ host: "ch.example.com", port: 8123, database: "analytics", user: "default", password: "x" });
    expect(v("jdbc:ch://ch.example.com/db?ssl=true")).toMatchObject({ port: 8443, ssl: true });
    expect(v("jdbc:clickhouse:https://h:8443/db")).toMatchObject({ host: "h", database: "db" });
  });
  it("Trino and Presto", () => {
    expect(v("jdbc:trino://t.example.com:8080/hive/default?user=ann")).toEqual({ host: "t.example.com", port: 8080, catalog: "hive", schema: "default", user: "ann" });
    expect(v("jdbc:trino://t/memory?SSL=true&SSLVerification=NONE")).toMatchObject({ catalog: "memory", ssl: true, sslVerify: false, port: 443 });
  });
  it("Cassandra", () => {
    expect(v("jdbc:cassandra://c1--c2:9042/shop?localdatacenter=dc1&user=u&password=p")).toMatchObject({ host: "c1", port: 9042, keyspace: "shop", localDataCenter: "dc1", user: "u", password: "p" });
  });
  it("Elasticsearch and OpenSearch", () => {
    expect(v("jdbc:es://https://es.example.com:9243?user=elastic&password=x")).toMatchObject({ host: "es.example.com", port: 9243, ssl: true, user: "elastic", password: "x" });
    expect(v("jdbc:opensearch://localhost:9200?useSSL=true&trustSelfSigned=true")).toMatchObject({ ssl: true, sslVerify: false });
  });
  it("Redis and Valkey", () => {
    expect(parseJdbcUrl("jdbc:redis://:secret@r.example.com:6380/2").values).toMatchObject({ host: "r.example.com", port: 6380, database: 2 });
    expect(parseJdbcUrl("jdbc:valkey://h").driver).toBe("redis");
  });
  it("Neo4j points to the HTTP port and says so", () => {
    const r = parseJdbcUrl("jdbc:neo4j:bolt://n.example.com:7687/neo4j?user=neo4j");
    expect(r.driver).toBe("neo4j");
    expect(r.values).toMatchObject({ host: "n.example.com", port: 7474, database: "neo4j", user: "neo4j" });
    expect(r.notes.length).toBeGreaterThan(0);
  });
  it("MongoDB keeps the whole URI as a secret", () => {
    const r = parseJdbcUrl("jdbc:mongodb://u:p@m1:27017/shop?authSource=admin");
    expect(r).toMatchObject({ driver: "mongodb", secretKeys: ["uri"], values: { uri: "mongodb://u:p@m1:27017/shop?authSource=admin", database: "shop" } });
  });
});

describe("errors and coverage", () => {
  it("rejects what is not a JDBC URL or has no connection here", () => {
    expect(err("postgres://h/db").message).toMatch(/jdbc:/);
    expect(err("jdbc:db2://h:50000/db").message).toMatch(/db2/);
    expect(err("jdbc:mysql://").message).toMatch(/no host|could not be read/);
    expect(err("jdbc:sqlserver:nope").template).toMatch(/could not be read/);
  });
  it("lists the drivers it can fill", () => {
    expect([...JDBC_DRIVERS].sort()).toEqual(["cassandra", "clickhouse", "duckdb", "elasticsearch", "mongodb", "mssql", "mysql", "neo4j", "oracle", "postgres", "redis", "sqlite", "trino"]);
  });
  it("never leaves an empty value behind", () => {
    for (const url of ["jdbc:postgresql://h/", "jdbc:mysql://h:3306/", "jdbc:oracle:thin:@//h/svc"]) for (const x of Object.values(v(url))) expect(x).not.toBe("");
  });
});

describe("importing a JDBC URL", () => {
  it("splits the password out of an Oracle URL", async () => {
    const { parseConnectionUri } = await import("./importers.js");
    const c = parseConnectionUri("jdbc:oracle:thin:scott/tiger@//db.example.com:1521/ORCLPDB1");
    expect(c.driver).toBe("oracle");
    expect(c.options).toMatchObject({ host: "db.example.com", port: 1521, service: "ORCLPDB1", user: "scott" });
    expect(c.secrets).toEqual({ password: "tiger" });
    expect(c.options).not.toHaveProperty("password");
    expect(c.jdbcNotes?.length).toBeGreaterThan(0);
  });
  it("reports an unsupported subprotocol instead of guessing", async () => {
    const { parseConnectionUri } = await import("./importers.js");
    expect(() => parseConnectionUri("jdbc:db2://h:50000/x")).toThrow(/db2/);
  });
});

describe("hostile or broken input", () => {
  it("only ever fails with a JdbcUrlError, never another exception", () => {
    const parts = ["jdbc:", "oracle:thin:", "postgresql:", "mysql:", "sqlserver:", "mongodb:", "neo4j:", "es:", "//", "@", "/", ":", ";", "?", "&", "=", "(", ")", "DESCRIPTION", "ADDRESS", "HOST", "PORT", "%zz", "%", "[::1]", "[", "]", "a", "99999", "-1", "user/pw@", "\u0000", "\n", " ", "ssl=true", "--"];
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 4000; i++) {
      let s = "jdbc:" + Array.from({ length: 1 + Math.floor(rnd() * 12) }, () => parts[Math.floor(rnd() * parts.length)]).join("");
      if (i % 7 === 0) s = s.slice(0, Math.floor(rnd() * s.length));
      try { parseJdbcUrl(s); } catch (e) { if (!(e instanceof JdbcUrlError)) throw new Error(`non-JdbcUrlError for ${JSON.stringify(s)}: ${String(e)}`, { cause: e }); }
    }
  });
});
