import { describe, it, expect } from "vitest";
import { Writable } from "node:stream";
import { gunzipSync } from "node:zlib";
import { sqliteDriver } from "@rizomadb/driver-sqlite";
import type { ResultEvent } from "@rizomadb/driver-api";
import { decrypt, exportResult, type ExportOptions } from "./index.js";

const mem = () => { const chunks: Buffer[] = []; return { sink: new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } }), out: () => Buffer.concat(chunks) }; };
async function* events(): AsyncGenerator<ResultEvent> {
  yield { type: "columns", columns: [{ name: "id", nativeType: "int", kind: "integer" }, { name: "note", nativeType: "text", kind: "text" }, { name: "email", nativeType: "text", kind: "text" }] };
  yield { type: "rows", rows: [[1, 'say "hi", ok', "ada@example.com"], [2n ** 62n, "=SUM(A1)\nline2", null], [3, null, "x@y.z"]] };
  yield { type: "done", rowCount: 3, durationMs: 1 };
}
const run = async (o: ExportOptions) => { const m = mem(); await exportResult(events(), m.sink, o); return m.out(); };

describe("export formats", () => {
  it("writes RFC 4180 CSV with quoting, CRLF and optional formula neutralization", async () => {
    const csv = (await run({ format: "csv" })).toString();
    expect(csv).toBe('id,note,email\r\n1,"say ""hi"", ok",ada@example.com\r\n4611686018427387904,"=SUM(A1)\nline2",\r\n3,,x@y.z\r\n');
    expect((await run({ format: "csv", neutralizeFormulas: true })).toString()).toContain("\"'=SUM(A1)\nline2\"");
  });
  it("writes JSON, JSONL with lossless 64-bit numbers", async () => {
    const j = JSON.parse((await run({ format: "json" })).toString());
    expect(j[1]).toEqual({ id: 4611686018427387904n.toString(), note: "=SUM(A1)\nline2", email: null });
    const lines = (await run({ format: "jsonl" })).toString().trim().split("\n");
    expect(lines).toHaveLength(3); expect(JSON.parse(lines[0]!).id).toBe(1);
  });
  it("writes SQL INSERTs with escaped quotes, and markdown", async () => {
    const sql = (await run({ format: "sql", sql: { table: '"t"', quoteIdent: (n) => `"${n}"` } })).toString();
    expect(sql.split("\n")[0]).toBe(`INSERT INTO "t" ("id", "note", "email") VALUES (1, 'say "hi", ok', 'ada@example.com');`);
    expect(sql).toContain("NULL");
    expect((await run({ format: "markdown" })).toString()).toContain("| id | note | email |");
  });
  it("masks columns by name and regex", async () => {
    const out = (await run({ format: "csv", mask: [{ column: "/^em/", rule: "last4" }, { column: "NOTE", rule: "redact" }] })).toString();
    expect(out).not.toContain("ada@example.com"); expect(out).toContain("***");
  });
  it("gzips and encrypts (round trip, wrong key fails)", async () => {
    expect(gunzipSync(await run({ format: "csv", gzip: true })).toString()).toContain("id,note,email");
    const enc = await run({ format: "csv", encryptPassphrase: "s3cret" });
    expect(enc.toString("utf8", 0, 6)).toBe("RZENC1"); expect(enc.includes("ada@example.com")).toBe(false);
    expect(decrypt(enc, "s3cret").toString()).toContain("ada@example.com");
    expect(() => decrypt(enc, "nope")).toThrow();
  });
  it("is cancellable", async () => {
    const ac = new AbortController(); ac.abort();
    await expect(run({ format: "csv", signal: ac.signal })).rejects.toThrow();
  });
});

describe("streaming at scale", () => {
  it("exports 5,000,000 rows with flat memory", async () => {
    const conn = await sqliteDriver.connect({ path: ":memory:" }, { log() {} });
    const sql = "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < 5000000) SELECT i, 'row ' || i AS label FROM n";
    let bytes = 0;
    const sink = new Writable({ write(c, _e, cb) { bytes += c.length; cb(); } });
    const before = process.memoryUsage().heapUsed;
    let peak = before;
    const t = setInterval(() => { peak = Math.max(peak, process.memoryUsage().heapUsed); }, 200);
    const r = await exportResult(conn.execute({ sql, batchSize: 5000 }, new AbortController().signal), sink, { format: "csv" });
    clearInterval(t);
    expect(r.rows).toBe(5_000_000);
    expect(bytes).toBeGreaterThan(50_000_000);
    expect(peak - before).toBeLessThan(200 * 1024 * 1024);
    await conn.close();
  }, 180_000);
});
