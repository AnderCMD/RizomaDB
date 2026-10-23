import { SchemaIndex } from "@rizomadb/sql";
import type { TableInfo, ForeignKey } from "@rizomadb/driver-api";
import type { ConnectionManager } from "./connections.js";

/** Above this many tables in a schema, completion uses table names only. */
const BIG_SCHEMA_TABLES = 1500;
const MAX_NAMES_ONLY = 5000;

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

  /** Which schemas feed completion. A server with hundreds of them (Oracle) would load for minutes, so only the user's own plus a few. */
  private pick(all: string[], profile: { options: Record<string, unknown> } | undefined): string[] {
    const mine = String(profile?.options["user"] ?? profile?.options["database"] ?? "").toLowerCase();
    const first = all.filter((s) => s.toLowerCase() === mine);
    const rest = all.filter((s) => s.toLowerCase() !== mine);
    return [...first, ...rest].slice(0, all.length > 50 ? Math.min(5, this.maxSchemas) : this.maxSchemas);
  }

  private async load(id: string): Promise<SchemaIndex> {
    const conn = await this.mgr.connect(id);
    const api = conn.introspect();
    const driver = await this.mgr.loadDriver(this.mgr.get(id)!.driver);
    const schemas = driver.capabilities.schemas ? this.pick(await api.listSchemas(), this.mgr.get(id)) : [undefined];
    const tables: TableInfo[] = [], fks: ForeignKey[] = [];
    for (const s of schemas) {
      // Names first: a schema with thousands of tables is not worth reading every column of (the answer alone can freeze the host), so completion gets table names only.
      const names = await api.listTables(s);
      const big = names.length > BIG_SCHEMA_TABLES;
      if (api.describeSchema && !big) {
        const t = await api.describeSchema(s);
        tables.push(...t.map((x) => ({ ...x, ...(s ? { schema: s } : {}) })));
      } else {
        for (const t of names.slice(0, MAX_NAMES_ONLY)) tables.push({ ...t, ...(s ? { schema: s } : {}) });
      }
      if (api.foreignKeys && !big) fks.push(...await api.foreignKeys(s).catch(() => []));
    }
    return new SchemaIndex(tables, fks);
  }
}

export const DIALECT_OF: Record<string, "postgres" | "mysql" | "sqlite" | "mssql" | "oracle"> = {
  postgres: "postgres", mysql: "mysql", sqlite: "sqlite", mssql: "mssql", oracle: "oracle",
};
