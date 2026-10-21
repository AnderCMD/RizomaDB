import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, type Connection } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { influxdbDriver, assessFlux, CsvReader } from "./index.js";

describe("CSV reader", () => {
  it("handles quotes, embedded commas/newlines and chunk boundaries", () => {
    const r = new CsvReader(); const all: string[][] = [];
    for (const chunk of ['a,"b,', 'c",', '"d""e"\r\n"x\ny",z\n', "\nlast"]) all.push(...r.push(chunk));
    all.push(...r.end());
    expect(all).toEqual([["a", "b,c", 'd"e'], ["x\ny", "z"], [""], ["last"]]);
    const split = new CsvReader(); // a CRLF cut between the two characters must still be one line break
    expect([...split.push("a,b\r"), ...split.push("\nc,d\r\n")]).toEqual([["a", "b"], ["c", "d"]]);
  });
});

describe("Flux risk classification", () => {
  const risk = (s: string) => assessFlux(s).risk;
  it("reads are safe; writes and outside access are not", () => {
    expect(risk('from(bucket: "b") |> range(start: -1h) |> filter(fn: (r) => r._measurement == "to(")')).toBe("none");
    expect(risk('buckets()')).toBe("none"); expect(risk('// to(bucket:"x")\nfrom(bucket:"b") |> range(start:-1h)')).toBe("none");
    expect(risk('from(bucket: "b") |> range(start: -1h) |> to(bucket: "other")')).toBe("write");
    expect(risk('import "influxdata/influxdb/schema"\nschema.measurements(bucket: "b")')).toBe("none");
    expect(risk('import "experimental/http"\nhttp.get(url: "http://x")')).toBe("write");
    expect(risk('import "sql"\nsql.from(driverName: "postgres", dataSourceName: "x", query: "select 1")')).toBe("write");
    expect(risk('option task = {name: "t", every: 1h}\nfrom(bucket:"b")')).toBe("write");
  });
});

const port = Number(process.env.RZ_INFLUXDB_PORT ?? 18086);
const up = await engineUp("127.0.0.1", port);
const cfg = { host: "127.0.0.1", port, org: "rizoma", token: "rizoma-test-token" };

describe.skipIf(!up)("influxdb driver", () => {
  let conn: Connection, ro: Connection; const bucket = `rz_${randomBytes(4).toString("hex")}`; const base = 1_700_000_000;
  const run = (c: Connection, sql: string, extra: { maxRows?: number } = {}, s = new AbortController().signal) => collect(c.execute({ sql, ...extra }, s));
  beforeAll(async () => {
    conn = await influxdbDriver.connect(cfg, { log() {} });
    ro = await influxdbDriver.connect({ ...cfg, readOnly: true }, { log() {} });
    const orgs = await (await fetch(`http://127.0.0.1:${port}/api/v2/orgs?org=rizoma`, { headers: { authorization: "Token rizoma-test-token" } })).json() as { orgs: { id: string }[] };
    const mk = await fetch(`http://127.0.0.1:${port}/api/v2/buckets`, { method: "POST", headers: { authorization: "Token rizoma-test-token", "content-type": "application/json" }, body: JSON.stringify({ orgID: orgs.orgs[0]!.id, name: bucket, retentionRules: [] }) });
    if (!mk.ok) throw new Error(await mk.text());
    const lines = Array.from({ length: 3000 }, (_, i) => `cpu,host=h${i % 3}${i % 2 ? ",region=eu" : ""} usage=${i}.5,n=${i}i,ok=${i % 2 === 0},label="row ${i}" ${base + i}`).join("\n");
    const w = await fetch(`http://127.0.0.1:${port}/api/v2/write?org=rizoma&bucket=${bucket}&precision=s`, { method: "POST", headers: { authorization: "Token rizoma-test-token" }, body: lines });
    if (!w.ok) throw new Error(await w.text());
  });
  afterAll(async () => { await conn.close(); await ro.close(); });

  it("identifies the server and pings", async () => { expect(conn.serverInfo.product).toBe("InfluxDB"); expect(conn.serverInfo.version).toMatch(/^2\./); await conn.ping(); });
  it("returns typed columns", async () => {
    const r = await run(conn, `from(bucket: "${bucket}") |> range(start: 0) |> filter(fn: (r) => r._measurement == "cpu") |> pivot(rowKey: ["_time", "host"], columnKey: ["_field"], valueColumn: "_value") |> sort(columns: ["_time"]) |> limit(n: 2)`);
    const cols = Object.fromEntries(r.columns.map((c) => [c.name, c]));
    expect(cols.usage!.kind).toBe("float"); expect(cols.n!.kind).toBe("integer"); expect(cols.ok!.kind).toBe("boolean"); expect(cols._time!.kind).toBe("datetime"); expect(cols.label!.kind).toBe("text");
    expect(r.columns.map((c) => c.name)).not.toContain("result"); expect(r.columns.map((c) => c.name)).not.toContain("table");
    const row = r.rows[0]!; const idx = (n: string) => r.columns.findIndex((c) => c.name === n);
    expect(row[idx("usage")]).toBe(0.5); expect(row[idx("n")]).toBe(0); expect(row[idx("ok")]).toBe(true); expect(row[idx("label")]).toBe("row 0");
    expect(row[idx("_time")]).toEqual(new Date(base * 1000));
  });
  it("unions the columns of series with different tags, filling missing ones with null", async () => {
    const r = await run(conn, `from(bucket: "${bucket}") |> range(start: 0) |> filter(fn: (r) => r._field == "usage") |> limit(n: 2)`);
    expect(r.columns.map((c) => c.name)).toEqual(expect.arrayContaining(["host", "region", "_value"]));
    const ri = r.columns.findIndex((c) => c.name === "region");
    expect(r.rows.some((x) => x[ri] === null)).toBe(true); expect(r.rows.some((x) => x[ri] === "eu")).toBe(true);
  });
  it("streams large results and honours maxRows", async () => {
    const all = await run(conn, `from(bucket: "${bucket}") |> range(start: 0) |> filter(fn: (r) => r._field == "usage")`); expect(all.rows.length).toBe(3000);
    const cut = await run(conn, `from(bucket: "${bucket}") |> range(start: 0) |> filter(fn: (r) => r._field == "usage")`, { maxRows: 25 }); expect(cut.rows.length).toBe(25);
  });
  it("maps errors", async () => {
    await expect(run(conn, "from(bucket: ")).rejects.toMatchObject({ kind: "syntax" });
    await expect(run(conn, `from(bucket: "nope_${bucket}") |> range(start: 0)`)).rejects.toMatchObject({ kind: expect.stringMatching(/syntax|unknown/) });
    await expect(influxdbDriver.connect({ ...cfg, token: "bad" }, { log() {} })).rejects.toMatchObject({ kind: "authentication" });
    await expect(influxdbDriver.connect({ ...cfg, port: 1 }, { log() {} })).rejects.toMatchObject({ kind: "connection" });
  });
  it("read-only connections refuse to()", async () => {
    await expect(run(ro, `from(bucket: "${bucket}") |> range(start: 0) |> to(bucket: "${bucket}2")`)).rejects.toMatchObject({ kind: "permission" });
    expect((await run(ro, `from(bucket: "${bucket}") |> range(start: 0) |> limit(n: 1)`)).rows.length).toBeGreaterThan(0);
  });
  it("cancels a running query", async () => {
    const ac = new AbortController(); setTimeout(() => ac.abort(), 300); const t0 = Date.now();
    await expect(run(conn, 'import "generate"\ngenerate.from(count: 400000000, fn: (n) => n, start: 2020-01-01T00:00:00Z, stop: 2030-01-01T00:00:00Z) |> sum()', {}, ac.signal)).rejects.toMatchObject({ kind: "cancelled" });
    expect(Date.now() - t0).toBeLessThan(5000);
  });
  it("introspects buckets, measurements, tags and fields", async () => {
    const api = conn.introspect();
    expect(await api.listSchemas()).toContain(bucket);
    expect((await api.listTables(bucket)).map((t) => t.name)).toEqual(["cpu"]);
    const d = await api.describeTable({ schema: bucket, name: "cpu" });
    expect(d.columns!.map((c) => `${c.name}:${c.nativeType}`)).toEqual(expect.arrayContaining(["host:tag", "region:tag", "usage:field", "n:field", "ok:field", "label:field", "_time:dateTime"]));
  });
});
