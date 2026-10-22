import http from "node:http";
import https from "node:https";
import type { IncomingMessage } from "node:http";
import {
  DriverError, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin, type ExecuteRequest, type IntrospectionApi, type ResultEvent, type TableInfo, type Value,
} from "@rizomadb/driver-api";
import { meta, quoteIdent } from "./meta.js";
import { assessCypher, stripCypher } from "./cypher.js";

export { quoteIdent, assessCypher, stripCypher };

interface Cell { type: string; value?: unknown }
class HydraError extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } }

interface Opts { host: string; port: number; ssl: boolean; verify: boolean; token: string; graph: string; cell: string; namespace?: string }

/** Integers beyond 2^53 arrive as bare JSON numbers: quote them before parsing so they stay exact. */
export const parseLossless = (text: string): unknown => JSON.parse(text.replace(/("type":\s*"(?:integer|vertex_id)",\s*"value":\s*)(-?\d{16,})/g, '$1"$2"'));
/** Request bodies: bigint parameters are written as bare JSON integers. */
export const stringifyBody = (body: unknown): string => JSON.stringify(body, (_, v) => (typeof v === "bigint" ? `__BIGINT__${v}` : v)).replace(/"__BIGINT__(-?\d+)"/g, "$1");

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const msg = (e as Error)?.message ?? String(e);
  if (e instanceof HydraError) {
    const kind: DriverErrorKind = e.status === 401 || e.code === "unauthenticated" ? "authentication"
      : e.status === 403 ? "permission" : e.status === 400 || e.status === 422 ? "syntax"
      : e.code === "resource_exhausted" ? "unknown" : "unknown";
    const hint = e.status === 500 && e.code === "internal" ? ` ${"(HydraDB answers 500 for an unknown cell id: check the Cell ID)"}` : "";
    return new DriverError(kind, `${msg}${hint}`, { code: e.code || `HTTP.${e.status}`, cause: e });
  }
  if ((e as Error)?.name === "AbortError") return new DriverError("cancelled", "Query cancelled", { cause: e });
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|socket hang up|EPIPE|certificate|self.signed/i.test(`${(e as { code?: string }).code} ${msg}`)) return new DriverError("connection", msg, { cause: e });
  return new DriverError("unknown", msg, { cause: e });
}

function makeClient(o: Opts) {
  const agent = o.ssl ? new https.Agent({ keepAlive: true, rejectUnauthorized: o.verify }) : new http.Agent({ keepAlive: true });
  const lib = o.ssl ? https : http;
  const headers = (payload?: string, ndjson = false) => ({
    authorization: `Bearer ${o.token}`, accept: ndjson ? "application/x-ndjson" : "application/json",
    ...(o.namespace ? { "x-graph-namespace": o.namespace } : {}),
    ...(payload !== undefined ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}),
  });
  const open = (method: string, path: string, body: unknown, signal: AbortSignal | undefined, ndjson: boolean) => new Promise<{ res: IncomingMessage; destroy: () => void }>((resolve, reject) => {
    if (signal?.aborted) { reject(Object.assign(new Error("aborted"), { name: "AbortError" })); return; }
    const payload = body === undefined ? undefined : stringifyBody(body);
    const req = lib.request({ host: o.host, port: o.port, method, path, agent, headers: headers(payload, ndjson) }, (res) => {
      // An abort that lands while nobody is reading the reply would otherwise surface as an uncaught 'error' on the response.
      res.on("error", () => {});
      resolve({ res, destroy: () => req.destroy() });
    });
    // Destroy without an error object: nothing may be left emitting an unhandled "error" once the reply is already being consumed.
    const onAbort = () => { reject(Object.assign(new Error("aborted"), { name: "AbortError" })); req.destroy(); };
    signal?.addEventListener("abort", onAbort, { once: true });
    req.on("close", () => signal?.removeEventListener("abort", onAbort));
    req.on("error", reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
  const readAll = async (res: IncomingMessage) => { const c: Buffer[] = []; for await (const x of res) c.push(x as Buffer); return Buffer.concat(c).toString("utf8"); };
  const fail = async (res: IncomingMessage): Promise<never> => {
    const text = await readAll(res);
    let code = "", message = text.slice(0, 300) || `HTTP ${res.statusCode}`;
    try { const j = JSON.parse(text) as { error?: { code?: string; message?: string } }; if (j.error) { code = j.error.code ?? ""; message = j.error.message ?? message; } } catch { /* framework text (422) */ }
    throw new HydraError(res.statusCode ?? 0, code, message);
  };
  const queryPath = `/v1/graphs/${encodeURIComponent(o.graph)}/query`;
  return {
    /** Streams the NDJSON reply: a header, one object per row, a summary. */
    async *stream(statement: string, parameters: Record<string, unknown> | undefined, signal: AbortSignal): AsyncGenerator<Record<string, unknown>> {
      const { res, destroy } = await open("POST", queryPath, { cell_id: o.cell, query: statement, ...(parameters ? { parameters } : {}) }, signal, true);
      if (res.statusCode !== 200) await fail(res);
      let queryId = "";
      try {
        let buf = "";
        for await (const chunk of res) {
          buf += (chunk as Buffer).toString("utf8");
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
            if (!line) continue;
            const obj = parseLossless(line) as Record<string, unknown>;
            if (obj["type"] === "header") queryId = String(obj["query_id"] ?? "");
            if (obj["error"]) { const e = obj["error"] as { code?: string; message?: string }; throw new HydraError(200, e.code ?? "", e.message ?? "query failed"); }
            yield obj;
          }
        }
        if (buf.trim()) yield parseLossless(buf.trim()) as Record<string, unknown>;
      } finally {
        if (!res.complete) {
          destroy();
          // Best effort: let the server stop the work too.
          if (queryId) void open("POST", `/v1/graphs/${encodeURIComponent(o.graph)}/queries/${encodeURIComponent(queryId)}/cancel`, { cell_id: o.cell }, undefined, false).then(({ res: r }) => r.resume(), () => {});
        }
      }
    },
    async health() { const { res } = await open("GET", "/healthz", undefined, undefined, false); if (res.statusCode !== 200) await fail(res); await readAll(res); },
    close: () => agent.destroy(),
  };
}

/** Typed cells to driver Values. Lists decode recursively; paths and anything structured stay as { json }. */
function decode(c: Cell | null | undefined): unknown {
  if (!c || typeof c !== "object") return null;
  switch (c.type) {
    case "null": return null;
    case "boolean": case "string": return c.value;
    case "integer": case "vertex_id": {
      if (typeof c.value === "string") { const b = BigInt(c.value); return b > BigInt(Number.MAX_SAFE_INTEGER) || b < BigInt(Number.MIN_SAFE_INTEGER) ? b : Number(b); }
      return c.value;
    }
    case "float": return c.value;
    case "list": return ((c.value as Cell[]) ?? []).map(decode);
    default: return c.value ?? null;
  }
}
const toValue = (v: unknown): Value => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "boolean" || typeof v === "number" || typeof v === "bigint") return v;
  return { json: v } as Value;
};
const kindOf = (c: Cell | undefined): ColumnInfo["kind"] => {
  switch (c?.type) { case "integer": case "vertex_id": return "integer"; case "float": return "float"; case "boolean": return "boolean"; case "string": return "text"; case undefined: case "null": return "other"; default: return "json"; }
};

function toParams(params?: Value[]): Record<string, unknown> | undefined {
  if (!params?.length) return undefined;
  const norm = (v: Value): unknown => v instanceof Date ? v.toISOString() : v instanceof Uint8Array ? Buffer.from(v).toString("base64") : v && typeof v === "object" && "json" in v ? (v as { json: unknown }).json : Array.isArray(v) ? v.map(norm) : v;
  return Object.fromEntries(params.map((v, i) => [`p${i + 1}`, norm(v)]));
}

class HydraConnection implements Connection {
  constructor(private c: ReturnType<typeof makeClient>, private labels: string[], readonly serverInfo: Connection["serverInfo"], private readOnly: boolean) {}
  quoteIdent = quoteIdent;

  async *execute(req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const t0 = performance.now();
    try {
      if (this.readOnly && assessCypher(req.sql).risk !== "none") throw new DriverError("permission", "Connection is read-only: statement rejected");
      const max = req.maxRows ?? Infinity, batch = req.batchSize ?? 500;
      let columns: string[] = [], emitted = false, n = 0, buf: Value[][] = [];
      const ac = new AbortController(); const onAbort = () => ac.abort(); signal.addEventListener("abort", onAbort, { once: true });
      const it = this.c.stream(req.sql, toParams(req.params), ac.signal);
      try {
        for await (const obj of it) {
          if (obj["type"] === "header") { columns = (obj["columns"] as string[]) ?? []; continue; }
          if (obj["type"] === "row") {
            const values = obj["values"] as Cell[];
            if (!emitted) { emitted = true; yield { type: "columns", columns: columns.map((name, i): ColumnInfo => ({ name, nativeType: values[i]?.type ?? "null", kind: kindOf(values[i]) })) }; }
            if (n >= max) { ac.abort(); break; }
            buf.push(values.map((c) => toValue(decode(c)))); n++;
            if (buf.length >= batch) { yield { type: "rows", rows: buf }; buf = []; }
          }
        }
      } catch (e) { if (!(ac.signal.aborted && !signal.aborted && n >= max)) throw e; }
      finally { signal.removeEventListener("abort", onAbort); }
      if (!emitted) yield { type: "columns", columns: columns.map((name): ColumnInfo => ({ name, nativeType: "null", kind: "other" })) };
      if (buf.length) yield { type: "rows", rows: buf };
      yield { type: "done", rowCount: n, durationMs: performance.now() - t0 };
    } catch (e) { throw signal.aborted ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e); }
  }

  introspect(): IntrospectionApi {
    return {
      listSchemas: async () => [],
      // HydraDB has no CALL db.labels(): the tree shows the labels the connection was configured with.
      listTables: async () => this.labels.map((name): TableInfo => ({ name, kind: "table" })),
      describeTable: async (ref) => ({ name: ref.name, kind: "table", columns: [{ name: "id", nativeType: "vertex_id", nullable: false, primaryKey: true }] }),
    };
  }

  /** A read that returns no rows on a healthy server, so it also proves the token and the cell id. */
  async ping() {
    try { for await (const _ of this.c.stream("MATCH (a {id: 0})-[:RIZOMA_PING]->(b) RETURN b.id AS id", undefined, new AbortController().signal)) void _; }
    catch (e) { throw mapError(e); }
  }
  async close() { this.c.close(); }
}

export const hydradbDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const token = String(cfg.token ?? "");
    if (!token) throw new DriverError("authentication", "A bearer token is required");
    const o: Opts = {
      host: String(cfg.host ?? "localhost"), port: Number(cfg.port ?? 8443), ssl: !!cfg.ssl, verify: cfg.sslVerify !== false, token,
      graph: String(cfg.graph ?? "default"), cell: String(cfg.cell ?? "cell-0"), ...(cfg.namespace ? { namespace: String(cfg.namespace) } : {}),
    };
    const c = makeClient(o);
    const labels = String(cfg.labels ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const conn = new HydraConnection(c, labels, { product: "HydraDB", version: "HTTP API v1" }, !!cfg.readOnly);
    try { await c.health(); await conn.ping(); return conn; } catch (e) { c.close(); throw mapError(e); }
  },
};
export { meta };
