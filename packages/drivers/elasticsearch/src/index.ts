import http from "node:http";
import https from "node:https";
import {
  DriverError, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin, type ExecuteRequest, type IndexInfo, type IntrospectionApi, type ResultEvent, type TableInfo, type Value,
} from "@rizomadb/driver-api";
import { meta, quoteIdent } from "./meta.js";
import { assessConsole, ConsoleSyntaxError, parseConsole, type ConsoleRequest } from "./console.js";

export { quoteIdent, assessConsole, parseConsole, ConsoleSyntaxError };

class HttpError extends Error { constructor(readonly status: number, message: string, readonly body: unknown) { super(message); } }

interface Client { request(req: { method: string; path: string; body?: unknown; rawBody?: string; signal?: AbortSignal }): Promise<{ status: number; json: unknown; text: string }>; close(): void }

function makeClient(o: { host: string; port: number; ssl: boolean; verify: boolean; headers: Record<string, string> }): Client {
  const agent = o.ssl ? new https.Agent({ keepAlive: true, rejectUnauthorized: o.verify }) : new http.Agent({ keepAlive: true });
  return {
    close: () => agent.destroy(),
    request: ({ method, path, body, rawBody, signal }) => new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(Object.assign(new Error("aborted"), { name: "AbortError" })); return; }
      const payload = rawBody ?? (body === undefined ? undefined : JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
      const lib = o.ssl ? https : http;
      const req = lib.request({ host: o.host, port: o.port, method, path, agent, headers: { accept: "application/json", ...(payload !== undefined ? { "content-type": rawBody ? "application/x-ndjson" : "application/json", "content-length": Buffer.byteLength(payload) } : {}), ...o.headers } }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8"); let json: unknown = undefined;
          try { json = text ? JSON.parse(text) : undefined; } catch { /* non-JSON (cat APIs) */ }
          if ((res.statusCode ?? 0) >= 400) reject(new HttpError(res.statusCode ?? 0, errMessage(json, text, res.statusCode), json)); else resolve({ status: res.statusCode ?? 0, json, text });
        });
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

function errMessage(json: unknown, text: string, status?: number): string {
  const e = (json as { error?: { reason?: string; type?: string; root_cause?: { reason?: string }[] } | string } | undefined)?.error;
  if (typeof e === "string") return e;
  if (e) return `${e.type ?? "error"}: ${e.root_cause?.[0]?.reason ?? e.reason ?? ""}`.trim();
  return text.slice(0, 300) || `HTTP ${status}`;
}

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  if (e instanceof ConsoleSyntaxError) return new DriverError("syntax", e.message, { position: e.position + 1, cause: e });
  const msg = (e as Error)?.message ?? String(e);
  if (e instanceof HttpError) {
    const t = (e.body as { error?: { type?: string } } | undefined)?.error?.type ?? "";
    const kind: DriverErrorKind = e.status === 401 ? "authentication" : e.status === 403 ? "permission" : e.status === 404 || e.status === 400 || /parsing_exception|query_shard|illegal_argument|index_not_found|x_content_parse/.test(t) ? "syntax" : e.status === 409 ? "constraint" : e.status === 408 || /timeout/.test(t) ? "timeout" : "unknown";
    return new DriverError(kind, msg, { code: String(e.status), cause: e });
  }
  if ((e as Error)?.name === "AbortError") return new DriverError("cancelled", "Query cancelled", { cause: e });
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|socket hang up|EPIPE|certificate|self.signed/i.test(`${(e as { code?: string }).code} ${msg}`)) return new DriverError("connection", msg, { cause: e });
  return new DriverError("unknown", msg, { cause: e });
}

const bsonish = (v: unknown): Value => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "number") return v;
  return { json: v };
};
const kindOfValue = (v: unknown): ColumnInfo["kind"] => (typeof v === "number" ? (Number.isInteger(v) ? "integer" : "float") : typeof v === "boolean" ? "boolean" : typeof v === "string" ? "text" : v && typeof v === "object" ? "json" : "other");

async function* docsToEvents(docs: Record<string, unknown>[], extra: AsyncIterable<Record<string, unknown>[]> | undefined, req: ExecuteRequest, signal: AbortSignal, t0: number): AsyncGenerator<ResultEvent> {
  const max = req.maxRows ?? Infinity, batch = req.batchSize ?? 500;
  const names: string[] = [];
  const note = (d: Record<string, unknown>) => { for (const k of Object.keys(d)) if (!names.includes(k)) names.push(k); };
  docs.slice(0, 100).forEach(note);
  const types = new Map<string, string>();
  for (const d of docs) for (const [k, v] of Object.entries(d)) if (!types.has(k) && v !== null && v !== undefined) types.set(k, Array.isArray(v) ? "array" : typeof v === "object" ? "object" : typeof v);
  yield { type: "columns", columns: names.map((n): ColumnInfo => { const v = docs.find((d) => d[n] !== undefined && d[n] !== null)?.[n]; return { name: n, nativeType: types.get(n) ?? "null", kind: kindOfValue(v) }; }) };
  let n = 0; let buf: Value[][] = [];
  const emit = function* (d: Record<string, unknown>) { buf.push(names.map((c) => bsonish(d[c]))); n++; if (buf.length >= batch) { yield { type: "rows", rows: buf } as ResultEvent; buf = []; } };
  for (const d of docs) { if (signal.aborted) throw new DriverError("cancelled", "Query cancelled"); if (n >= max) break; yield* emit(d); }
  if (extra) for await (const page of extra) for (const d of page) { if (signal.aborted) throw new DriverError("cancelled", "Query cancelled"); if (n >= max) break; yield* emit(d); }
  if (buf.length) yield { type: "rows", rows: buf };
  yield { type: "done", rowCount: n, durationMs: performance.now() - t0 };
}

interface Hit { _index: string; _id: string; _score?: number | null; _source?: Record<string, unknown>; fields?: Record<string, unknown> }
const hitDoc = (h: Hit): Record<string, unknown> => ({ _id: h._id, _index: h._index, ...(h._source ?? {}), ...(h.fields ?? {}) });

class EsConnection implements Connection {
  constructor(private c: Client, readonly serverInfo: Connection["serverInfo"], private readOnly: boolean) {}
  quoteIdent = quoteIdent;

  async *execute(req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const t0 = performance.now();
    try {
      const r = parseConsole(req.sql);
      if (this.readOnly && assessConsole(req.sql).risk !== "none") throw new DriverError("permission", "Connection is read-only: request rejected");
      yield* this.run(r, req, signal, t0);
    } catch (e) { throw signal.aborted && !(e instanceof DriverError && e.kind !== "cancelled") ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e); }
  }

  private async *run(r: ConsoleRequest, req: ExecuteRequest, signal: AbortSignal, t0: number): AsyncGenerator<ResultEvent> {
    const isSearch = /\/_search(\?|$)/.test(r.path) && !/scroll=/.test(r.path);
    const body = (r.body ?? {}) as Record<string, unknown>;
    const paged = isSearch && body.size === undefined && body.from === undefined && body.aggs === undefined && body.aggregations === undefined && body.search_after === undefined;
    if (paged) {
      const size = Math.min(1000, Math.max(1, req.batchSize ?? 500));
      const first = await this.c.request({ method: r.method, path: `${r.path}${r.path.includes("?") ? "&" : "?"}scroll=1m&size=${size}`, body: r.body, signal });
      const page = first.json as { _scroll_id?: string; hits: { hits: Hit[] } };
      const scrollId = page._scroll_id;
      const client = this.c;
      async function* more() {
        let id = scrollId; let cur = page.hits.hits;
        try {
          while (id && cur.length === size) {
            const next = (await client.request({ method: "POST", path: "/_search/scroll", body: { scroll: "1m", scroll_id: id }, signal })).json as typeof page;
            id = next._scroll_id ?? id; cur = next.hits.hits; if (!cur.length) break;
            yield cur.map(hitDoc);
          }
        } finally { if (id) await client.request({ method: "DELETE", path: "/_search/scroll", body: { scroll_id: id } }).catch(() => {}); }
      }
      yield* docsToEvents(page.hits.hits.map(hitDoc), more(), req, signal, t0);
      return;
    }
    const res = await this.c.request({ method: r.method, path: r.path, ...(r.body !== undefined ? { body: r.body } : {}), ...(r.rawBody ? { rawBody: r.rawBody } : {}), signal });
    const j = res.json as Record<string, unknown> | unknown[] | undefined;
    if (j && !Array.isArray(j) && typeof j === "object" && (j as { hits?: { hits?: Hit[] } }).hits?.hits) {
      const out = j as { hits: { hits: Hit[]; total?: unknown }; aggregations?: unknown };
      if (out.aggregations !== undefined && !out.hits.hits.length) { yield* docsToEvents([{ aggregations: out.aggregations, total: (out.hits.total as { value?: number } | undefined)?.value ?? null }], undefined, req, signal, t0); return; }
      yield* docsToEvents(out.hits.hits.map(hitDoc), undefined, req, signal, t0); return;
    }
    if (Array.isArray(j)) { yield* docsToEvents(j.map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : { value: x })), undefined, req, signal, t0); return; }
    if (j && typeof j === "object") { yield* docsToEvents([j as Record<string, unknown>], undefined, req, signal, t0); return; }
    yield* docsToEvents(res.text ? res.text.split("\n").filter(Boolean).map((l) => ({ line: l })) : [{ status: res.status }], undefined, req, signal, t0);
  }

  introspect(): IntrospectionApi {
    const get = async (path: string) => (await this.c.request({ method: "GET", path })).json as Record<string, unknown> | Record<string, unknown>[];
    const flatten = (props: Record<string, { type?: string; properties?: Record<string, unknown>; fields?: unknown }>, prefix = ""): { name: string; type: string }[] =>
      Object.entries(props ?? {}).flatMap(([k, v]) => (v.properties ? [{ name: `${prefix}${k}`, type: "object" }, ...flatten(v.properties as never, `${prefix}${k}.`)] : [{ name: `${prefix}${k}`, type: v.type ?? "object" }]));
    const describe = async (name: string): Promise<TableInfo> => {
      const m = (await get(`/${encodeURIComponent(name)}/_mapping`)) as Record<string, { mappings: { properties?: Record<string, never> } }>;
      const first = Object.values(m)[0];
      return { name, kind: "table", columns: [{ name: "_id", nativeType: "keyword", nullable: false, primaryKey: true }, ...flatten(first?.mappings.properties ?? {}).map((f) => ({ name: f.name, nativeType: f.type, nullable: true, primaryKey: false }))] };
    };
    return {
      listSchemas: async () => [],
      listTables: async () => (((await this.c.request({ method: "GET", path: "/_cat/indices?format=json&h=index" })).json as { index: string }[]) ?? []).filter((i) => !i.index.startsWith(".")).sort((x, y) => (x.index < y.index ? -1 : 1)).map((i): TableInfo => ({ name: i.index, kind: "table" })),
      describeTable: async (ref) => describe(ref.name),
      indexes: async () => [] as IndexInfo[],
    };
  }

  async ping() { try { await this.c.request({ method: "GET", path: "/" }); } catch (e) { throw mapError(e); } }
  async close() { this.c.close(); }
}

export const elasticsearchDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const headers: Record<string, string> = {};
    if (cfg.apiKey) headers.authorization = `ApiKey ${String(cfg.apiKey)}`;
    else if (cfg.user) headers.authorization = `Basic ${Buffer.from(`${String(cfg.user)}:${String(cfg.password ?? "")}`).toString("base64")}`;
    const c = makeClient({ host: String(cfg.host ?? "localhost"), port: Number(cfg.port ?? 9200), ssl: !!cfg.ssl, verify: cfg.sslVerify !== false, headers });
    try {
      const info = (await c.request({ method: "GET", path: "/" })).json as { version?: { number?: string; distribution?: string } };
      const product = info.version?.distribution === "opensearch" ? "OpenSearch" : "Elasticsearch";
      const conn = new EsConnection(c, { product, version: info.version?.number ?? "" }, !!cfg.readOnly);
      return conn;
    } catch (e) { c.close(); throw mapError(e); }
  },
};
export { meta };
