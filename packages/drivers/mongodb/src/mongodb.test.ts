import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, DriverError, type Connection } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { mongoDriver, assessMongo, valueToShell, jsonToShell } from "./index.js";

const port = Number(process.env.RZ_MONGO_PORT ?? 27018);
const up = await engineUp("127.0.0.1", port);
const base = { host: "127.0.0.1", port, ssl: false };
const sig = () => new AbortController().signal;

describe("risk assessment", () => {
  it("classifies reads, writes and destructive commands", () => {
    expect(assessMongo("db.users.find({})").risk).toBe("none");
    expect(assessMongo("db.users.aggregate([{ $match: {} }])").risk).toBe("none");
    expect(assessMongo("db.users.aggregate([{ $out: 'x' }])").risk).toBe("write");
    expect(assessMongo("db.users.insertOne({ a: 1 })").risk).toBe("write");
    expect(assessMongo("db.users.deleteMany({})").risk).toBe("destructive");
    expect(assessMongo("db.users.deleteMany({ a: 1 })").risk).toBe("write");
    expect(assessMongo("db.users.drop()").risk).toBe("destructive");
    expect(assessMongo("db.dropDatabase()").risk).toBe("destructive");
    expect(assessMongo("db.runCommand({ ping: 1 })").risk).toBe("none");
    expect(assessMongo("db.runCommand({ createUser: 'x' })").risk).toBe("write");
  });
  it("round-trips typed values through shell text", () => {
    expect(valueToShell("507f1f77bcf86cd799439011", "objectId")).toBe('ObjectId("507f1f77bcf86cd799439011")');
    expect(valueToShell(5n)).toBe('NumberLong("5")'); expect(valueToShell({ json: { a: { $oid: "507f1f77bcf86cd799439011" } } })).toContain("ObjectId");
    expect(jsonToShell({ $date: "2020-01-01T00:00:00.000Z" })).toBe('ISODate("2020-01-01T00:00:00.000Z")');
  });
});

describe.skipIf(!up)("MongoDB driver", () => {
  let conn: Connection; let db: string; let ro: Connection;
  const run = (c: Connection, text: string, extra: { maxRows?: number } = {}, s = sig()) => collect(c.execute({ sql: text, ...extra }, s));
  beforeAll(async () => {
    db = `rz_${randomBytes(5).toString("hex")}`;
    conn = await mongoDriver.connect({ ...base, database: db }, { log() {} });
    ro = await mongoDriver.connect({ ...base, database: db, readOnly: true }, { log() {} });
  });
  afterAll(async () => { await run(conn, "db.dropDatabase()").catch(() => {}); await conn.close(); await ro.close(); });

  it("reports server info and pings", async () => { expect(conn.serverInfo.version).toMatch(/^\d+\./); await conn.ping(); });

  it("inserts and reads typed documents with _id first and lossless values", async () => {
    await run(conn, `db.items.insertMany([{ name: "a", n: NumberLong("9223372036854775807"), at: ISODate("2020-01-02T03:04:05Z"), price: NumberDecimal("1.50"), tags: ["x","y"], meta: { k: 1 } }, { name: "b", n: 2 }])`);
    const r = await run(conn, "db.items.find({}).sort({ name: 1 })");
    expect(r.columns[0]!.name).toBe("_id"); expect(r.columns[0]!.nativeType).toBe("objectId");
    const idx = (n: string) => r.columns.findIndex((c) => c.name === n);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]![idx("n")]).toBe(9223372036854775807n); expect(r.rows[1]![idx("n")]).toBe(2);
    expect((r.rows[0]![idx("at")] as Date).toISOString()).toBe("2020-01-02T03:04:05.000Z");
    expect(r.rows[0]![idx("price")]).toBe("1.50"); expect(r.rows[0]![idx("tags")]).toEqual({ json: ["x", "y"] }); expect(r.rows[1]![idx("price")]).toBeNull();
    expect(String(r.rows[0]![0])).toMatch(/^[0-9a-f]{24}$/);
  });

  it("honors filters, projection, sort/skip/limit, count, distinct and maxRows", async () => {
    await run(conn, `db.nums.insertMany([${Array.from({ length: 50 }, (_, i) => `{ i: ${i}, g: ${i % 3} }`).join(",")}])`);
    expect((await run(conn, "db.nums.find({ i: { $gte: 10 } }, { i: 1, _id: 0 }).sort({ i: -1 }).skip(2).limit(3)")).rows).toEqual([[47], [46], [45]]);
    expect((await run(conn, "db.nums.countDocuments({ g: 1 })")).rows[0]![0]).toBe(17);
    expect((await run(conn, "db.nums.distinct('g')")).rows.map((r) => r[0]).sort()).toEqual([0, 1, 2]);
    expect((await run(conn, "db.nums.find({})", { maxRows: 7 })).rows).toHaveLength(7);
    expect((await run(conn, "db.nums.aggregate([{ $group: { _id: '$g', n: { $sum: 1 } } }, { $sort: { _id: 1 } }])")).rows).toEqual([[0, 17], [1, 17], [2, 16]]);
  });

  it("types syntax errors with a position and unsupported methods", async () => {
    await expect(run(conn, "db.items.find({ a: })")).rejects.toMatchObject({ kind: "syntax" });
    const e = await run(conn, "db.items.find({ a: 1 } x").catch((x: DriverError) => x);
    expect(e).toBeInstanceOf(DriverError); expect((e as DriverError).position).toBeGreaterThan(10);
    await expect(run(conn, "db.items.frobnicate()")).rejects.toMatchObject({ kind: "syntax" });
    await expect(run(conn, "db.items.find({ $badOp: 1 })")).rejects.toBeInstanceOf(DriverError);
  });

  it("reports duplicate keys as constraint errors", async () => {
    await run(conn, "db.uniq.insertOne({ _id: 1 })");
    await expect(run(conn, "db.uniq.insertOne({ _id: 1 })")).rejects.toMatchObject({ kind: "constraint" });
  });

  it("rejects an already-aborted signal and cancels a running aggregation", async () => {
    const dead = new AbortController(); dead.abort();
    await expect(run(conn, "db.items.find({})", {}, dead.signal)).rejects.toMatchObject({ kind: "cancelled" });
    const ac = new AbortController();
    const slow = run(conn, `db.items.aggregate([{ $addFields: { z: { $function: { body: "function() { var s = Date.now(); while (Date.now() - s < 10000) {} return 1 }", args: [], lang: "js" } } } }])`, {}, ac.signal);
    setTimeout(() => ac.abort(), 300);
    const t0 = Date.now();
    await expect(slow).rejects.toMatchObject({ kind: "cancelled" });
    expect(Date.now() - t0).toBeLessThan(4000);
    await conn.ping();
  });

  it("blocks writes on read-only connections but allows reads", async () => {
    await expect(run(ro, "db.items.insertOne({ x: 1 })")).rejects.toMatchObject({ kind: "permission" });
    await expect(run(ro, "db.items.deleteMany({})")).rejects.toMatchObject({ kind: "permission" });
    await expect(run(ro, "db.items.aggregate([{ $out: 'copy' }])")).rejects.toMatchObject({ kind: "permission" });
    await expect(run(ro, "db.runCommand({ drop: 'items' })")).rejects.toMatchObject({ kind: "permission" });
    expect((await run(ro, "db.items.countDocuments({})")).rows[0]![0]).toBe(2);
  });

  it("introspects databases, collections, sampled fields and indexes", async () => {
    await run(conn, "db.items.createIndex({ name: 1 }, { unique: true })");
    const api = conn.introspect();
    expect(await api.listSchemas()).toContain(db);
    expect((await api.listTables(db)).map((t) => t.name)).toEqual(expect.arrayContaining(["items", "nums"]));
    const d = await api.describeTable({ schema: db, name: "items" });
    expect(d.columns![0]).toMatchObject({ name: "_id", primaryKey: true });
    expect(d.columns!.find((c) => c.name === "n")!.nativeType).toMatch(/long|int/);
    expect(d.columns!.find((c) => c.name === "price")!.nullable).toBe(true);
    const idx = (await api.indexes!(db)).filter((i) => i.table === "items");
    expect(idx.find((i) => i.name === "name_1")).toMatchObject({ unique: true, columns: ["name"] });
    expect(idx.find((i) => i.primary)).toBeTruthy();
  });

  it("fails with a typed error for bad credentials or unreachable hosts", async () => {
    const bad = await mongoDriver.connect({ ...base, user: "nobody", password: "wrong", database: db }, { log() {} }).catch((e: unknown) => e);
    expect(bad).toBeInstanceOf(DriverError); expect(["authentication", "connection"]).toContain((bad as DriverError).kind);
    const down = await mongoDriver.connect({ host: "127.0.0.1", port: 1, ssl: false }, { log() {} }).catch((e: unknown) => e);
    expect((down as DriverError).kind).toBe("connection");
  }, 30_000);
});
