import { describe, it, expect } from "vitest";
import type { ColumnDef } from "@rizomadb/driver-api";
import { chooseRowKey, generate, keySource, type EditTarget } from "./index.js";
import { sqliteDriver } from "@rizomadb/driver-sqlite";

const col = (name: string, nativeType: string, nullable = true, primaryKey = false): ColumnDef => ({ name, nativeType, nullable, primaryKey });

describe("chooseRowKey", () => {
  it("leaves tables with a primary key alone", () => {
    expect(chooseRowKey([col("id", "int", false, true), col("b", "text")], [])).toBeUndefined();
  });
  it("prefers the smallest unique index on NOT NULL columns", () => {
    const cols = [col("a", "int", false), col("b", "int", false), col("c", "varchar(5)", true)];
    expect(chooseRowKey(cols, [["a", "b"], ["B"], ["c"]])).toEqual({ columns: ["b"], source: "unique" });
  });
  it("ignores unique indexes with a nullable column and falls back to the comparable columns", () => {
    const cols = [col("a", "integer"), col("f", "double precision"), col("j", "jsonb"), col("ts", "timestamp without time zone"), col("t", "text"), col("bin", "bytea")];
    expect(chooseRowKey(cols, [["a"]])).toEqual({ columns: ["a", "t"], source: "row" });
  });
  it("leaves out TEXT/NTEXT where the engine cannot compare them", () => {
    expect(chooseRowKey([col("a", "int"), col("t", "ntext"), col("u", "text")], [], { lobText: true })).toEqual({ columns: ["a"], source: "row" });
  });
  it("gives up when nothing can identify a row", () => {
    expect(chooseRowKey([col("f", "real"), col("b", "blob")], [])).toBeUndefined();
  });
});

describe("statements without a primary key", () => {
  const t: EditTarget = { table: "t", columns: [col("a", "INTEGER"), col("b", "TEXT"), col("r", "REAL")], rowKey: { columns: ["a", "b"], source: "row" } };
  it("match on the row key only, never on columns that do not compare exactly", () => {
    expect(keySource(t)).toBe("row");
    const del = generate(sqliteDriver, t, { kind: "delete", key: { a: 1, b: null }, before: { r: 1.5 } });
    expect(del.sql).toBe(`DELETE FROM "t" WHERE "a" = ? AND "b" IS NULL`);
    const up = generate(sqliteDriver, t, { kind: "update", key: { a: 1, b: "x" }, before: { r: 1.5 }, set: { r: 2 } });
    expect(up.sql).toBe(`UPDATE "t" SET "r" = ? WHERE "a" = ? AND "b" = ?`);
  });
});

describe("optimistic-concurrency predicates", () => {
  const t: EditTarget = { table: "t", columns: [col("id", "INTEGER", false, true), col("name", "TEXT"), col("created", "timestamp with time zone"), col("doc", "CLOB"), col("j", "json")] };
  it("compare only the columns whose loaded value compares exactly", () => {
    const del = generate(sqliteDriver, t, { kind: "delete", key: { id: 1 }, before: { name: "a", created: new Date(0), doc: "x", j: { json: {} } } });
    expect(del.sql).toBe(`DELETE FROM "t" WHERE "id" = ? AND "name" = ?`);
    const up = generate(sqliteDriver, t, { kind: "update", key: { id: 1 }, before: { doc: "x" }, set: { doc: "y" } });
    expect(up.sql).toBe(`UPDATE "t" SET "doc" = ? WHERE "id" = ?`);
  });
  it("leave out SQL Server TEXT/NTEXT, which cannot be compared with =", () => {
    const ms = { ...sqliteDriver, id: "mssql" };
    const tt: EditTarget = { table: "t", columns: [col("id", "int", false, true), col("n", "ntext"), col("v", "nvarchar")] };
    expect(generate(ms, tt, { kind: "delete", key: { id: 1 }, before: { n: "a", v: "b" } }).sql).toBe(`DELETE FROM "t" WHERE "id" = ? AND "v" = ?`);
  });
});
