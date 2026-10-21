import { Redis, type RedisOptions } from "ioredis";
import {
  DriverError, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin, type ExecuteRequest, type IntrospectionApi, type ResultEvent, type TableInfo, type Value,
} from "@rizomadb/driver-api";
import { meta, quoteIdent } from "./meta.js";
import { assessRedis, parseCommandLine, RedisSyntaxError } from "./parser.js";

export { quoteIdent, assessRedis, parseCommandLine, RedisSyntaxError };

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  if (e instanceof RedisSyntaxError) return new DriverError("syntax", e.message, { position: e.position + 1, cause: e });
  const msg = (e as Error)?.message ?? String(e);
  const opt = { cause: e };
  let kind: DriverErrorKind = "unknown";
  if (/^(WRONGPASS|ERR invalid password|ERR AUTH|NOAUTH)/i.test(msg) || /Authentication required|invalid username-password/i.test(msg)) kind = "authentication";
  else if (/^NOPERM|no permissions/i.test(msg)) kind = "permission";
  else if (/^(ERR unknown command|ERR wrong number|ERR syntax|ERR Unknown|ERR value is not|ERR invalid|WRONGTYPE|ERR index|ERR no such key|ERR offset)/i.test(msg)) kind = "syntax";
  else if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|Connection is closed|connect/i.test(msg)) kind = "connection";
  return new DriverError(kind, msg, opt);
}

const asValue = (v: unknown): Value => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number") return v;
  if (Buffer.isBuffer(v)) return v.toString("utf8");
  return { json: v };
};

const row = (...c: unknown[]): Value[] => c.map(asValue);
const pairs = (a: unknown[]): unknown[][] => { const o: unknown[][] = []; for (let i = 0; i < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };

interface Shape { columns: ColumnInfo[]; rows: Value[][] }
const col = (name: string, kind: ColumnInfo["kind"] = "text"): ColumnInfo => ({ name, nativeType: "redis", kind });

/** Turns a reply into rows. Commands with a known shape get meaningful columns. */
function shapeReply(cmd: string, args: string[], reply: unknown): Shape {
  const a = Array.isArray(reply) ? reply : undefined;
  switch (cmd) {
    case "HGETALL": if (a) return { columns: [col("field"), col("value")], rows: pairs(a).map((p) => row(...p)) }; break;
    case "ZRANGE": case "ZREVRANGE": case "ZRANGEBYSCORE": case "ZREVRANGEBYSCORE":
      if (a && args.some((x) => x.toUpperCase() === "WITHSCORES")) return { columns: [col("member"), col("score", "float")], rows: pairs(a).map(([m, s]) => row(m, Number(s))) }; break;
    case "CONFIG": if (a && args[0]?.toUpperCase() === "GET") return { columns: [col("parameter"), col("value")], rows: pairs(a).map((p) => row(...p)) }; break;
    case "XRANGE": case "XREVRANGE": if (a) return { columns: [col("id"), col("fields", "json")], rows: (a as [string, string[]][]).map(([id, f]) => [id, { json: Object.fromEntries(pairs(f).map(([k, v]) => [String(k), v])) }]) }; break;
    case "INFO": if (typeof reply === "string") return { columns: [col("property"), col("value")], rows: reply.split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes(":")).map((l) => { const i = l.indexOf(":"); return row(l.slice(0, i), l.slice(i + 1)); }) }; break;
    case "SLOWLOG": case "CLIENT": if (typeof reply === "string") return { columns: [col("value")], rows: reply.split(/\r?\n/).filter(Boolean).map((l) => row(l)) }; break;
  }
  if (a) return { columns: [col("index", "integer"), col("value", a.some((x) => Array.isArray(x)) ? "json" : "text")], rows: a.map((v, i) => [i, asValue(v)]) };
  return { columns: [col("value", typeof reply === "number" ? "integer" : "text")], rows: [row(reply)] };
}

class RedisConnection implements Connection {
  private client: Redis;
  constructor(private opts: RedisOptions, client: Redis, readonly serverInfo: Connection["serverInfo"], private readOnly: boolean) { this.client = client; }
  quoteIdent = quoteIdent;

  private fresh(over: RedisOptions = {}): Redis { const c = new Redis({ ...this.opts, ...over, lazyConnect: true, maxRetriesPerRequest: 0, enableOfflineQueue: false, retryStrategy: () => null, protocol: 2 }); c.on("error", () => {}); return c; }

  /** Redis cannot interrupt a running command: cancelling drops the connection and opens a new one. */
  private async hardReset() { const old = this.client; this.client = this.fresh(); old.disconnect(); await this.client.connect().catch(() => {}); }

  async *execute(req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const t0 = performance.now();
    let aborted = false;
    const onAbort = () => { aborted = true; void this.hardReset(); };
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      const args = parseCommandLine(req.sql);
      if (!args.length) throw new DriverError("syntax", "Empty command");
      const cmd = args[0]!.toUpperCase(), rest = args.slice(1);
      if (this.readOnly && assessRedis(req.sql).risk !== "none") throw new DriverError("permission", "Connection is read-only: command rejected");
      if (cmd === "KEYS") throw new DriverError("permission", "KEYS blocks the whole server while it scans. Use SCAN [MATCH pattern] [COUNT n] [TYPE t], which RizomaDB iterates for you.");
      if (["MONITOR", "SUBSCRIBE", "PSUBSCRIBE", "SSUBSCRIBE", "SYNC", "PSYNC"].includes(cmd)) throw new DriverError("unsupported", `${cmd} is a streaming command and is not available in the query console.`);
      let shape: Shape;
      if (cmd === "SCAN") shape = await this.scan(rest, req.maxRows ?? 100_000, () => aborted);
      else if (cmd === "OPEN") shape = await this.open(rest);
      else shape = shapeReply(cmd, rest, await this.client.call(cmd, ...rest));
      if (aborted) throw new DriverError("cancelled", "Query cancelled");
      yield { type: "columns", columns: shape.columns };
      const batch = req.batchSize ?? 500, max = req.maxRows ?? Infinity;
      const rows = shape.rows.slice(0, max);
      for (let i = 0; i < rows.length; i += batch) yield { type: "rows", rows: rows.slice(i, i + batch) };
      yield { type: "done", rowCount: rows.length, durationMs: performance.now() - t0 };
    } catch (e) {
      throw aborted || signal.aborted ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e);
    } finally { signal.removeEventListener("abort", onAbort); }
  }

  /** SCAN with the cursor handled for the user: iterates until the cursor returns to 0 or the row cap is reached. */
  private async scan(a: string[], cap: number, stopped: () => boolean): Promise<Shape> {
    const opts = [...a];
    if (/^\d+$/.test(opts[0] ?? "")) opts.shift();
    if (!opts.some((x) => x.toUpperCase() === "COUNT")) opts.push("COUNT", "1000");
    const keys: string[] = []; let cursor = "0";
    do {
      if (stopped()) break;
      const [next, batch] = (await this.client.call("SCAN", cursor, ...opts)) as [string, string[]];
      cursor = next; keys.push(...batch);
    } while (cursor !== "0" && keys.length < cap);
    const types = keys.length <= 2000 ? await Promise.all(keys.map((k) => this.client.type(k))) : [];
    return { columns: [col("key"), ...(types.length ? [col("type")] : [])], rows: keys.slice(0, cap).map((k, i) => (types.length ? row(k, types[i]) : row(k))) };
  }

  /** `OPEN key [limit]` shows a key according to its type. */
  private async open(a: string[]): Promise<Shape> {
    const key = a[0]; const limit = Math.max(1, Number(a[1] ?? 200));
    if (!key) throw new DriverError("syntax", "OPEN needs a key name");
    const type = await this.client.type(key);
    switch (type) {
      case "string": return { columns: [col("value")], rows: [row(await this.client.get(key))] };
      case "hash": { const r = await this.client.hgetall(key); return { columns: [col("field"), col("value")], rows: Object.entries(r).slice(0, limit).map(([f, v]) => row(f, v)) }; }
      case "list": return { columns: [col("index", "integer"), col("value")], rows: (await this.client.lrange(key, 0, limit - 1)).map((v, i) => [i, v]) };
      case "set": { const [, m] = await this.client.sscan(key, "0", "COUNT", String(limit)); return { columns: [col("member")], rows: m.slice(0, limit).map((v) => row(v)) }; }
      case "zset": { const r = await this.client.zrange(key, "0", String(limit - 1), "WITHSCORES"); return { columns: [col("member"), col("score", "float")], rows: pairs(r).map(([m, s]) => row(m, Number(s))) }; }
      case "stream": return shapeReply("XRANGE", [], await this.client.xrange(key, "-", "+", "COUNT", String(limit)));
      case "ReJSON-RL": return { columns: [col("json", "json")], rows: [[{ json: JSON.parse(String(await this.client.call("JSON.GET", key))) }]] };
      default: throw new DriverError("syntax", `Key "${key}" does not exist`);
    }
  }

  introspect(): IntrospectionApi {
    const withDb = async <T>(schema: string | undefined, f: (c: Redis) => Promise<T>) => {
      const n = schema?.startsWith("db") ? Number(schema.slice(2)) : undefined;
      if (n === undefined || Number.isNaN(n)) return f(this.client);
      const c = this.fresh({ db: n }); try { await c.connect(); return await f(c); } finally { c.disconnect(); }
    };
    return {
      listSchemas: async () => {
        const info = await this.client.info("keyspace");
        const withKeys = [...info.matchAll(/^db(\d+):/gm)].map((m) => `db${m[1]}`);
        return withKeys.length ? withKeys : ["db0"];
      },
      listTables: async (schema) => withDb(schema, async (c) => {
        const keys: string[] = []; let cursor = "0";
        do { const [n, b] = (await c.scan(cursor, "COUNT", "1000")) as [string, string[]]; cursor = n; keys.push(...b); } while (cursor !== "0" && keys.length < 1000);
        return keys.sort().map((k): TableInfo => ({ schema: schema ?? "db0", name: k, kind: "table" }));
      }),
      describeTable: async (ref) => withDb(ref.schema, async (c) => {
        const type = await c.type(ref.name);
        const ttl = await c.ttl(ref.name);
        const cols = type === "hash" ? ["field", "value"] : type === "zset" ? ["member", "score"] : type === "list" ? ["index", "value"] : type === "set" ? ["member"] : type === "stream" ? ["id", "fields"] : ["value"];
        return { schema: ref.schema ?? "db0", name: ref.name, kind: "table", columns: cols.map((n, i) => ({ name: n, nativeType: `${type}${ttl >= 0 ? ` ttl=${ttl}s` : ""}`, nullable: false, primaryKey: i === 0 && type !== "string" })) };
      }),
    };
  }

  async ping() { try { await this.client.ping(); } catch (e) { throw mapError(e); } }
  async close() { this.client.disconnect(); }
}

export const redisDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const opts: RedisOptions = {
      host: String(cfg.host ?? "localhost"), port: Number(cfg.port ?? 6379), db: Number(cfg.database ?? 0), connectTimeout: 8000,
      ...(cfg.user ? { username: String(cfg.user) } : {}), ...(cfg.password !== undefined ? { password: String(cfg.password) } : {}),
      ...(cfg.ssl ? { tls: { rejectUnauthorized: cfg.sslVerify !== false } } : {}),
      lazyConnect: true, maxRetriesPerRequest: 0, enableOfflineQueue: false, retryStrategy: () => null, protocol: 2,
    };
    const client = new Redis(opts);
    client.on("error", () => {});
    try {
      await client.connect();
      const info = await client.info("server");
      const name = /server_name:(\w+)/.exec(info)?.[1];
      const version = /(?:valkey_version|redis_version):([^\r\n]+)/.exec(info)?.[1] ?? "";
      return new RedisConnection(opts, client, { product: name === "valkey" || /valkey_version/.test(info) ? "Valkey" : "Redis", version }, !!cfg.readOnly);
    } catch (e) { client.disconnect(); throw mapError(e); }
  },
};
export { meta };
