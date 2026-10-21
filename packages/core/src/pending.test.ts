import { describe, it, expect } from "vitest";
import { PendingEdits, type EditTarget } from "./index.js";

const target: EditTarget = { table: "t", columns: [
  { name: "id", nativeType: "int", nullable: false, primaryKey: true },
  { name: "name", nativeType: "text", nullable: false, primaryKey: false },
  { name: "note", nativeType: "text", nullable: true, primaryKey: false },
] };
const rows = [{ id: 1, name: "a", note: null }, { id: 2, name: "b", note: "x" }];

describe("PendingEdits", () => {
  it("derives updates with original values as concurrency predicates", () => {
    const p = new PendingEdits(rows, target);
    p.do({ t: "set", row: 0, col: "name", value: "A" });
    expect(p.toChanges()).toEqual([{ kind: "update", key: { id: 1 }, before: { name: "a" }, set: { name: "A" } }]);
  });
  it("drops edits that restore the original value", () => {
    const p = new PendingEdits(rows, target);
    p.do({ t: "set", row: 0, col: "name", value: "z" }); p.do({ t: "set", row: 0, col: "name", value: "a" });
    expect(p.count).toBe(0);
  });
  it("delete wins over edits; restore brings the edit back", () => {
    const p = new PendingEdits(rows, target);
    p.do({ t: "set", row: 1, col: "note", value: null }); p.do({ t: "delete", row: 1 });
    expect(p.toChanges().map((c) => c.kind)).toEqual(["delete"]);
    p.do({ t: "restore", row: 1 });
    expect(p.toChanges().map((c) => c.kind)).toEqual(["update"]);
  });
  it("tracks inserts and supports undo/redo with redo invalidation", () => {
    const p = new PendingEdits(rows, target);
    p.do({ t: "insert" }); p.do({ t: "setNew", index: 0, col: "id", value: 3 }); p.do({ t: "setNew", index: 0, col: "name", value: "c" });
    expect(p.toChanges()).toEqual([{ kind: "insert", values: { id: 3, name: "c" } }]);
    p.undo(); expect(p.state().inserts[0]).toEqual({ id: 3 });
    p.redo(); expect(p.state().inserts[0]).toEqual({ id: 3, name: "c" });
    p.undo(); p.do({ t: "delete", row: 0 }); expect(p.redo()).toBe(false);
  });
  it("rejects edits to rows that do not exist", () => {
    expect(() => new PendingEdits(rows, target).do({ t: "set", row: 9, col: "name", value: "x" })).toThrow(RangeError);
  });
});
