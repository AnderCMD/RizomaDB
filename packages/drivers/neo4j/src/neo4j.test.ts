import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, DriverError, type Connection } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { neo4jDriver, assessCypher } from "./index.js";

describe("Cypher risk classification", () => {
  const risk = (s: string) => assessCypher(s).risk;
  it("treats plain reads as safe", () => {
    for (const s of ["MATCH (n:Person) RETURN n LIMIT 5", "OPTIONAL MATCH (a)-[r]->(b) RETURN r", "RETURN 1", "UNWIND [1,2] AS x RETURN x", "CALL db.labels()", "SHOW INDEXES", "EXPLAIN MATCH (n) RETURN n", "MATCH (n) WHERE n.name = 'DELETE ME' RETURN n // CREATE"])
      expect(risk(s), s).toBe("none");
  });
  it("flags writes and destructive statements", () => {
    expect(risk("CREATE (n:X)")).toBe("write"); expect(risk("MATCH (n) SET n.a = 1")).toBe("write"); expect(risk("MERGE (n:X {id:1})")).toBe("write");
    expect(risk("MATCH (n) DETACH DELETE n")).toBe("destructive"); expect(risk("DROP INDEX foo")).toBe("destructive");
    expect(risk("LOAD CSV FROM 'file:///x.csv' AS r RETURN r")).toBe("write");
  });
  it("is default-deny for unknown procedures, multiple statements and keywords hidden after reads", () => {
    expect(risk("CALL apoc.cypher.runWrite('CREATE (n)', {})")).toBe("write");
    expect(risk("MATCH (n) RETURN n; MATCH (m) DETACH DELETE m")).toBe("write");
    expect(risk("MATCH (n) WITH n CREATE (m:Copy)")).toBe("write");
    expect(risk("PROFILE MATCH (n) RETURN n")).toBe("write");
    expect(risk("CALL { MATCH (n) DELETE n } IN TRANSACTIONS")).toBe("destructive");
    expect(risk("GRANT ROLE admin TO bob")).toBe("write");
  });
  it("ignores keywords inside strings, comments and quoted identifiers", () => {
    expect(risk("MATCH (n:`DELETE`) RETURN n")).toBe("none");
    expect(risk("/* CREATE */ MATCH (n) RETURN 'SET x'")).toBe("none");
  });
});

const port = Number(process.env.RZ_NEO4J_PORT ?? 17474);
const up = await engineUp("127.0.0.1", port);
const cfg = { host: "127.0.0.1", port, user: "neo4j", password: "rizoma-test-pw", database: "neo4j" };

describe.skipIf(!up)("neo4j driver", () => {
  let conn: Connection, ro: Connection; const tag = `T${randomBytes(4).toString("hex")}`;
  const run = (c: Connection, sql: string, params?: never[] | import("@rizomadb/driver-api").Value[], extra: { maxRows?: number } = {}, s = new AbortController().signal) => collect(c.execute({ sql, ...(params ? { params } : {}), ...extra }, s));
  beforeAll(async () => {
    conn = await neo4jDriver.connect(cfg, { log() {} });
    ro = await neo4jDriver.connect({ ...cfg, readOnly: true }, { log() {} });
    await run(conn, `UNWIND range(1, 50) AS i CREATE (:${tag} {n: i, name: 'p' + toString(i), big: 9007199254740993, f: 1.5, ok: true, tags: ['a','b']})`);
  });
  afterAll(async () => { await run(conn, `MATCH (n:${tag}) DETACH DELETE n`).catch(() => {}); await conn.close(); await ro.close(); });

  it("identifies the server and pings", async () => { expect(conn.serverInfo.product).toMatch(/^Neo4j/); expect(conn.serverInfo.version).toMatch(/^5\./); await conn.ping(); });

  it("returns typed scalars without losing 64-bit integers", async () => {
    const r = await run(conn, `MATCH (n:${tag} {n: 1}) RETURN n.n AS n, n.big AS big, n.f AS f, n.ok AS ok, n.tags AS tags, null AS z`);
    expect(r.columns.map((c) => c.name)).toEqual(["n", "big", "f", "ok", "tags", "z"]);
    expect(r.rows[0]).toEqual([1, 9007199254740993n, 1.5, true, { json: ["a", "b"] }, null]);
  });
  it("returns nodes and relationships as structured values", async () => {
    const r = await run(conn, `MATCH (n:${tag} {n: 2}) RETURN n`);
    const v = (r.rows[0]![0] as { json: { $type: string; labels: string[]; properties: Record<string, unknown> } }).json;
    expect(v.$type).toBe("Node"); expect(v.labels).toEqual([tag]); expect(v.properties.big).toBe(9007199254740993n);
  });
  it("binds positional parameters", async () => {
    const r = await run(conn, `MATCH (n:${tag}) WHERE n.n > $p1 AND n.name <> $p2 RETURN count(n) AS c`, [40, "p45"]);
    expect(r.rows[0]).toEqual([9]);
    const big = await run(conn, `RETURN $p1 AS x`, [9007199254740993n]);
    expect(big.rows[0]).toEqual([9007199254740993n]);
    const mixed = await run(conn, `RETURN $p1 AS b, $p2 AS m, $p3 AS d, $p4 AS f`, [true, { json: { a: 1, b: ["x", 2.5] } }, new Date("2020-01-02T03:04:05Z"), 2.5]);
    expect(mixed.rows[0]).toEqual([true, { json: { a: 1, b: ["x", 2.5] } }, "2020-01-02T03:04:05Z", 2.5]);
  });
  it("truncates at maxRows", async () => { const r = await run(conn, `MATCH (n:${tag}) RETURN n.n AS n`, undefined, { maxRows: 7 }); expect(r.rows.length).toBe(7); });
  it("maps errors", async () => {
    await expect(run(conn, "MATC (n) RETURN n")).rejects.toMatchObject({ kind: "syntax" });
    await expect(run(conn, "RETURN 1/0")).rejects.toBeInstanceOf(DriverError);
    await expect(neo4jDriver.connect({ ...cfg, password: "wrong" }, { log() {} })).rejects.toMatchObject({ kind: "authentication" });
    await expect(neo4jDriver.connect({ ...cfg, port: 1 }, { log() {} })).rejects.toMatchObject({ kind: "connection" });
  });
  it("read-only connections refuse writes without contacting the server", async () => {
    await expect(run(ro, `CREATE (:${tag} {n: 999})`)).rejects.toMatchObject({ kind: "permission" });
    const c = await run(conn, `MATCH (n:${tag} {n: 999}) RETURN count(n) AS c`); expect(c.rows[0]).toEqual([0]);
    expect((await run(ro, `MATCH (n:${tag}) RETURN count(n) AS c`)).rows[0]).toEqual([50]);
  });
  it("commits and rolls back transactions", async () => {
    const t1 = await conn.begin!(); await collect(t1.execute({ sql: `CREATE (:${tag} {n: 1001})` }, new AbortController().signal));
    const inside = await collect(t1.execute({ sql: `MATCH (n:${tag} {n: 1001}) RETURN count(n) AS c` }, new AbortController().signal)); expect(inside.rows[0]).toEqual([1]);
    expect((await run(conn, `MATCH (n:${tag} {n: 1001}) RETURN count(n) AS c`)).rows[0]).toEqual([0]);
    await t1.rollback();
    expect((await run(conn, `MATCH (n:${tag} {n: 1001}) RETURN count(n) AS c`)).rows[0]).toEqual([0]);
    const t2 = await conn.begin!(); await collect(t2.execute({ sql: `CREATE (:${tag} {n: 1002})` }, new AbortController().signal)); await t2.commit();
    expect((await run(conn, `MATCH (n:${tag} {n: 1002}) RETURN count(n) AS c`)).rows[0]).toEqual([1]);
  });
  it("cancels a long query", async () => {
    const ac = new AbortController(); setTimeout(() => ac.abort(), 300);
    const t0 = Date.now();
    await expect(run(conn, "UNWIND range(1, 2000000000) AS x RETURN sum(x * x) AS s", undefined, {}, ac.signal)).rejects.toMatchObject({ kind: "cancelled" });
    expect(Date.now() - t0).toBeLessThan(3000);
  });
  it("introspects labels, properties and indexes", async () => {
    await run(conn, `CREATE INDEX ${tag}_idx IF NOT EXISTS FOR (n:${tag}) ON (n.n)`);
    const api = conn.introspect();
    expect((await api.listTables()).map((t) => t.name)).toContain(tag);
    const d = await api.describeTable({ name: tag });
    expect(d.columns!.map((c) => c.name)).toEqual(expect.arrayContaining(["n", "name", "big", "tags"]));
    expect((await api.indexes!()).some((i) => i.name === `${tag}_idx` && i.table === tag && i.columns[0] === "n")).toBe(true);
    await run(conn, `DROP INDEX ${tag}_idx IF EXISTS`);
  });
});
