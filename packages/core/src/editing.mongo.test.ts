import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, type ColumnDef, type Value } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { mongoDriver } from "@rizomadb/driver-mongodb";
import { applyChanges, defaultEffectivePolicy, EditError, PendingEdits, generate, type EditTarget, type Row } from "./index.js";

const port = Number(process.env.RZ_MONGO_PORT ?? 27018);
const up = await engineUp("127.0.0.1", port);
const sig = new AbortController().signal;

describe.skipIf(!up)("document edit queue on MongoDB", () => {
  async function setup() {
    const db = `rz_${randomBytes(5).toString("hex")}`;
    const conn = await mongoDriver.connect({ host: "127.0.0.1", port, ssl: false, database: db }, { log() {} });
    const run = (s: string) => collect(conn.execute({ sql: s }, sig));
    await run('db.people.insertMany([{ name: "Ada", age: 36, note: null }, { name: "Linus", age: 54, note: "x", tags: ["a"] }])');
    const info = await conn.introspect().describeTable({ schema: db, name: "people" });
    const target: EditTarget = { schema: db, table: "people", columns: info.columns as ColumnDef[] };
    const found = await run(`db.getSiblingDB("${db}").people.find({}).sort({ name: 1 })`);
    const rows: Row[] = found.rows.map((r) => Object.fromEntries(found.columns.map((c, i) => [c.name, r[i] as Value])));
    const base = { conn, plugin: mongoDriver, target, environment: "dev", readOnly: false, policy: defaultEffectivePolicy, confirm: async () => true };
    return { conn, run, target, rows, base, db };
  }

  it("generates readable commands with typed _id and optimistic filters", async () => {
    const t = await setup();
    const p = new PendingEdits(t.rows, t.target);
    p.do({ t: "set", row: 0, col: "age", value: 37 });
    const [g] = p.toChanges().map((c) => generate(mongoDriver, t.target, c));
    expect(g!.sql).toContain('.getSiblingDB(');
    expect(g!.sql).toMatch(/"_id": ObjectId\("[0-9a-f]{24}"\)/); expect(g!.sql).toContain('"age": 36'); expect(g!.sql).toContain('"$set": { "age": 37 }');
    await t.conn.close();
  });

  it("applies update, insert and delete", async () => {
    const t = await setup();
    const p = new PendingEdits(t.rows, t.target);
    p.do({ t: "set", row: 0, col: "age", value: 37 }); p.do({ t: "set", row: 0, col: "note", value: "hi" });
    p.do({ t: "delete", row: 1 }); p.do({ t: "insert" }); p.do({ t: "setNew", index: 0, col: "name", value: "Grace" }); p.do({ t: "setNew", index: 0, col: "age", value: 85 });
    expect((await applyChanges(p.toChanges(), t.base)).applied).toBe(3);
    const res = await t.run("db.people.find({}, { _id: 0 }).sort({ name: 1 })");
    const docs = res.rows.map((r) => Object.fromEntries(res.columns.map((c, i) => [c.name, r[i]])));
    expect(docs.map((d) => d.name)).toEqual(["Ada", "Grace"]);
    expect(docs[0]).toMatchObject({ age: 37, note: "hi" }); expect(docs[1]).toMatchObject({ age: 85 });
    await t.conn.close();
  });

  it("detects concurrent modification and stops, reporting what was already applied", async () => {
    const t = await setup();
    await t.run('db.people.updateOne({ name: "Ada" }, { $set: { age: 99 } })');
    const p = new PendingEdits(t.rows, t.target);
    p.do({ t: "set", row: 1, col: "age", value: 55 });      // Linus: still matches
    p.do({ t: "set", row: 0, col: "age", value: 37 });      // Ada: changed under us
    const err = await applyChanges(p.toChanges(), t.base).catch((e: unknown) => e) as EditError;
    expect(err).toBeInstanceOf(EditError); expect(err.code).toBe("conflict"); expect(err.message).toMatch(/NOT rolled back/);
    const ages = (await t.run("db.people.find({}).sort({ name: 1 })")).rows;
    const col = (await t.run("db.people.find({})")).columns.findIndex((c) => c.name === "age");
    expect(ages.map((r) => r[col])).toEqual([99, 55]);
    await t.conn.close();
  });

  it("blocks edits on read-only connections and prod, honoring the shared policy", async () => {
    const t = await setup();
    const p = new PendingEdits(t.rows, t.target); p.do({ t: "delete", row: 0 });
    await expect(applyChanges(p.toChanges(), { ...t.base, readOnly: true })).rejects.toMatchObject({ code: "blocked" });
    await expect(applyChanges(p.toChanges(), { ...t.base, environment: "prod" })).rejects.toMatchObject({ code: "blocked" });
    await t.conn.close();
  });
});
