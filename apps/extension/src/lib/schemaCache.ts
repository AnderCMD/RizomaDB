import { SchemaIndex } from "@rizomadb/sql";
import type { TableInfo, ForeignKey } from "@rizomadb/driver-api";
import type { ConnectionManager } from "./connections.js";

/** Lazily loaded, invalidatable schema snapshots per connection (feeds completion and diagnostics). */
export class SchemaCache {
  private cache = new Map<string, Promise<SchemaIndex>>();
  private ready = new Map<string, SchemaIndex>();
  constructor(private mgr: ConnectionManager, private maxSchemas = 25) {}

  /** Synchronous peek for latency-sensitive callers (diagnostics): never triggers I/O. */
  peek(id: string): SchemaIndex | undefined { return this.ready.get(id); }

  get(id: string): Promise<SchemaIndex> {
    let p = this.cache.get(id);
    if (!p) {
      p = this.load(id).then((idx) => { this.ready.set(id, idx); return idx; }, (e) => { this.cache.delete(id); throw e; });
      this.cache.set(id, p);
    }
    return p;
  }

  invalidate(id?: string) {
    if (id) { this.cache.delete(id); this.ready.delete(id); } else { this.cache.clear(); this.ready.clear(); }
  }

  private async load(id: string): Promise<SchemaIndex> {
    const conn = await this.mgr.connect(id);
    const api = conn.introspect();
    const driver = await this.mgr.loadDriver(this.mgr.get(id)!.driver);
    const schemas = driver.capabilities.schemas ? (await api.listSchemas()).slice(0, this.maxSchemas) : [undefined];
    const tables: TableInfo[] = [], fks: ForeignKey[] = [];
    for (const s of schemas) {
      if (api.describeSchema) {
        const t = await api.describeSchema(s);
        tables.push(...t.map((x) => ({ ...x, ...(s ? { schema: s } : {}) })));
      } else {
        for (const t of await api.listTables(s)) tables.push({ ...t, ...(s ? { schema: s } : {}) });
      }
      if (api.foreignKeys) fks.push(...await api.foreignKeys(s).catch(() => []));
    }
    return new SchemaIndex(tables, fks);
  }
}

export const DIALECT_OF: Record<string, "postgres" | "mysql" | "sqlite" | "mssql" | "oracle"> = {
  postgres: "postgres", mysql: "mysql", sqlite: "sqlite", mssql: "mssql", oracle: "oracle",
};
