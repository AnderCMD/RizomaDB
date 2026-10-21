import type { Value } from "@rizomadb/driver-api";
import { keyColumns, type Change, type EditTarget, type Row } from "./editing.js";

export type Op =
  | { t: "set"; row: number; col: string; value: Value }
  | { t: "delete"; row: number }
  | { t: "restore"; row: number }
  | { t: "insert" }
  | { t: "setNew"; index: number; col: string; value: Value };

export interface PendingState {
  sets: Map<number, Row>;
  deletes: Set<number>;
  inserts: Row[];
}

const same = (a: Value, b: Value) =>
  a === b || (a instanceof Date && b instanceof Date && a.getTime() === b.getTime()) || (typeof a === "bigint" && typeof b === "number" && a === BigInt(b)) || (typeof b === "bigint" && typeof a === "number" && b === BigInt(a))
  || (typeof a === "object" && typeof b === "object" && a !== null && b !== null && JSON.stringify(a, (_, x) => (typeof x === "bigint" ? x.toString() : x)) === JSON.stringify(b, (_, x) => (typeof x === "bigint" ? x.toString() : x)));

/** Operation log over the rows loaded in the grid. Undo/redo move a cursor; state is always derived by replay. */
export class PendingEdits {
  private ops: Op[] = [];
  private cursor = 0;
  constructor(readonly original: readonly Row[], readonly target: EditTarget) {}

  do(op: Op) {
    if (op.t !== "insert" && op.t !== "setNew" && (op.row < 0 || op.row >= this.original.length)) throw new RangeError(`No such row ${"row" in op ? op.row : ""}`);
    this.ops = this.ops.slice(0, this.cursor); this.ops.push(op); this.cursor++;
  }
  undo(): boolean { if (this.cursor === 0) return false; this.cursor--; return true; }
  redo(): boolean { if (this.cursor >= this.ops.length) return false; this.cursor++; return true; }
  get canUndo() { return this.cursor > 0; }
  get canRedo() { return this.cursor < this.ops.length; }
  clear() { this.ops = []; this.cursor = 0; }

  state(): PendingState {
    const sets = new Map<number, Row>(), deletes = new Set<number>(), inserts: Row[] = [];
    for (const op of this.ops.slice(0, this.cursor)) {
      if (op.t === "set") {
        const cur = sets.get(op.row) ?? {};
        cur[op.col] = op.value; sets.set(op.row, cur);
      } else if (op.t === "delete") deletes.add(op.row);
      else if (op.t === "restore") deletes.delete(op.row);
      else if (op.t === "insert") inserts.push({});
      else if (inserts[op.index]) inserts[op.index]![op.col] = op.value;
    }
    for (const [row, vals] of sets) {
      for (const col of Object.keys(vals)) if (same(vals[col]!, this.original[row]![col] ?? null)) delete vals[col];
      if (Object.keys(vals).length === 0) sets.delete(row);
    }
    return { sets, deletes, inserts };
  }

  /** Number of effective pending row changes. */
  get count(): number {
    const s = this.state();
    return [...s.sets.keys()].filter((r) => !s.deletes.has(r)).length + s.deletes.size + s.inserts.length;
  }

  toChanges(): Change[] {
    const s = this.state(), keys = keyColumns(this.target), out: Change[] = [];
    const keyOf = (r: Row): Row => Object.fromEntries(keys.map((k) => [k, r[k] ?? null]));
    for (const [row, set] of s.sets) {
      if (s.deletes.has(row)) continue;
      const orig = this.original[row]!;
      out.push({ kind: "update", key: keyOf(orig), before: Object.fromEntries(Object.keys(set).map((c) => [c, orig[c] ?? null])), set });
    }
    for (const row of s.deletes) {
      const orig = this.original[row]!;
      out.push({ kind: "delete", key: keyOf(orig), before: Object.fromEntries(Object.entries(orig).filter(([c]) => !keys.includes(c))) });
    }
    for (const values of s.inserts) out.push({ kind: "insert", values });
    return out;
  }
}
