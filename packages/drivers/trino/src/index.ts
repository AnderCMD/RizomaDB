import http from "node:http";
import https from "node:https";
import {
  DriverError, type ColumnDef, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin, type ExecuteRequest, type IntrospectionApi, type ResultEvent, type TableInfo, type Value,
} from "@rizomadb/driver-api";
import { meta, quoteIdent } from "./meta.js";
import { assessTrino, stripSql } from "./readonly.js";

export { quoteIdent, assessTrino, stripSql };

interface TrinoColumn { name: string; type: string }
interface TrinoResponse { id: string; nextUri?: string; infoUri?: string; columns?: TrinoColumn[]; data?: unknown[][]; error?: { message: string; errorName: string; errorType: string; errorLocation?: { lineNumber: number; columnNumber: number } }; updateCount?: number }
class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }

/** JSON.parse that keeps integers beyond 2^53 exact (as bigint) where the runtime exposes the source text. */
const parseJson = (text: string): unknown => JSON.parse(text, function (this: unknown, _k: string, v: unknown, ctx?: { source?: string }) {
  if (typeof v === "number" && ctx?.source && /^-?\d+$/.test(ctx.source) && !Number.isSafeInteger(v)) return BigInt(ctx.source);
  return v;
} as never);

interface Client { send(method: string, url: string, body?: string, extraHeaders?: Record<string, string>, signal?: AbortSignal): Promise<TrinoResponse>; close(): void }

function makeClient(o: { host: string; port: number; ssl: boolean; verify: boolean; headers: Record<string, string> }): Client {
  const agent = o.ssl ? new https.Agent({ keepAlive: true, rejectUnauthorized: o.verify }) : new http.Agent({ keepAlive: true });
  const lib = o.ssl ? https : http;
  return {
    close: () => agent.destroy(),
    send: (method, url, body, extra, signal) => new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(Object.assign(new Error("aborted"), { name: "AbortError" })); return; }
      const u = new URL(url, `${o.ssl ? "https" : "http"}://${o.host}:${o.port}`);
      // nextUri may carry the server's own hostname; always talk to the configured endpoint.
      const req = lib.request({ host: o.host, port: o.port, method, path: u.pathname + u.search, agent, headers: { ...o.headers, ...extra, ...(body !== undefined ? { "content-type": "text/plain", "content-length": Buffer.byteLength(body) } : {}) } }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8"); const status = res.statusCode ?? 0;
          if (status === 401 || status === 403) { reject(new HttpError(status, text.slice(0, 200) || `HTTP ${status}`)); return; }
          if (status >= 400) { reject(new HttpError(status, text.slice(0, 300) || `HTTP ${status}`)); return; }
          try { resolve((text ? parseJson(text) : { id: "" }) as TrinoResponse); } catch { reject(new HttpError(status, `Unexpected response: ${text.slice(0, 200)}`)); }
        });
      });
      const onAbort = () => req.destroy(Object.assign(new Error("aborted"), { name: "AbortError" }));
      signal?.addEventListener("abort", onAbort, { once: true });
      req.on("close", () => signal?.removeEventListener("abort", onAbort));
      req.on("error", reject);
      if (body !== undefined) req.write(body);
      req.end();
    }),
  };
}

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const msg = (e as Error)?.message ?? String(e);
  if (e instanceof HttpError) return new DriverError(e.status === 401 ? "authentication" : e.status === 403 ? "permission" : "unknown", msg, { code: String(e.status), cause: e });
  if ((e as Error)?.name === "AbortError") return new DriverError("cancelled", "Query cancelled", { cause: e });
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|socket hang up|EPIPE|certificate/i.test(`${(e as { code?: string }).code} ${msg}`)) return new DriverError("connection", msg, { cause: e });
  return new DriverError("unknown", msg, { cause: e });
}

function queryError(err: NonNullable<TrinoResponse["error"]>): DriverError {
  const n = err.errorName;
  const kind: DriverErrorKind = n === "SYNTAX_ERROR" || err.errorType === "USER_ERROR" && /NOT_FOUND|NOT_SUPPORTED|MISSING|INVALID|TYPE_MISMATCH|AMBIGUOUS|DIVISION|CAST|SCHEMA_NOT_FOUND/.test(n) ? "syntax"
    : n === "PERMISSION_DENIED" || n === "ACCESS_DENIED" ? "permission" : n === "USER_CANCELED" ? "cancelled" : /EXCEEDED_.*LIMIT|TIMEOUT/.test(n) ? "timeout" : /ALREADY_EXISTS/.test(n) ? "constraint" : "unknown";
  return new DriverError(kind, err.message, { code: n, ...(err.errorLocation ? { position: err.errorLocation.columnNumber } : {}) });
}

const base = (t: string) => t.replace(/\(.*$/, "").toLowerCase();
function kindOf(t: string): ColumnInfo["kind"] {
  switch (base(t)) {
    case "tinyint": case "smallint": case "integer": case "bigint": return "integer";
    case "real": case "double": return "float";
    case "decimal": return "decimal";
    case "boolean": return "boolean";
    case "date": case "time": case "timestamp": case "time with time zone": case "timestamp with time zone": return "datetime";
    case "varbinary": return "binary";
    case "varchar": case "char": case "uuid": case "ipaddress": return "text";
    case "json": case "array": case "map": case "row": return "json";
    default: return "other";
  }
}
function convert(t: string, v: unknown): Value {
  if (v === null || v === undefined) return null;
  switch (base(t)) {
    case "varbinary": return new Uint8Array(Buffer.from(String(v), "base64"));
    case "array": case "map": case "row": case "json": return { json: v };
    case "real": case "double": return typeof v === "string" ? Number(v) : (v as number);
    default: return v as Value;
  }
}

/** Literal for EXECUTE ... USING. Strings are quoted with doubled quotes; nothing user-supplied reaches the statement unescaped. */
function literal(v: Value): string {
  if (v === null) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") { if (!Number.isFinite(v)) throw new DriverError("syntax", "NaN and Infinity cannot be passed as parameters"); return String(v); }
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return `TIMESTAMP '${v.toISOString().replace("T", " ").replace("Z", "")}'`;
  if (v instanceof Uint8Array) return `X'${Buffer.from(v).toString("hex")}'`;
  if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
  return `JSON '${JSON.stringify((v as { json: unknown }).json).replace(/'/g, "''")}'`;
}

class TrinoConnection implements Connection {
  constructor(private c: Client, private cfg: { catalog: string; schema?: string; user: string }, readonly serverInfo: Connection["serverInfo"], private readOnly: boolean) {}
  quoteIdent = quoteIdent;
  private headers() { return { "x-trino-user": this.cfg.user, "x-trino-catalog": this.cfg.catalog, ...(this.cfg.schema ? { "x-trino-schema": this.cfg.schema } : {}), "x-trino-source": "rizomadb" }; }

  async *execute(req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const t0 = performance.now();
    let next: string | undefined;
    const kill = () => { if (next) void this.c.send("DELETE", next).catch(() => {}); };
    try {
      if (this.readOnly && assessTrino(req.sql).risk !== "none") throw new DriverError("permission", "Connection is read-only: statement rejected");
      const params = req.params ?? [];
      const sql = req.sql.trim().replace(/;+\s*$/, "");
      const extra: Record<string, string> = { ...this.headers() };
      let body = sql;
      if (params.length) { extra["x-trino-prepared-statement"] = `rz=${encodeURIComponent(sql)}`; body = `EXECUTE rz USING ${params.map(literal).join(", ")}`; }
      const max = req.maxRows ?? Infinity, batch = req.batchSize ?? 500;
      let r = await this.c.send("POST", "/v1/statement", body, extra, signal);
      let cols: TrinoColumn[] | undefined; let n = 0, buf: Value[][] = []; let affected: number | undefined;
      for (;;) {
        next = r.nextUri;
        if (r.error) throw queryError(r.error);
        if (r.columns && !cols) {
          cols = r.columns;
          yield { type: "columns", columns: cols.map((c): ColumnInfo => ({ name: c.name, nativeType: c.type, kind: kindOf(c.type) })) };
        }
        if (r.updateCount !== undefined) affected = r.updateCount;
        if (r.data && cols) {
          for (const row of r.data) {
            if (n >= max) break;
            buf.push(row.map((v, i) => convert(cols![i]!.type, v))); n++;
            if (buf.length >= batch) { yield { type: "rows", rows: buf }; buf = []; }
          }
        }
        if (n >= max && r.nextUri) { kill(); break; }
        if (!r.nextUri) break;
        if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
        r = await this.c.send("GET", r.nextUri, undefined, undefined, signal);
      }
      if (buf.length) yield { type: "rows", rows: buf };
      yield { type: "done", rowCount: n, durationMs: performance.now() - t0, ...(affected !== undefined ? { affectedRows: affected } : {}) };
    } catch (e) {
      if (signal.aborted) kill();
      throw signal.aborted && !(e instanceof DriverError && e.kind !== "cancelled") ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e);
    }
  }

  introspect(): IntrospectionApi {
    const cat = quoteIdent(this.cfg.catalog);
    const rows = async (sql: string, params?: Value[]) => {
      const out: unknown[][] = [];
      for await (const ev of this.execute({ sql, ...(params ? { params } : {}) }, new AbortController().signal)) if (ev.type === "rows") out.push(...ev.rows as unknown[][]);
      return out;
    };
    return {
      listSchemas: async () => (await rows(`SELECT schema_name FROM ${cat}.information_schema.schemata WHERE schema_name <> 'information_schema' ORDER BY 1`)).map((r) => String(r[0])),
      listTables: async (schema) => (await rows(`SELECT table_schema, table_name, table_type FROM ${cat}.information_schema.tables WHERE table_schema <> 'information_schema' ${schema ? "AND table_schema = ?" : ""} ORDER BY 1, 2`, schema ? [schema] : undefined))
        .map((r): TableInfo => ({ name: String(r[1]), schema: String(r[0]), kind: String(r[2]) === "VIEW" ? "view" : "table" })),
      describeTable: async (ref) => {
        const schema = ref.schema ?? this.cfg.schema;
        const r = await rows(`SELECT column_name, data_type, is_nullable, column_default FROM ${cat}.information_schema.columns WHERE table_name = ? ${schema ? "AND table_schema = ?" : ""} ORDER BY ordinal_position`, schema ? [ref.name, schema] : [ref.name]);
        // Trino has no enforced primary keys.
        return { name: ref.name, ...(schema ? { schema } : {}), kind: "table", columns: r.map((x): ColumnDef => ({ name: String(x[0]), nativeType: String(x[1]), nullable: String(x[2]) === "YES", primaryKey: false, ...(x[3] ? { default: String(x[3]) } : {}) })) };
      },
    };
  }

  async ping() { try { for await (const _ of this.execute({ sql: "SELECT 1" }, new AbortController().signal)) void _; } catch (e) { throw mapError(e); } }
  async close() { this.c.close(); }
}

export const trinoDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const user = String(cfg.user ?? ""); if (!user) throw new DriverError("authentication", "A user name is required.");
    const ssl = !!cfg.ssl;
    if (cfg.password && !ssl) throw new DriverError("authentication", "Trino only accepts passwords over TLS: enable \"Use TLS\".");
    const headers: Record<string, string> = cfg.password ? { authorization: `Basic ${Buffer.from(`${user}:${String(cfg.password)}`).toString("base64")}` } : {};
    const c = makeClient({ host: String(cfg.host ?? "localhost"), port: Number(cfg.port ?? 8080), ssl, verify: cfg.sslVerify !== false, headers });
    try {
      const info = await new Promise<{ nodeVersion?: { version?: string } }>((resolve, reject) => {
        const lib = ssl ? https : http;
        const req = lib.get({ host: String(cfg.host ?? "localhost"), port: Number(cfg.port ?? 8080), path: "/v1/info", headers, ...(ssl ? { rejectUnauthorized: cfg.sslVerify !== false } : {}) }, (res) => {
          const chunks: Buffer[] = []; res.on("data", (d: Buffer) => chunks.push(d));
          res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { resolve({}); } });
        });
        req.on("error", reject);
      });
      const conn = new TrinoConnection(c, { catalog: String(cfg.catalog ?? ""), user, ...(cfg.schema ? { schema: String(cfg.schema) } : {}) }, { product: "Trino", version: info.nodeVersion?.version ?? "unknown" }, !!cfg.readOnly);
      await conn.ping();
      return conn;
    } catch (e) { c.close(); throw mapError(e); }
  },
};
export { meta };
