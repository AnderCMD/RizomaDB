import http from "node:http";
import https from "node:https";
import {
  DriverError, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin, type ExecuteRequest, type IntrospectionApi, type ResultEvent, type TableInfo, type Value,
} from "@rizomadb/driver-api";
import { meta, quoteIdent } from "./meta.js";
import { defaultCredentialsPath, loadGoogleCredentials, tokenSource } from "./googleAuth.js";
import { assessFirestore, ConsoleSyntaxError, opName, parseCommand, type Command } from "./console.js";

export { quoteIdent, assessFirestore, parseCommand, ConsoleSyntaxError };

class HttpError extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } }
type FsValue = Record<string, unknown>;

interface Client { request(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<unknown>; close(): void }

function makeClient(o: { host: string; port: number; ssl: boolean; getToken: () => Promise<string | undefined> }): Client {
  const agent = o.ssl ? new https.Agent({ keepAlive: true }) : new http.Agent({ keepAlive: true });
  const lib = o.ssl ? https : http;
  return {
    close: () => agent.destroy(),
    request: async (method, path, body, signal) => { const token = await o.getToken(); return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(Object.assign(new Error("aborted"), { name: "AbortError" })); return; }
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = lib.request({ host: o.host, port: o.port, method, path, agent, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(payload !== undefined ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}) } }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8"); let json: unknown;
          try { json = text ? JSON.parse(text) : undefined; } catch { /* leave undefined */ }
          const status = res.statusCode ?? 0;
          if (status >= 400) { const e = (json as { error?: { status?: string; message?: string } } | undefined)?.error; reject(new HttpError(status, e?.status ?? `HTTP_${status}`, e?.message ?? (text.slice(0, 300) || `HTTP ${status}`))); } else resolve(json);
        });
      });
      const onAbort = () => req.destroy(Object.assign(new Error("aborted"), { name: "AbortError" }));
      signal?.addEventListener("abort", onAbort, { once: true });
      req.on("close", () => signal?.removeEventListener("abort", onAbort));
      req.on("error", reject);
      if (payload !== undefined) req.write(payload);
      req.end();
    }); },
  };
}

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  if (e instanceof ConsoleSyntaxError) return new DriverError("syntax", e.message, { position: e.position + 1, cause: e });
  const msg = (e as Error)?.message ?? String(e);
  if (e instanceof HttpError) {
    const kind: DriverErrorKind = e.status === 401 || e.code === "UNAUTHENTICATED" ? "authentication" : e.status === 403 || e.code === "PERMISSION_DENIED" ? "permission"
      : e.code === "INVALID_ARGUMENT" || e.code === "NOT_FOUND" || e.code === "FAILED_PRECONDITION" || e.status === 400 || e.status === 404 ? "syntax"
      : e.code === "ALREADY_EXISTS" ? "constraint" : e.code === "DEADLINE_EXCEEDED" || e.status === 504 ? "timeout" : "unknown";
    return new DriverError(kind, msg, { code: e.code, cause: e });
  }
  if ((e as Error)?.name === "AbortError") return new DriverError("cancelled", "Query cancelled", { cause: e });
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|socket hang up|EPIPE|certificate/i.test(`${(e as { code?: string }).code} ${msg}`)) return new DriverError("connection", msg, { cause: e });
  return new DriverError("unknown", msg, { cause: e });
}

/** Plain JSON -> Firestore typed value. Special forms: {"$int": "exact 64-bit integer text"}, {"$timestamp"}, {"$ref"}, {"$bytes"} (base64), {"$geo":[lat,lng]}. */
export function toFs(v: unknown, root: string): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "bigint") return { integerValue: v.toString() };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map((x) => toFs(x, root)) } };
  const o = v as Record<string, unknown>; const keys = Object.keys(o);
  if (keys.length === 1) {
    if (keys[0] === "$int" && /^-?\d+$/.test(String(o.$int))) return { integerValue: String(o.$int) };
    if (keys[0] === "$timestamp") return { timestampValue: new Date(String(o.$timestamp)).toISOString() };
    if (keys[0] === "$ref") return { referenceValue: `${root}/${String(o.$ref).replace(/^\/+/, "")}` };
    if (keys[0] === "$bytes") return { bytesValue: String(o.$bytes) };
    if (keys[0] === "$geo" && Array.isArray(o.$geo) && o.$geo.length === 2) return { geoPointValue: { latitude: Number(o.$geo[0]), longitude: Number(o.$geo[1]) } };
  }
  return { mapValue: { fields: Object.fromEntries(Object.entries(o).map(([k, x]) => [k, toFs(x, root)])) } };
}

/** Firestore typed value -> JS value (integers exact). */
export function fromFs(v: FsValue | undefined): unknown {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) { const b = BigInt(String(v.integerValue)); return b > BigInt(Number.MAX_SAFE_INTEGER) || b < BigInt(Number.MIN_SAFE_INTEGER) ? b : Number(b); }
  if ("doubleValue" in v) return v.doubleValue === "NaN" ? NaN : v.doubleValue === "Infinity" ? Infinity : v.doubleValue === "-Infinity" ? -Infinity : v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return new Date(String(v.timestampValue));
  if ("bytesValue" in v) return new Uint8Array(Buffer.from(String(v.bytesValue), "base64"));
  if ("referenceValue" in v) return String(v.referenceValue).replace(/^projects\/[^/]+\/databases\/[^/]+\/documents\//, "");
  if ("geoPointValue" in v) return v.geoPointValue;
  if ("arrayValue" in v) return ((v.arrayValue as { values?: FsValue[] }).values ?? []).map(fromFs);
  if ("mapValue" in v) return Object.fromEntries(Object.entries((v.mapValue as { fields?: Record<string, FsValue> }).fields ?? {}).map(([k, x]) => [k, fromFs(x)]));
  return null;
}

const typeOf = (v: FsValue | undefined) => (v ? Object.keys(v)[0]!.replace(/Value$/, "") : "null");
const kindOfType = (t: string): ColumnInfo["kind"] => (t === "integer" ? "integer" : t === "double" ? "float" : t === "boolean" ? "boolean" : t === "string" || t === "reference" ? "text" : t === "timestamp" ? "datetime" : t === "bytes" ? "binary" : t === "null" ? "other" : "json");
const toValue = (v: unknown): Value => (v === null || v === undefined ? null : typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "bigint" || v instanceof Date || v instanceof Uint8Array ? v : ({ json: v } as Value));

interface Doc { name: string; fields?: Record<string, FsValue> }
const DEFAULT_LIMIT = 10_000;

class FirestoreConnection implements Connection {
  private base: string; private root: string;
  constructor(private c: Client, project: string, database: string, readonly serverInfo: Connection["serverInfo"], private readOnly: boolean) {
    this.root = `projects/${project}/databases/${database}/documents`;
    this.base = `/v1/${this.root}`;
  }
  quoteIdent = quoteIdent;
  private rel = (name: string) => name.startsWith(this.root + "/") ? name.slice(this.root.length + 1) : name;

  async *execute(req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const t0 = performance.now();
    try {
      if (req.params?.length) throw new DriverError("syntax", "Firestore commands take no positional parameters: write the values into the JSON.");
      const cmd = parseCommand(req.sql);
      if (this.readOnly && assessFirestore(req.sql).risk !== "none") throw new DriverError("permission", "Connection is read-only: command rejected");
      const max = req.maxRows ?? Infinity;
      switch (cmd.kind) {
        case "query": yield* this.docs(await this.runQuery(cmd, Number.isFinite(max) ? max : DEFAULT_LIMIT, signal), req, t0, !Number.isFinite(max) && cmd.limit === undefined); return;
        case "get": yield* this.docs([await this.c.request("GET", `${this.base}/${cmd.path.split("/").map(encodeURIComponent).join("/")}`, undefined, signal) as Doc], req, t0, false); return;
        case "collections": {
          const r = await this.c.request("POST", `${this.base}${cmd.path ? "/" + cmd.path : ""}:listCollectionIds`, {}, signal) as { collectionIds?: string[] };
          yield { type: "columns", columns: [{ name: "collection", nativeType: "string", kind: "text" }] };
          yield { type: "rows", rows: (r.collectionIds ?? []).map((x) => [x]) };
          yield { type: "done", rowCount: r.collectionIds?.length ?? 0, durationMs: performance.now() - t0 }; return;
        }
        case "set": case "update": {
          const fields = Object.fromEntries(Object.entries(cmd.data).map(([k, v]) => [k, toFs(v, `${this.root}`)]));
          const mask = cmd.kind === "update" ? "?" + Object.keys(cmd.data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&") + "&currentDocument.exists=true" : "";
          await this.c.request("PATCH", `${this.base}/${cmd.path.split("/").map(encodeURIComponent).join("/")}${mask}`, { fields }, signal);
          yield { type: "message", text: `${cmd.kind === "set" ? "Wrote" : "Updated"} ${cmd.path}` };
          yield { type: "done", rowCount: 0, affectedRows: 1, durationMs: performance.now() - t0 }; return;
        }
        case "delete":
          await this.c.request("DELETE", `${this.base}/${cmd.path.split("/").map(encodeURIComponent).join("/")}`, undefined, signal);
          yield { type: "message", text: `Deleted ${cmd.path}` };
          yield { type: "done", rowCount: 0, affectedRows: 1, durationMs: performance.now() - t0 }; return;
      }
    } catch (e) { throw signal.aborted && !(e instanceof DriverError && e.kind !== "cancelled") ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e); }
  }

  private async runQuery(cmd: Extract<Command, { kind: "query" }>, cap: number, signal: AbortSignal): Promise<Doc[]> {
    const parts = cmd.from.split("/");
    const parentPath = parts.length > 1 && !cmd.group ? parts.slice(0, -1).join("/") : "";
    const collectionId = cmd.group ? cmd.from : parts.at(-1)!;
    const filters = cmd.where.map(([f, op, v]) => ({ fieldFilter: { field: { fieldPath: f }, op: opName(op), value: toFs(v, this.root) } }));
    const limit = Math.min(cmd.limit ?? cap, cap);
    const structuredQuery = {
      from: [{ collectionId, ...(cmd.group ? { allDescendants: true } : {}) }],
      ...(filters.length ? { where: filters.length === 1 ? filters[0] : { compositeFilter: { op: "AND", filters } } } : {}),
      ...(cmd.orderBy.length ? { orderBy: cmd.orderBy.map(([f, d]) => ({ field: { fieldPath: f }, direction: d === "asc" ? "ASCENDING" : "DESCENDING" })) } : {}),
      ...(cmd.select ? { select: { fields: cmd.select.map((f) => ({ fieldPath: f })) } } : {}),
      limit,
    };
    const r = await this.c.request("POST", `${this.base}${parentPath ? "/" + parentPath : ""}:runQuery`, { structuredQuery }, signal) as { document?: Doc }[];
    return r.flatMap((x) => (x.document ? [x.document] : []));
  }

  private async *docs(docs: Doc[], req: ExecuteRequest, t0: number, capped: boolean): AsyncGenerator<ResultEvent> {
    const batch = req.batchSize ?? 500;
    const names: string[] = []; const types = new Map<string, string>();
    for (const d of docs) for (const [k, v] of Object.entries(d.fields ?? {})) { if (!names.includes(k)) names.push(k); if (!types.has(k) && typeOf(v) !== "null") types.set(k, typeOf(v)); }
    names.sort();
    yield { type: "columns", columns: [{ name: "__name__", nativeType: "path", kind: "text" }, ...names.map((n): ColumnInfo => ({ name: n, nativeType: types.get(n) ?? "null", kind: kindOfType(types.get(n) ?? "null") }))] };
    let buf: Value[][] = [];
    for (const d of docs) {
      buf.push([this.rel(d.name), ...names.map((c) => toValue(fromFs(d.fields?.[c])))]);
      if (buf.length >= batch) { yield { type: "rows", rows: buf }; buf = []; }
    }
    if (buf.length) yield { type: "rows", rows: buf };
    if (capped && docs.length >= DEFAULT_LIMIT) yield { type: "message", text: `Showing the first ${DEFAULT_LIMIT} documents. Add "limit" or filters to control what is read (every document read is billed).` };
    yield { type: "done", rowCount: docs.length, durationMs: performance.now() - t0 };
  }

  introspect(): IntrospectionApi {
    const call = (m: string, p: string, b?: unknown) => this.c.request(m, p, b).catch((e) => { throw mapError(e); });
    return {
      listSchemas: async () => [],
      listTables: async () => (((await call("POST", `${this.base}:listCollectionIds`, {})) as { collectionIds?: string[] }).collectionIds ?? []).sort().map((name): TableInfo => ({ name, kind: "table" })),
      describeTable: async (ref) => {
        const r = (await call("POST", `${this.base}:runQuery`, { structuredQuery: { from: [{ collectionId: ref.name }], limit: 50 } })) as { document?: Doc }[];
        const types = new Map<string, Set<string>>();
        for (const x of r) for (const [k, v] of Object.entries(x.document?.fields ?? {})) (types.get(k) ?? types.set(k, new Set()).get(k)!).add(typeOf(v));
        return { name: ref.name, kind: "table", columns: [{ name: "__name__", nativeType: "path", nullable: false, primaryKey: true }, ...[...types].sort(([a], [b]) => (a < b ? -1 : 1)).map(([n, t]) => ({ name: n, nativeType: [...t].join(" | "), nullable: true, primaryKey: false }))] };
      },
    };
  }

  async ping() { try { await this.c.request("POST", `${this.base}:listCollectionIds`, { pageSize: 1 }); } catch (e) { throw mapError(e); } }
  async close() { this.c.close(); }
}

export const firestoreDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const local = typeof cfg.host === "string" && cfg.host !== "";
    // A token typed in the connection wins; otherwise a credentials file (chosen here, GOOGLE_APPLICATION_CREDENTIALS, or the gcloud application-default file) is exchanged for short-lived tokens.
    let getToken: (() => Promise<string>) | undefined;
    if (cfg.accessToken) { const t = String(cfg.accessToken); getToken = async () => t; }
    else if (local) getToken = async () => "owner";
    else {
      const file = cfg.credentialsFile ? String(cfg.credentialsFile) : defaultCredentialsPath();
      if (file) {
        try { getToken = tokenSource(loadGoogleCredentials(file)); } catch (e) { throw new DriverError("authentication", (e as Error).message); }
      }
    }
    if (!getToken) throw new DriverError("authentication", "An OAuth access token or a Google credentials file is required for Google Cloud (for example `gcloud auth print-access-token`).");
    const wrap = getToken;
    const tokenOrError = async () => { try { return await wrap(); } catch (e) { throw e instanceof DriverError ? e : new DriverError("authentication", (e as Error).message); } };
    if (!cfg.projectId) throw new DriverError("syntax", "Project ID is required.");
    const c = makeClient({ host: local ? String(cfg.host) : "firestore.googleapis.com", port: local ? Number(cfg.port ?? 8080) : 443, ssl: local ? !!cfg.ssl : true, getToken: tokenOrError });
    const conn = new FirestoreConnection(c, String(cfg.projectId), String(cfg.databaseId ?? "(default)"), { product: local ? "Firestore (custom endpoint)" : "Google Cloud Firestore", version: "v1" }, !!cfg.readOnly);
    try { await conn.ping(); } catch (e) { c.close(); throw e; }
    return conn;
  },
};
export { meta };
