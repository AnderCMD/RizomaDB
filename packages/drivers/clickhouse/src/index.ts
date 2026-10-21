import { createClient, ClickHouseError, type ClickHouseClient } from "@clickhouse/client";
import { randomUUID } from "node:crypto";
import {
  DriverError, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin, type ExecuteRequest, type IndexInfo, type IntrospectionApi, type ResultEvent, type TableInfo, type Value,
} from "@rizomadb/driver-api";
import { meta, quoteIdent } from "./meta.js";

export { quoteIdent };

const SAFE_MIN = BigInt(Number.MIN_SAFE_INTEGER), SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER);

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const err = e as { code?: string | number; message?: string; type?: string; name?: string };
  const msg = err.message ?? String(e);
  const code = Number(err.code);
  const opt = { ...(err.code !== undefined ? { code: String(err.code) } : {}), cause: e };
  let kind: DriverErrorKind = "unknown";
  if (e instanceof ClickHouseError || Number.isFinite(code)) {
    if ([62, 60, 47, 81, 46, 36, 53, 43, 42, 38, 27, 6, 70].includes(code)) kind = "syntax";
    else if (code === 516 || code === 193) kind = "authentication";
    else if (code === 497 || code === 164) kind = "permission";
    else if (code === 394) kind = "cancelled";
    else if (code === 159 || code === 160) kind = "timeout";
    else if (code === 57 || code === 253) kind = "constraint";
  }
  if (kind === "unknown" && (err.name === "AbortError" || /abort/i.test(msg))) kind = "cancelled";
  else if (kind === "unknown" && /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|socket hang up|Timeout error/i.test(`${err.code} ${msg}`)) kind = "connection";
  return new DriverError(kind, msg, opt);
}

function kindOf(t: string): ColumnInfo["kind"] {
  const b = t.replace(/^(Nullable|LowCardinality)\((.*)\)$/, "$2").replace(/^(Nullable|LowCardinality)\((.*)\)$/, "$2");
  if (/^U?Int(8|16|32|64|128|256)$/.test(b)) return "integer";
  if (/^Float/.test(b)) return "float";
  if (/^Decimal/.test(b)) return "decimal";
  if (/^Bool/.test(b)) return "boolean";
  if (/^(Date|DateTime)/.test(b)) return "datetime";
  if (/^(String|FixedString|UUID|Enum|IPv)/.test(b)) return "text";
  if (/^(Array|Map|Tuple|Object|JSON|Nested)/.test(b)) return "json";
  return "other";
}

function convert(v: unknown, type: string): Value {
  if (v === null || v === undefined) return null;
  const k = kindOf(type);
  if (k === "integer") {
    if (typeof v === "string") { const b = BigInt(v); return b >= SAFE_MIN && b <= SAFE_MAX ? Number(b) : b; }
    return v as number;
  }
  if (k === "boolean") return typeof v === "boolean" ? v : v === 1 || v === "true";
  if (typeof v === "object") return { json: v };
  return v as Value;
}

class ClickHouseConnection implements Connection {
  constructor(private client: ClickHouseClient, readonly serverInfo: Connection["serverInfo"], private db: string) {}
  quoteIdent = quoteIdent;

  async *execute(req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const t0 = performance.now();
    const queryId = randomUUID();
    const killer = () => { void this.client.command({ query: `KILL QUERY WHERE query_id = '${queryId}' ASYNC` }).catch(() => {}); };
    signal.addEventListener("abort", killer, { once: true });
    const isRead = /^\s*(\/\*[\s\S]*?\*\/\s*|--[^\n]*\n\s*)*(select|with|show|describe|desc|explain|exists)\b/i.test(req.sql);
    try {
      const params = Object.fromEntries((req.params ?? []).map((v, i) => [`p${i + 1}`, v === null ? null : v instanceof Date ? v.toISOString().replace("T", " ").replace("Z", "") : typeof v === "object" ? JSON.stringify(v) : v]));
      if (!isRead) {
        await this.client.command({ query: req.sql.replace(/;\s*$/, ""), query_id: queryId, abort_signal: signal, query_params: params });
        yield { type: "done", rowCount: 0, affectedRows: 0, durationMs: performance.now() - t0 };
        return;
      }
      const rs = await this.client.query({ query: req.sql.replace(/;\s*$/, ""), format: "JSONCompactEachRowWithNamesAndTypes", query_id: queryId, abort_signal: signal, query_params: params });
      const batch = req.batchSize ?? 500, max = req.maxRows ?? Infinity;
      let names: string[] = [], types: string[] = [], line = 0, n = 0, buf: Value[][] = [];
      for await (const rows of rs.stream()) {
        for (const r of rows) {
          const parsed = r.json() as unknown[];
          if (line === 0) { names = parsed as string[]; line++; continue; }
          if (line === 1) { types = parsed as string[]; line++; yield { type: "columns", columns: names.map((nm, i): ColumnInfo => ({ name: nm, nativeType: types[i]!, kind: kindOf(types[i]!) })) }; continue; }
          buf.push(parsed.map((v, i) => convert(v, types[i]!))); n++;
          if (buf.length >= batch) { yield { type: "rows", rows: buf }; buf = []; }
          if (n >= max) { rs.close(); break; }
        }
        if (n >= max) break;
      }
      if (line < 2 && names.length) yield { type: "columns", columns: names.map((nm, i) => ({ name: nm, nativeType: types[i] ?? "String", kind: kindOf(types[i] ?? "String") })) };
      if (buf.length) yield { type: "rows", rows: buf };
      yield { type: "done", rowCount: n, durationMs: performance.now() - t0 };
    } catch (e) {
      throw signal.aborted ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e);
    } finally { signal.removeEventListener("abort", killer); }
  }

  introspect(): IntrospectionApi {
    const rows = async (query: string, params: Record<string, unknown> = {}) => (await (await this.client.query({ query, format: "JSONEachRow", query_params: params })).json()) as Record<string, unknown>[];
    const sch = (s?: string) => s ?? this.db;
    return {
      listSchemas: async () => (await rows("SELECT name FROM system.databases WHERE name NOT IN ('system','INFORMATION_SCHEMA','information_schema') ORDER BY name")).map((r) => String(r.name)),
      listTables: async (schema) => (await rows("SELECT name, engine FROM system.tables WHERE database = {d:String} AND NOT startsWith(name, '.inner') ORDER BY name", { d: sch(schema) })).map((r): TableInfo => ({ schema: sch(schema), name: String(r.name), kind: /View/.test(String(r.engine)) ? "view" : "table" })),
      describeTable: async (ref) => {
        const cols = await rows("SELECT name, type, default_expression, is_in_primary_key FROM system.columns WHERE database = {d:String} AND table = {t:String} ORDER BY position", { d: sch(ref.schema), t: ref.name });
        if (!cols.length) throw new DriverError("unknown", `Table not found: ${ref.name}`);
        return { schema: sch(ref.schema), name: ref.name, kind: "table", columns: cols.map((c) => ({ name: String(c.name), nativeType: String(c.type), nullable: /^Nullable\(/.test(String(c.type)), ...(c.default_expression ? { default: String(c.default_expression) } : {}), primaryKey: Number(c.is_in_primary_key) === 1 })) };
      },
      describeSchema: async (schema) => {
        const cols = await rows("SELECT c.table AS t, t.engine AS e, c.name AS name, c.type AS type, c.default_expression AS def, c.is_in_primary_key AS pk FROM system.columns c JOIN system.tables t ON t.database = c.database AND t.name = c.table WHERE c.database = {d:String} ORDER BY c.table, c.position", { d: sch(schema) });
        const out = new Map<string, TableInfo>();
        for (const c of cols) {
          const t = out.get(String(c.t)) ?? { schema: sch(schema), name: String(c.t), kind: /View/.test(String(c.e)) ? "view" as const : "table" as const, columns: [] };
          t.columns!.push({ name: String(c.name), nativeType: String(c.type), nullable: /^Nullable\(/.test(String(c.type)), ...(c.def ? { default: String(c.def) } : {}), primaryKey: Number(c.pk) === 1 });
          out.set(String(c.t), t);
        }
        return [...out.values()];
      },
      foreignKeys: async () => [],
      indexes: async (schema) => {
        const out: IndexInfo[] = [];
        for (const r of await rows("SELECT name, primary_key, sorting_key FROM system.tables WHERE database = {d:String} AND primary_key != ''", { d: sch(schema) }))
          out.push({ name: "PRIMARY", schema: sch(schema), table: String(r.name), columns: String(r.primary_key).split(",").map((x) => x.trim()), unique: false, primary: true });
        for (const r of await rows("SELECT table, name, expr FROM system.data_skipping_indices WHERE database = {d:String}", { d: sch(schema) }))
          out.push({ name: String(r.name), schema: sch(schema), table: String(r.table), columns: [String(r.expr)], unique: false, primary: false });
        return out;
      },
    };
  }

  async ping() { try { await this.client.ping(); const r = await this.client.query({ query: "SELECT 1", format: "JSONEachRow" }); await r.json(); } catch (e) { throw mapError(e); } }
  async close() { await this.client.close(); }
}

export const clickhouseDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const proto = cfg.ssl ? "https" : "http";
    const client = createClient({
      url: `${proto}://${String(cfg.host ?? "localhost")}:${Number(cfg.port ?? (cfg.ssl ? 8443 : 8123))}`,
      username: String(cfg.user ?? "default"), password: String(cfg.password ?? ""), database: String(cfg.database ?? "default"),
      application: "RizomaDB", request_timeout: 300_000,
      clickhouse_settings: { ...(cfg.readOnly ? { readonly: "2" as const } : {}), output_format_json_quote_64bit_integers: 1, date_time_output_format: "iso" as const },
      ...(cfg.ssl && cfg.sslVerify === false ? { tls: undefined } : {}),
    });
    try {
      const rs = await client.query({ query: "SELECT version() AS v, currentDatabase() AS d", format: "JSONEachRow" });
      const [row] = (await rs.json()) as { v: string; d: string }[];
      return new ClickHouseConnection(client, { product: "ClickHouse", version: row!.v }, row!.d);
    } catch (e) { await client.close().catch(() => {}); throw mapError(e); }
  },
};
export { meta };
