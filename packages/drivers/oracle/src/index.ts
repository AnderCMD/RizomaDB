import oracledb from "oracledb";
import {
  DriverError, type Capabilities, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin,
  type ExecuteRequest, type IntrospectionApi, type ResultEvent, type TableInfo, type Transaction, type Value,
} from "@rizomadb/driver-api";

const capabilities: Capabilities = {
  sql: true, transactions: true, savepoints: true, multiDatabase: false, schemas: true,
  routines: true, triggers: true, cancelQuery: true, streamingResults: true,
  explain: "text", ddlGeneration: true, rowEditing: "primaryKey",
  // Oracle has no session-level read-only mode: enforced by a driver-side statement guard.
  readOnlyEnforcement: "client",
  objectTypes: ["schema", "table", "view", "index", "column"],
};

export const quoteIdent = (n: string) => `"${n.replaceAll('"', '""')}"`;

const SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER), SAFE_MIN = BigInt(Number.MIN_SAFE_INTEGER);

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const err = e as { message?: string; errorNum?: number; code?: string; offset?: number };
  const msg = err.message ?? String(e);
  const n = err.errorNum ?? Number(/ORA-(\d+)/.exec(msg)?.[1] ?? 0);
  const opt = { ...(n ? { code: `ORA-${String(n).padStart(5, "0")}` } : {}), ...(err.offset !== undefined ? { position: err.offset + 1 } : {}), cause: e };
  let kind: DriverErrorKind = "unknown";
  if ([900, 902, 903, 904, 905, 906, 907, 908, 909, 911, 923, 933, 936, 942, 955, 957, 1747].includes(n)) kind = "syntax";
  else if (n === 1017 || n === 1005 || n === 28000) kind = "authentication";
  else if ([1031, 1045, 1950, 942 + 100000].includes(n)) kind = "permission";
  else if ([1, 1400, 2290, 2291, 2292, 1407].includes(n)) kind = "constraint";
  else if (n === 1013 || /DPI-1067|call timeout|NJS-018|NJS-040/.test(msg) && /cancel/i.test(msg)) kind = "cancelled";
  else if ([12541, 12514, 12170, 12154, 12545, 3113, 3114, 3135, 12537].includes(n) || /NJS-503|NJS-500|DPY-6005|DPI-1080/.test(msg)) kind = "connection";
  return new DriverError(kind, msg, opt);
}

const WRITE_RE = /\b(insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|begin|declare|call|exec|execute|lock|commit|rollback|savepoint|rename|comment|purge|flashback|audit)\b/i;
export function isReadOnlySafe(sql: string): boolean {
  const s = sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/'(?:[^']|'')*'/g, "''");
  return /^\s*(select|with|explain)\b/i.test(s) && !WRITE_RE.test(s) && !/\bfor\s+update\b/i.test(s);
}

const isQuery = (sql: string) => /^\s*(\/\*[\s\S]*?\*\/\s*|--[^\n]*\n\s*)*(select|with)\b/i.test(sql);

/** NUMBER arrives as text so 64-bit and decimal values never pass through a JS double. */
const fetchTypeHandler = (m: { dbType?: unknown }) => (m.dbType === oracledb.DB_TYPE_NUMBER ? { type: oracledb.STRING } : undefined);

function normalize(v: unknown, dbTypeName: string): Value {
  if (v === null || v === undefined) return null;
  if (dbTypeName === "NUMBER" && typeof v === "string") {
    if (/^-?\d+$/.test(v)) { const b = BigInt(v); return b > SAFE_MAX || b < SAFE_MIN ? b : Number(b); }
    return v.startsWith(".") ? `0${v}` : v.startsWith("-.") ? `-0${v.slice(1)}` : v;
  }
  if (Buffer.isBuffer(v)) return new Uint8Array(v);
  if (typeof v === "object" && !(v instanceof Date)) return v as Value;
  return v as Value;
}

function kindOf(t: string): ColumnInfo["kind"] {
  if (t === "NUMBER") return "decimal";
  if (/FLOAT|DOUBLE/.test(t)) return "float";
  if (/CHAR|CLOB|LONG$/.test(t)) return "text";
  if (/DATE|TIMESTAMP/.test(t)) return "datetime";
  if (/RAW|BLOB/.test(t)) return "binary";
  if (t === "JSON") return "json";
  if (t === "BOOLEAN") return "boolean";
  return "other";
}

const bindOf = (v: Value) => (v === null ? { val: null, type: oracledb.STRING } : typeof v === "bigint" ? v.toString() : v instanceof Uint8Array ? Buffer.from(v) : typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) ? JSON.stringify((v as { json: unknown }).json) : v);

async function* run(conn: oracledb.Connection, state: { readOnly: boolean; inTx: boolean }, req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
  if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
  if (state.readOnly && !isReadOnlySafe(req.sql)) throw new DriverError("permission", "Connection is read-only: statement rejected");
  const t0 = performance.now();
  const sql = req.sql.replace(/;\s*$/, (m) => (/\bend\s*;?\s*$/i.test(req.sql) ? m : ""));
  const binds = (req.params ?? []).map(bindOf) as oracledb.BindParameters;
  const onAbort = () => { void conn.break().catch(() => {}); };
  signal.addEventListener("abort", onAbort, { once: true });
  const batch = req.batchSize ?? 500, max = req.maxRows ?? Infinity;
  try {
    if (!isQuery(sql)) {
      const r = await conn.execute(sql, binds, { autoCommit: !state.inTx });
      yield { type: "done", rowCount: 0, affectedRows: r.rowsAffected ?? 0, durationMs: performance.now() - t0 };
      return;
    }
    const stream = conn.queryStream(sql, binds, { fetchArraySize: Math.min(batch, 1000), outFormat: oracledb.OUT_FORMAT_ARRAY, fetchTypeHandler });
    let names: string[] = [];
    let cols: ColumnInfo[] | undefined;
    stream.on("metadata", (m: oracledb.Metadata<unknown>[]) => {
      names = m.map((x) => x.dbType?.columnTypeName ?? "");
      cols = m.map((x, i) => ({ name: x.name, nativeType: names[i]!, kind: kindOf(names[i]!) }));
    });
    let buf: Value[][] = [], n = 0, sent = false;
    for await (const row of stream as AsyncIterable<unknown[]>) {
      if (!sent && cols) { sent = true; yield { type: "columns", columns: cols }; }
      buf.push(row.map((v, i) => normalize(v, names[i] ?? "")));
      n++;
      if (buf.length >= batch) { yield { type: "rows", rows: buf }; buf = []; }
      if (n >= max) { stream.destroy(); break; }
    }
    if (!sent && cols) yield { type: "columns", columns: cols };
    if (buf.length) yield { type: "rows", rows: buf };
    yield { type: "done", rowCount: n, durationMs: performance.now() - t0 };
  } catch (e) {
    throw signal.aborted ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e);
  } finally { signal.removeEventListener("abort", onAbort); }
}

class OracleConnection implements Connection {
  private state: { readOnly: boolean; inTx: boolean };
  constructor(private conn: oracledb.Connection, readonly serverInfo: Connection["serverInfo"], readOnly: boolean) { this.state = { readOnly, inTx: false }; }
  execute(req: ExecuteRequest, signal: AbortSignal) { return run(this.conn, this.state, req, signal); }
  quoteIdent = quoteIdent;
  private async rows(sql: string, binds: Record<string, unknown> = {}): Promise<Record<string, unknown>[]> {
    try { return (await this.conn.execute(sql, binds as oracledb.BindParameters, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows as Record<string, unknown>[]; }
    catch (e) { throw mapError(e); }
  }
  introspect(): IntrospectionApi {
    return {
      listSchemas: async () => (await this.rows("select username from all_users where oracle_maintained = 'N' order by 1")).map((r) => String(r.USERNAME)),
      listTables: async (schema) => (await this.rows(
        `select owner, table_name n, 'table' k from all_tables where owner = coalesce(:s, sys_context('USERENV','CURRENT_SCHEMA'))
         union all select owner, view_name, 'view' from all_views where owner = coalesce(:s, sys_context('USERENV','CURRENT_SCHEMA')) order by 2`, { s: schema ?? null }))
        .map((r): TableInfo => ({ schema: String(r.OWNER), name: String(r.N), kind: r.K === "view" ? "view" : "table" })),
      describeTable: async (ref) => {
        const rows = await this.rows(
          `select c.column_name n, c.data_type || case when c.data_type in ('VARCHAR2','CHAR','NVARCHAR2') then '(' || c.char_length || ')' else '' end t,
                  c.nullable nl, c.data_default d,
                  (select count(*) from all_cons_columns cc join all_constraints k on k.owner = cc.owner and k.constraint_name = cc.constraint_name
                    where k.constraint_type = 'P' and cc.owner = c.owner and cc.table_name = c.table_name and cc.column_name = c.column_name) pk
           from all_tab_columns c where c.owner = coalesce(:s, sys_context('USERENV','CURRENT_SCHEMA')) and c.table_name = :t order by c.column_id`, { s: ref.schema ?? null, t: ref.name });
        if (rows.length === 0) throw new DriverError("unknown", `Table not found: ${ref.name}`);
        return {
          name: ref.name, ...(ref.schema ? { schema: ref.schema } : {}), kind: "table",
          columns: rows.map((r) => ({ name: String(r.N), nativeType: String(r.T), nullable: r.NL === "Y", ...(r.D ? { default: String(r.D).trim() } : {}), primaryKey: Number(r.PK) > 0 })),
        };
      },
    };
  }
  async begin(): Promise<Transaction> {
    this.state.inTx = true;
    const end = () => { this.state.inTx = false; };
    return {
      execute: (req, signal) => run(this.conn, this.state, req, signal),
      commit: async () => { try { await this.conn.commit(); } finally { end(); } },
      rollback: async () => { try { await this.conn.rollback(); } finally { end(); } },
    };
  }
  async ping() { try { await this.conn.ping(); } catch (e) { throw mapError(e); } }
  async close() { await this.conn.close().catch(() => {}); }
}

export const oracleDriver: DriverPlugin = {
  id: "oracle",
  displayName: "Oracle Database",
  family: "relational",
  capabilities,
  quoteIdent,
  selectTop: (t: string, n: number) => `SELECT * FROM ${t} FETCH FIRST ${n} ROWS ONLY`,
  placeholder: (i: number) => `:${i}`,
  connectionSchema: {
    type: "object", required: ["host", "service", "user"],
    properties: {
      host: { type: "string", title: "Host", default: "localhost" },
      port: { type: "number", title: "Port", default: 1521 },
      service: { type: "string", title: "Service name", description: "e.g. FREEPDB1" },
      user: { type: "string", title: "User" },
      password: { type: "string", title: "Password", secret: true },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
  async connect(cfg) {
    try {
      // Thin mode (pure JS): no Oracle Client installation required.
      const conn = await oracledb.getConnection({
        user: cfg.user as string, password: (cfg.password as string | undefined) ?? "",
        connectString: `${cfg.host as string}:${(cfg.port as number | undefined) ?? 1521}/${cfg.service as string}`,
      });
      const v = await conn.execute("select banner_full b from v$version fetch first 1 rows only").catch(() => undefined);
      const banner = String((v?.rows as unknown[][] | undefined)?.[0]?.[0] ?? conn.oracleServerVersionString ?? "");
      return new OracleConnection(conn, { product: "Oracle Database", version: conn.oracleServerVersionString ?? banner }, !!cfg.readOnly);
    } catch (e) { throw mapError(e); }
  },
};
