import { describe, it, expect } from "vitest";
import { collect, type Connection, type Value } from "@rizomadb/driver-api";
import { engineUp, runConformance } from "@rizomadb/driver-api/conformance";
import { randomBytes } from "node:crypto";
import { trinoDriver, assessTrino } from "./index.js";

const port = Number(process.env.RZ_TRINO_PORT ?? 18081);
const enabled = await engineUp("127.0.0.1", port);
const schema = `rz_${randomBytes(4).toString("hex")}`;
const cfg = { host: "127.0.0.1", port, user: "rizoma", catalog: "memory", schema };

async function freshSchema() {
  const c = await trinoDriver.connect({ ...cfg, schema: "default" }, { log() {} });
  await collect(c.execute({ sql: `CREATE SCHEMA IF NOT EXISTS memory.${schema}` }, new AbortController().signal)); await c.close();
  return cfg;
}

describe("Trino risk classification", () => {
  const risk = (s: string) => assessTrino(s).risk;
  it("classifies (default-deny)", () => {
    for (const s of ["SELECT 1", "select 'DROP' from t -- DELETE", "SHOW TABLES", "DESCRIBE t", "EXPLAIN SELECT 1", "WITH a AS (SELECT 1) SELECT * FROM a", "VALUES 1"]) expect(risk(s), s).toBe("none");
    for (const s of ["INSERT INTO t VALUES (1)", "CREATE TABLE t (a int)", "CALL system.runtime.kill_query('x')", "SET SESSION x = 1", "USE other", "EXPLAIN ANALYZE INSERT INTO t VALUES (1)", "SELECT 1; DROP TABLE t", "ALTER TABLE t ADD COLUMN b int"]) expect(risk(s), s).toBe("write");
    for (const s of ["DROP TABLE t", "DELETE FROM t", "TRUNCATE TABLE t"]) expect(risk(s), s).toBe("destructive");
  });
});

runConformance({
  enabled,
  plugin: trinoDriver,
  config: freshSchema,
  slowSql: "SELECT count(*) FROM tpch.sf100.lineitem a CROSS JOIN tpch.sf100.orders b",
  createTableSql: "CREATE TABLE conf_t (id integer, name varchar NOT NULL)",
  paramSql: "SELECT CAST(? AS varchar) AS a, CAST(? AS varchar) AS b",
  skipFkAndIndexTests: true,
  noPrimaryKeys: true,
  badConfig: () => ({ ...cfg, port: 1 }),
});

describe.skipIf(!enabled)("trino specifics", () => {
  const run = (c: Connection, sql: string, params?: Value[]) => collect(c.execute({ sql, ...(params ? { params } : {}) }, new AbortController().signal));
  it("returns typed values", async () => {
    const c = await trinoDriver.connect(cfg, { log() {} });
    const r = await run(c, "SELECT CAST(9223372036854775807 AS bigint) AS big, CAST(1.50 AS decimal(5,2)) AS d, true AS b, ARRAY[1,2] AS a, MAP(ARRAY['k'], ARRAY[1]) AS m, CAST(ROW(1,'x') AS ROW(p integer, q varchar)) AS r, X'0102' AS bin, DATE '2020-01-02' AS dt, CAST(0.5 AS double) AS f");
    expect(r.columns.map((c) => c.kind)).toEqual(["integer", "decimal", "boolean", "json", "json", "json", "binary", "datetime", "float"]);
    expect(r.rows[0]).toEqual([9223372036854775807n, "1.50", true, { json: [1, 2] }, { json: { k: 1 } }, { json: [1, "x"] }, new Uint8Array([1, 2]), "2020-01-02", 0.5]);
    await c.close();
  });
  it("binds parameters, escaping quotes", async () => {
    const c = await trinoDriver.connect(cfg, { log() {} });
    const r = await run(c, "SELECT CAST(? AS varchar), CAST(? AS bigint), CAST(? AS boolean), CAST(? AS timestamp)", ["it's; DROP TABLE x", 9007199254740993n, true, new Date("2020-01-02T03:04:05Z")]);
    expect(r.rows[0]).toEqual(["it's; DROP TABLE x", 9007199254740993n, true, "2020-01-02 03:04:05.000"]);
    await c.close();
  });
  it("writes, reads and refuses writes when read-only", async () => {
    const c = await trinoDriver.connect(cfg, { log() {} }); const ro = await trinoDriver.connect({ ...cfg, readOnly: true }, { log() {} });
    await run(c, "CREATE TABLE w (a integer, b varchar)"); const w = await run(c, "INSERT INTO w VALUES (1, 'x'), (2, 'y')"); expect(w.done?.affectedRows).toBe(2);
    await expect(run(ro, "DELETE FROM w WHERE a = 1")).rejects.toMatchObject({ kind: "permission" });
    expect((await run(ro, "SELECT count(*) FROM w")).rows[0]).toEqual([2]);
    await c.close(); await ro.close();
  });
  it("introspects schemas, tables and columns, and truncates long results", async () => {
    const c = await trinoDriver.connect(cfg, { log() {} }); const api = c.introspect();
    expect(await api.listSchemas()).toContain(schema);
    const t = await api.describeTable({ schema, name: "w" }); expect(t.columns!.map((x) => `${x.name}:${x.nativeType}`)).toEqual(["a:integer", "b:varchar"]);
    const many = await collect(c.execute({ sql: "SELECT a FROM UNNEST(sequence(1, 10000)) t(a) CROSS JOIN UNNEST(sequence(1, 10)) u(b)", maxRows: 1234 }, new AbortController().signal)); expect(many.rows.length).toBe(1234);
    const e = await collect(c.execute({ sql: "SELECT * FROM nope_table" }, new AbortController().signal)).catch((x) => x); expect(e).toMatchObject({ kind: "syntax" });
    await c.close();
  });
});
