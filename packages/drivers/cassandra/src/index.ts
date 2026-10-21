import cassandra from "cassandra-driver";
import type { Readable } from "node:stream";
import {
  DriverError, type ColumnDef, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin, type ExecuteRequest, type IndexInfo, type IntrospectionApi, type ResultEvent, type TableInfo, type Value,
} from "@rizomadb/driver-api";
import { meta, quoteIdent } from "./meta.js";
import { assessCql, stripCql } from "./cql.js";

export { quoteIdent, assessCql, stripCql };

const { types } = cassandra;

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const err = e as Error & { code?: number | string; name?: string; innerErrors?: unknown };
  const msg = err?.message ?? String(e);
  const name = err?.name ?? "";
  const kind: DriverErrorKind =
    name === "NoHostAvailableError" || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EPIPE|certificate/i.test(`${err?.code} ${msg}`) ? "connection"
    : name === "AuthenticationError" || /Username and/i.test(msg) ? "authentication"
    : name === "ResponseError" && err.code === types.responseErrorCodes.unauthorized ? "permission"
    : name === "ResponseError" && (err.code === types.responseErrorCodes.syntaxError || err.code === types.responseErrorCodes.invalid || err.code === types.responseErrorCodes.configError || err.code === types.responseErrorCodes.alreadyExists) ? "syntax"
    : name === "ResponseError" && (err.code === types.responseErrorCodes.readTimeout || err.code === types.responseErrorCodes.writeTimeout || err.code === types.responseErrorCodes.unavailableException) ? "timeout"
    : name === "OperationTimedOutError" ? "timeout" : "unknown";
  return new DriverError(kind, msg, { ...(err?.code !== undefined ? { code: String(err.code) } : {}), cause: e });
}

const T = types.dataTypes;
function kindOf(code: number): ColumnInfo["kind"] {
  switch (code) {
    case T.tinyint: case T.smallint: case T.int: case T.bigint: case T.counter: case T.varint: return "integer";
    case T.float: case T.double: return "float";
    case T.decimal: return "decimal";
    case T.boolean: return "boolean";
    case T.timestamp: case T.date: case T.time: return "datetime";
    case T.blob: return "binary";
    case T.ascii: case T.text: case T.varchar: case T.uuid: case T.timeuuid: case T.inet: case T.duration: return "text";
    default: return "json";
  }
}
function nativeName(t: { code: number; info?: unknown }): string {
  const name = Object.entries(T).find(([, v]) => v === t.code)?.[0] ?? String(t.code);
  const info = t.info as { code: number } | { code: number }[] | undefined;
  return Array.isArray(info) ? `${name}<${info.map(nativeName).join(", ")}>` : info && typeof info === "object" && "code" in info ? `${name}<${nativeName(info)}>` : name;
}

/** Driver-native value -> normalized Value. */
export function toValue(v: unknown): Value {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "boolean" || typeof v === "number") return v;
  if (typeof v === "bigint") return v;
  if (v instanceof Date) return v;
  if (v instanceof Uint8Array) return new Uint8Array(v);
  if (types.Long.isLong?.(v) || v instanceof types.Long) { const b = BigInt((v as InstanceType<typeof types.Long>).toString()); return b > BigInt(Number.MAX_SAFE_INTEGER) || b < BigInt(Number.MIN_SAFE_INTEGER) ? b : Number(b); }
  if (v instanceof types.Integer) return v.toString();                    // varint: arbitrary size, kept exact as text
  if (v instanceof types.BigDecimal) return v.toString();
  if (v instanceof types.Uuid || v instanceof types.TimeUuid || v instanceof types.InetAddress || v instanceof types.LocalDate || v instanceof types.LocalTime || v instanceof types.Duration) return v.toString();
  return { json: jsonable(v) };
}
function jsonable(v: unknown): unknown {
  if (v === null || v === undefined || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return `0x${Buffer.from(v).toString("hex")}`;
  if (Array.isArray(v)) return v.map(jsonable);
  if (v instanceof Map) return Object.fromEntries([...v].map(([k, x]) => [String(jsonable(k)), jsonable(x)]));
  if (v instanceof Set) return [...v].map(jsonable);
  if (v instanceof types.Tuple) return v.values().map(jsonable);
  if (typeof (v as { toString?: unknown }).toString === "function" && Object.getPrototypeOf(v) !== Object.prototype) return String(v);
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, jsonable(x)]));
}
function toParam(v: Value): unknown {
  if (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number" || v instanceof Date) return v;
  if (typeof v === "bigint") return types.Long.fromString(v.toString());
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (Array.isArray(v)) return v.map(toParam);
  if (v && typeof v === "object" && "json" in v) return (v as { json: unknown }).json;
  return v;
}

class CassandraConnection implements Connection {
  constructor(private client: cassandra.Client, readonly serverInfo: Connection["serverInfo"], private readOnly: boolean) {}
  quoteIdent = quoteIdent;

  async *execute(req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const t0 = performance.now();
    try {
      if (this.readOnly && assessCql(req.sql).risk !== "none") throw new DriverError("permission", "Connection is read-only: statement rejected");
      const max = req.maxRows ?? Infinity, batch = req.batchSize ?? 500;
      const params = req.params?.map(toParam);
      const stream = this.client.stream(req.sql.trim().replace(/;+\s*$/, ""), params as never, { prepare: !!params?.length, fetchSize: Math.min(5000, Math.max(1, batch)) }) as unknown as Readable;
      const onAbort = () => stream.destroy(Object.assign(new Error("aborted"), { name: "AbortError" }));
      signal.addEventListener("abort", onAbort, { once: true });
      let n = 0, buf: Value[][] = []; let names: string[] = []; let announced = false;
      try {
        // 'readable' fires after metadata is known; columns come from the stream's own result description.
        for await (const row of stream as AsyncIterable<cassandra.types.Row>) {
          if (!announced) {
            // The row carries its column descriptions (not part of the public typings).
            const described = (row as unknown as { __columns?: { name: string; type: { code: number; info?: unknown } }[] }).__columns ?? [];
            const meta = Object.fromEntries(described.map((c) => [c.name, c]));
            names = row.keys();
            yield { type: "columns", columns: names.map((name): ColumnInfo => ({ name, nativeType: meta[name] ? nativeName(meta[name]!.type) : "unknown", kind: meta[name] ? kindOf(meta[name]!.type.code) : "other" })) };
            announced = true;
          }
          if (n >= max) { stream.destroy(); break; }
          buf.push(names.map((c) => toValue(row.get(c)))); n++;
          if (buf.length >= batch) { yield { type: "rows", rows: buf }; buf = []; }
        }
      } finally { signal.removeEventListener("abort", onAbort); }
      // An empty result still announces its columns (names only: the stream gives no column types before the first row).
      if (!announced) {
        const cols = (stream as unknown as { columns?: { name: string; type: { code: number; info?: unknown } }[] }).columns ?? [];
        yield { type: "columns", columns: cols.map((c): ColumnInfo => ({ name: c.name, nativeType: nativeName(c.type), kind: kindOf(c.type.code) })) };
      }
      if (buf.length) yield { type: "rows", rows: buf };
      yield { type: "done", rowCount: n, durationMs: performance.now() - t0 };
    } catch (e) { throw signal.aborted && !(e instanceof DriverError && e.kind !== "cancelled") ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e); }
  }

  introspect(): IntrospectionApi {
    const q = async (cql: string, params: unknown[] = []) => { try { return (await this.client.execute(cql, params as never, { prepare: true })).rows; } catch (e) { throw mapError(e); } };
    const SYSTEM = /^system(_|$)/;
    return {
      listSchemas: async () => (await q("SELECT keyspace_name FROM system_schema.keyspaces")).map((r) => String(r.get("keyspace_name"))).filter((k) => !SYSTEM.test(k)).sort(),
      listTables: async (ks) => {
        if (!ks) return [];
        const t = (await q("SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?", [ks])).map((r): TableInfo => ({ name: String(r.get("table_name")), schema: ks, kind: "table" }));
        const v = (await q("SELECT view_name FROM system_schema.views WHERE keyspace_name = ?", [ks])).map((r): TableInfo => ({ name: String(r.get("view_name")), schema: ks, kind: "view" }));
        return [...t, ...v].sort((a, b) => (a.name < b.name ? -1 : 1));
      },
      describeTable: async (ref) => {
        const rows = await q("SELECT column_name, type, kind, position FROM system_schema.columns WHERE keyspace_name = ? AND table_name = ?", [ref.schema ?? "", ref.name]);
        const order = { partition_key: 0, clustering: 1, regular: 2, static: 3 } as Record<string, number>;
        const cols: ColumnDef[] = rows.map((r) => ({ name: String(r.get("column_name")), nativeType: String(r.get("type")), nullable: !["partition_key", "clustering"].includes(String(r.get("kind"))), primaryKey: ["partition_key", "clustering"].includes(String(r.get("kind"))), _k: String(r.get("kind")), _p: Number(r.get("position")) } as ColumnDef & { _k: string; _p: number }))
          .sort((a, b) => (order[(a as never as { _k: string })._k]! - order[(b as never as { _k: string })._k]!) || ((a as never as { _p: number })._p - (b as never as { _p: number })._p) || (a.name < b.name ? -1 : 1))
          .map(({ name, nativeType, nullable, primaryKey }) => ({ name, nativeType, nullable, primaryKey }));
        return { name: ref.name, ...(ref.schema ? { schema: ref.schema } : {}), kind: "table", columns: cols };
      },
      indexes: async (ks) => (await q("SELECT index_name, table_name, options FROM system_schema.indexes WHERE keyspace_name = ?", [ks ?? this.client.keyspace ?? ""])).map((r): IndexInfo => ({
        name: String(r.get("index_name")), ...(ks ? { schema: ks } : {}), table: String(r.get("table_name")), columns: [String((r.get("options") as Record<string, string> | null)?.target ?? "")], unique: false, primary: false })),
    };
  }

  async ping() { try { await this.client.execute("SELECT release_version FROM system.local"); } catch (e) { throw mapError(e); } }
  async close() { await this.client.shutdown().catch(() => {}); }
}

export const cassandraDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const port = Number(cfg.port ?? 9042);
    const hosts = String(cfg.host ?? "localhost").split(",").map((h) => h.trim()).filter(Boolean).map((h) => (/:\d+$/.test(h) ? h : `${h}:${port}`));
    const client = new cassandra.Client({
      contactPoints: hosts, localDataCenter: String(cfg.localDataCenter ?? "datacenter1"),
      ...(cfg.keyspace ? { keyspace: String(cfg.keyspace) } : {}),
      ...(cfg.user ? { credentials: { username: String(cfg.user), password: String(cfg.password ?? "") } } : {}),
      ...(cfg.ssl ? { sslOptions: { rejectUnauthorized: cfg.sslVerify !== false } } : {}),
      socketOptions: { connectTimeout: 10_000, readTimeout: 0 },
    });
    try {
      await client.connect();
      const r = (await client.execute("SELECT release_version, data_center FROM system.local")).first();
      const version = String(r?.get("release_version") ?? "");
      // Scylla exposes its own version column; Cassandra rejects the query.
      const scylla = await client.execute("SELECT scylla_version FROM system.local").then((x) => x.first()?.get("scylla_version") as string | undefined, () => undefined);
      return new CassandraConnection(client, { product: scylla ? "ScyllaDB" : "Apache Cassandra", version: scylla ?? version }, !!cfg.readOnly);
    } catch (e) { await client.shutdown().catch(() => {}); throw mapError(e); }
  },
};
export { meta };
