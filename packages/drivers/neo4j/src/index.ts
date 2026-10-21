import http from "node:http";
import https from "node:https";
import {
  DriverError, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin, type ExecuteRequest, type IndexInfo, type IntrospectionApi, type ResultEvent, type TableInfo, type Transaction, type Value,
} from "@rizomadb/driver-api";
import { meta, quoteIdent } from "./meta.js";
import { assessCypher, stripCypher } from "./cypher.js";

export { quoteIdent, assessCypher, stripCypher };

interface Typed { $type: string; _value: unknown }
interface Reply { status: number; json: { data?: { fields: string[]; values: unknown[][] }; errors?: { code: string; message: string }[]; transaction?: { id: string } } }

class CypherError extends Error { constructor(readonly code: string, message: string) { super(message); } }

interface Client { post(path: string, body: unknown, signal?: AbortSignal): Promise<Reply>; del(path: string): Promise<void>; close(): void }

function makeClient(o: { host: string; port: number; ssl: boolean; verify: boolean; auth: string }): Client {
  const agent = o.ssl ? new https.Agent({ keepAlive: true, rejectUnauthorized: o.verify }) : new http.Agent({ keepAlive: true });
  const lib = o.ssl ? https : http;
  const call = (method: string, path: string, body: unknown | undefined, signal?: AbortSignal) => new Promise<Reply>((resolve, reject) => {
    if (signal?.aborted) { reject(Object.assign(new Error("aborted"), { name: "AbortError" })); return; }
    const payload = body === undefined ? undefined : JSON.stringify(body, (_, v) => (typeof v === "bigint" ? { $type: "Integer", _value: v.toString() } : v));
    const req = lib.request({ host: o.host, port: o.port, method, path, agent, headers: { accept: "application/vnd.neo4j.query", authorization: o.auth, ...(payload !== undefined ? { "content-type": "application/vnd.neo4j.query", "content-length": Buffer.byteLength(payload) } : {}) } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json: Reply["json"];
        try { json = text ? JSON.parse(text) : {}; } catch { json = { errors: [{ code: "HTTP", message: text.slice(0, 300) }] }; }
        const status = res.statusCode ?? 0;
        const err = json.errors?.[0];
        if (err) reject(new CypherError(err.code, err.message));
        else if (status >= 400) reject(new CypherError(`HTTP.${status}`, `HTTP ${status}`));
        else resolve({ status, json });
      });
    });
    const onAbort = () => req.destroy(Object.assign(new Error("aborted"), { name: "AbortError" }));
    signal?.addEventListener("abort", onAbort, { once: true });
    req.on("close", () => signal?.removeEventListener("abort", onAbort));
    req.on("error", reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
  return { post: (p, b, s) => call("POST", p, b, s), del: async (p) => { await call("DELETE", p, undefined); }, close: () => agent.destroy() };
}

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const msg = (e as Error)?.message ?? String(e);
  if (e instanceof CypherError) {
    const c = e.code;
    const kind: DriverErrorKind = /Security\.(Unauthorized|AuthenticationRateLimit)|HTTP\.401/.test(c) ? "authentication"
      : /Security\.Forbidden|HTTP\.403|PermissionDenied/.test(c) ? "permission"
      : /Statement\.(SyntaxError|SemanticError|ParameterMissing|TypeError|ArgumentError|ArithmeticError)|Request\.Invalid|Schema\.(IndexNotFound)/.test(c) ? "syntax"
      : /ConstraintValidationFailed|Schema\.ConstraintViolation|Schema\.Constraint/.test(c) ? "constraint"
      : /TransactionTimedOut|TransactionTerminated|Timeout/.test(c) ? "timeout"
      : /Database\.DatabaseNotFound|HTTP\.404/.test(c) ? "syntax" : "unknown";
    return new DriverError(kind, msg, { code: c, cause: e });
  }
  if ((e as Error)?.name === "AbortError") return new DriverError("cancelled", "Query cancelled", { cause: e });
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|socket hang up|EPIPE|certificate|self.signed/i.test(`${(e as { code?: string }).code} ${msg}`)) return new DriverError("connection", msg, { cause: e });
  return new DriverError("unknown", msg, { cause: e });
}

/** Decodes the Query API's typed JSON into driver Values. Graph objects and maps stay structured as { json }. */
function decode(t: unknown): unknown {
  if (t === null || typeof t !== "object") return t;
  const { $type, _value } = t as Typed;
  switch ($type) {
    case "Null": return null;
    case "Boolean": case "String": return _value;
    case "Integer": { const b = BigInt(_value as string); return b > BigInt(Number.MAX_SAFE_INTEGER) || b < BigInt(Number.MIN_SAFE_INTEGER) ? b : Number(b); }
    case "Float": { const s = String(_value); return s === "NaN" ? NaN : s === "Infinity" ? Infinity : s === "-Infinity" ? -Infinity : Number(s); }
    case "List": return (_value as unknown[]).map(decode);
    case "Map": return Object.fromEntries(Object.entries(_value as Record<string, unknown>).map(([k, v]) => [k, decode(v)]));
    case "Node": { const v = _value as { _element_id: string; _labels: string[]; _properties: Record<string, unknown> }; return { $type: "Node", id: v._element_id, labels: v._labels, properties: decode({ $type: "Map", _value: v._properties }) }; }
    case "Relationship": { const v = _value as { _element_id: string; _start_node_element_id: string; _end_node_element_id: string; _type: string; _properties: Record<string, unknown> }; return { $type: "Relationship", id: v._element_id, type: v._type, start: v._start_node_element_id, end: v._end_node_element_id, properties: decode({ $type: "Map", _value: v._properties }) }; }
    case "Path": return { $type: "Path", elements: (_value as unknown[]).map(decode) };
    default: return _value; // Date, DateTime, Duration, Point, ...: server-formatted text
  }
}

const toValue = (v: unknown): Value => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "boolean" || typeof v === "number" || typeof v === "bigint") return v;
  return { json: v, } as Value;
};
const kindOf = (v: unknown, type?: string): ColumnInfo["kind"] => {
  if (type === "Integer" || typeof v === "bigint" || (typeof v === "number" && Number.isInteger(v))) return "integer";
  if (type === "Float" || typeof v === "number") return "float";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "string") return /^(Date|LocalDate|ZonedDateTime|OffsetDateTime|LocalDateTime|Time)/.test(type ?? "") ? "datetime" : "text";
  return v === null || v === undefined ? "other" : "json";
};

function toParams(params?: Value[]): Record<string, unknown> | undefined {
  if (!params?.length) return undefined;
  return Object.fromEntries(params.map((v, i) => [`p${i + 1}`, normalizeParam(v)]));
}
function normalizeParam(v: Value): unknown {
  if (v instanceof Date) return { $type: "OffsetDateTime", _value: v.toISOString() };
  if (v instanceof Uint8Array) return { $type: "Base64", _value: Buffer.from(v).toString("base64") };
  if (Array.isArray(v)) return { $type: "List", _value: v.map(normalizeParam) };
  if (v && typeof v === "object" && "json" in v) return typedJson((v as { json: unknown }).json);
  return typedJson(v);
}
/** Plain JSON data to the Query API's typed representation (so integers keep their type). */
function typedJson(j: unknown): unknown {
  if (j === null || j === undefined) return { $type: "Null", _value: null };
  if (typeof j === "bigint") return { $type: "Integer", _value: j.toString() };
  if (typeof j === "number") return Number.isInteger(j) ? { $type: "Integer", _value: String(j) } : { $type: "Float", _value: String(j) };
  if (typeof j === "string") return { $type: "String", _value: j };
  if (typeof j === "boolean") return { $type: "Boolean", _value: j };
  if (Array.isArray(j)) return { $type: "List", _value: j.map(typedJson) };
  return { $type: "Map", _value: Object.fromEntries(Object.entries(j as Record<string, unknown>).map(([k, v]) => [k, typedJson(v)])) };
}

async function* toEvents(reply: Reply, req: ExecuteRequest, signal: AbortSignal, t0: number): AsyncGenerator<ResultEvent> {
  const data = reply.json.data ?? { fields: [], values: [] };
  const max = req.maxRows ?? Infinity, batch = req.batchSize ?? 500;
  const first = data.values[0];
  yield { type: "columns", columns: data.fields.map((name, i): ColumnInfo => {
    const sample = data.values.map((r) => r[i]).find((c) => c && (c as Typed).$type !== "Null");
    const type = (sample as Typed | undefined)?.$type;
    return { name, nativeType: type ?? "Null", kind: first ? kindOf(sample ? decode(sample) : null, type) : "other" };
  }) };
  let n = 0, buf: Value[][] = [];
  for (const r of data.values) {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    if (n >= max) break;
    buf.push(r.map((c) => toValue(decode(c)))); n++;
    if (buf.length >= batch) { yield { type: "rows", rows: buf }; buf = []; }
  }
  if (buf.length) yield { type: "rows", rows: buf };
  yield { type: "done", rowCount: n, durationMs: performance.now() - t0 };
}

class Neo4jConnection implements Connection {
  constructor(private c: Client, private db: string, readonly serverInfo: Connection["serverInfo"], private readOnly: boolean) {}
  quoteIdent = quoteIdent;
  private base = (db = this.db) => `/db/${encodeURIComponent(db)}`;

  private check(sql: string) {
    if (this.readOnly && assessCypher(sql).risk !== "none") throw new DriverError("permission", "Connection is read-only: statement rejected");
  }

  async *execute(req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const t0 = performance.now();
    try {
      this.check(req.sql);
      const params = toParams(req.params);
      const reply = await this.c.post(`${this.base()}/query/v2`, { statement: req.sql, ...(params ? { parameters: params } : {}) }, signal);
      yield* toEvents(reply, req, signal, t0);
    } catch (e) { throw signal.aborted && !(e instanceof DriverError && e.kind !== "cancelled") ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e); }
  }

  async begin(): Promise<Transaction> {
    // An empty POST opens the transaction and returns its id.
    const open = await this.c.post(`${this.base()}/query/v2/tx`, {}).catch((e) => { throw mapError(e); });
    const id = open.json.transaction?.id;
    if (!id) throw new DriverError("unknown", "Neo4j did not return a transaction id");
    const path = `${this.base()}/query/v2/tx/${id}`;
    const check = (s: string) => this.check(s);
    const client = this.c;
    let done = false;
    return {
      execute: (req, signal) => (async function* () {
        const t0 = performance.now();
        try {
          check(req.sql);
          const params = toParams(req.params);
          const reply = await client.post(path, { statement: req.sql, ...(params ? { parameters: params } : {}) }, signal);
          yield* toEvents(reply, req, signal, t0);
        } catch (e) { throw signal.aborted ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e); }
      })(),
      commit: async () => { if (done) return; done = true; await this.c.post(`${path}/commit`, {}).then(() => undefined, (e) => { throw mapError(e); }); },
      rollback: async () => { if (done) return; done = true; await this.c.del(path).catch(() => {}); },
    };
  }

  introspect(): IntrospectionApi {
    const q = async (statement: string) => (await this.c.post(`${this.base()}/query/v2`, { statement }).catch((e) => { throw mapError(e); })).json.data ?? { fields: [], values: [] };
    const cell = (c: unknown) => decode(c);
    const describe = async (name: string): Promise<TableInfo> => {
      const d = await q("CALL db.schema.nodeTypeProperties() YIELD nodeLabels, propertyName, propertyTypes, mandatory RETURN nodeLabels, propertyName, propertyTypes, mandatory");
      const cols = new Map<string, { type: string; mandatory: boolean }>();
      for (const r of d.values) {
        const labels = cell(r[0]) as string[]; const prop = cell(r[1]) as string | null;
        if (!labels?.includes(name) || !prop) continue;
        cols.set(prop, { type: ((cell(r[2]) as string[]) ?? ["Any"]).join(" | "), mandatory: !!cell(r[3]) });
      }
      return { name, kind: "table", columns: [{ name: "id()", nativeType: "elementId", nullable: false, primaryKey: true }, ...[...cols].map(([n, c]) => ({ name: n, nativeType: c.type, nullable: !c.mandatory, primaryKey: false }))] };
    };
    return {
      listSchemas: async () => [],
      listTables: async () => (await q("CALL db.labels() YIELD label RETURN label ORDER BY label")).values.map((r): TableInfo => ({ name: String(cell(r[0])), kind: "table" })),
      describeTable: async (ref) => describe(ref.name),
      indexes: async () => (await q("SHOW INDEXES YIELD name, labelsOrTypes, properties, type RETURN name, labelsOrTypes, properties, type")).values
        .filter((r) => cell(r[3]) !== "LOOKUP")
        .map((r): IndexInfo => ({ name: String(cell(r[0])), table: String((cell(r[1]) as string[] | null)?.[0] ?? ""), columns: (cell(r[2]) as string[] | null) ?? [], unique: false, primary: false })),
    };
  }

  async ping() { try { await this.c.post(`${this.base()}/query/v2`, { statement: "RETURN 1" }); } catch (e) { throw mapError(e); } }
  async close() { this.c.close(); }
}

export const neo4jDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const auth = `Basic ${Buffer.from(`${String(cfg.user ?? "neo4j")}:${String(cfg.password ?? "")}`).toString("base64")}`;
    const c = makeClient({ host: String(cfg.host ?? "localhost"), port: Number(cfg.port ?? 7474), ssl: !!cfg.ssl, verify: cfg.sslVerify !== false, auth });
    const db = String(cfg.database ?? "neo4j");
    try {
      const reply = await c.post(`/db/${encodeURIComponent(db)}/query/v2`, { statement: "CALL dbms.components() YIELD name, versions, edition RETURN name, versions, edition" });
      const row = reply.json.data?.values[0];
      const versions = row ? (decode(row[1]) as string[]) : [];
      const edition = row ? String(decode(row[2])) : "";
      return new Neo4jConnection(c, db, { product: `Neo4j${edition ? ` ${edition[0]!.toUpperCase()}${edition.slice(1)}` : ""}`, version: versions[0] ?? "" }, !!cfg.readOnly);
    } catch (e) { c.close(); throw mapError(e); }
  },
};
export { meta };
