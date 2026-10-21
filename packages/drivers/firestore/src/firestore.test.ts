import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import fc from "fast-check";
import { collect, type Connection } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { firestoreDriver, assessFirestore, parseCommand, ConsoleSyntaxError, toFs, fromFs } from "./index.js";

describe("command parsing and risk", () => {
  it("parses queries with comments and trailing commas", () => {
    expect(parseCommand('{ // all adults\n "from": "users", "where": [["age", ">=", 18],], "orderBy": ["age", "desc"], "limit": 5, }')).toEqual({ kind: "query", from: "users", group: false, where: [["age", ">=", 18]], orderBy: [["age", "desc"]], limit: 5 });
    expect(parseCommand('{ "collectionGroup": "posts" }')).toMatchObject({ kind: "query", from: "posts", group: true });
    expect(parseCommand('{ "get": "/users/alice/" }')).toEqual({ kind: "get", path: "users/alice" });
  });
  it("rejects bad commands with readable messages", () => {
    expect(() => parseCommand("select 1")).toThrow(ConsoleSyntaxError);
    expect(() => parseCommand('{ "get": "users" }')).toThrow(/even number of segments/);
    expect(() => parseCommand('{ "from": "u", "where": [["a", "~", 1]] }')).toThrow(/Unknown operator/);
    expect(() => parseCommand('{ "from": "u", "limit": 0 }')).toThrow(/positive integer/);
    expect(() => parseCommand("[]")).toThrow(ConsoleSyntaxError);
  });
  it("classifies reads, writes and deletes (default-deny)", () => {
    expect(assessFirestore('{"from":"u","limit":1}').risk).toBe("none"); expect(assessFirestore('{"get":"u/a"}').risk).toBe("none");
    expect(assessFirestore('{"set":"u/a","data":{}}').risk).toBe("write"); expect(assessFirestore('{"update":"u/a","data":{"x":1}}').risk).toBe("write");
    expect(assessFirestore('{"delete":"u/a"}').risk).toBe("destructive"); expect(assessFirestore("garbage").risk).toBe("write");
    expect(assessFirestore('{"from":"u"}').reasons[0]).toMatch(/whole collection/);
  });
  it("never throws anything but ConsoleSyntaxError (fuzz)", () => {
    fc.assert(fc.property(fc.string(), (s) => { try { parseCommand(s); } catch (e) { return e instanceof ConsoleSyntaxError; } return true; }), { numRuns: 500 });
    fc.assert(fc.property(fc.string(), (s) => { assessFirestore(s); return true; }), { numRuns: 300 });
  });
});

describe("value mapping", () => {
  it("round-trips typed values", () => {
    const root = "projects/p/databases/(default)/documents";
    const v = { s: "x", i: 5, f: 1.5, b: true, n: null, t: { $timestamp: "2020-01-01T00:00:00Z" }, r: { $ref: "users/a" }, l: [1, "a"], m: { k: 2 }, g: { $geo: [1, 2] }, by: { $bytes: "AQI=" } };
    const back = fromFs(toFs(v, root)) as Record<string, unknown>;
    expect(back).toMatchObject({ s: "x", i: 5, f: 1.5, b: true, n: null, t: new Date("2020-01-01T00:00:00Z"), r: "users/a", l: [1, "a"], m: { k: 2 }, g: { latitude: 1, longitude: 2 }, by: new Uint8Array([1, 2]) });
    expect(fromFs({ integerValue: "9007199254740993" })).toBe(9007199254740993n);
  });
});

const port = Number(process.env.RZ_FIRESTORE_PORT ?? 18080);
const up = await engineUp("127.0.0.1", port);
const cfg = { projectId: "rizoma-test", host: "127.0.0.1", port, ssl: false };

describe.skipIf(!up)("firestore driver (emulator)", () => {
  let conn: Connection, ro: Connection; const col = `rz_${randomBytes(4).toString("hex")}`;
  const run = (c: Connection, cmd: unknown, extra: { maxRows?: number } = {}, s = new AbortController().signal) => collect(c.execute({ sql: typeof cmd === "string" ? cmd : JSON.stringify(cmd), ...extra }, s));
  beforeAll(async () => {
    conn = await firestoreDriver.connect(cfg, { log() {} });
    ro = await firestoreDriver.connect({ ...cfg, readOnly: true }, { log() {} });
    for (let i = 1; i <= 30; i++) await run(conn, { set: `${col}/d${String(i).padStart(2, "0")}`, data: { n: i, name: `user ${i}`, even: i % 2 === 0, big: { $int: "9007199254740993" }, tags: ["a", "b"], meta: { k: i }, at: { $timestamp: "2020-01-02T03:04:05Z" }, ...(i % 3 === 0 ? { extra: "x" } : {}) } });
  });
  afterAll(async () => { for (let i = 1; i <= 30; i++) await run(conn, { delete: `${col}/d${String(i).padStart(2, "0")}` }).catch(() => {}); await conn.close(); await ro.close(); });

  it("pings and identifies the endpoint", async () => { expect(conn.serverInfo.product).toMatch(/Firestore/); await conn.ping(); });
  it("returns typed columns and documents", async () => {
    const r = await run(conn, { get: `${col}/d01` });
    const names = r.columns.map((c) => c.name); expect(names[0]).toBe("__name__");
    const row = Object.fromEntries(names.map((n, i) => [n, r.rows[0]![i]]));
    expect(row).toMatchObject({ __name__: `${col}/d01`, n: 1, name: "user 1", even: false, tags: { json: ["a", "b"] }, meta: { json: { k: 1 } }, at: new Date("2020-01-02T03:04:05Z") });
    expect(row.big).toBe(9007199254740993n); // exact through {"$int"}; a bare JSON literal would already be rounded by JSON.parse
    expect(Object.fromEntries(r.columns.map((c) => [c.name, c.kind]))).toMatchObject({ n: "integer", name: "text", even: "boolean", at: "datetime", tags: "json" });
  });
  it("filters, orders and limits", async () => {
    const r = await run(conn, { from: col, where: [["n", ">", 10], ["even", "==", true]], orderBy: [["n", "desc"]], limit: 4, select: ["n"] });
    expect(r.rows.map((x) => x[1])).toEqual([30, 28, 26, 24]);
    const inq = await run(conn, { from: col, where: [["n", "in", [1, 2, 3]]], orderBy: ["n"] }); expect(inq.rows.map((x) => x[r.columns.length === 0 ? 0 : inq.columns.findIndex((c) => c.name === "n")])).toEqual([1, 2, 3]);
    const arr = await run(conn, { from: col, where: [["tags", "array-contains", "a"]] }); expect(arr.rows.length).toBe(30);
  });
  it("unions fields of schemaless documents and honours maxRows", async () => {
    const all = await run(conn, { from: col }); expect(all.rows.length).toBe(30); expect(all.columns.map((c) => c.name)).toContain("extra");
    const ei = all.columns.findIndex((c) => c.name === "extra"); expect(all.rows.filter((x) => x[ei] === "x").length).toBe(10); expect(all.rows.filter((x) => x[ei] === null).length).toBe(20);
    expect((await run(conn, { from: col }, { maxRows: 7 })).rows.length).toBe(7);
  });
  it("updates (merge), sets and deletes", async () => {
    await run(conn, { update: `${col}/d02`, data: { name: "renamed" } });
    const r = await run(conn, { get: `${col}/d02` }); const i = (n: string) => r.columns.findIndex((c) => c.name === n);
    expect(r.rows[0]![i("name")]).toBe("renamed"); expect(r.rows[0]![i("n")]).toBe(2);
    await run(conn, { set: `${col}/tmp`, data: { only: 1 } }); await run(conn, { delete: `${col}/tmp` });
    expect((await run(conn, { from: col, where: [["only", "==", 1]] })).rows.length).toBe(0);
    await expect(run(conn, { update: `${col}/missing`, data: { a: 1 } })).rejects.toBeInstanceOf(Error);
  });
  it("lists collections", async () => { expect((await run(conn, { collections: "" })).rows.map((x) => x[0])).toContain(col); });
  it("read-only connections refuse writes", async () => {
    await expect(run(ro, { delete: `${col}/d03` })).rejects.toMatchObject({ kind: "permission" });
    expect((await run(ro, { get: `${col}/d03` })).rows.length).toBe(1);
  });
  it("maps errors", async () => {
    await expect(run(conn, "not json")).rejects.toMatchObject({ kind: "syntax" });
    await expect(run(conn, { from: col, where: [["n", ">", "a"], ["name", ">", 1], ["x", "not-in", 1]] })).rejects.toBeInstanceOf(Error);
    await expect(firestoreDriver.connect({ ...cfg, port: 1 }, { log() {} })).rejects.toMatchObject({ kind: "connection" });
    await expect(firestoreDriver.connect({ projectId: "p" }, { log() {} })).rejects.toMatchObject({ kind: "authentication" });
  });
  it("introspects collections and sampled fields", async () => {
    const api = conn.introspect();
    expect((await api.listTables()).map((t) => t.name)).toContain(col);
    const d = await api.describeTable({ name: col });
    expect(d.columns!.map((c) => c.name)).toEqual(expect.arrayContaining(["__name__", "n", "name", "tags", "extra"])); expect(d.columns!.find((c) => c.name === "n")!.nativeType).toBe("integer");
  });
});
