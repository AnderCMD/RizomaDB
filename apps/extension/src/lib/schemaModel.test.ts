import { describe, it, expect } from "vitest";
import { missingFkIndexes, describeChanges } from "./schemaModel.js";
import type { SchemaModel } from "@rizomadb/schema-tools";

const m = (idx: { name: string; columns: string[]; unique: boolean }[]): SchemaModel => ({ dialect: "postgres", tables: [
  { name: "p", columns: [{ name: "id", type: "int", nullable: false }], primaryKey: ["id"], indexes: [], foreignKeys: [] },
  { name: "c", columns: [{ name: "id", type: "int", nullable: false }, { name: "pid", type: "int", nullable: true }], primaryKey: ["id"], indexes: idx, foreignKeys: [{ name: "fk", columns: ["pid"], refTable: "p", refColumns: ["id"] }] },
] });
describe("schema model helpers", () => {
  it("finds foreign keys without a covering index", () => {
    expect(missingFkIndexes(m([]))).toEqual([{ table: "c", fk: "fk", columns: ["pid"] }]);
    expect(missingFkIndexes(m([{ name: "i", columns: ["pid", "x"], unique: false }]))).toEqual([]);
    expect(missingFkIndexes(m([{ name: "i", columns: ["x", "pid"], unique: false }]))).toHaveLength(1);
  });
  it("summarizes changes for review", () => {
    expect(describeChanges(m([]), m([{ name: "i", columns: ["pid"], unique: false }]))).toEqual(["+ index i on c"]);
  });
});
