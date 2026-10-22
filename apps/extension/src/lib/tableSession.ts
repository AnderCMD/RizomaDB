import type { ColumnInfo, Value } from "@rizomadb/driver-api";
import { PendingEdits, type EditTarget, type Row } from "@rizomadb/core";
import { formatValue } from "./format.js";

export interface PendingView {
  sets: { row: number; col: number; text: string | null }[];
  deletes: number[];
  inserts: (string | null | undefined)[][];
  count: number;
  canUndo: boolean;
  canRedo: boolean;
}

export class InputError extends Error {}

/** Parses grid text into a typed Value using the column kind reported by the driver. */
export function parseInput(kind: ColumnInfo["kind"], text: string | null): Value {
  if (text === null) return null;
  switch (kind) {
    case "integer": {
      if (!/^[+-]?\d+$/.test(text.trim())) throw new InputError(`"${text}" is not an integer`);
      const b = BigInt(text.trim());
      return b > BigInt(Number.MAX_SAFE_INTEGER) || b < BigInt(Number.MIN_SAFE_INTEGER) ? b : Number(b);
    }
    case "float": {
      const n = Number(text.trim());
      if (text.trim() === "" || Number.isNaN(n)) throw new InputError(`"${text}" is not a number`);
      return n;
    }
    case "decimal": {
      if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text.trim())) throw new InputError(`"${text}" is not a decimal number`);
      return text.trim();
    }
    case "boolean": {
      const t = text.trim().toLowerCase();
      if (["true", "1", "t", "yes"].includes(t)) return true;
      if (["false", "0", "f", "no"].includes(t)) return false;
      throw new InputError(`"${text}" is not a boolean`);
    }
    case "json":
      try { return { json: JSON.parse(text) }; } catch { throw new InputError("Invalid JSON"); }
    case "binary": throw new InputError("Binary columns cannot be edited in the grid");
    default: return text;
  }
}

export class TableSession {
  readonly pending: PendingEdits;
  private nameOf: string[];
  constructor(readonly target: EditTarget, readonly columns: ColumnInfo[], rawRows: Value[][]) {
    this.nameOf = columns.map((c) => c.name);
    const rows: Row[] = rawRows.map((r) => Object.fromEntries(r.map((v, i) => [this.nameOf[i]!, v])));
    this.pending = new PendingEdits(rows, target);
  }
  get rowCount() { return this.pending.original.length; }
  private insertCount() { return this.pending.state().inserts.length; }

  edit(row: number, col: number, text: string | null) {
    const c = this.columns[col];
    if (!c) throw new InputError("No such column");
    const value = parseInput(c.kind, text);
    if (row < this.rowCount) this.pending.do({ t: "set", row, col: c.name, value });
    else {
      const index = row - this.rowCount;
      if (index >= this.insertCount()) throw new InputError("No such row");
      this.pending.do({ t: "setNew", index, col: c.name, value });
    }
  }
  /** Applies many cells as one undo step; nothing is applied when any cell is invalid. */
  editMany(cells: { row: number; col: number; text: string | null }[]) {
    const ops: Parameters<PendingEdits["do"]>[0][] = [];
    const fresh = this.insertCount();
    for (const { row, col, text } of cells) {
      const c = this.columns[col];
      if (!c) throw new InputError("No such column");
      let value: Value;
      try { value = parseInput(c.kind, text); } catch (e) { throw e instanceof InputError ? new InputError(`${e.message} (row ${row + 1}, ${c.name})`) : e; }
      if (row < this.rowCount) ops.push({ t: "set", row, col: c.name, value });
      else if (row - this.rowCount < fresh) ops.push({ t: "setNew", index: row - this.rowCount, col: c.name, value });
      else throw new InputError("No such row");
    }
    if (ops.length) this.pending.do({ t: "group", ops });
  }
  toggleDelete(row: number) {
    if (row >= this.rowCount) throw new InputError("Inserted rows are discarded with Undo");
    this.pending.do({ t: this.pending.state().deletes.has(row) ? "restore" : "delete", row });
  }
  insertRow() { this.pending.do({ t: "insert" }); }

  view(): PendingView {
    const s = this.pending.state();
    const idx = new Map(this.nameOf.map((n, i) => [n, i]));
    const sets: PendingView["sets"] = [];
    for (const [row, vals] of s.sets) for (const [name, v] of Object.entries(vals)) sets.push({ row, col: idx.get(name)!, text: formatValue(v) });
    const inserts = s.inserts.map((r) => this.nameOf.map((n) => (n in r ? formatValue(r[n]!) : undefined)));
    return { sets, deletes: [...s.deletes], inserts, count: this.pending.count, canUndo: this.pending.canUndo, canRedo: this.pending.canRedo };
  }
}
