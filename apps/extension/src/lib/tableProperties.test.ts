import { describe, it, expect } from "vitest";
import type { Connection } from "@rizomadb/driver-api";
import { tableProperties } from "./tableProperties.js";

const fake = (): Connection => ({
  introspect: () => ({
    listSchemas: async () => [], listTables: async () => [],
    describeTable: async (r: { name: string }) => ({ name: r.name, kind: "table", columns: [{ name: "id", nativeType: "integer", nullable: false, primaryKey: true }, { name: "pid", nativeType: "integer", nullable: true, primaryKey: false, default: "0" }] }),
    indexes: async () => [{ name: "ix_pid", table: "child", columns: ["pid"], unique: false, primary: false }, { name: "ix_other", table: "other", columns: ["x"], unique: false, primary: false }],
    foreignKeys: async () => [{ name: "fk_child_parent", from: { table: "child", columns: ["pid"] }, to: { table: "parent", columns: ["id"] } }, { name: "fk_grand_child", from: { table: "grand", columns: ["cid"] }, to: { table: "child", columns: ["id"] } }],
  }),
} as unknown as Connection);

describe("tableProperties", () => {
  it("separates own indexes and foreign keys from the ones that point at the table", async () => {
    const p = await tableProperties(fake(), "postgres", { name: "child" });
    expect(p.columns.map((c) => [c.name, c.pk])).toEqual([["id", true], ["pid", false]]);
    expect(p.indexes.map((i) => i.name)).toEqual(["ix_pid"]);
    expect(p.foreignKeys).toEqual([{ name: "fk_child_parent", columns: ["pid"], refTable: "parent", refColumns: ["id"] }]);
    expect(p.referencedBy).toEqual([{ name: "fk_grand_child", table: "grand", columns: ["cid"], refColumns: ["id"] }]);
  });
  it("generates DDL for SQL engines and leaves it empty for the rest", async () => {
    const sql = await tableProperties(fake(), "postgres", { name: "child" });
    expect(sql.ddl).toContain('CREATE TABLE "child"'); expect(sql.ddl).toContain("FOREIGN KEY"); expect(sql.ddl.trim().endsWith(";")).toBe(true);
    expect((await tableProperties(fake(), "mongodb", { name: "child" })).ddl).toBe("");
  });
});
