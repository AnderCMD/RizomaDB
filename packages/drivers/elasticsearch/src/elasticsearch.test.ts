import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, DriverError, type Connection } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { elasticsearchDriver, assessConsole, parseConsole, ConsoleSyntaxError } from "./index.js";

describe("console parsing and risk", () => {
  it("parses Dev-Tools-style requests with comments and trailing commas", () => {
    const r = parseConsole('GET my-index/_search\n{\n  // all docs\n  "query": { "match_all": {}, },\n  "size": 5 /* few */\n}');
    expect(r).toMatchObject({ method: "GET", path: "/my-index/_search", body: { query: { match_all: {} }, size: 5 } });
    expect(parseConsole("DELETE /idx")).toEqual({ method: "DELETE", path: "/idx" });
    expect(() => parseConsole("find me")).toThrow(ConsoleSyntaxError);
    const e = (() => { try { parseConsole('GET /i/_search\n{ "a": }'); } catch (x) { return x as ConsoleSyntaxError; } })();
    expect(e!.position).toBeGreaterThan(14);
    expect(parseConsole('POST /_bulk\n{"index":{"_index":"a"}}\n{"x":1}\n').rawBody).toContain('"x":1');
  });
  it("classifies reads, writes and destructive requests", () => {
    expect(assessConsole("GET /_cluster/health").risk).toBe("none"); expect(assessConsole("POST /i/_search\n{}").risk).toBe("none");
    expect(assessConsole("PUT /i/_doc/1\n{}").risk).toBe("write"); expect(assessConsole("DELETE /i").risk).toBe("destructive");
    expect(assessConsole("POST /i/_delete_by_query\n{}").risk).toBe("destructive"); expect(assessConsole("DELETE /i/_doc/1").risk).toBe("write");
  });
});

for (const [name, port] of [["elasticsearch", 19200], ["opensearch", 19201]] as const) {
  const p = Number(process.env[`RZ_${name.toUpperCase()}_PORT`] ?? port);
  const up = await engineUp("127.0.0.1", p);
  describe.skipIf(!up)(`${name} driver`, () => {
    let conn: Connection, ro: Connection; let idx: string;
    const run = (c: Connection, text: string, extra: { maxRows?: number; batchSize?: number } = {}, s = new AbortController().signal) => collect(c.execute({ sql: text, ...extra }, s));
    beforeAll(async () => {
      idx = `rz-${randomBytes(4).toString("hex")}`;
      conn = await elasticsearchDriver.connect({ host: "127.0.0.1", port: p, ssl: false }, { log() {} });
      ro = await elasticsearchDriver.connect({ host: "127.0.0.1", port: p, ssl: false, readOnly: true }, { log() {} });
      const bulk = Array.from({ length: 1200 }, (_, i) => `{"index":{"_index":"${idx}","_id":"${i}"}}\n{"n":${i},"name":"user ${i}","tags":["a","b"],"nested":{"k":${i % 3}},"big":9007199254740993}`).join("\n") + "\n";
      await conn.execute({ sql: `POST /_bulk?refresh=true\n${bulk}` }, new AbortController().signal)[Symbol.asyncIterator]().next();
    });
    afterAll(async () => { await run(conn, `DELETE /${idx}`).catch(() => {}); await conn.close(); await ro.close(); });

    it("identifies the product and pings", async () => { expect(conn.serverInfo.product).toBe(name === "opensearch" ? "OpenSearch" : "Elasticsearch"); expect(conn.serverInfo.version).toMatch(/^\d/); await conn.ping(); });

    it("searches with typed columns (_id/_index first, nested as JSON) and streams all pages via scroll", async () => {
      const r = await run(conn, `GET /${idx}/_search\n{ "query": { "range": { "n": { "lt": 3 } } }, "sort": [{ "n": "asc" }], "size": 3 }`);
      expect(r.columns.slice(0, 2).map((c) => c.name)).toEqual(["_id", "_index"]);
      expect(r.rows).toHaveLength(3);
      const col = (n: string) => r.columns.findIndex((c) => c.name === n);
      expect(r.rows[1]![col("name")]).toBe("user 1"); expect(r.rows[0]![col("tags")]).toEqual({ json: ["a", "b"] }); expect(r.rows[2]![col("nested")]).toEqual({ json: { k: 2 } });
      const all = await run(conn, `GET /${idx}/_search\n{ "query": { "match_all": {} } }`, { batchSize: 200 });
      expect(all.rows).toHaveLength(1200); expect(new Set(all.rows.map((x) => x[0])).size).toBe(1200);
      expect((await run(conn, `GET /${idx}/_search\n{ "query": { "match_all": {} } }`, { maxRows: 50 })).rows).toHaveLength(50);
    });

    it("returns aggregations and counts, and non-search responses as documents", async () => {
      const a = await run(conn, `POST /${idx}/_search\n{ "size": 0, "aggs": { "g": { "terms": { "field": "nested.k" } } } }`);
      expect(JSON.stringify(a.rows[0])).toContain("buckets");
      expect((await run(conn, `GET /${idx}/_count`)).rows[0]).toContain(1200);
      expect((await run(conn, "GET /_cluster/health")).columns.map((c) => c.name)).toContain("status");
      expect((await run(conn, "GET /_cat/indices?format=json")).rows.length).toBeGreaterThan(0);
    });

    it("types errors: syntax (bad query, missing index), parse positions", async () => {
      await expect(run(conn, `GET /${idx}/_search\n{ "query": { "nonsense": {} } }`)).rejects.toMatchObject({ kind: "syntax" });
      await expect(run(conn, "GET /does-not-exist-xyz/_search")).rejects.toMatchObject({ kind: "syntax" });
      await expect(run(conn, "not a request")).rejects.toMatchObject({ kind: "syntax" });
    });

    it("writes documents and honours read-only connections", async () => {
      await run(conn, `PUT /${idx}/_doc/new1?refresh=true\n{ "n": 5000, "name": "added" }`);
      expect((await run(conn, `GET /${idx}/_doc/new1`)).columns.map((c) => c.name)).toContain("_source");
      await expect(run(ro, `PUT /${idx}/_doc/x\n{ "a": 1 }`)).rejects.toMatchObject({ kind: "permission" });
      await expect(run(ro, `DELETE /${idx}`)).rejects.toMatchObject({ kind: "permission" });
      expect((await run(ro, `POST /${idx}/_search\n{ "size": 1 }`)).rows).toHaveLength(1);
    });

    it("rejects an aborted signal and cancels an in-flight request", async () => {
      const dead = new AbortController(); dead.abort();
      await expect(run(conn, "GET /", {}, dead.signal)).rejects.toMatchObject({ kind: "cancelled" });
      const ac = new AbortController();
      const slow = run(conn, `POST /${idx}/_search\n{ "size": 0, "aggs": { "s": { "scripted_metric": { "init_script": "state.n = 0", "map_script": "long t = System.currentTimeMillis(); while (System.currentTimeMillis() - t < 4000) { }", "combine_script": "return 1", "reduce_script": "return 1" } } } }`, {}, ac.signal);
      setTimeout(() => ac.abort(), 300);
      const t0 = Date.now();
      await expect(slow).rejects.toBeInstanceOf(DriverError);
      expect(Date.now() - t0).toBeLessThan(3000);
      await conn.ping();
    });

    it("introspects indices and mappings", async () => {
      const api = conn.introspect();
      expect((await api.listTables()).map((t) => t.name)).toContain(idx);
      const d = await api.describeTable({ name: idx });
      expect(d.columns![0]).toMatchObject({ name: "_id", primaryKey: true });
      expect(d.columns!.map((c) => c.name)).toEqual(expect.arrayContaining(["n", "name", "nested.k"]));
      expect(d.columns!.find((c) => c.name === "n")!.nativeType).toBe("long");
    });

    it("fails with typed errors for unreachable hosts", async () => {
      const down = await elasticsearchDriver.connect({ host: "127.0.0.1", port: 1, ssl: false }, { log() {} }).catch((e: unknown) => e);
      expect((down as DriverError).kind).toBe("connection");
    });
  });
}
