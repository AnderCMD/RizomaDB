import http from "node:http";
import https from "node:https";
import {
  DriverError, type ColumnDef, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin, type ExecuteRequest, type IntrospectionApi, type ResultEvent, type TableInfo, type Value,
} from "@rizomadb/driver-api";
import { meta, quoteIdent } from "./meta.js";

export { quoteIdent };

class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }

interface Client { stream(method: string, path: string, body: unknown, signal?: AbortSignal): Promise<AsyncIterable<string>>; close(): void }

function makeClient(o: { host: string; port: number; ssl: boolean; verify: boolean; token?: string }): Client {
  const agent = o.ssl ? new https.Agent({ keepAlive: true, rejectUnauthorized: o.verify }) : new http.Agent({ keepAlive: true });
  const lib = o.ssl ? https : http;
  return {
    close: () => agent.destroy(),
    stream: (method, path, body, signal) => new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(Object.assign(new Error("aborted"), { name: "AbortError" })); return; }
      const payload = body === undefined ? undefined : JSON.stringify(body, (_, v) => (typeof v === "bigint" ? Number(v) : v));
      const req = lib.request({ host: o.host, port: o.port, method, path, agent, headers: { ...(o.token ? { authorization: `Bearer ${o.token}` } : {}), ...(payload !== undefined ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}) } }, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 400) {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => reject(new HttpError(status, (() => { const t = Buffer.concat(chunks).toString("utf8"); try { const j = JSON.parse(t) as { error?: string; message?: string }; return j.error ?? j.message ?? t; } catch { return t.slice(0, 400) || `HTTP ${status}`; } })())));
          return;
        }
        res.setEncoding("utf8");
        resolve((async function* () {
          try { for await (const c of res) yield c as string; }
          catch (e) { if (signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" }); throw e; }
        })());
      });
      const onAbort = () => req.destroy(Object.assign(new Error("aborted"), { name: "AbortError" }));
      signal?.addEventListener("abort", onAbort, { once: true });
      req.on("close", () => signal?.removeEventListener("abort", onAbort));
      req.on("error", reject);
      if (payload !== undefined) req.write(payload);
      req.end();
    }),
  };
}

async function readAll(it: AsyncIterable<string>): Promise<string> { let s = ""; for await (const c of it) s += c; return s; }

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const msg = (e as Error)?.message ?? String(e);
  if (e instanceof HttpError) {
    const kind: DriverErrorKind = e.status === 401 ? "authentication" : e.status === 403 ? "permission" : e.status === 400 || e.status === 404 || e.status === 422 ? "syntax" : e.status === 408 || e.status === 504 ? "timeout" : "unknown";
    return new DriverError(kind, msg, { code: String(e.status), cause: e });
  }
  if ((e as Error)?.name === "AbortError") return new DriverError("cancelled", "Query cancelled", { cause: e });
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|socket hang up|EPIPE|certificate|self.signed/i.test(`${(e as { code?: string }).code} ${msg}`)) return new DriverError("connection", msg, { cause: e });
  return new DriverError("unknown", msg, { cause: e });
}

/** Keeps integer literals beyond 2^53 exact (needs JSON.parse source access, present in current runtimes). */
const parse = (line: string): Record<string, unknown> => JSON.parse(line, function (this: unknown, _k: string, v: unknown, ctx?: { source?: string }) {
  if (typeof v === "number" && ctx?.source && /^-?\d+$/.test(ctx.source) && !Number.isSafeInteger(v)) return BigInt(ctx.source);
  return v;
} as never) as Record<string, unknown>;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const kindOfValue = (v: unknown): ColumnInfo["kind"] => (typeof v === "bigint" || (typeof v === "number" && Number.isInteger(v)) ? "integer" : typeof v === "number" ? "float" : typeof v === "boolean" ? "boolean" : typeof v === "string" ? (ISO.test(v) ? "datetime" : "text") : v && typeof v === "object" ? "json" : "other");
const toValue = (v: unknown): Value => (v === null || v === undefined ? null : typeof v === "string" && ISO.test(v) && /(?:Z|[+-]\d\d:?\d\d)$/.test(v) ? new Date(v) : typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "bigint" ? v : ({ json: v } as Value));
const DISCOVERY_ROWS = 2000;

/** Orders `time` first (the conventional timestamp column), the rest as the server sends them. */
const orderColumns = (names: string[]) => [...names.filter((n) => n === "time"), ...names.filter((n) => n !== "time")];

function paramValue(v: Value): unknown {
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return Buffer.from(v).toString("base64");
  if (v && typeof v === "object" && !Array.isArray(v)) return (v as { json: unknown }).json;
  return v;
}

class Influx3Connection implements Connection {
  constructor(private c: Client, private db: string, readonly serverInfo: Connection["serverInfo"]) {}
  quoteIdent = quoteIdent;
  private query(sql: string, db: string, params?: Value[], signal?: AbortSignal) {
    return this.c.stream("POST", "/api/v3/query_sql", { db, q: sql, format: "jsonl", ...(params?.length ? { params: Object.fromEntries(params.map((v, i) => [`p${i + 1}`, paramValue(v)])) } : {}) }, signal);
  }

  async *execute(req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const t0 = performance.now();
    try {
      const max = req.maxRows ?? Infinity, batch = req.batchSize ?? 500;
      const body = await this.query(req.sql.trim().replace(/;+\s*$/, ""), this.db, req.params, signal);
      const known: string[] = []; const kinds = new Map<string, ColumnInfo["kind"]>();
      let announced = false, dropped = false, n = 0, tail = "", out: Value[][] = []; const held: Record<string, unknown>[] = [];
      const note = (row: Record<string, unknown>) => { for (const [k, v] of Object.entries(row)) { if (!known.includes(k)) known.push(k); if (v !== null && v !== undefined && (!kinds.has(k) || kinds.get(k) === "other")) kinds.set(k, kindOfValue(v)); } };
      const emitColumns = function* (): Generator<ResultEvent> {
        announced = true; const cols = orderColumns(known); known.splice(0, known.length, ...cols);
        yield { type: "columns", columns: cols.map((name): ColumnInfo => ({ name, nativeType: kinds.get(name) ?? "unknown", kind: kinds.get(name) ?? "other" })) };
        for (const r of held.splice(0)) { out.push(known.map((c) => toValue(r[c]))); if (out.length >= batch) { yield { type: "rows", rows: out }; out = []; } }
      };
      const handle = function* (line: string): Generator<ResultEvent> {
        if (!line.trim() || n >= max) return;
        const row = parse(line); n++;
        if (announced) { if (Object.keys(row).some((k) => !known.includes(k))) dropped = true; out.push(known.map((c) => toValue(row[c]))); if (out.length >= batch) { yield { type: "rows", rows: out }; out = []; } }
        else { note(row); held.push(row); if (held.length >= DISCOVERY_ROWS) yield* emitColumns(); }
      };
      for await (const chunk of body) {
        if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
        tail += chunk; const lines = tail.split("\n"); tail = lines.pop() ?? "";
        for (const l of lines) yield* handle(l);
        if (n >= max && announced) break;
      }
      if (tail) yield* handle(tail);
      if (!announced) yield* emitColumns();
      if (out.length) yield { type: "rows", rows: out };
      if (dropped) yield { type: "message", text: "Rows have different columns: those that first appeared after the first 2000 rows are not shown." };
      yield { type: "done", rowCount: n, durationMs: performance.now() - t0 };
    } catch (e) { throw signal.aborted && !(e instanceof DriverError && e.kind !== "cancelled") ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e); }
  }

  introspect(): IntrospectionApi {
    const rows = async (sql: string, db = this.db, params?: Value[]) => {
      try { return (await readAll(await this.query(sql, db, params))).split("\n").filter(Boolean).map((l) => parse(l)); } catch (e) { throw mapError(e); }
    };
    return {
      listSchemas: async () => [],
      listTables: async () => (await rows("SELECT table_name FROM information_schema.tables WHERE table_schema = 'iox' ORDER BY table_name")).map((r): TableInfo => ({ name: String(r.table_name), kind: "table" })),
      describeTable: async (ref) => {
        const r = await rows("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'iox' AND table_name = $p1 ORDER BY ordinal_position", this.db, [ref.name]);
        return { name: ref.name, kind: "table", columns: r.map((x): ColumnDef => ({ name: String(x.column_name), nativeType: String(x.data_type), nullable: String(x.is_nullable) === "YES", primaryKey: String(x.column_name) === "time" })) };
      },
    };
  }

  async ping() { try { await readAll(await this.query("SELECT 1", this.db)); } catch (e) { throw mapError(e); } }
  async close() { this.c.close(); }
}

export const influxdb3Driver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const host = String(cfg.host ?? "localhost"), port = Number(cfg.port ?? 8181), ssl = !!cfg.ssl;
    const token = cfg.token ? String(cfg.token) : undefined;
    const c = makeClient({ host, port, ssl, verify: cfg.sslVerify !== false, ...(token ? { token } : {}) });
    try {
      const info = JSON.parse(await readAll(await c.stream("GET", "/ping", undefined))) as { product_name?: string; version?: string };
      const conn = new Influx3Connection(c, String(cfg.database ?? ""), { product: info.product_name ?? "InfluxDB 3", version: info.version ?? "unknown" });
      await conn.ping();
      return conn;
    } catch (e) { c.close(); throw mapError(e); }
  },
};
export { meta };
