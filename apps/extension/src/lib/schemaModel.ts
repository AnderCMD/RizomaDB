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

export function describeChanges(from: SchemaModel, to: SchemaModel): string[] {
  return diffModels(from, to).changes.map((c) => {
    switch (c.kind) {
      case "create-table": return `+ table ${c.table.name}`;
      case "drop-table": return `- table ${c.table.name}`;
      case "add-column": return `+ column ${c.table.name}.${c.column.name} ${c.column.type}`;
      case "drop-column": return `- column ${c.table.name}.${c.column.name}`;
      case "alter-column": return `~ column ${c.table.name}.${c.to.name} (${c.what.join(", ")})`;
      case "add-index": return `+ index ${c.index.name} on ${c.table.name}`;
      case "drop-index": return `- index ${c.name} on ${c.table.name}`;
      case "add-fk": return `+ foreign key ${c.fk.name} on ${c.table.name}`;
      case "drop-fk": return `- foreign key ${c.name} on ${c.table.name}`;
      case "change-pk": return `~ primary key of ${c.table.name}`;
    }
  });
}

export type { TableM };
