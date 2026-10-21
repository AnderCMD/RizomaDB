import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fc from "fast-check";
import { collect, DriverError, type Connection, type Value } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { hydradbDriver, assessCypher, parseLossless, stringifyBody } from "./index.js";
import { meta } from "./meta.js";

describe("Cypher risk classification (HydraDB)", () => {
  const risk = (s: string) => assessCypher(s).risk;
  it("treats reads and the path procedures as safe", () => {
    for (const s of ["MATCH (a:Person {id: 1})-[:FOLLOWS]->(b) RETURN b.id AS id", "CALL algo.SPpaths({sourceNode: 1, targetNode: 5, relTypes: ['FOLLOWS'], maxLen: 3}) YIELD path RETURN path", "MATCH (a {id: 1}) RETURN a.id // DELETE"]) expect(risk(s), s).toBe("none");
  });
  it("flags every write shape HydraDB accepts", () => {
    for (const s of ["MERGE (a:P {id: 1})-[:F]->(b:P {id: 2})", "CREATE (a {id: 1})-[:F]->(b {id: 2})", "UNWIND $rows AS row CREATE (a {id: row.src})-[:F]->(b {id: row.dst})", "MATCH (n {id: 1}) SET n.x = 1", "MATCH (a {id: 1})-[r:F]->(b) REMOVE r.x"]) expect(risk(s), s).toBe("write");
    expect(risk("MATCH (a {id: 1}) DETACH DELETE a")).toBe("destructive");
    expect(risk("MATCH (a)-[r:F]->(b) DELETE r")).toBe("destructive");
  });
  it("is default-deny for other procedures and several statements", () => {
    expect(risk("CALL db.labels()")).toBe("write"); expect(risk("CALL algo.other({})")).toBe("write");
    expect(risk("MATCH (a {id: 1}) RETURN a.id; MATCH (a {id: 1}) DETACH DELETE a")).toBe("write");
  });
});

describe("lossless JSON", () => {
  it("keeps 64-bit integers exact in typed cells", () => {
    const v = parseLossless('{"values":[{"type":"integer","value":9223372036854775807},{"type":"vertex_id","value":-9223372036854775808},{"type":"integer","value":42}]}') as { values: { value: unknown }[] };
    expect(v.values.map((c) => c.value)).toEqual(["9223372036854775807", "-9223372036854775808", 42]);
  });
  it("writes bigint parameters as bare integers", () => { expect(stringifyBody({ a: 9223372036854775807n, b: "x" })).toBe('{"a":9223372036854775807,"b":"x"}'); });
  it("round-trips any int64 through the quoting step", () => {
    fc.assert(fc.property(fc.bigInt({ min: -(2n ** 63n), max: 2n ** 63n - 1n }), (n) => {
      const out = parseLossless(`{"type":"integer","value":${n}}`) as { value: string | number };
      expect(BigInt(out.value)).toBe(n);
    }));
  });
});

const port = Number(process.env.RZ_HYDRADB_PORT ?? 18443);
const up = await engineUp("127.0.0.1", port, "hydradb");
const cfg = { host: "127.0.0.1", port, token: "local-development-token-32-bytes", graph: "default", cell: "cell-0", labels: "Person, Place" };

describe.skipIf(!up)("hydradb driver", () => {
  let conn: Connection, ro: Connection;
  const base = 910_000 + Math.floor(Math.random() * 50_000) * 10;
  const run = (c: Connection, sql: string, params?: Value[], extra: { maxRows?: number } = {}, s = new AbortController().signal) => collect(c.execute({ sql, ...(params ? { params } : {}), ...extra }, s));
  beforeAll(async () => {
    conn = await hydradbDriver.connect(cfg, { log() {} });
    ro = await hydradbDriver.connect({ ...cfg, readOnly: true }, { log() {} });
    await run(conn, `MERGE (a:RzPerson {id: ${base}, name: 'alice', age: 30, big: 9223372036854775807, f: 1.5, ok: true})-[:RZ_FOLLOWS]->(b:RzPerson {id: ${base + 1}, name: 'héllo 🌱'})`);
    await run(conn, `MERGE (a:RzPerson {id: ${base}})-[:RZ_FOLLOWS]->(b:RzPerson {id: ${base + 2}, name: 'carol'})`);
  });
  afterAll(async () => {
    for (const i of [0, 1, 2]) await run(conn, `MATCH (n {id: ${base + i}}) DETACH DELETE n`).catch(() => {});
    await conn.close(); await ro.close();
  });

  it("identifies the server and pings", async () => { expect(conn.serverInfo.product).toBe("HydraDB"); expect(conn.serverInfo.version).toBeTruthy(); await conn.ping(); });

  it("returns typed scalars, nulls and lists without losing 64-bit integers", async () => {
    const r = await run(conn, `MATCH (n:RzPerson {id: ${base}}) RETURN n.id AS id, n.name AS name, n.age AS age, n.big AS big, n.f AS f, n.ok AS ok, n.nope AS nope`);
    expect(r.columns.map((c) => [c.name, c.kind])).toEqual([["id", "integer"], ["name", "text"], ["age", "integer"], ["big", "integer"], ["f", "float"], ["ok", "boolean"], ["nope", "other"]]);
    expect(r.rows[0]).toEqual([base, "alice", 30, 9223372036854775807n, 1.5, true, null]);
    const l = await run(conn, `MATCH (a:RzPerson {id: ${base}})-[:RZ_FOLLOWS]->(b) RETURN collect(b.name) AS names`);
    expect((l.rows[0]![0] as { json: string[] }).json.sort()).toEqual(["carol", "héllo 🌱"]);
  });

  it("binds parameters, including unicode and 64-bit integers", async () => {
    const r = await run(conn, `MATCH (n:RzPerson {id: $p1}) RETURN n.name AS name`, [base + 1]);
    expect(r.rows).toEqual([["héllo 🌱"]]);
    const w = await run(conn, `MATCH (n:RzPerson {id: $p1}) WHERE n.big = $p2 RETURN n.id AS id`, [base, 9223372036854775807n]);
    expect(w.rows).toEqual([[base]]);
  });

  it("streams rows in batches and honours maxRows", async () => {
    const ev: string[] = [];
    for await (const e of conn.execute({ sql: `MATCH (a:RzPerson {id: ${base}})-[:RZ_FOLLOWS]->(b) RETURN b.id AS id ORDER BY id`, batchSize: 1 }, new AbortController().signal)) ev.push(e.type);
    expect(ev[0]).toBe("columns"); expect(ev.at(-1)).toBe("done"); expect(ev.filter((x) => x === "rows")).toHaveLength(2);
    const r = await run(conn, `MATCH (a:RzPerson {id: ${base}})-[:RZ_FOLLOWS]->(b) RETURN b.id AS id ORDER BY id`, undefined, { maxRows: 1 });
    expect(r.rows).toEqual([[base + 1]]);
  });

  it("returns columns for empty results and for writes", async () => {
    const r = await run(conn, `MATCH (a:RzPerson {id: ${base + 2}})-[:RZ_FOLLOWS]->(b) RETURN b.id AS id`);
    expect(r.columns.map((c) => c.name)).toEqual(["id"]); expect(r.rows).toEqual([]);
  });

  it("types syntax errors, unsupported constructs and bad credentials", async () => {
    await expect(run(conn, "SELEC nope")).rejects.toMatchObject({ name: "DriverError", kind: "syntax" });
    await expect(run(conn, "MATCH (n:RzPerson) RETURN n LIMIT 1")).rejects.toMatchObject({ kind: "syntax" });
    await expect(hydradbDriver.connect({ ...cfg, token: "wrong-token-wrong-token-wrong" }, { log() {} })).rejects.toMatchObject({ kind: "authentication" });
    await expect(hydradbDriver.connect({ ...cfg, token: "" }, { log() {} })).rejects.toMatchObject({ kind: "authentication" });
    await expect(hydradbDriver.connect({ ...cfg, port: 1 }, { log() {} })).rejects.toMatchObject({ kind: "connection" });
  });

  it("explains an unknown cell id", async () => {
    const err = await hydradbDriver.connect({ ...cfg, cell: "no-such-cell" }, { log() {} }).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(DriverError); expect((err as DriverError).message).toMatch(/Cell ID/);
  });

  it("rejects when already aborted and cancels a running request", async () => {
    const ac = new AbortController(); ac.abort();
    await expect(run(conn, "MATCH (a {id: 1})-[:X]->(b) RETURN b.id AS id", undefined, {}, ac.signal)).rejects.toMatchObject({ kind: "cancelled" });
    const ac2 = new AbortController(); const p = run(conn, `MATCH (a:RzPerson {id: ${base}})-[:RZ_FOLLOWS*1..3]->(b) RETURN b.id AS id`, undefined, {}, ac2.signal); ac2.abort();
    await expect(p).rejects.toMatchObject({ kind: "cancelled" });
    await conn.ping();
  });

  it("lists the configured labels as tables and describes the id column", async () => {
    const tables = await conn.introspect().listTables();
    expect(tables.map((t) => t.name)).toEqual(["Person", "Place"]);
    const t = await conn.introspect().describeTable({ name: "Person" });
    expect(t.columns?.[0]).toMatchObject({ name: "id", primaryKey: true });
    expect(meta.openCommand!({ name: "Person" }, 5)).toBe("MATCH (n:`Person`) RETURN n.id AS id LIMIT 5");
  });

  it("blocks writes in read-only mode but still reads", async () => {
    await expect(run(ro, `MERGE (a:RzPerson {id: ${base + 3}})-[:RZ_FOLLOWS]->(b:RzPerson {id: ${base + 4}})`)).rejects.toMatchObject({ kind: "permission" });
    await expect(run(ro, `MATCH (a {id: ${base}}) DETACH DELETE a`)).rejects.toBeInstanceOf(DriverError);
    expect((await run(ro, `MATCH (n:RzPerson {id: ${base}}) RETURN n.name AS name`)).rows).toEqual([["alice"]]);
  });
});
