import { DuckDBInstance, type DuckDBConnection, type DuckDBResult } from "@duckdb/node-api";
import {
  DriverError, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin, type ExecuteRequest, type ForeignKey, type IndexInfo, type IntrospectionApi, type ResultEvent, type TableInfo, type Transaction, type Value,
} from "@rizomadb/driver-api";
import { meta, quoteIdent } from "./meta.js";

export { quoteIdent };

const SAFE_MIN = BigInt(Number.MIN_SAFE_INTEGER), SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER);

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const msg = (e as Error)?.message ?? String(e);
  const prefix = /([A-Za-z ]+?) Error:/.exec(msg)?.[1]?.trim() ?? "";
  const opt = { cause: e };
  let kind: DriverErrorKind = "unknown";
  if (/^(Parser|Catalog|Binder|Conversion|Invalid Input|Not implemented|Syntax)$/.test(prefix)) kind = "syntax";
  else if (prefix === "Constraint") kind = "constraint";
  else if (prefix === "INTERRUPT" || /interrupt/i.test(msg)) kind = "cancelled";
  else if (prefix === "IO" || /Could not open|Cannot open|lock/i.test(msg)) kind = "connection";
  else if (/permission|read-only|read only/i.test(msg)) kind = "permission";
  return new DriverError(kind, msg, opt);
}

const WRITE_RE = /\b(insert|update|delete|merge|drop|alter|create|truncate|copy|attach|detach|install|load|set|pragma|call|export|import|vacuum|checkpoint|begin|commit|rollback)\b/i;
export function isReadOnlySafe(sql: string): boolean {
  const s = sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/'(?:[^']|'')*'/g, "''");
  return /^\s*(select|with|show|describe|summarize|explain|from|values|pivot|unpivot)\b/i.test(s) && !/\b(insert|update|delete|merge|drop|alter|create|truncate|copy|attach|detach|install|load|call|export|import|vacuum|checkpoint)\b/i.test(s) && !(/^\s*explain\b/i.test(s) && /\banalyze\b/i.test(s) && WRITE_RE.test(s));
}

const kindOf = (t: string): ColumnInfo["kind"] => {
  if (/^U?(TINY|SMALL|BIG|HUGE)?INT(EGER)?(\d+)?$/.test(t)) return "integer";
  if (/^(FLOAT|DOUBLE|REAL)/.test(t)) return "float";
  if (/^DECIMAL/.test(t)) return "decimal";
  if (/^BOOL/.test(t)) return "boolean";
  if (/^(DATE|TIME|TIMESTAMP|INTERVAL)/.test(t)) return /^INTERVAL/.test(t) ? "text" : "datetime";
  if (/^(BLOB|BIT)/.test(t)) return "binary";
  if (/^(VARCHAR|UUID|ENUM)/.test(t)) return "text";
  if (/\[\]$|^(LIST|STRUCT|MAP|UNION|JSON)/.test(t)) return "json";
  return "other";
};

/** Converts DuckDB value classes to normalized Values (decimals stay exact strings, timestamps become Dates). */
function convert(v: unknown): Value {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "boolean" || typeof v === "number") return v;
  if (typeof v === "bigint") return v >= SAFE_MIN && v <= SAFE_MAX ? Number(v) : v;
  if (v instanceof Uint8Array) return v;
  const o = v as { constructor: { name: string }; micros?: bigint; days?: number; items?: unknown[]; entries?: { key: unknown; value: unknown }[]; toString(): string };
  const name = o.constructor.name;
  if (/^DuckDBTimestamp(TZ|S|MS|NS)?Value$/.test(name) && o.micros !== undefined) return new Date(Number(o.micros / 1000n));
  if (name === "DuckDBDateValue" && o.days !== undefined) return new Date(o.days * 86_400_000);
  if (name === "DuckDBBlobValue" && (o as unknown as { bytes: Uint8Array }).bytes) return (o as unknown as { bytes: Uint8Array }).bytes;
  if (name === "DuckDBListValue" || name === "DuckDBArrayValue") return { json: (o.items ?? []).map(toJson) };
  if (name === "DuckDBStructValue" || name === "DuckDBMapValue") return { json: toJson(v) };
  return o.toString();
}
function toJson(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return v >= SAFE_MIN && v <= SAFE_MAX ? Number(v) : v.toString();
  if (typeof v !== "object" || v instanceof Uint8Array) return v instanceof Uint8Array ? Buffer.from(v).toString("hex") : v;
  const o = v as { constructor: { name: string }; items?: unknown[]; entries?: unknown; micros?: bigint; days?: number; toString(): string };
  const name = o.constructor.name;
  if (name === "DuckDBListValue" || name === "DuckDBArrayValue") return (o.items ?? []).map(toJson);
  if (name === "DuckDBStructValue") return Object.fromEntries(Object.entries(o.entries ?? {}).map(([k, x]) => [k, toJson(x)]));
  if (name === "DuckDBMapValue") return Object.fromEntries(((o.entries ?? []) as { key: unknown; value: unknown }[]).map((e) => [String(toJson(e.key)), toJson(e.value)]));
  if (o.micros !== undefined) return new Date(Number(o.micros / 1000n)).toISOString();
  return o.toString();
}

async function* run(conn: DuckDBConnection, readOnly: boolean, req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
  if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
  if (readOnly && !isReadOnlySafe(req.sql)) throw new DriverError("permission", "Connection is read-only: statement rejected");
  const t0 = performance.now();
  const onAbort = () => { try { conn.interrupt(); } catch { /* connection already idle */ } };
  signal.addEventListener("abort", onAbort, { once: true });
  const batch = req.batchSize ?? 500, max = req.maxRows ?? Infinity;
  let res: DuckDBResult | undefined;
  try {
    res = await conn.stream(req.sql, (req.params ?? []).map((p) => (p instanceof Date ? p.toISOString() : p !== null && typeof p === "object" && !(p instanceof Uint8Array) && !Array.isArray(p) ? JSON.stringify((p as { json: unknown }).json) : p)) as never);
    const names = res.columnNames(), types = res.columnTypes().map((t) => t.toString());
    if (names.length) yield { type: "columns", columns: names.map((name, i): ColumnInfo => ({ name, nativeType: types[i]!, kind: kindOf(types[i]!) })) };
    let n = 0, buf: Value[][] = [];
    for (;;) {
      if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
      const chunk = await res.fetchChunk();
      if (!chunk || chunk.rowCount === 0) break;
      for (const row of chunk.getRows()) {
        buf.push(row.map(convert)); n++;
        if (buf.length >= batch) { yield { type: "rows", rows: buf }; buf = []; }
        if (n >= max) break;
      }
      if (n >= max) break;
    }
    if (buf.length) yield { type: "rows", rows: buf };
    yield { type: "done", rowCount: n, ...(names.length === 0 ? { affectedRows: Number(res.rowsChanged) } : {}), durationMs: performance.now() - t0 };
  } catch (e) {
    throw signal.aborted ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e);
  } finally { signal.removeEventListener("abort", onAbort); res?.closeSync?.(); }
}

class DuckConnection implements Connection {
  constructor(private inst: DuckDBInstance, private conn: DuckDBConnection, readonly serverInfo: Connection["serverInfo"], private readOnly: boolean) {}
  execute(req: ExecuteRequest, signal: AbortSignal) { return run(this.conn, this.readOnly, req, signal); }
  quoteIdent = quoteIdent;
  private async rows(sql: string): Promise<Record<string, unknown>[]> {
    try { return (await (await this.conn.runAndReadAll(sql)).getRowObjectsJS()) as Record<string, unknown>[]; } catch (e) { throw mapError(e); }
  }
  introspect(): IntrospectionApi {
    const sch = (s?: string) => (s ? `'${s.replaceAll("'", "''")}'` : "current_schema()");
    const tableInfo = async (schema?: string): Promise<TableInfo[]> => {
      const cols = await this.rows(`SELECT table_name t, column_name c, data_type ty, is_nullable nl, column_default d, ordinal_position o FROM information_schema.columns WHERE table_schema = ${sch(schema)} AND table_catalog = current_database() ORDER BY table_name, ordinal_position`);
      const kinds = new Map((await this.rows(`SELECT table_name t, table_type k FROM information_schema.tables WHERE table_schema = ${sch(schema)} AND table_catalog = current_database()`)).map((r) => [String(r.t), String(r.k)]));
      const pks = new Set((await this.rows(`SELECT table_name t, unnest(constraint_column_names) c FROM duckdb_constraints() WHERE constraint_type = 'PRIMARY KEY' AND schema_name = ${sch(schema)}`)).map((r) => `${r.t}.${r.c}`));
      const out = new Map<string, TableInfo>();
      for (const c of cols) {
        const t = out.get(String(c.t)) ?? { ...(schema ? { schema } : {}), name: String(c.t), kind: /VIEW/.test(kinds.get(String(c.t)) ?? "") ? "view" as const : "table" as const, columns: [] };
        t.columns!.push({ name: String(c.c), nativeType: String(c.ty), nullable: c.nl === "YES", ...(c.d ? { default: String(c.d) } : {}), primaryKey: pks.has(`${c.t}.${c.c}`) });
        out.set(String(c.t), t);
      }
      return [...out.values()];
    };
    return {
      listSchemas: async () => (await this.rows("SELECT schema_name n FROM information_schema.schemata WHERE catalog_name = current_database() AND schema_name NOT IN ('information_schema','pg_catalog') ORDER BY 1")).map((r) => String(r.n)),
      listTables: async (schema) => (await tableInfo(schema)).map(({ columns: _c, ...t }) => { void _c; return t; }),
      describeTable: async (ref) => { const t = (await tableInfo(ref.schema)).find((x) => x.name === ref.name); if (!t) throw new DriverError("unknown", `Table not found: ${ref.name}`); return t; },
      describeSchema: tableInfo,
      foreignKeys: async (schema) => (await this.rows(`SELECT constraint_name n, table_name t, constraint_column_names c, referenced_table rt, referenced_column_names rc FROM duckdb_constraints() WHERE constraint_type = 'FOREIGN KEY' AND schema_name = ${sch(schema)}`))
        .map((r): ForeignKey => ({ name: String(r.n), from: { table: String(r.t), columns: (r.c as unknown[]).map(String) }, to: { table: String(r.rt), columns: (r.rc as unknown[]).map(String) } })),
      indexes: async (schema) => {
        const out: IndexInfo[] = [];
        for (const r of await this.rows(`SELECT table_name t, constraint_type ty, constraint_column_names c, constraint_name n FROM duckdb_constraints() WHERE constraint_type IN ('PRIMARY KEY','UNIQUE') AND schema_name = ${sch(schema)}`))
          out.push({ name: String(r.ty) === "PRIMARY KEY" ? "PRIMARY" : String(r.n), table: String(r.t), columns: (r.c as unknown[]).map(String), unique: true, primary: String(r.ty) === "PRIMARY KEY" });
        for (const r of await this.rows(`SELECT index_name n, table_name t, is_unique u, expressions e, sql FROM duckdb_indexes() WHERE schema_name = ${sch(schema)}`))
          out.push({ name: String(r.n), table: String(r.t), columns: [...String(r.sql).matchAll(/\(([^)]*)\)\s*;?\s*$/g)].flatMap((m) => m[1]!.split(",").map((x) => x.trim().replace(/^"|"$/g, ""))), unique: Boolean(r.u), primary: false });
        return out;
      },
    };
  }
  async begin(): Promise<Transaction> {
    await this.rows("BEGIN TRANSACTION");
    return { execute: (req, signal) => run(this.conn, this.readOnly, req, signal), commit: async () => { await this.conn.run("COMMIT"); }, rollback: async () => { await this.conn.run("ROLLBACK"); } };
  }
  async ping() { try { await this.conn.run("SELECT 1"); } catch (e) { throw mapError(e); } }
  async close() { this.conn.closeSync(); this.inst.closeSync(); }
}

export const duckdbDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const path = String(cfg.path ?? "");
    if (!path) throw new DriverError("connection", "DuckDB: 'path' is required");
    try {
      const inst = await DuckDBInstance.create(path);
      const conn = await inst.connect();
      const v = await (await conn.runAndReadAll("SELECT version() AS v")).getRowObjectsJS();
      return new DuckConnection(inst, conn, { product: "DuckDB", version: String(v[0]!.v) }, !!cfg.readOnly);
    } catch (e) { throw new DriverError("connection", (e as Error).message, { cause: e }); }
  },
};
export { meta };
