import type { Connection } from "@rizomadb/driver-api";
import { buildModel, createScript, type Dialect } from "@rizomadb/schema-tools";

export interface TableProperties {
  columns: { name: string; type: string; nullable: boolean; pk: boolean; default?: string }[];
  indexes: { name: string; columns: string[]; unique: boolean; primary: boolean }[];
  foreignKeys: { name: string; columns: string[]; refTable: string; refSchema?: string; refColumns: string[] }[];
  referencedBy: { name: string; table: string; schema?: string; columns: string[]; refColumns: string[] }[];
  ddl: string;
}

const SQL_DIALECTS = new Set(["sqlite", "postgres", "mysql", "mssql", "oracle"]);
const lc = (s: string) => s.toLowerCase();

/** Everything the Properties, Relations and DDL tabs show about one table, read through the driver's introspection. */
export async function tableProperties(conn: Connection, dialect: string, ref: { schema?: string; name: string }): Promise<TableProperties> {
  const api = conn.introspect();
  const info = await api.describeTable({ name: ref.name, ...(ref.schema ? { schema: ref.schema } : {}) });
  const indexes = api.indexes ? (await api.indexes(ref.schema).catch(() => [])).filter((i) => lc(i.table) === lc(ref.name)) : [];
  const fks = api.foreignKeys ? await api.foreignKeys(ref.schema).catch(() => []) : [];
  const own = fks.filter((f) => lc(f.from.table) === lc(ref.name));
  const incoming = fks.filter((f) => lc(f.to.table) === lc(ref.name) && lc(f.from.table) !== lc(ref.name));
  let ddl = "";
  if (SQL_DIALECTS.has(dialect) && info.kind === "table") {
    try { ddl = createScript(buildModel(dialect as Dialect, [{ ...info, ...(ref.schema ? { schema: ref.schema } : {}) }], indexes, own)).map((s) => `${s};`).join("\n\n"); } catch { ddl = ""; }
  }
  return {
    columns: (info.columns ?? []).map((c) => ({ name: c.name, type: c.nativeType, nullable: c.nullable, pk: c.primaryKey, ...(c.default !== undefined ? { default: c.default } : {}) })),
    indexes: indexes.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique, primary: i.primary })),
    foreignKeys: own.map((f) => ({ name: f.name, columns: f.from.columns, refTable: f.to.table, ...(f.to.schema ? { refSchema: f.to.schema } : {}), refColumns: f.to.columns })),
    referencedBy: incoming.map((f) => ({ name: f.name, table: f.from.table, ...(f.from.schema ? { schema: f.from.schema } : {}), columns: f.from.columns, refColumns: f.to.columns })),
    ddl,
  };
}
