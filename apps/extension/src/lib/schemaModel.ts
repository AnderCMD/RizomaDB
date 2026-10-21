import { buildModel, diffModels, type Dialect, type SchemaModel, type TableM } from "@rizomadb/schema-tools";
import type { ConnectionManager } from "./connections.js";

/** Introspects every schema of a connection into the neutral model (views are skipped). */
export async function loadModel(mgr: ConnectionManager, id: string): Promise<SchemaModel> {
  const profile = mgr.get(id); if (!profile) throw new Error("Unknown connection");
  const conn = await mgr.connect(id);
  const driver = await mgr.loadDriver(profile.driver);
  const api = conn.introspect();
  const schemas = driver.capabilities.schemas ? (await api.listSchemas()).slice(0, 25) : [undefined];
  const tables = [], indexes = [], fks = [];
  for (const s of schemas) {
    const t = api.describeSchema ? await api.describeSchema(s) : await Promise.all((await api.listTables(s)).map((x) => api.describeTable({ name: x.name, ...(s ? { schema: s } : {}) })));
    tables.push(...t.map((x) => ({ ...x, ...(s ? { schema: s } : {}) })));
    if (api.indexes) indexes.push(...(await api.indexes(s)).map((i) => ({ ...i, ...(s ? { schema: s } : {}) })));
    if (api.foreignKeys) fks.push(...await api.foreignKeys(s));
  }
  return buildModel(profile.driver as Dialect, tables, indexes, fks);
}

export interface MissingIndex { table: string; fk: string; columns: string[] }

/** Foreign keys whose columns are not the leading columns of any index (joins and cascades scan the table). */
export function missingFkIndexes(m: SchemaModel): MissingIndex[] {
  const out: MissingIndex[] = [];
  for (const t of m.tables) for (const f of t.foreignKeys) {
    const covered = (cols: string[]) => cols.length >= f.columns.length && f.columns.every((c, i) => cols[i]?.toLowerCase() === c.toLowerCase());
    if (!covered(t.primaryKey) && !t.indexes.some((i) => covered(i.columns))) out.push({ table: t.name, fk: f.name, columns: f.columns });
  }
  return out;
}

export interface ChangeLabels { table: string; column: string; index: string; foreignKey: string; primaryKeyOf: string; on: string }
const EN: ChangeLabels = { table: "table", column: "column", index: "index", foreignKey: "foreign key", primaryKeyOf: "primary key of", on: "on" };

/** One line per difference, with the words of the UI language (English by default). */
export function describeChanges(from: SchemaModel, to: SchemaModel, L: ChangeLabels = EN): string[] {
  return diffModels(from, to).changes.map((c) => {
    switch (c.kind) {
      case "create-table": return `+ ${L.table} ${c.table.name}`;
      case "drop-table": return `- ${L.table} ${c.table.name}`;
      case "add-column": return `+ ${L.column} ${c.table.name}.${c.column.name} ${c.column.type}`;
      case "drop-column": return `- ${L.column} ${c.table.name}.${c.column.name}`;
      case "alter-column": return `~ ${L.column} ${c.table.name}.${c.to.name} (${c.what.join(", ")})`;
      case "add-index": return `+ ${L.index} ${c.index.name} ${L.on} ${c.table.name}`;
      case "drop-index": return `- ${L.index} ${c.name} ${L.on} ${c.table.name}`;
      case "add-fk": return `+ ${L.foreignKey} ${c.fk.name} ${L.on} ${c.table.name}`;
      case "drop-fk": return `- ${L.foreignKey} ${c.name} ${L.on} ${c.table.name}`;
      case "change-pk": return `~ ${L.primaryKeyOf} ${c.table.name}`;
    }
  });
}

export type { TableM };
