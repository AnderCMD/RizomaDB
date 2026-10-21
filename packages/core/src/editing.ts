import { DriverError, collect, type ColumnDef, type Connection, type DriverPlugin, type Value } from "@rizomadb/driver-api";
import { decideEffective, type EffectivePolicy } from "./effective-policy.js";

/** Data edits never run directly: they accumulate here, are previewed as exact SQL, then applied in one transaction. */

export type Row = Record<string, Value>;
export type Change =
  | { kind: "insert"; values: Row }
  | { kind: "update"; key: Row; before: Row; set: Row }
  | { kind: "delete"; key: Row; before: Row };

export interface EditTarget {
  schema?: string;
  table: string;
  columns: ColumnDef[];
}

export interface GeneratedStatement { sql: string; params: Value[]; change: Change; description: string }

export class EditError extends Error {
  constructor(readonly code: "no-key" | "validation" | "conflict" | "blocked" | "declined" | "failed", message: string, readonly changeIndex?: number) {
    super(message);
    this.name = "EditError";
  }
}

const qualified = (p: DriverPlugin, t: EditTarget) => (t.schema ? `${p.quoteIdent(t.schema)}.${p.quoteIdent(t.table)}` : p.quoteIdent(t.table));

export function keyColumns(t: EditTarget): string[] {
  const k = t.columns.filter((c) => c.primaryKey).map((c) => c.name);
  if (k.length === 0) throw new EditError("no-key", `Table ${t.table} has no primary key: rows cannot be identified safely, so it is not editable.`);
  return k;
}

export function validateChange(t: EditTarget, c: Change): void {
  const byName = new Map(t.columns.map((x) => [x.name, x]));
  const check = (row: Row, requireAll: boolean) => {
    for (const [name, v] of Object.entries(row)) {
      const col = byName.get(name);
      if (!col) throw new EditError("validation", `Unknown column: ${name}`);
      if (v === null && !col.nullable && !col.default) throw new EditError("validation", `Column ${name} is NOT NULL.`);
      if (v === null && !col.nullable && col.default && c.kind === "update") throw new EditError("validation", `Column ${name} is NOT NULL.`);
    }
    if (requireAll) {
      for (const col of t.columns) {
        if (!col.nullable && !col.default && !col.primaryKey && !(col.name in row)) throw new EditError("validation", `Column ${col.name} requires a value.`);
      }
    }
  };
  if (c.kind === "insert") check(c.values, true);
  else if (c.kind === "update") {
    if (Object.keys(c.set).length === 0) throw new EditError("validation", "Update changes no columns.");
    check(c.set, false);
    for (const k of keyColumns(t)) if (!(k in c.key)) throw new EditError("validation", `Missing key column ${k}.`);
  } else for (const k of keyColumns(t)) if (!(k in c.key)) throw new EditError("validation", `Missing key column ${k}.`);
}

/** Builds parameterized SQL with optimistic-concurrency predicates (key + original values of edited columns). */
export function generate(p: DriverPlugin, t: EditTarget, c: Change): GeneratedStatement {
  validateChange(t, c);
  if (p.generateChange) { const g = p.generateChange(t, c); return { sql: g.sql, params: g.params, change: c, description: g.description }; }
  const params: Value[] = [];
  const bind = (v: Value) => { params.push(v); return p.placeholder(params.length); };
  const q = p.quoteIdent;
  const eq = (col: string, v: Value) => (v === null ? `${q(col)} IS NULL` : `${q(col)} = ${bind(v)}`);
  const target = qualified(p, t);
  if (c.kind === "insert") {
    const cols = Object.keys(c.values);
    const sql = cols.length
      ? `INSERT INTO ${target} (${cols.map(q).join(", ")}) VALUES (${cols.map((k) => bind(c.values[k]!)).join(", ")})`
      : `INSERT INTO ${target} DEFAULT VALUES`;
    return { sql, params, change: c, description: "Insert row" };
  }
  const keys = keyColumns(t);
  if (c.kind === "update") {
    const set = Object.entries(c.set).map(([k, v]) => `${q(k)} = ${bind(v)}`).join(", ");
    const where = [...keys.map((k) => eq(k, c.key[k]!)), ...Object.keys(c.set).filter((k) => !keys.includes(k) && k in c.before).map((k) => eq(k, c.before[k]!))];
    return { sql: `UPDATE ${target} SET ${set} WHERE ${where.join(" AND ")}`, params, change: c, description: `Update ${Object.keys(c.set).join(", ")}` };
  }
  const where = [...keys.map((k) => eq(k, c.key[k]!)), ...Object.keys(c.before).filter((k) => !keys.includes(k)).map((k) => eq(k, c.before[k]!))];
  return { sql: `DELETE FROM ${target} WHERE ${where.join(" AND ")}`, params, change: c, description: "Delete row" };
}

export class EditQueue {
  private changes: Change[] = [];
  private redoStack: Change[] = [];
  list(): readonly Change[] { return this.changes; }
  get size() { return this.changes.length; }
  add(c: Change) { this.changes.push(c); this.redoStack = []; }
  undo() { const c = this.changes.pop(); if (c) this.redoStack.push(c); return c; }
  redo() { const c = this.redoStack.pop(); if (c) this.changes.push(c); return c; }
  clear() { this.changes = []; this.redoStack = []; }
  preview(p: DriverPlugin, t: EditTarget): GeneratedStatement[] { return this.changes.map((c) => generate(p, t, c)); }
}

export interface ApplyOptions {
  conn: Connection;
  plugin: DriverPlugin;
  target: EditTarget;
  environment: string;
  readOnly: boolean;
  policy: EffectivePolicy;
  /** Called with the exact SQL before anything runs; return false to abort. Required for confirm-environments. */
  confirm: (statements: GeneratedStatement[]) => Promise<boolean>;
  signal?: AbortSignal;
}

export interface ApplyResult { applied: number }

/** All-or-nothing apply. Any conflict (0 rows matched) or error rolls the whole batch back. */
export async function applyChanges(changes: readonly Change[], o: ApplyOptions): Promise<ApplyResult> {
  if (changes.length === 0) return { applied: 0 };
  const statements = changes.map((c, i) => { try { return generate(o.plugin, o.target, c); } catch (e) { throw e instanceof EditError ? new EditError(e.code, e.message, i) : e; } });
  for (const s of statements) {
    const d = decideEffective(s.sql, { environment: o.environment, readOnly: o.readOnly }, o.policy, o.plugin.assess);
    if (!d.allowed) throw new EditError("blocked", d.reason ?? "Blocked by policy");
  }
  if (!(await o.confirm(statements))) throw new EditError("declined", "Changes were not confirmed.");

  const signal = o.signal ?? new AbortController().signal;
  if (!o.plugin.capabilities.transactions || !o.conn.begin) {
    // Engines without multi-statement transactions (e.g. standalone MongoDB): apply in order and stop at the first problem.
    let done = 0;
    for (const [i, s] of statements.entries()) {
      try {
        const r = await collect(o.conn.execute({ sql: s.sql, params: s.params }, signal), );
        const n = r.done?.affectedRows;
        if (n !== undefined && n !== 1) throw new EditError("conflict", `${n === 0 ? "The document changed or was deleted by someone else since it was loaded." : `Statement affected ${n} documents, expected 1.`} ${done} of ${statements.length} change(s) were already applied and are NOT rolled back on this engine.`, i);
        done++;
      } catch (e) {
        if (e instanceof EditError) throw e;
        throw new EditError("failed", `${e instanceof DriverError ? e.message : (e as Error).message} (${done} of ${statements.length} change(s) were already applied and are NOT rolled back on this engine.)`, i);
      }
    }
    return { applied: done };
  }
  const tx = await o.conn.begin();
  try {
    for (const [i, s] of statements.entries()) {
      const r = await collect(tx.execute({ sql: s.sql, params: s.params }, signal));
      const n = r.done?.affectedRows;
      if (n !== undefined && n !== 1) {
        throw new EditError("conflict", n === 0 ? "The row changed or was deleted by someone else since it was loaded." : `Statement affected ${n} rows, expected 1.`, i);
      }
    }
    await tx.commit();
    return { applied: statements.length };
  } catch (e) {
    await tx.rollback().catch(() => {});
    if (e instanceof EditError) throw e;
    if (e instanceof DriverError) throw new EditError("failed", e.message);
    throw e;
  }
}
