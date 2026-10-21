import type { ForeignKey, IndexInfo, TableInfo } from "@rizomadb/driver-api";

export type Dialect = "sqlite" | "postgres" | "mysql" | "mssql" | "oracle";

export interface ColumnM { name: string; type: string; nullable: boolean; default?: string; identity?: boolean; comment?: string }
export interface IndexM { name: string; columns: string[]; unique: boolean }
export interface FkM { name: string; columns: string[]; refSchema?: string; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }
export interface TableM {
  schema?: string; name: string; columns: ColumnM[]; primaryKey: string[]; indexes: IndexM[]; foreignKeys: FkM[]; comment?: string;
}
export interface SchemaModel { dialect: Dialect; tables: TableM[] }

const lc = (s: string) => s.toLowerCase();

/** Builds the neutral model from what the drivers introspect (views are excluded: they are not designed here). */
export function buildModel(dialect: Dialect, tables: TableInfo[], indexes: IndexInfo[] = [], fks: ForeignKey[] = []): SchemaModel {
  const out: TableM[] = tables.filter((t) => t.kind === "table").map((t) => {
    const cols = t.columns ?? [];
    const fkList = fks.filter((f) => lc(f.from.table) === lc(t.name)).map((f): FkM => ({
      name: f.name, columns: f.from.columns, ...(f.to.schema ? { refSchema: f.to.schema } : {}), refTable: f.to.table, refColumns: f.to.columns,
    }));
    const idx = indexes.filter((i) => lc(i.table) === lc(t.name) && !i.primary)
      // MySQL silently creates an index named after each FK; it is not something the user designed.
      .filter((i) => !(dialect === "mysql" && fkList.some((f) => lc(f.name) === lc(i.name))))
      .map((i): IndexM => ({ name: i.name, columns: i.columns, unique: i.unique }));
    return {
      ...(t.schema ? { schema: t.schema } : {}), name: t.name,
      columns: cols.map((c): ColumnM => ({ name: c.name, type: c.nativeType, nullable: c.nullable, ...(c.default !== undefined ? { default: c.default } : {}) })),
      primaryKey: cols.filter((c) => c.primaryKey).map((c) => c.name), indexes: idx, foreignKeys: fkList,
    };
  });
  return { dialect, tables: out };
}

export const tableKey = (t: { schema?: string; name: string }) => lc(t.name);

/** Tables ordered so every referenced table precedes the tables that reference it; cycles are reported. */
export function topoSort(tables: TableM[]): { order: TableM[]; cyclic: Set<string> } {
  const byName = new Map(tables.map((t) => [lc(t.name), t]));
  const state = new Map<string, 0 | 1 | 2>();
  const order: TableM[] = [], cyclic = new Set<string>();
  const visit = (t: TableM) => {
    const k = lc(t.name);
    if (state.get(k) === 2) return;
    if (state.get(k) === 1) { cyclic.add(k); return; }
    state.set(k, 1);
    for (const f of t.foreignKeys) { const d = byName.get(lc(f.refTable)); if (d && d !== t) visit(d); }
    state.set(k, 2); order.push(t);
  };
  [...tables].sort((a, b) => (lc(a.name) < lc(b.name) ? -1 : 1)).forEach(visit);
  return { order, cyclic };
}
