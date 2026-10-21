import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { collect, type ColumnInfo } from "@rizomadb/driver-api";
import { available, engines, wanted } from "@rizomadb/test-engines";
import { ConversionError, convertCell, detectDelimiter, detectEncoding, exportResult, importRows, inferKind, openSource, parseDelimited, parseJsonArray, parseJsonLines, type ImportMapping, type TargetColumn } from "./index.js";

async function* chunked(s: string, sizes: number[]) { let i = 0, k = 0; while (i < s.length) { const n = sizes[k++ % sizes.length]!; yield s.slice(i, i + n); i += n; } }
const all = async <T>(g: AsyncIterable<T>) => { const o: T[] = []; for await (const x of g) o.push(x); return o; };
const tmp = (name: string, content: string | Buffer) => { const p = join(mkdtempSync(join(tmpdir(), "rz-imp-")), name); writeFileSync(p, content); return p; };

describe("delimited parsing", () => {
  it("handles quotes, escaped quotes, embedded newlines, CRLF/LF/CR and empty fields", async () => {
    const text = 'a,b,c\r\n1,"x, ""y""",\r\n2,"line1\nline2",z\n,,\n"",3,4';
    expect(await all(parseDelimited(chunked(text, [7]), ","))).toEqual([["a", "b", "c"], ["1", 'x, "y"', ""], ["2", "line1\nline2", "z"], ["", "", ""], ["", "3", "4"]]);
  });
  it("round-trips arbitrary tables through our exporter at any chunk size (property)", async () => {
    const cell = fc.string({ maxLength: 12, unit: fc.constantFrom("a", "Z", " ", ",", '"', "\n", "\r", "é", "🌱", ";", "\t", "1") });
    await fc.assert(fc.asyncProperty(fc.array(fc.array(cell, { minLength: 2, maxLength: 2 }), { minLength: 1, maxLength: 8 }), fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 1, maxLength: 4 }), async (rows, sizes) => {
      // rows that are entirely empty cannot be represented in CSV (a blank line is skipped by every reader)
      const data = rows.filter((r) => !r.every((c) => c === ""));
      fc.pre(data.length > 0);
      const chunks: Buffer[] = [];
      await exportResult((async function* () {
        yield { type: "columns" as const, columns: [{ name: "a", nativeType: "t", kind: "text" as const }, { name: "b", nativeType: "t", kind: "text" as const }] };
        yield { type: "rows" as const, rows: data.map((r) => r.map((c) => (c === "" ? null : c))) };
        yield { type: "done" as const, rowCount: data.length, durationMs: 0 };
      })(), new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } }), { format: "csv" });
      const parsed = await all(parseDelimited(chunked(Buffer.concat(chunks).toString(), sizes), ","));
      expect(parsed).toEqual([["a", "b"], ...data]);
    }), { numRuns: 300 });
  });
  it("detects delimiter and encoding", () => {
    expect(detectDelimiter("a;b;c\n1;2;3\n4;5;6")).toBe(";");
    expect(detectDelimiter('a,b\n"x;y",2')).toBe(",");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(detectEncoding(Buffer.from([0xef, 0xbb, 0xbf, 0x61])).encoding).toBe("utf-8");
    expect(detectEncoding(Buffer.from([0xff, 0xfe, 0x61, 0x00])).encoding).toBe("utf-16le");
    expect(detectEncoding(Buffer.from("caf\xe9", "latin1")).encoding).toBe("windows-1252");
    expect(detectEncoding(Buffer.from("café")).encoding).toBe("utf-8");
  });
  it("parses JSON arrays and JSON lines (strings with brackets, escapes, nesting)", async () => {
    const arr = '[ {"a":1,"b":"x]},{"}, {"a":2,"n":{"k":[1,2,{"z":"\\"q\\""}]}} ]';
    expect(await all(parseJsonArray(chunked(arr, [5])))).toEqual([{ a: 1, b: "x]},{" }, { a: 2, n: { k: [1, 2, { z: '"q"' }] } }]);
    expect(await all(parseJsonLines(chunked('{"a":1}\n\n{"a":2}', [3])))).toEqual([{ a: 1 }, { a: 2 }]);
    await expect(all(parseJsonArray(chunked("[1]", [1])))).rejects.toThrow();
  });
  it("opens files with BOM, semicolons and Latin-1 text", async () => {
    const f = tmp("a.csv", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("nombre;edad\nJosé;30\n")]));
    const s = await openSource(f);
    expect(s.columns).toEqual(["nombre", "edad"]); expect(await all(s.rows)).toEqual([["José", "30"]]); expect(s.delimiter).toBe(";");
    const l = await openSource(tmp("b.csv", Buffer.from("a,b\ncaf\xe9,1\n", "latin1")));
    expect((await all(l.rows))[0]).toEqual(["café", "1"]); expect(l.encoding).toBe("windows-1252");
    const j = await openSource(tmp("c.json", '[{"x":1,"y":null},{"x":2,"z":true}]'));
    expect(j.columns).toEqual(["x", "y", "z"]); expect(await all(j.rows)).toEqual([[1, null, undefined], [2, undefined, true]]);
  });
});

describe("cell conversion", () => {
  const c = (kind: ColumnInfo["kind"], nullable = true): TargetColumn => ({ name: "col", kind, nullable });
  it("converts typed values and fails clearly", () => {
    expect(convertCell("42", c("integer"))).toBe(42);
    expect(convertCell("9223372036854775807", c("integer"))).toBe(9223372036854775807n);
    expect(convertCell("12,50", c("decimal"))).toBe("12.50");
    expect(convertCell("sí", c("boolean"))).toBe(true);
    expect(convertCell("", c("integer"))).toBeNull();
    expect(convertCell("", c("text"))).toBe("");
    expect(convertCell("NA", c("text"), { nullTokens: ["NA"] })).toBeNull();
    expect(convertCell('{"a":1}', c("json"))).toEqual({ json: { a: 1 } });
    expect((convertCell("2026-01-02", c("datetime")) as Date).toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect((convertCell("31/12/2025 10:30", c("datetime"), { dateFormat: "dmy" }) as Date).toISOString()).toBe("2025-12-31T10:30:00.000Z");
    expect(() => convertCell("4x", c("integer"))).toThrow(ConversionError);
    expect(() => convertCell("maybe", c("boolean"))).toThrow(/boolean/);
    expect(() => convertCell("13/13/2025", c("datetime"), { dateFormat: "dmy" })).toThrow(/date/);
    expect(() => convertCell("xyz", c("binary"))).toThrow();
  });
  it("infers column kinds from samples", () => {
    expect(inferKind(["1", "22", ""])).toBe("integer"); expect(inferKind(["1.5", "2"])).toBe("decimal"); expect(inferKind(["true", "False"])).toBe("boolean");
    expect(inferKind(["2026-01-01", "2026-02-03 10:00"])).toBe("datetime"); expect(inferKind(["a", "1"])).toBe("text");
  });
});

for (const e of engines) {
  const up = wanted(e.id) && (await available(e));
  describe.skipIf(!up)(`import on ${e.id}`, () => {
    const DDL: Record<string, string> = {
      sqlite: "CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL, born TEXT, score NUMERIC, note TEXT)",
      postgres: "CREATE TABLE people (id integer PRIMARY KEY, name text NOT NULL, born timestamp, score numeric(10,2), note text)",
      mysql: "CREATE TABLE people (id int PRIMARY KEY, name varchar(100) NOT NULL, born datetime, score decimal(10,2), note text)",
      mssql: "CREATE TABLE people (id int PRIMARY KEY, name nvarchar(100) NOT NULL, born datetime2, score decimal(10,2), note nvarchar(max))",
      oracle: "CREATE TABLE people (id NUMBER(10) PRIMARY KEY, name VARCHAR2(100) NOT NULL, born TIMESTAMP, score NUMBER(10,2), note CLOB)",
    };
    const target = (u: boolean): TargetColumn[] => [
      { name: u ? "ID" : "id", kind: "integer", nullable: false }, { name: u ? "NAME" : "name", kind: "text", nullable: false }, { name: u ? "BORN" : "born", kind: "datetime", nullable: true },
      { name: u ? "SCORE" : "score", kind: "decimal", nullable: true }, { name: u ? "NOTE" : "note", kind: "text", nullable: true },
    ];
    async function setup() {
      const conn = await e.plugin.connect(await e.freshConfig(), { log() {} });
      await collect(conn.execute({ sql: DDL[e.id]! }, new AbortController().signal));
      const mapping: ImportMapping[] = target(e.id === "oracle").map((t, i) => ({ source: i, target: t }));
      const count = async () => Number((await collect(conn.execute({ sql: "SELECT COUNT(*) FROM people" }, new AbortController().signal))).rows[0]![0]);
      return { conn, mapping, count };
    }
    const csv = 'id,name,born,score,note\n1,"José ""Pepe"" Núñez",1990-05-17,12.50,"two\nlines"\n2,Ana 🌱,,7,\n3,Li;Wei,2001-01-01 10:20:30,0.5,x,\n'.replace(/x,\n$/, "x\n");

    it("imports a CSV file with quotes, unicode, NULLs and embedded newlines", async () => {
      const t = await setup();
      const src = await openSource(tmp("p.csv", csv));
      const r = await importRows({ conn: t.conn, plugin: e.plugin, table: { name: e.id === "oracle" ? "PEOPLE" : "people" }, mapping: t.mapping, rows: src.rows });
      expect(r).toMatchObject({ read: 3, inserted: 3, skipped: 0 });
      const rows = (await collect(t.conn.execute({ sql: `SELECT ${e.id === "oracle" ? "NAME, NOTE" : "name, note"} FROM people ORDER BY 1` }, new AbortController().signal))).rows;
      expect(rows.map((x) => x[0])).toEqual(["Ana 🌱", "José \"Pepe\" Núñez", "Li;Wei"]);
      await t.conn.close();
    });
    it("aborts and rolls back everything when a row cannot be converted", async () => {
      const t = await setup();
      const rows = (async function* () { yield ["1", "a", "", "1", ""]; yield ["2", "b", "", "oops", ""]; })();
      await expect(importRows({ conn: t.conn, plugin: e.plugin, table: { name: e.id === "oracle" ? "PEOPLE" : "people" }, mapping: t.mapping, rows })).rejects.toThrow(/Row 2.*decimal/);
      expect(await t.count()).toBe(0);
      await t.conn.close();
    });
    it("skips bad rows when asked, reporting each one", async () => {
      const t = await setup();
      const rows = (async function* () { yield ["1", "a", "", "1", ""]; yield ["x", "b", "", "2", ""]; yield ["3", "c", "", "3", ""]; })();
      const r = await importRows({ conn: t.conn, plugin: e.plugin, table: { name: e.id === "oracle" ? "PEOPLE" : "people" }, mapping: t.mapping, rows, onError: "skip" });
      expect(r).toMatchObject({ inserted: 2, skipped: 1 }); expect(r.errors[0]!.row).toBe(2);
      expect(await t.count()).toBe(2);
      await t.conn.close();
    });
    it("rolls back on database errors (duplicate key) and on cancellation", async () => {
      const t = await setup();
      const dup = (async function* () { yield ["1", "a", "", "1", ""]; yield ["1", "b", "", "1", ""]; })();
      await expect(importRows({ conn: t.conn, plugin: e.plugin, table: { name: e.id === "oracle" ? "PEOPLE" : "people" }, mapping: t.mapping, rows: dup, batchRows: 1 })).rejects.toThrow(/rejected/);
      expect(await t.count()).toBe(0);
      const ac = new AbortController();
      const many = (async function* () { for (let i = 0; i < 5000; i++) { if (i === 100) ac.abort(); yield [String(i), "n", "", "1", ""]; } })();
      await expect(importRows({ conn: t.conn, plugin: e.plugin, table: { name: e.id === "oracle" ? "PEOPLE" : "people" }, mapping: t.mapping, rows: many, batchRows: 10, signal: ac.signal })).rejects.toThrow(/cancel/i);
      expect(await t.count()).toBe(0);
      await t.conn.close();
    });
    it.runIf(e.id === "sqlite" || e.id === "postgres")("imports 1,000,000 rows (throughput report)", async () => {
      const t = await setup();
      const rows = (async function* () { for (let i = 1; i <= 1_000_000; i++) yield [String(i), `name ${i}`, "", "1.5", ""]; })();
      const t0 = performance.now();
      const r = await importRows({ conn: t.conn, plugin: e.plugin, table: { name: "people" }, mapping: t.mapping, rows, batchRows: 2000 });
      const secs = (performance.now() - t0) / 1000;
      expect(r.inserted).toBe(1_000_000); expect(await t.count()).toBe(1_000_000);
      process.stderr.write(`[perf] ${e.id}: 1M rows imported in ${secs.toFixed(1)} s (${Math.round(1_000_000 / secs).toLocaleString()} rows/s)\n`);
      await t.conn.close();
    }, 300_000);
  });
}

import { kindFromNative } from "./index.js";
describe("native type kinds", () => {
  it("maps engine types to conversion kinds", () => {
    const k = kindFromNative;
    expect([k("integer"), k("bigserial"), k("int4"), k("NUMBER(10)"), k("tinyint(1)"), k("numeric(10,2)"), k("NUMBER(10,2)"), k("decimal"), k("double precision"), k("timestamp without time zone"), k("datetime2"), k("jsonb"), k("bytea"), k("varchar(10)"), k("CLOB"), k("text")])
      .toEqual(["integer", "integer", "integer", "integer", "boolean", "decimal", "decimal", "decimal", "float", "datetime", "datetime", "json", "binary", "text", "text", "text"]);
  });
});
