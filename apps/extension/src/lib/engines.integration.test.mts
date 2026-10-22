import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, type Connection, type DriverPlugin, type ResolvedConnectionConfig } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { defaultEffectivePolicy } from "@rizomadb/core";
import { buildModel, columnStatements, type Dialect } from "@rizomadb/schema-tools";
import { postgresDriver } from "@rizomadb/driver-postgres";
import { mysqlDriver } from "@rizomadb/driver-mysql";
import { mssqlDriver } from "@rizomadb/driver-mssql";
import { oracleDriver } from "@rizomadb/driver-oracle";
import { clickhouseDriver } from "@rizomadb/driver-clickhouse";
import { mongoDriver } from "@rizomadb/driver-mongodb";
import { elasticsearchDriver } from "@rizomadb/driver-elasticsearch";
import { neo4jDriver } from "@rizomadb/driver-neo4j";
import { runStatement, type RunEvent } from "./runner.js";
import { buildTableQuery } from "./tableQuery.js";
import { keysetOrder, keysetStatement, keysetSupported, lastKey } from "./keysetPaging.js";

/**
 * What the table screen does, run against real servers: the filter box builds a statement, the runner pages through it by skipping rows,
 * and the column menu's DDL changes a real table. Each suite skips when its engine is not up (and fails in CI where it is required).
 */
const sig = () => new AbortController().signal;
const run = (c: Connection, sql: string) => collect(c.execute({ sql }, sig()));
const profile = (driver: string) => ({ id: "c", name: "t", driver, environment: "dev", readOnly: false, options: {}, secretKeys: [], tags: [] });

async function page(conn: Connection, driver: string, sql: string, skip: number, size: number) {
  const events: RunEvent[] = [];
  await runStatement({ conn, profile: profile(driver), sql, signal: sig(), policy: defaultEffectivePolicy, readOnly: false, maxRows: size, ...(skip ? { skip } : {}), confirmDestructive: true, confirm: async () => true, onEvent: (e) => events.push(e) });
  const err = events.find((e) => e.type === "error") as Extract<RunEvent, { type: "error" }> | undefined;
  if (err) throw new Error(`${err.kind}: ${err.message}`);
  return { rows: events.flatMap((e) => (e.type === "rows" ? e.rows : [])), more: (events.find((e) => e.type === "done") as Extract<RunEvent, { type: "done" }>).truncated };
}
/** Walks every page of a statement and returns the first cell of each row. */
async function walk(conn: Connection, driver: string, sql: string, size: number) {
  const out: unknown[] = []; let skip = 0, pages = 0;
  for (;;) { const p = await page(conn, driver, sql, skip, size); out.push(...p.rows.map((r) => r[0])); skip += p.rows.length; pages++; if (!p.more) break; }
  return { out, pages };
}

// ---- SQL engines: filter, order, paging and column DDL ----
const sqlEngines: { name: string; driver: string; plugin: DriverPlugin; dialect: Dialect; port: number; env: string; admin: ResolvedConnectionConfig; cfg: (db: string) => ResolvedConnectionConfig; create: string; provision?: (admin: Connection, db: string) => Promise<void> }[] = [
  { name: "postgres", driver: "postgres", plugin: postgresDriver, dialect: "postgres", port: Number(process.env.RZ_PG_PORT ?? 54329), env: "pg", admin: { host: "localhost", port: Number(process.env.RZ_PG_PORT ?? 54329), user: "postgres", password: "rizoma_test", ssl: false, database: "postgres" },
    cfg: (db) => ({ host: "localhost", port: Number(process.env.RZ_PG_PORT ?? 54329), user: "postgres", password: "rizoma_test", ssl: false, database: db }), create: "CREATE TABLE people (id integer PRIMARY KEY, name varchar(20) NOT NULL, age integer)" },
  { name: "mysql", driver: "mysql", plugin: mysqlDriver, dialect: "mysql", port: Number(process.env.RZ_MYSQL_PORT ?? 33069), env: "mysql", admin: { host: "127.0.0.1", port: Number(process.env.RZ_MYSQL_PORT ?? 33069), user: "root", password: "rizoma_test", ssl: false },
    cfg: (db) => ({ host: "127.0.0.1", port: Number(process.env.RZ_MYSQL_PORT ?? 33069), user: "root", password: "rizoma_test", ssl: false, database: db }), create: "CREATE TABLE people (id int PRIMARY KEY, name varchar(20) NOT NULL, age int)" },
  { name: "mssql", driver: "mssql", plugin: mssqlDriver, dialect: "mssql", port: Number(process.env.RZ_MSSQL_PORT ?? 14339), env: "mssql", admin: { host: "127.0.0.1", port: Number(process.env.RZ_MSSQL_PORT ?? 14339), user: "sa", password: "Rizoma_test1", ssl: true, sslVerify: false },
    cfg: (db) => ({ host: "127.0.0.1", port: Number(process.env.RZ_MSSQL_PORT ?? 14339), user: "sa", password: "Rizoma_test1", ssl: true, sslVerify: false, database: db }), create: "CREATE TABLE people (id int PRIMARY KEY, name varchar(20) NOT NULL, age int)" },
  // Oracle has no CREATE DATABASE: each run gets its own schema (user) with its own password.
  { name: "oracle", driver: "oracle", plugin: oracleDriver, dialect: "oracle", port: Number(process.env.RZ_ORACLE_PORT ?? 15219), env: "oracle", admin: { host: "127.0.0.1", port: Number(process.env.RZ_ORACLE_PORT ?? 15219), service: "FREEPDB1", user: "system", password: "rizoma_test" },
    cfg: (db) => ({ host: "127.0.0.1", port: Number(process.env.RZ_ORACLE_PORT ?? 15219), service: "FREEPDB1", user: db, password: "Rz_test_pw1" }), create: "CREATE TABLE people (id number(10) PRIMARY KEY, name varchar2(20) NOT NULL, age number(10))",
    provision: async (admin, db) => { await run(admin, `CREATE USER ${db} IDENTIFIED BY Rz_test_pw1 QUOTA UNLIMITED ON USERS`); await run(admin, `GRANT CREATE SESSION, CREATE TABLE TO ${db}`); } },
];

for (const e of sqlEngines) {
  const up = await engineUp("127.0.0.1", e.port, e.name);
  describe.skipIf(!up)(`${e.name}: table filter, paging and column edits`, () => {
    let conn: Connection;
    beforeAll(async () => {
      const hex = randomBytes(5).toString("hex"), db = e.name === "oracle" ? `RZ${hex.toUpperCase()}` : `rz_${hex}`;
      const admin = await e.plugin.connect(e.admin, { log() {} }); await (e.provision ? e.provision(admin, db) : run(admin, `CREATE DATABASE ${db}`)); await admin.close();
      conn = await e.plugin.connect(e.cfg(db), { log() {} });
      await run(conn, e.create);
      for (let i = 1; i <= 25; i++) await run(conn, `INSERT INTO people VALUES (${i}, 'p${i}', ${20 + (i % 10)})`);
    });
    afterAll(async () => { await conn?.close(); });
    // Oracle stores unquoted names in upper case and the explorer passes them as stored.
    const C = (n: string) => (e.name === "oracle" ? n.toUpperCase() : n), TBL = C("people");
    const q = (where = "", order = "") => buildTableQuery({ driver: e.driver, quoted: conn.quoteIdent(TBL), name: TBL, where, order, limit: 100000 });

    it("pages a whole table in order without gaps or repeats", async () => {
      const r = await walk(conn, e.driver, q("", "id"), 10);
      expect(r.out.map(Number)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1)); expect(r.pages).toBe(3);
    });
    it("filters and orders in the database, then pages the filtered rows", async () => {
      const r = await walk(conn, e.driver, q("age >= 28", "id DESC"), 3);
      expect(r.out.map(Number)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1).filter((i) => 20 + (i % 10) >= 28).sort((x, y) => y - x));
    });
    it.skipIf(!keysetSupported(e.driver))("pages by primary key, with and without a filter, never skipping rows", async () => {
      const info = await conn.introspect().describeTable({ name: TBL });
      const keys = (info.columns ?? []).filter((c) => c.primaryKey).map((c) => ({ name: c.name, quoted: conn.quoteIdent(c.name) }));
      expect(keys.map((k) => k.name)).toEqual([C("id")]);
      // The exact flow of the grid: the first page is the table ordered by its key, "Load more" asks for the rows after the last key seen.
      const walkKeys = async (where: string, size: number) => {
        const got: number[] = []; let last: unknown[] | undefined, pages = 0;
        for (;;) {
          const sql = last ? keysetStatement({ driver: e.driver, quoted: conn.quoteIdent(TBL), name: TBL, where, keys, last: last as never, limit: 100000 })! : q(where, keysetOrder(keys));
          const r = await page(conn, e.driver, sql, 0, size);
          got.push(...r.rows.map((x) => Number(x[0]))); pages++;
          if (!r.more) return { got, pages };
          last = lastKey(keys, info.columns!, r.rows[r.rows.length - 1]!);
        }
      };
      const all = await walkKeys("", 10);
      expect(all.got).toEqual(Array.from({ length: 25 }, (_, i) => i + 1)); expect(all.pages).toBe(3);
      const some = await walkKeys("age >= 28 OR id = 1", 3);
      expect(some.got).toEqual(Array.from({ length: 25 }, (_, i) => i + 1).filter((i) => 20 + (i % 10) >= 28 || i === 1));
    });
    it("rejects an injected filter before it reaches the server", () => { expect(() => q("1=1; DROP TABLE people")).toThrow(); });

    it("renames, retypes, defaults, constrains, adds and drops a column on the real table", async () => {
      const describe_ = async () => { const info = await conn.introspect().describeTable({ name: TBL }); return buildModel(e.dialect, [{ ...info }]).tables[0]!; };
      const exec = async (table: Awaited<ReturnType<typeof describe_>>, op: Parameters<typeof columnStatements>[2]) => { for (const s of columnStatements(e.dialect, table, op)) if (!s.sql.startsWith("--")) await run(conn, s.sql); return describe_(); };
      let t = await describe_();
      t = await exec(t, { op: "rename", column: C("age"), to: C("years") });
      expect(t.columns.map((c) => c.name)).toContain(C("years"));
      expect((await run(conn, "SELECT years FROM people WHERE id = 1")).rows).toHaveLength(1);
      t = await exec(t, { op: "type", column: C("name"), type: "varchar(50)" });
      expect(t.columns.find((c) => c.name === C("name"))!.type).toMatch(/50/);
      t = await exec(t, { op: "default", column: C("years"), default: "7" });
      expect(String(t.columns.find((c) => c.name === C("years"))!.default)).toContain("7");
      t = await exec(t, { op: "default", column: C("years"), default: "9" });
      expect(String(t.columns.find((c) => c.name === C("years"))!.default)).toContain("9");
      t = await exec(t, { op: "nullable", column: C("years"), nullable: false });
      expect(t.columns.find((c) => c.name === C("years"))!.nullable).toBe(false);
      t = await exec(t, { op: "add", column: { name: C("note"), type: e.dialect === "postgres" ? "text" : "varchar(30)", nullable: true } });
      expect(t.columns.map((c) => c.name)).toContain(C("note"));
      t = await exec(t, { op: "drop", column: C("note") });
      expect(t.columns.map((c) => c.name)).not.toContain(C("note"));
      expect(Number((await run(conn, "SELECT count(*) FROM people")).rows[0]![0])).toBe(25);
    });
  });
}

// ---- ClickHouse: filter and paging (columns are not altered from the grid on this engine) ----
const chPort = Number(process.env.RZ_CLICKHOUSE_PORT ?? 18124);
describe.skipIf(!(await engineUp("127.0.0.1", chPort, "clickhouse")))("clickhouse: table filter and paging", () => {
  let conn: Connection; const db = `rz_${randomBytes(4).toString("hex")}`;
  beforeAll(async () => {
    const base = { host: "localhost", port: chPort, user: "default", password: "rizoma_test" };
    const admin = await clickhouseDriver.connect(base, { log() {} }); await run(admin, `CREATE DATABASE ${db}`); await admin.close();
    conn = await clickhouseDriver.connect({ ...base, database: db }, { log() {} });
    await run(conn, "CREATE TABLE people (id Int32, name String, age Int32) ENGINE = MergeTree ORDER BY id");
    await run(conn, `INSERT INTO people SELECT number + 1, concat('p', toString(number + 1)), 20 + ((number + 1) % 10) FROM numbers(25)`);
  });
  afterAll(async () => { await conn?.close(); });
  const q = (where = "", order = "") => buildTableQuery({ driver: "clickhouse", quoted: conn.quoteIdent("people"), name: "people", where, order, limit: 100000 });
  it("pages a whole table in order without gaps or repeats", async () => {
    const r = await walk(conn, "clickhouse", q("", "id"), 10);
    expect(r.out.map(Number)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1)); expect(r.pages).toBe(3);
  });
  it("filters and orders in the database, then pages the filtered rows", async () => {
    const r = await walk(conn, "clickhouse", q("age >= 28", "id DESC"), 3);
    expect(r.out.map(Number)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1).filter((i) => 20 + (i % 10) >= 28).sort((x, y) => y - x));
  });
});

// ---- MongoDB ----
const mongoPort = Number(process.env.RZ_MONGO_PORT ?? 27018);
describe.skipIf(!(await engineUp("127.0.0.1", mongoPort, "mongodb")))("mongodb: table filter and paging", () => {
  let conn: Connection; const db = `rz_${randomBytes(4).toString("hex")}`;
  beforeAll(async () => {
    conn = await mongoDriver.connect({ host: "127.0.0.1", port: mongoPort, ssl: false, database: db }, { log() {} });
    await run(conn, `db.getCollection("people").insertMany([${Array.from({ length: 25 }, (_, i) => `{ "n": ${i + 1}, "age": ${20 + ((i + 1) % 10)} }`).join(", ")}])`);
  });
  afterAll(async () => { await run(conn, `db.getSiblingDB("${db}").dropDatabase()`).catch(() => {}); await conn.close(); });
  it("filters and sorts with Mongo syntax and pages through the result", async () => {
    const sql = buildTableQuery({ driver: "mongodb", quoted: "", schema: db, name: "people", where: '{ "age": { "$gte": 28 } }', order: '{ "n": -1 }', limit: 100000 });
    const col = (await page(conn, "mongodb", sql, 0, 100)).rows; expect(col.length).toBe(Array.from({ length: 25 }, (_, i) => i + 1).filter((i) => 20 + (i % 10) >= 28).length);
    const first = await page(conn, "mongodb", sql, 0, 3), rest = await page(conn, "mongodb", sql, 3, 3);
    expect(first.more).toBe(true); expect(first.rows.length).toBe(3); expect(rest.rows.length).toBe(col.length - 3);
    expect(JSON.stringify([...first.rows, ...rest.rows])).toBe(JSON.stringify(col));
  });
  it("rejects a filter that tries to close the call", () => { expect(() => buildTableQuery({ driver: "mongodb", quoted: "", name: "p", where: "{}).drop(", order: "", limit: 10 })).toThrow(); });
});

// ---- Elasticsearch ----
const esPort = Number(process.env.RZ_ELASTICSEARCH_PORT ?? 19200);
describe.skipIf(!(await engineUp("127.0.0.1", esPort, "elasticsearch")))("elasticsearch: table filter and paging", () => {
  let conn: Connection; const idx = `rz-${randomBytes(4).toString("hex")}`;
  beforeAll(async () => {
    conn = await elasticsearchDriver.connect({ host: "127.0.0.1", port: esPort, ssl: false }, { log() {} });
    const bulk = Array.from({ length: 25 }, (_, i) => `{"index":{"_index":"${idx}","_id":"${i + 1}"}}\n{"n":${i + 1},"level":"${(i + 1) % 3 === 0 ? "error" : "info"}"}`).join("\n") + "\n";
    await run(conn, `POST /_bulk?refresh=true\n${bulk}`);
  });
  afterAll(async () => { await run(conn, `DELETE /${idx}`).catch(() => {}); await conn.close(); });
  it("filters with a query string, sorts and pages", async () => {
    const sql = buildTableQuery({ driver: "elasticsearch", quoted: "", name: idx, where: "level:error", order: "n:desc", limit: 10000 });
    const r = await walk(conn, "elasticsearch", sql, 3);
    expect(r.out.length).toBe(8); expect(r.pages).toBe(3);
  });
});

// ---- Neo4j ----
const neoPort = Number(process.env.RZ_NEO4J_PORT ?? 17474);
describe.skipIf(!(await engineUp("127.0.0.1", neoPort, "neo4j")))("neo4j: table filter and paging", () => {
  let conn: Connection; const label = `T${randomBytes(4).toString("hex")}`;
  beforeAll(async () => {
    conn = await neo4jDriver.connect({ host: "127.0.0.1", port: neoPort, user: "neo4j", password: "rizoma-test-pw", database: "neo4j" }, { log() {} });
    await run(conn, `UNWIND range(1, 25) AS i CREATE (:${label} {n: i, age: 20 + (i % 10)})`);
  });
  afterAll(async () => { await run(conn, `MATCH (n:${label}) DETACH DELETE n`).catch(() => {}); await conn.close(); });
  it("filters on n, orders and pages", async () => {
    const sql = buildTableQuery({ driver: "neo4j", quoted: conn.quoteIdent(label), name: label, where: "n.age >= 28", order: "n.n DESC", limit: 100000 });
    const all = (await page(conn, "neo4j", sql, 0, 100)).rows.length;
    expect(all).toBe(Array.from({ length: 25 }, (_, i) => i + 1).filter((i) => 20 + (i % 10) >= 28).length);
    const a = await page(conn, "neo4j", sql, 0, 3), b = await page(conn, "neo4j", sql, 3, 100);
    expect(a.more).toBe(true); expect(a.rows.length + b.rows.length).toBe(all);
  });
});
