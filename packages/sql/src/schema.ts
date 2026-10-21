import type { ForeignKey, TableInfo } from "@rizomadb/driver-api";

export interface SchemaColumn { name: string; type: string; pk: boolean; nullable: boolean }
export interface SchemaTable { schema?: string; name: string; kind: "table" | "view"; columns: SchemaColumn[] }

const lc = (s: string) => s.toLowerCase();

/** Immutable, prefix-searchable snapshot of a database schema (built once, queried per keystroke). */
export class SchemaIndex {
  readonly tables: SchemaTable[];
  readonly foreignKeys: ForeignKey[];
  private sorted: { key: string; t: SchemaTable }[];
  private byName = new Map<string, SchemaTable[]>();

  constructor(tables: TableInfo[], fks: ForeignKey[] = []) {
    this.tables = tables.map((t) => ({
      ...(t.schema ? { schema: t.schema } : {}), name: t.name, kind: t.kind,
      columns: (t.columns ?? []).map((c) => ({ name: c.name, type: c.nativeType, pk: c.primaryKey, nullable: c.nullable })),
    }));
    this.foreignKeys = fks;
    this.sorted = this.tables.map((t) => ({ key: lc(t.name), t })).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    for (const t of this.tables) {
      const k = lc(t.name);
      const l = this.byName.get(k); if (l) l.push(t); else this.byName.set(k, [t]);
    }
  }

  find(name: string, schema?: string): SchemaTable | undefined {
    const l = this.byName.get(lc(name));
    if (!l) return undefined;
    return schema ? l.find((t) => t.schema && lc(t.schema) === lc(schema)) : l[0];
  }

  /** Binary search for the first entry >= prefix, then walk while it matches. */
  tablesWithPrefix(prefix: string, limit = 200): SchemaTable[] {
    const p = lc(prefix);
    let lo = 0, hi = this.sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.sorted[mid]!.key < p) lo = mid + 1; else hi = mid; }
    const out: SchemaTable[] = [];
    for (let i = lo; i < this.sorted.length && this.sorted[i]!.key.startsWith(p) && out.length < limit; i++) out.push(this.sorted[i]!.t);
    return out;
  }

  schemas(): string[] { return [...new Set(this.tables.map((t) => t.schema).filter((x): x is string => !!x))]; }

  /** FKs connecting a and b in either direction. */
  fksBetween(a: SchemaTable, b: SchemaTable): ForeignKey[] {
    const is = (r: { table: string; schema?: string }, t: SchemaTable) => lc(r.table) === lc(t.name) && (!r.schema || !t.schema || lc(r.schema) === lc(t.schema));
    return this.foreignKeys.filter((f) => (is(f.from, a) && is(f.to, b)) || (is(f.from, b) && is(f.to, a)));
  }
  relatedTables(t: SchemaTable): SchemaTable[] {
    const out = new Map<string, SchemaTable>();
    for (const f of this.foreignKeys) {
      const o = lc(f.from.table) === lc(t.name) ? f.to : lc(f.to.table) === lc(t.name) ? f.from : undefined;
      if (o) { const x = this.find(o.table, o.schema); if (x) out.set(lc(x.name), x); }
    }
    return [...out.values()];
  }
}
