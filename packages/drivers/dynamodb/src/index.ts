import http from "node:http";
import https from "node:https";
import {
  DriverError, type ColumnDef, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin, type ExecuteRequest, type IndexInfo, type IntrospectionApi, type ResultEvent, type TableInfo, type Value,
} from "@rizomadb/driver-api";
import { meta, quoteIdent } from "./meta.js";
import { assessPartiql, stripPartiql } from "./partiql.js";
import { signV4, type Credentials } from "./sigv4.js";

export { quoteIdent, assessPartiql, stripPartiql, signV4 };

type AttributeValue = Record<string, unknown>;
class AwsError extends Error { constructor(readonly type: string, message: string, readonly status: number) { super(message); } }

interface Client { call(target: string, body: unknown, signal?: AbortSignal): Promise<Record<string, unknown>>; close(): void }

function makeClient(o: { host: string; port: number; ssl: boolean; region: string; creds: Credentials }): Client {
  const agent = o.ssl ? new https.Agent({ keepAlive: true }) : new http.Agent({ keepAlive: true });
  const lib = o.ssl ? https : http;
  const hostHeader = (o.ssl && o.port === 443) || (!o.ssl && o.port === 80) ? o.host : `${o.host}:${o.port}`;
  return {
    close: () => agent.destroy(),
    call: (target, body, signal) => new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(Object.assign(new Error("aborted"), { name: "AbortError" })); return; }
      const payload = JSON.stringify(body);
      const headers = signV4(o.creds, { method: "POST", host: hostHeader, path: "/", headers: { "content-type": "application/x-amz-json-1.0", "x-amz-target": `DynamoDB_20120810.${target}` }, body: payload, region: o.region, service: "dynamodb" });
      const req = lib.request({ host: o.host, port: o.port, method: "POST", path: "/", agent, headers: { ...headers, "content-length": Buffer.byteLength(payload) } }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8"); let json: Record<string, unknown> = {};
          try { json = text ? JSON.parse(text) : {}; } catch { /* leave empty */ }
          const status = res.statusCode ?? 0;
          if (status >= 400) reject(new AwsError(String(json.__type ?? "Unknown").split("#").pop()!, String(json.message ?? json.Message ?? text.slice(0, 300)), status)); else resolve(json);
        });
      });
      const onAbort = () => req.destroy(Object.assign(new Error("aborted"), { name: "AbortError" }));
      signal?.addEventListener("abort", onAbort, { once: true });
      req.on("close", () => signal?.removeEventListener("abort", onAbort));
      req.on("error", reject);
      req.write(payload); req.end();
    }),
  };
}

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const msg = (e as Error)?.message ?? String(e);
  if (e instanceof AwsError) {
    const t = e.type;
    const kind: DriverErrorKind = /UnrecognizedClient|InvalidSignature|ExpiredToken|IncompleteSignature|MissingAuthentication/.test(t) || e.status === 401 ? "authentication"
      : /AccessDenied|NotAuthorized/.test(t) || e.status === 403 ? "permission"
      : /ValidationException|ResourceNotFound|SerializationException/.test(t) ? "syntax"
      : /ConditionalCheckFailed|DuplicateItem|TransactionCanceled/.test(t) ? "constraint"
      : /ThrottlingException|ProvisionedThroughputExceeded|RequestLimitExceeded/.test(t) ? "timeout" : "unknown";
    return new DriverError(kind, `${t}: ${msg}`, { code: t, cause: e });
  }
  if ((e as Error)?.name === "AbortError") return new DriverError("cancelled", "Query cancelled", { cause: e });
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|socket hang up|EPIPE|certificate/i.test(`${(e as { code?: string }).code} ${msg}`)) return new DriverError("connection", msg, { cause: e });
  return new DriverError("unknown", msg, { cause: e });
}

/** DynamoDB AttributeValue -> driver Value. Numbers are exact: integers beyond 2^53 become bigint, unrepresentable decimals stay text. */
export function fromAttr(a: AttributeValue | undefined): unknown {
  if (!a) return null;
  if ("S" in a) return a.S;
  if ("N" in a) return parseNumber(String(a.N));
  if ("BOOL" in a) return a.BOOL;
  if ("NULL" in a) return null;
  if ("B" in a) return new Uint8Array(Buffer.from(String(a.B), "base64"));
  if ("L" in a) return (a.L as AttributeValue[]).map(fromAttr);
  if ("M" in a) return Object.fromEntries(Object.entries(a.M as Record<string, AttributeValue>).map(([k, v]) => [k, fromAttr(v)]));
  if ("SS" in a) return a.SS;
  if ("NS" in a) return (a.NS as string[]).map(parseNumber);
  if ("BS" in a) return (a.BS as string[]).map((b) => Buffer.from(b, "base64").toString("base64"));
  return null;
}
function parseNumber(s: string): number | bigint | string {
  if (/^-?\d+$/.test(s)) { const b = BigInt(s); return b > BigInt(Number.MAX_SAFE_INTEGER) || b < BigInt(Number.MIN_SAFE_INTEGER) ? b : Number(b); }
  const n = Number(s); return String(n) === s || Number.isFinite(n) && Number(n.toPrecision(15)) === n && !/e/i.test(s) ? n : s;
}

/** Driver Value -> AttributeValue. */
export function toAttr(v: unknown): AttributeValue {
  if (v === null || v === undefined) return { NULL: true };
  if (typeof v === "string") return { S: v };
  if (typeof v === "boolean") return { BOOL: v };
  if (typeof v === "number" || typeof v === "bigint") return { N: String(v) };
  if (v instanceof Date) return { S: v.toISOString() };
  if (v instanceof Uint8Array) return { B: Buffer.from(v).toString("base64") };
  if (Array.isArray(v)) return { L: v.map(toAttr) };
  if (typeof v === "object" && "json" in (v as object)) return toAttr((v as { json: unknown }).json);
  return { M: Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, toAttr(x)])) };
}

/** Column order: the SELECT list when it names plain attributes, otherwise alphabetical (the service returns attributes unordered). */
function orderColumns(found: string[], sql: string): string[] {
  const m = /^\s*SELECT\s+(.+?)\s+FROM\b/is.exec(sql);
  const listed = m && m[1]!.trim() !== "*" ? m[1]!.split(",").map((x) => x.trim().replace(/^"(.*)"$/, "$1")) : undefined;
  if (listed?.every((x) => /^[\w.-]+$/.test(x))) return [...listed.filter((x) => found.includes(x)), ...found.filter((x) => !listed.includes(x)).sort()];
  return [...found].sort();
}

const typeName = (a: AttributeValue | undefined) => (a ? Object.keys(a)[0] ?? "NULL" : "NULL");
const kindOfAttr = (t: string): ColumnInfo["kind"] => (t === "N" ? "float" : t === "BOOL" ? "boolean" : t === "S" ? "text" : t === "B" ? "binary" : t === "NULL" ? "other" : "json");
const toValue = (v: unknown): Value => (v === null || v === undefined ? null : typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "bigint" || v instanceof Uint8Array ? v : ({ json: v } as Value));

class DynamoConnection implements Connection {
  constructor(private c: Client, readonly serverInfo: Connection["serverInfo"], private readOnly: boolean) {}
  quoteIdent = quoteIdent;

  async *execute(req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const t0 = performance.now();
    try {
      if (this.readOnly && assessPartiql(req.sql).risk !== "none") throw new DriverError("permission", "Connection is read-only: statement rejected");
      const max = req.maxRows ?? Infinity, batch = req.batchSize ?? 500;
      const params = req.params?.length ? req.params.map(toAttr) : undefined;
      let token: string | undefined; let names: string[] | undefined; const types = new Map<string, string>();
      let n = 0, dropped = false, buf: Value[][] = [];
      do {
        const r = await this.c.call("ExecuteStatement", { Statement: req.sql.trim().replace(/;+\s*$/, ""), ...(params ? { Parameters: params } : {}), ...(token ? { NextToken: token } : {}) }, signal);
        const items = (r.Items as Record<string, AttributeValue>[] | undefined) ?? [];
        if (!names) {
          names = [];
          for (const it of items) for (const [k, v] of Object.entries(it)) { if (!names.includes(k)) names.push(k); if (!types.has(k) && typeName(v) !== "NULL") types.set(k, typeName(v)); }
          names = orderColumns(names, req.sql);
          yield { type: "columns", columns: names.map((c): ColumnInfo => ({ name: c, nativeType: types.get(c) ?? "NULL", kind: kindOfAttr(types.get(c) ?? "NULL") })) };
        }
        for (const it of items) {
          if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
          if (n >= max) { token = undefined; break; }
          if (Object.keys(it).some((k) => !names!.includes(k))) dropped = true;
          buf.push(names.map((c) => toValue(fromAttr(it[c])))); n++;
          if (buf.length >= batch) { yield { type: "rows", rows: buf }; buf = []; }
        }
        token = n >= max ? undefined : (r.NextToken as string | undefined);
      } while (token);
      if (buf.length) yield { type: "rows", rows: buf };
      if (dropped) yield { type: "message", text: "Items are schemaless: attributes that first appeared after the first page are not shown as columns." };
      yield { type: "done", rowCount: n, durationMs: performance.now() - t0 };
    } catch (e) { throw signal.aborted && !(e instanceof DriverError && e.kind !== "cancelled") ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e); }
  }

  introspect(): IntrospectionApi {
    const call = (t: string, b: unknown) => this.c.call(t, b).catch((e) => { throw mapError(e); });
    const describe = async (name: string): Promise<TableInfo & { raw: Record<string, unknown> }> => {
      const t = (await call("DescribeTable", { TableName: name })).Table as { KeySchema: { AttributeName: string; KeyType: string }[]; AttributeDefinitions: { AttributeName: string; AttributeType: string }[]; GlobalSecondaryIndexes?: unknown[]; LocalSecondaryIndexes?: unknown[] };
      const defs = new Map(t.AttributeDefinitions.map((a) => [a.AttributeName, a.AttributeType]));
      const keys = new Set(t.KeySchema.map((k) => k.AttributeName));
      const cols: ColumnDef[] = [...keys].map((k) => ({ name: k, nativeType: defs.get(k) ?? "S", nullable: false, primaryKey: true }));
      for (const [k, ty] of defs) if (!keys.has(k)) cols.push({ name: k, nativeType: ty, nullable: true, primaryKey: false });
      return { name, kind: "table", columns: cols, raw: t as never };
    };
    return {
      listSchemas: async () => [],
      listTables: async () => {
        const out: TableInfo[] = []; let start: string | undefined;
        do { const r = await call("ListTables", start ? { ExclusiveStartTableName: start } : {}); out.push(...((r.TableNames as string[]) ?? []).map((name): TableInfo => ({ name, kind: "table" }))); start = r.LastEvaluatedTableName as string | undefined; } while (start);
        return out.sort((a, b) => (a.name < b.name ? -1 : 1));
      },
      describeTable: async (ref) => { const d = await describe(ref.name); return { name: d.name, kind: d.kind, ...(d.columns ? { columns: d.columns } : {}) }; },
      indexes: async () => {
        const out: IndexInfo[] = [];
        const tables = await this.introspect().listTables();
        for (const t of tables) {
          const d = (await describe(t.name)).raw as { KeySchema: { AttributeName: string }[]; GlobalSecondaryIndexes?: { IndexName: string; KeySchema: { AttributeName: string }[] }[]; LocalSecondaryIndexes?: { IndexName: string; KeySchema: { AttributeName: string }[] }[] };
          out.push({ name: "PRIMARY", table: t.name, columns: d.KeySchema.map((k) => k.AttributeName), unique: true, primary: true });
          for (const i of [...(d.GlobalSecondaryIndexes ?? []), ...(d.LocalSecondaryIndexes ?? [])]) out.push({ name: i.IndexName, table: t.name, columns: i.KeySchema.map((k) => k.AttributeName), unique: false, primary: false });
        }
        return out;
      },
    };
  }

  async ping() { try { await this.c.call("ListTables", { Limit: 1 }); } catch (e) { throw mapError(e); } }
  async close() { this.c.close(); }
}

export const dynamodbDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const region = String(cfg.region ?? "us-east-1");
    const local = typeof cfg.host === "string" && cfg.host !== "";
    const creds: Credentials = { accessKeyId: String(cfg.accessKeyId ?? (local ? "local" : "")), secretAccessKey: String(cfg.secretAccessKey ?? (local ? "local" : "")), ...(cfg.sessionToken ? { sessionToken: String(cfg.sessionToken) } : {}) };
    if (!creds.accessKeyId || !creds.secretAccessKey) throw new DriverError("authentication", "Access key ID and secret access key are required (the AWS credential chain, profiles and SSO are not supported).");
    const c = makeClient({ host: local ? String(cfg.host) : `dynamodb.${region}.amazonaws.com`, port: local ? Number(cfg.port ?? 8000) : 443, ssl: local ? !!cfg.ssl : true, region, creds });
    const conn = new DynamoConnection(c, { product: local ? "DynamoDB (custom endpoint)" : "Amazon DynamoDB", version: region }, !!cfg.readOnly);
    try { await conn.ping(); } catch (e) { c.close(); throw e; }
    return conn;
  },
};
export { meta };
