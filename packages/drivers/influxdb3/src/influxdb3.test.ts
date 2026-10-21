import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, type Connection, type Value } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { influxdb3Driver } from "./index.js";

const port = Number(process.env.RZ_INFLUXDB3_PORT ?? 18181);
const up = await engineUp("127.0.0.1", port, "influxdb3");
const db = `rz_${randomBytes(4).toString("hex")}`;
const cfg = { host: "127.0.0.1", port, database: db };

describe.skipIf(!up)("influxdb3 driver", () => {
  let conn: Connection; const base = 1_700_000_000;
  const run = (sql: string, params?: Value[], extra: { maxRows?: number } = {}, s = new AbortController().signal) => collect(conn.execute({ sql, ...(params ? { params } : {}), ...extra }, s));
  beforeAll(async () => {
    const lines = Array.from({ length: 3000 }, (_, i) => `cpu,host=h${i % 3} usage=${i}.5,n=${i}i,ok=${i % 2 === 0},big=9007199254740993i${i % 5 === 0 ? `,label="row ${i}"` : ""} ${base + i}`).join("\n");
    const w = await fetch(`http://127.0.0.1:${port}/api/v3/write_lp?db=${db}&precision=second`, { method: "POST", body: lines });
    if (!w.ok) throw new Error(await w.text());
    conn = await influxdb3Driver.connect(cfg, { log() {} });
  });
  afterAll(async () => { await conn?.close(); });

  it("identifies the server and pings", async () => { expect(conn.serverInfo.product).toMatch(/InfluxDB 3/); expect(conn.serverInfo.version).toMatch(/^3\./); await conn.ping(); });
  it("returns columns (time first) with inferred kinds and exact 64-bit integers", async () => {
    const r = await run("SELECT * FROM cpu ORDER BY time LIMIT 2");
    expect(r.columns[0]!.name).toBe("time");
    const k = Object.fromEntries(r.columns.map((c) => [c.name, c.kind]));
    expect(k).toMatchObject({ time: "datetime", host: "text", usage: "float", n: "integer", ok: "boolean", label: "text" });
    const i = (n: string) => r.columns.findIndex((c) => c.name === n);
    expect(r.rows[0]![i("big")]).toBe(9007199254740993n); expect(r.rows[0]![i("n")]).toBe(0); expect(r.rows[0]![i("label")]).toBe("row 0"); expect(r.rows[1]![i("label")]).toBeNull();
  });
  it("binds parameters", async () => {
    const r = await run("SELECT count(*) AS c FROM cpu WHERE host = $p1 AND n >= $p2", ["h1", 1000]);
    expect(r.rows[0]).toEqual([667]);
  });
  it("streams large results and honours maxRows", async () => {
    expect((await run("SELECT n FROM cpu")).rows.length).toBe(3000);
    expect((await run("SELECT n FROM cpu", undefined, { maxRows: 13 })).rows.length).toBe(13);
  });
  it("cannot modify data through SQL", async () => {
    await expect(run("DELETE FROM cpu")).rejects.toMatchObject({ kind: "syntax" });
    await expect(run("INSERT INTO cpu (n) VALUES (1)")).rejects.toMatchObject({ kind: "syntax" });
    expect((await run("SELECT count(*) FROM cpu")).rows[0]).toEqual([3000]);
  });
  it("maps errors", async () => {
    await expect(run("selec 1")).rejects.toMatchObject({ kind: "syntax" });
    await expect(run("SELECT * FROM nope")).rejects.toMatchObject({ kind: "syntax" });
    await expect(influxdb3Driver.connect({ ...cfg, port: 1 }, { log() {} })).rejects.toMatchObject({ kind: "connection" });
    await expect(influxdb3Driver.connect({ ...cfg, database: "does_not_exist_x" }, { log() {} })).rejects.toBeInstanceOf(Error);
  });
  it("cancels while streaming", async () => {
    const ac = new AbortController(); const it = conn.execute({ sql: "SELECT * FROM cpu a CROSS JOIN cpu b LIMIT 2000000", batchSize: 1 }, ac.signal)[Symbol.asyncIterator]();
    setTimeout(() => ac.abort(), 100);
    await expect((async () => { for (;;) { const r = await it.next(); if (r.done) return; } })()).rejects.toMatchObject({ kind: "cancelled" });
  });
  it("introspects tables and columns", async () => {
    const api = conn.introspect();
    expect((await api.listTables()).map((t) => t.name)).toEqual(["cpu"]);
    const d = await api.describeTable({ name: "cpu" });
    expect(d.columns!.map((c) => c.name)).toEqual(expect.arrayContaining(["host", "usage", "n", "ok", "big", "label", "time"]));
    expect(d.columns!.find((c) => c.name === "usage")!.nativeType).toBe("Float64");
  });
});
