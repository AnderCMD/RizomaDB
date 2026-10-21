import { addFk, columnDef, createIndex, createTable, dropFk, dropIndex, quote } from "./ddl.js";
import { normalizeDefault, normalizeType } from "./normalize.js";
import { topoSort, type ColumnM, type Dialect, type SchemaModel, type TableM } from "./model.js";

const lc = (s: string) => s.toLowerCase();
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => lc(x) === lc(b[i]!));

export type Change =
  | { kind: "create-table"; table: TableM }
  | { kind: "drop-table"; table: TableM }
  | { kind: "add-column"; table: TableM; column: ColumnM }
  | { kind: "drop-column"; table: TableM; column: ColumnM }
  | { kind: "alter-column"; table: TableM; from: ColumnM; to: ColumnM; what: ("type" | "nullable" | "default")[] }
  | { kind: "add-index"; table: TableM; index: { name: string; columns: string[]; unique: boolean } }
  | { kind: "drop-index"; table: TableM; name: string }
  | { kind: "add-fk"; table: TableM; fk: TableM["foreignKeys"][number] }
  | { kind: "drop-fk"; table: TableM; name: string }
  | { kind: "change-pk"; table: TableM; from: string[]; to: string[] };

export interface DiffResult { changes: Change[]; identical: boolean }

/** Compares `from` (current) with `to` (desired): applying the changes to `from` yields `to`. Renames appear as drop + add. */
export function diffModels(from: SchemaModel, to: SchemaModel): DiffResult {
  const d = to.dialect;
  const changes: Change[] = [];
  const fromT = new Map(from.tables.map((t) => [lc(t.name), t]));
  const toT = new Map(to.tables.map((t) => [lc(t.name), t]));
  for (const t of to.tables) if (!fromT.has(lc(t.name))) changes.push({ kind: "create-table", table: t });
  for (const t of from.tables) if (!toT.has(lc(t.name))) changes.push({ kind: "drop-table", table: t });
  for (const t of to.tables) {
    const f = fromT.get(lc(t.name)); if (!f) continue;
    const fc = new Map(f.columns.map((c) => [lc(c.name), c])), tc = new Map(t.columns.map((c) => [lc(c.name), c]));
    for (const c of t.columns) if (!fc.has(lc(c.name))) changes.push({ kind: "add-column", table: t, column: c });
    for (const c of f.columns) if (!tc.has(lc(c.name))) changes.push({ kind: "drop-column", table: f, column: c });
    for (const c of t.columns) {
      const o = fc.get(lc(c.name)); if (!o) continue;
      const what: ("type" | "nullable" | "default")[] = [];
      if (normalizeType(d, o.type) !== normalizeType(d, c.type)) what.push("type");
      if (o.nullable !== c.nullable && !t.primaryKey.some((p) => lc(p) === lc(c.name))) what.push("nullable");
      if (normalizeDefault(o.default) !== normalizeDefault(c.default) && !c.identity) what.push("default");
      if (what.length) changes.push({ kind: "alter-column", table: t, from: o, to: c, what });
    }
    if (!same(f.primaryKey, t.primaryKey)) changes.push({ kind: "change-pk", table: t, from: f.primaryKey, to: t.primaryKey });
    const fi = new Map(f.indexes.map((i) => [lc(i.name), i])), ti = new Map(t.indexes.map((i) => [lc(i.name), i]));
    for (const i of t.indexes) { const o = fi.get(lc(i.name)); if (!o) changes.push({ kind: "add-index", table: t, index: i }); else if (!same(o.columns, i.columns) || o.unique !== i.unique) { changes.push({ kind: "drop-index", table: f, name: o.name }); changes.push({ kind: "add-index", table: t, index: i }); } }
    for (const i of f.indexes) if (!ti.has(lc(i.name))) changes.push({ kind: "drop-index", table: f, name: i.name });
    // SQLite does not keep FK names, so its constraints are identified by structure.
    const fkId = (x: TableM["foreignKeys"][number]) => (d === "sqlite" ? `${x.columns.map(lc).join(",")}>${lc(x.refTable)}(${x.refColumns.map(lc).join(",")})` : lc(x.name));
    const ff = new Map(f.foreignKeys.map((x) => [fkId(x), x])), tf = new Map(t.foreignKeys.map((x) => [fkId(x), x]));
    const fkSame = (a: TableM["foreignKeys"][number], b: TableM["foreignKeys"][number]) => same(a.columns, b.columns) && lc(a.refTable) === lc(b.refTable) && same(a.refColumns, b.refColumns);
    for (const x of t.foreignKeys) { const o = ff.get(fkId(x)); if (!o) changes.push({ kind: "add-fk", table: t, fk: x }); else if (!fkSame(o, x)) { changes.push({ kind: "drop-fk", table: f, name: o.name }); changes.push({ kind: "add-fk", table: t, fk: x }); } }
    for (const x of f.foreignKeys) if (!tf.has(fkId(x))) changes.push({ kind: "drop-fk", table: f, name: x.name });
  }
  return { changes, identical: changes.length === 0 };
}

export interface Statement { sql: string; destructive?: string; manual?: string }

/** SQL for a change list in a safe order: drop FKs/indexes, drop columns/tables, create, alter, add indexes/FKs. */
export function migrationStatements(dialect: Dialect, changes: Change[], opts: { target?: SchemaModel } = {}): Statement[] {
  const d = dialect;
  const q = (n: string) => quote(d, n);
  const tn = (t: TableM) => (t.schema && d !== "sqlite" ? `${q(t.schema)}.${q(t.name)}` : q(t.name));
  const phases: Statement[][] = [[], [], [], [], [], [], []];
  const push = (p: number, s: Statement) => phases[p]!.push(s);
  const created = changes.filter((c): c is Extract<Change, { kind: "create-table" }> => c.kind === "create-table").map((c) => c.table);
  const dropped = changes.filter((c): c is Extract<Change, { kind: "drop-table" }> => c.kind === "drop-table").map((c) => c.table);
  for (const c of changes) {
    switch (c.kind) {
      case "drop-fk": push(0, { sql: dropFk(d, c.table, c.name) }); break;
      case "drop-index": push(1, { sql: dropIndex(d, c.table, c.name) }); break;
      case "drop-column": push(2, { sql: `ALTER TABLE ${tn(c.table)} DROP COLUMN ${q(c.column.name)}`, destructive: `Drops column ${c.table.name}.${c.column.name} and its data` }); break;
      case "add-column": push(4, { sql: `ALTER TABLE ${tn(c.table)} ADD ${d === "postgres" || d === "mysql" || d === "sqlite" ? "COLUMN " : ""}${columnDef(d, c.column)}`, ...(!c.column.nullable && c.column.default === undefined ? { manual: `Adding NOT NULL column ${c.column.name} without a default fails on tables that already have rows` } : {}) }); break;
      case "alter-column": for (const s of alterColumn(d, c)) push(4, s); break;
      case "change-pk": push(4, { sql: `-- Primary key of ${c.table.name} changes from (${c.from.join(", ")}) to (${c.to.join(", ")})`, manual: "Changing a primary key needs the old constraint name and may need a table rebuild; do it by hand." }); break;
      case "add-index": push(5, { sql: createIndex(d, c.table, c.index) }); break;
      case "add-fk": push(6, { sql: addFk(d, c.table, c.fk) }); break;
      default: break;
    }
  }
  // drop tables: dependents first
  const dropOrder = topoSort(dropped).order.reverse();
  for (const t of dropOrder) { for (const f of t.foreignKeys) if (d !== "sqlite") push(0, { sql: dropFk(d, t, f.name) }); push(2, { sql: `DROP TABLE ${tn(t)}`, destructive: `Drops table ${t.name} and all its rows` }); }
  const { order, cyclic } = topoSort(created);
  for (const t of order) {
    const defer = cyclic.has(lc(t.name)) && d !== "sqlite";
    const stmts = createTable(d, t, { withFks: !defer });
    stmts.forEach((s) => push(3, { sql: s }));
    if (defer) for (const f of t.foreignKeys) push(6, { sql: addFk(d, t, f) });
  }
  void opts;
  return phases.flat();
}

function alterColumn(d: Dialect, c: Extract<Change, { kind: "alter-column" }>): Statement[] {
  const q = (n: string) => quote(d, n), t = c.table, tn = t.schema && d !== "sqlite" ? `${q(t.schema)}.${q(t.name)}` : q(t.name), col = q(c.to.name);
  const out: Statement[] = [];
  const typeNarrowing = c.what.includes("type") ? { destructive: `Changing the type of ${t.name}.${c.to.name} from ${c.from.type} to ${c.to.type} may truncate or fail on existing data` } : {};
  if (d === "sqlite") return [{ sql: `-- ${tn}.${col}: ${c.what.join(", ")} change`, manual: "SQLite cannot alter a column in place; rebuild the table (create new, copy, drop, rename)." }];
  if (d === "postgres") {
    if (c.what.includes("type")) out.push({ sql: `ALTER TABLE ${tn} ALTER COLUMN ${col} TYPE ${c.to.type}`, ...typeNarrowing });
    if (c.what.includes("nullable")) out.push({ sql: `ALTER TABLE ${tn} ALTER COLUMN ${col} ${c.to.nullable ? "DROP" : "SET"} NOT NULL`, ...(!c.to.nullable ? { destructive: `SET NOT NULL fails if ${t.name}.${c.to.name} contains NULLs` } : {}) });
    if (c.what.includes("default")) out.push({ sql: c.to.default === undefined ? `ALTER TABLE ${tn} ALTER COLUMN ${col} DROP DEFAULT` : `ALTER TABLE ${tn} ALTER COLUMN ${col} SET DEFAULT ${c.to.default}` });
  } else if (d === "mysql") {
    out.push({ sql: `ALTER TABLE ${tn} MODIFY COLUMN ${columnDef(d, c.to)}`, ...typeNarrowing });
  } else if (d === "mssql") {
    if (c.what.includes("type") || c.what.includes("nullable")) out.push({ sql: `ALTER TABLE ${tn} ALTER COLUMN ${col} ${c.to.type} ${c.to.nullable ? "NULL" : "NOT NULL"}`, ...typeNarrowing });
    if (c.what.includes("default")) out.push({ sql: `-- default of ${tn}.${col} changes`, manual: "SQL Server defaults are named constraints: drop the old default constraint, then ADD CONSTRAINT ... DEFAULT." });
  } else if (d === "oracle") {
    const bits = [c.what.includes("type") ? c.to.type : "", c.what.includes("default") ? `DEFAULT ${c.to.default ?? "NULL"}` : "", c.what.includes("nullable") ? (c.to.nullable ? "NULL" : "NOT NULL") : ""].filter(Boolean).join(" ");
    out.push({ sql: `ALTER TABLE ${tn} MODIFY (${col} ${bits})`, ...typeNarrowing });
  }
  return out;
}

export function renderScript(statements: Statement[], terminator = ";"): string {
  return statements.map((s) => `${s.manual ? `-- MANUAL STEP: ${s.manual}\n` : ""}${s.destructive ? `-- WARNING (destructive): ${s.destructive}\n` : ""}${s.sql}${s.sql.startsWith("--") ? "" : terminator}`).join("\n\n") + "\n";
}
