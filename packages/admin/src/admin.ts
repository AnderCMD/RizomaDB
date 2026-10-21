import { collect, type Connection, type Value } from "@rizomadb/driver-api";
import { providers, type Engine, type MetricDef, type Provider } from "./providers.js";

export interface Table { columns: string[]; rows: Value[][] }

const sig = () => new AbortController().signal;
const asTable = async (conn: Connection, sql: string): Promise<Table> => { const r = await collect(conn.execute({ sql, maxRows: 5000 }, sig())); return { columns: r.columns.map((c) => c.name.toLowerCase()), rows: r.rows }; };

export class Admin {
  readonly p: Provider;
  constructor(private conn: Connection, engine: Engine) { this.p = providers[engine]; }
  sessions() { return asTable(this.conn, this.p.sessions); }
  locks() { return asTable(this.conn, this.p.locks); }
  async slowQueries(limit = 20): Promise<Table & { source: string }> {
    if (this.p.engine === "postgres") {
      const ext = await asTable(this.conn, "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'");
      if (!ext.rows.length) {
        const t = await asTable(this.conn, `SELECT left(query, 2000) AS query, 1 AS calls, round(extract(epoch FROM now() - query_start)::numeric * 1000, 2) AS total_ms, round(extract(epoch FROM now() - query_start)::numeric * 1000, 2) AS mean_ms, 0 AS rows FROM pg_stat_activity WHERE state = 'active' AND pid <> pg_backend_pid() AND backend_type = 'client backend' ORDER BY query_start LIMIT ${Math.min(limit, 1000)}`);
        return { ...t, source: "running queries (install the pg_stat_statements extension for history)" };
      }
    }
    return { ...(await asTable(this.conn, this.p.slow(limit))), source: this.p.engine === "postgres" ? "pg_stat_statements" : this.p.engine === "mysql" ? "performance_schema digests" : this.p.engine === "mssql" ? "sys.dm_exec_query_stats" : "v$sql" };
  }
  tableStats() { return asTable(this.conn, this.p.tableStats); }
  unusedIndexes() { return asTable(this.conn, this.p.unusedIndexes); }
  variables() { return asTable(this.conn, this.p.variables); }
  roles() { return asTable(this.conn, this.p.roles); }
  privileges(role: string) { return asTable(this.conn, this.p.privileges(role)); }
  /** Statements to run for a kill; the caller shows them and asks for confirmation first. */
  killStatements(id: string, hard: boolean) { return this.p.kill(id, hard); }
  setVariableStatements(name: string, value: string) { return this.p.setVariable(name, value); }
  metricsSnapshot() { return asTable(this.conn, this.p.metrics); }
}

/** Turns successive cumulative samples into per-second rates and ratios. */
export class MetricSampler {
  private prev?: { t: number; v: Record<string, number> };
  constructor(private defs: MetricDef[]) {}
  push(row: Record<string, number>, now = Date.now()): Record<string, number> {
    const out: Record<string, number> = {};
    const prev = this.prev;
    for (const d of this.defs) {
      if (d.kind === "gauge") out[d.name] = row[d.name] ?? 0;
      else if (d.kind === "counter" && prev) { const dt = (now - prev.t) / 1000; out[d.name] = dt > 0 ? Math.max(0, ((row[d.name] ?? 0) - (prev.v[d.name] ?? 0)) / dt) : 0; }
      else if (d.kind === "ratio" && d.of && prev) {
        const total = (row[d.of[0]] ?? 0) - (prev.v[d.of[0]] ?? 0), misses = (row[d.of[1]] ?? 0) - (prev.v[d.of[1]] ?? 0);
        // `of` is [hits-or-requests, misses]; when the first is a request counter, hits = requests - misses
        const hits = d.of[0] === "cache_hits" ? total : total - misses;
        const all = d.of[0] === "cache_hits" ? total + misses : total;
        out[d.name] = all > 0 ? (hits / all) * 100 : 100;
      }
    }
    this.prev = { t: now, v: { ...row } };
    return out;
  }
}

export function snapshotToRecord(t: Table): Record<string, number> {
  const r: Record<string, number> = {};
  t.columns.forEach((c, i) => { const v = t.rows[0]?.[i]; r[c] = typeof v === "bigint" ? Number(v) : Number(v ?? 0); });
  return r;
}
