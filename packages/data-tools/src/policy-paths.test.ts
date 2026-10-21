import { describe, it, expect } from "vitest";
import { collect, type ColumnDef, type Connection } from "@rizomadb/driver-api";
import { applyChanges, builtInPolicy, guardConnection, mergePolicies, type EditTarget } from "@rizomadb/core";
import { sqliteDriver } from "@rizomadb/driver-sqlite";
import { applySync, backupSqlite, importRows, syncChanges } from "./index.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sig = () => new AbortController().signal;
const q = (c: Connection, sql: string) => collect(c.execute({ sql }, sig()));

/** The promise behind "prod policy is inviolable": whichever feature tries to write, the guarded connection says no. */
describe("every write path respects the production policy", () => {
  async function prod() {
    const raw = await sqliteDriver.connect({ path: ":memory:" }, { log() {} });
    await q(raw, "CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
    await q(raw, "INSERT INTO people VALUES (1, 'Ada'), (2, 'Linus')");
    const guarded = guardConnection(raw, { plugin: sqliteDriver, connectionId: "p", connectionName: "prod-db", environment: "prod", readOnly: () => false, policy: () => mergePolicies(builtInPolicy) });
    const rows = async () => (await q(raw, "SELECT id, name FROM people ORDER BY id")).rows;
    const info = await raw.introspect().describeTable({ name: "people" });
    const target: EditTarget = { table: "people", columns: info.columns as ColumnDef[] };
    return { raw, guarded, rows, target };
  }
  const before = [[1, "Ada"], [2, "Linus"]];

  it("rejects raw statements and transactions", async () => {
    const t = await prod();
    await expect(q(t.guarded, "DELETE FROM people WHERE id = 1")).rejects.toMatchObject({ kind: "permission" });
    const tx = await t.guarded.begin!();
    await expect(collect(tx.execute({ sql: "UPDATE people SET name = 'x'" }, sig()))).rejects.toMatchObject({ kind: "permission" });
    await tx.rollback();
    expect(await t.rows()).toEqual(before);
  });
  it("rejects the edit queue (even if its own pre-check were bypassed)", async () => {
    const t = await prod();
    await expect(applyChanges([{ kind: "update", key: { id: 1 }, before: { name: "Ada" }, set: { name: "Mallory" } }], { conn: t.guarded, plugin: sqliteDriver, target: t.target, environment: "dev", readOnly: false, policy: mergePolicies(), confirm: async () => true }))
      .rejects.toBeDefined(); // environment label lies ("dev") but the guarded connection knows it is prod
    expect(await t.rows()).toEqual(before);
  });
  it("rejects imports and rolls back", async () => {
    const t = await prod();
    const rows = (async function* () { yield ["9", "Eve"]; })();
    await expect(importRows({ conn: t.guarded, plugin: sqliteDriver, table: { name: "people" }, mapping: [{ source: 0, target: { name: "id", kind: "integer", nullable: false } }, { source: 1, target: { name: "name", kind: "text", nullable: false } }], rows })).rejects.toThrow();
    expect(await t.rows()).toEqual(before);
  });
  it("rejects data sync", async () => {
    const t = await prod();
    await expect(applySync(syncChanges([{ kind: "only-in-source", key: { id: 7 }, row: { id: 7, name: "Zed" } }]), { conn: t.guarded, plugin: sqliteDriver, table: t.target, environment: "dev", readOnly: false, policy: mergePolicies(), confirm: async () => true })).rejects.toBeDefined();
    expect(await t.rows()).toEqual(before);
  });
  it("rejects DDL (designer, migrations, drops) and admin-style commands", async () => {
    const t = await prod();
    for (const sql of ["CREATE TABLE x (a)", "ALTER TABLE people ADD COLUMN z", "DROP TABLE people", "CREATE INDEX i ON people(name)", "PRAGMA writable_schema = 1", "ATTACH DATABASE ':memory:' AS other", "VACUUM"])
      await expect(q(t.guarded, sql), sql).rejects.toMatchObject({ kind: "permission" });
    expect(await t.rows()).toEqual(before);
  });
  it("still allows reading, exporting and backing up production", async () => {
    const t = await prod();
    expect((await q(t.guarded, "SELECT COUNT(*) FROM people")).rows[0]![0]).toBe(2);
    const f = join(mkdtempSync(join(tmpdir(), "rz-bk-")), "b.db");
    await backupSqlite(t.guarded, f);
    const copy = await sqliteDriver.connect({ path: f }, { log() {} });
    expect((await q(copy, "SELECT COUNT(*) FROM people")).rows[0]![0]).toBe(2);
  });
});
