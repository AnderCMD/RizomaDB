import http from "node:http";
import https from "node:https";
import {
  DriverError, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin, type ExecuteRequest, type IntrospectionApi, type ResultEvent, type TableInfo, type Value,
} from "@rizomadb/driver-api";
import { meta, quoteIdent } from "./meta.js";
import { assessFlux, stripFlux } from "./flux.js";
import { CsvReader } from "./csv.js";

export { quoteIdent, assessFlux, stripFlux, CsvReader };

class HttpError extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } }

interface Client {
  /** Resolves when headers arrive (errors become HttpError); the body is yielded in chunks. */
  stream(method: string, path: string, body: unknown, accept: string, signal?: AbortSignal): Promise<AsyncIterable<string>>;
  close(): void;
}

function makeClient(o: { host: string; port: number; ssl: boolean; verify: boolean; token: string }): Client {
  const agent = o.ssl ? new https.Agent({ keepAlive: true, rejectUnauthorized: o.verify }) : new http.Agent({ keepAlive: true });
  const lib = o.ssl ? https : http;
  return {
    close: () => agent.destroy(),
    stream: (method, path, body, accept, signal) => new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(Object.assign(new Error("aborted"), { name: "AbortError" })); return; }
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = lib.request({ host: o.host, port: o.port, method, path, agent, headers: { authorization: `Token ${o.token}`, accept, ...(payload !== undefined ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}) } }, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 400) {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => { const t = Buffer.concat(chunks).toString("utf8"); let j: { code?: string; message?: string } = {}; try { j = JSON.parse(t); } catch { /* plain text */ } reject(new HttpError(status, j.code ?? `http ${status}`, j.message ?? (t.slice(0, 300) || `HTTP ${status}`))); });
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
    const kind: DriverErrorKind = e.status === 401 ? "authentication" : e.status === 403 ? "permission" : e.status === 404 || e.status === 400 || e.status === 422 ? "syntax" : e.status === 408 || e.status === 504 ? "timeout" : "unknown";
    return new DriverError(kind, msg, { code: e.code, cause: e });
  }
  if ((e as Error)?.name === "AbortError") return new DriverError("cancelled", "Query cancelled", { cause: e });
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|socket hang up|EPIPE|certificate|self.signed/i.test(`${(e as { code?: string }).code} ${msg}`)) return new DriverError("connection", msg, { cause: e });
  return new DriverError("unknown", msg, { cause: e });
}

function convert(type: string, s: string): Value {
  if (s === "" && type !== "string") return null;
  switch (type) {
    case "long": case "unsignedLong": { const b = BigInt(s); return b > BigInt(Number.MAX_SAFE_INTEGER) || b < BigInt(Number.MIN_SAFE_INTEGER) ? b : Number(b); }
    case "double": return s === "+Inf" ? Infinity : s === "-Inf" ? -Infinity : Number(s);
    case "boolean": return s === "true";
    case "base64Binary": return new Uint8Array(Buffer.from(s, "base64"));
    default: return type.startsWith("dateTime") ? new Date(s) : s;
  }
}
const kindOf = (t: string): ColumnInfo["kind"] => (t === "long" || t === "unsignedLong" ? "integer" : t === "double" ? "float" : t === "boolean" ? "boolean" : t.startsWith("dateTime") ? "datetime" : t === "base64Binary" ? "binary" : "text");

const SKIP = new Set(["result", "table"]);
const DISCOVERY_ROWS = 2000;

/** Parses annotated CSV (datatype annotation + header) from a streaming response into driver events. */
async function* csvToEvents(body: AsyncIterable<string>, req: ExecuteRequest, signal: AbortSignal, t0: number): AsyncGenerator<ResultEvent> {
  const max = req.maxRows ?? Infinity, batch = req.batchSize ?? 500;
  const reader = new CsvReader();
  let types: string[] | undefined, header: string[] | undefined, expectError = false;
  const known: string[] = []; const typeOf = new Map<string, string>();
  let announced = false, dropped = false, n = 0, out: Value[][] = [];
  const held: Record<string, Value>[] = [];
  const emitColumns = function* (): Generator<ResultEvent> {
    announced = true;
    yield { type: "columns", columns: known.map((name): ColumnInfo => ({ name, nativeType: typeOf.get(name) ?? "string", kind: kindOf(typeOf.get(name) ?? "string") })) };
    for (const r of held.splice(0)) { out.push(known.map((c) => r[c] ?? null)); if (out.length >= batch) { yield { type: "rows", rows: out }; out = []; } }
  };
  const handle = function* (rec: string[]): Generator<ResultEvent> {
    if (expectError) throw new HttpError(500, "flux-error", rec[0] ?? "query failed");
    if (rec.length === 1 && rec[0] === "") { types = undefined; header = undefined; return; } // table boundary
    if (rec[0] === "#datatype") { types = rec.slice(1); return; }
    if (rec[0]?.startsWith("#")) return;
    if (!header) {
      if (rec[1] === "error" && rec[2] === "reference") { expectError = true; return; }
      header = rec; return;
    }
    if (n >= max) return;
    const row: Record<string, Value> = {};
    for (let i = 1; i < header.length; i++) {
      const name = header[i]!; if (SKIP.has(name)) continue;
      const ty = types?.[i - 1] ?? "string";
      if (!typeOf.has(name)) { if (announced) { dropped = true; continue; } known.push(name); typeOf.set(name, ty); }
      row[name] = convert(ty, rec[i] ?? "");
    }
    n++;
    if (announced) { out.push(known.map((c) => row[c] ?? null)); if (out.length >= batch) { yield { type: "rows", rows: out }; out = []; } }
    else { held.push(row); if (held.length >= DISCOVERY_ROWS) yield* emitColumns(); }
  };
  for await (const chunk of body) {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    for (const rec of reader.push(chunk)) yield* handle(rec);
    if (n >= max && announced) break;
  }
  for (const rec of reader.end()) yield* handle(rec);
  if (!announced) yield* emitColumns();
  if (out.length) yield { type: "rows", rows: out };
  if (dropped) yield { type: "message", text: "Series have different tags and fields: columns that first appeared after the first 2000 rows are not shown. Use pivot() or keep() to fix the column set." };
  yield { type: "done", rowCount: n, durationMs: performance.now() - t0 };
}

class InfluxConnection implements Connection {
  constructor(private c: Client, private org: string, readonly serverInfo: Connection["serverInfo"], private readOnly: boolean) {}
  quoteIdent = quoteIdent;
  private queryPath = () => `/api/v2/query?org=${encodeURIComponent(this.org)}`;
  private flux(query: string, signal?: AbortSignal) {
    return this.c.stream("POST", this.queryPath(), { query, type: "flux", dialect: { annotations: ["datatype"], header: true, delimiter: ",", commentPrefix: "#", dateTimeFormat: "RFC3339" } }, "application/csv", signal);
  }

  async *execute(req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const t0 = performance.now();
    try {
      if (req.params?.length) throw new DriverError("syntax", "Flux has no positional parameters: write the values into the script.");
      if (this.readOnly && assessFlux(req.sql).risk !== "none") throw new DriverError("permission", "Connection is read-only: script rejected");
      yield* csvToEvents(await this.flux(req.sql, signal), req, signal, t0);
    } catch (e) { throw signal.aborted && !(e instanceof DriverError && e.kind !== "cancelled") ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e); }
  }

  introspect(): IntrospectionApi {
    const rows = async (script: string): Promise<string[][]> => {
      try {
        const text = await readAll(await this.flux(script));
        const r = new CsvReader(); const recs = [...r.push(text), ...r.end()];
        const out: string[][] = []; let header: string[] | undefined;
        for (const rec of recs) { if (rec.length === 1 && rec[0] === "") { header = undefined; continue; } if (rec[0]?.startsWith("#")) continue; if (!header) { header = rec; continue; } out.push(rec); }
        return out;
      } catch (e) { throw mapError(e); }
    };
    const lit = (s: string) => JSON.stringify(s);
    return {
      listSchemas: async () => (await rows('buckets() |> filter(fn: (r) => r.name !~ /^_/) |> keep(columns: ["name"])')).map((r) => r[3]!).sort(),
      listTables: async (bucket) => {
        if (!bucket) return [];
        return (await rows(`import "influxdata/influxdb/schema"\nschema.measurements(bucket: ${lit(bucket)}, start: time(v: 0))`)).map((r) => r[3]!).sort().map((name): TableInfo => ({ name, schema: bucket, kind: "table" }));
      },
      describeTable: async (ref) => {
        const bucket = ref.schema ?? ""; const m = lit(ref.name);
        const tags = (await rows(`import "influxdata/influxdb/schema"\nschema.measurementTagKeys(bucket: ${lit(bucket)}, measurement: ${m}, start: time(v: 0))`)).map((r) => r[3]!).filter((t) => !t.startsWith("_"));
        const fields = (await rows(`import "influxdata/influxdb/schema"\nschema.measurementFieldKeys(bucket: ${lit(bucket)}, measurement: ${m}, start: time(v: 0))`)).map((r) => r[3]!);
        return { name: ref.name, schema: bucket, kind: "table", columns: [
          { name: "_time", nativeType: "dateTime", nullable: false, primaryKey: false },
          ...tags.map((n) => ({ name: n, nativeType: "tag", nullable: true, primaryKey: false })),
          ...fields.map((n) => ({ name: n, nativeType: "field", nullable: true, primaryKey: false })),
        ] };
      },
    };
  }

  async ping() { try { await readAll(await this.flux("buckets() |> limit(n: 1)")); } catch (e) { throw mapError(e); } }
  async close() { this.c.close(); }
}

export const influxdbDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const c = makeClient({ host: String(cfg.host ?? "localhost"), port: Number(cfg.port ?? 8086), ssl: !!cfg.ssl, verify: cfg.sslVerify !== false, token: String(cfg.token ?? "") });
    try {
      const health = JSON.parse(await readAll(await c.stream("GET", "/health", undefined, "application/json"))) as { version?: string; name?: string };
      const conn = new InfluxConnection(c, String(cfg.org ?? ""), { product: "InfluxDB", version: String(health.version ?? "").replace(/^v/, "") }, !!cfg.readOnly);
      await conn.ping();
      return conn;
    } catch (e) { c.close(); throw mapError(e); }
  },
};
export { meta };
