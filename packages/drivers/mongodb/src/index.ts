import { Binary, Decimal128, Long, MongoClient, MongoError, MongoServerError, ObjectId, UUID, type Db, type Document, type MongoClientOptions } from "mongodb";
import {
  DriverError, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin, type EditTargetRef, type ExecuteRequest, type IntrospectionApi, type ResultEvent, type TableInfo, type Value,
} from "@rizomadb/driver-api";
import { meta, quoteIdent } from "./meta.js";
import { assessMongo } from "./assess.js";
import { MongoSyntaxError, parseMongoCommand, type ParsedCommand } from "./parser.js";

export { quoteIdent, assessMongo, parseMongoCommand, MongoSyntaxError };

const SAFE_MIN = BigInt(Number.MIN_SAFE_INTEGER), SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER);

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  if (e instanceof MongoSyntaxError) return new DriverError("syntax", e.message, { position: e.position + 1, cause: e });
  const err = e as { code?: number | string; codeName?: string; message?: string; name?: string };
  const msg = err.message ?? String(e);
  const opt = { ...(err.code !== undefined ? { code: String(err.code) } : {}), cause: e };
  let kind: DriverErrorKind = "unknown";
  if (err.name === "AbortError" || /aborted|operation was interrupted|interrupted/i.test(msg) || err.code === 11601 || err.code === 11600) kind = "cancelled";
  else if (e instanceof MongoServerError) {
    if (err.code === 18 || err.code === 8000 || err.codeName === "AuthenticationFailed") kind = "authentication";
    else if (err.code === 13 || err.codeName === "Unauthorized") kind = "permission";
    else if (err.code === 11000 || err.code === 121) kind = "constraint";
    else if (err.code === 50 || err.codeName === "MaxTimeMSExpired") kind = "timeout";
    else if (err.code === 2 || err.code === 9 || err.code === 168 || err.code === 40415 || err.code === 59 || err.code === 40324) kind = "syntax";
  } else if (e instanceof MongoError && /ECONNREFUSED|ENOTFOUND|server selection|timed out|ECONNRESET|topology|connect/i.test(`${err.name} ${msg}`)) kind = "connection";
  else if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Server selection/i.test(msg)) kind = "connection";
  return new DriverError(kind, msg, opt);
}

// ----- BSON <-> normalized values -----
const bsonTypeName = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (v instanceof ObjectId) return "objectId"; if (v instanceof Date) return "date"; if (v instanceof Long) return "long"; if (v instanceof Decimal128) return "decimal";
  if (v instanceof Binary) return v.sub_type === 4 ? "uuid" : "binData"; if (v instanceof RegExp) return "regex";
  if (Array.isArray(v)) return "array"; if (typeof v === "object") return "object";
  if (typeof v === "number") return Number.isInteger(v) ? "int" : "double"; return typeof v;
};

/** Plain JSON for nested documents: bson types become their canonical relaxed forms. */
function plain(v: unknown): unknown {
  if (v instanceof ObjectId) return { $oid: v.toHexString() };
  if (v instanceof Date) return { $date: v.toISOString() };
  if (v instanceof Long) return { $numberLong: v.toString() };
  if (v instanceof Decimal128) return { $numberDecimal: v.toString() };
  if (v instanceof Binary) return v.sub_type === 4 ? { $uuid: new UUID(v.buffer).toHexString(true) } : { $binary: Buffer.from(v.buffer).toString("base64") };
  if (v instanceof RegExp) return { $regex: v.source, $options: v.flags };
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, plain(x)]));
  return v;
}

export function toValue(v: unknown): Value {
  if (v === null || v === undefined) return null;
  if (v instanceof ObjectId) return v.toHexString();
  if (v instanceof Date) return v;
  if (v instanceof Long) { const b = v.toBigInt(); return b >= SAFE_MIN && b <= SAFE_MAX ? Number(b) : b; }
  if (v instanceof Decimal128) return v.toString();
  if (v instanceof Binary) return v.sub_type === 4 ? new UUID(v.buffer).toHexString(true) : new Uint8Array(v.buffer);
  if (v instanceof RegExp) return `/${v.source}/${v.flags}`;
  if (typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return v >= SAFE_MIN && v <= SAFE_MAX ? Number(v) : v;
  return { json: plain(v) };
}

const kindOfValue = (v: unknown): ColumnInfo["kind"] => {
  const t = bsonTypeName(v);
  return t === "int" || t === "long" ? "integer" : t === "double" ? "float" : t === "decimal" ? "decimal" : t === "boolean" ? "boolean" : t === "date" ? "datetime" : t === "binData" ? "binary" : t === "object" || t === "array" ? "json" : t === "string" || t === "objectId" || t === "uuid" ? "text" : "other";
};

/** Shell-lite text for a normalized value, used to build commands that round-trip typed ids. */
export function valueToShell(v: Value, bsonType?: string): string {
  if (v === null) return "null";
  if (typeof v === "string") return bsonType === "objectId" && /^[0-9a-f]{24}$/i.test(v) ? `ObjectId("${v}")` : bsonType === "uuid" ? `UUID("${v}")` : JSON.stringify(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "bigint") return `NumberLong("${v}")`;
  if (typeof v === "boolean") return String(v);
  if (v instanceof Date) return `ISODate("${v.toISOString()}")`;
  if (v instanceof Uint8Array) return `BinData(0, "${Buffer.from(v).toString("base64")}")`;
  if (Array.isArray(v)) return `[${v.map((x) => valueToShell(x)).join(", ")}]`;
  return jsonToShell((v as { json: unknown }).json);
}
export function jsonToShell(x: unknown): string {
  if (x === null || x === undefined) return "null";
  if (Array.isArray(x)) return `[${x.map(jsonToShell).join(", ")}]`;
  if (typeof x === "object") {
    const o = x as Record<string, unknown>;
    if (typeof o.$oid === "string" && Object.keys(o).length === 1) return `ObjectId("${o.$oid}")`;
    if (typeof o.$date === "string" && Object.keys(o).length === 1) return `ISODate("${o.$date}")`;
    if (typeof o.$numberLong === "string") return `NumberLong("${o.$numberLong}")`;
    if (typeof o.$numberDecimal === "string") return `NumberDecimal("${o.$numberDecimal}")`;
    if (typeof o.$uuid === "string") return `UUID("${o.$uuid}")`;
    return `{ ${Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${jsonToShell(v)}`).join(", ")} }`;
  }
  return typeof x === "string" ? JSON.stringify(x) : String(x);
}

// ----- execution -----
const WRITE_METHODS = new Set(["insertOne", "insertMany", "updateOne", "updateMany", "replaceOne", "deleteOne", "deleteMany", "createIndex", "createIndexes", "dropIndex", "dropIndexes", "drop", "findOneAndUpdate", "findOneAndReplace", "findOneAndDelete", "bulkWrite", "renameCollection", "remove"]);

async function* docsToEvents(docs: AsyncIterable<unknown> | unknown[], req: ExecuteRequest, signal: AbortSignal, t0: number): AsyncGenerator<ResultEvent> {
  const batch = req.batchSize ?? 500, max = req.maxRows ?? Infinity;
  const head: Document[] = [];
  const iter = (Symbol.asyncIterator in (docs as object) ? (docs as AsyncIterable<unknown>)[Symbol.asyncIterator]() : (async function* () { yield* docs as unknown[]; })());
  let more = true;
  while (head.length < 100 && more) { const r = await iter.next(); if (r.done) more = false; else head.push(r.value as Document); }
  const names: string[] = [];
  for (const d of head) for (const k of Object.keys(d)) if (!names.includes(k)) names.push(k);
  if (names.includes("_id")) names.splice(names.indexOf("_id"), 1), names.unshift("_id");
  const kindOf = (n: string) => { for (const d of head) { const x = d[n]; if (x !== null && x !== undefined) return { kind: kindOfValue(x), type: bsonTypeName(x) }; } return { kind: "other" as const, type: "null" }; };
  const cols = names.map((n): ColumnInfo => { const k = kindOf(n); return { name: n, nativeType: k.type, kind: k.kind }; });
  yield { type: "columns", columns: cols };
  let buf: Value[][] = [], n = 0;
  const row = (d: Document) => names.map((c) => toValue(d[c]));
  const push = function* (d: Document): Generator<ResultEvent, boolean> {
    buf.push(row(d)); n++;
    if (buf.length >= batch) { yield { type: "rows", rows: buf }; buf = []; }
    return n >= max;
  };
  for (const d of head) { if (signal.aborted) throw new DriverError("cancelled", "Query cancelled"); if (yield* push(d)) { more = false; break; } }
  while (more) {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const r = await iter.next(); if (r.done) break;
    if (yield* push(r.value as Document)) break;
  }
  if (buf.length) yield { type: "rows", rows: buf };
  yield { type: "done", rowCount: n, durationMs: performance.now() - t0 };
}

class MongoConnection implements Connection {
  constructor(private client: MongoClient, private defaultDb: string, readonly serverInfo: Connection["serverInfo"], private readOnly: boolean) {}
  quoteIdent = quoteIdent;
  private db(name?: string): Db { return this.client.db(name ?? this.defaultDb); }

  async *execute(req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const t0 = performance.now();
    try {
      const cmd = parseMongoCommand(req.sql);
      if (this.readOnly && assessMongo(req.sql).risk !== "none") throw new DriverError("permission", "Connection is read-only: command rejected");
      yield* this.run(cmd, req, signal, t0);
    } catch (e) { throw signal.aborted && !(e instanceof DriverError && e.kind !== "cancelled") ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e); }
  }

  private async *run(c: ParsedCommand, req: ExecuteRequest, signal: AbortSignal, t0: number): AsyncGenerator<ResultEvent> {
    const db = this.db(c.database);
    const one = (obj: Document) => docsToEvents([obj], req, signal, t0);
    if (c.target === "db") {
      switch (c.method) {
        case "runCommand": yield* one(await db.command(c.args[0] as Document, { signal })); return;
        case "stats": yield* one(await db.command({ dbStats: 1 }, { signal })); return;
        case "getCollectionNames": yield* docsToEvents((await db.listCollections({}, { nameOnly: true }).toArray()).map((x) => ({ name: x.name })), req, signal, t0); return;
        case "listCollections": yield* docsToEvents(await db.listCollections({}, { nameOnly: false }).toArray(), req, signal, t0); return;
        case "dropDatabase": yield* one({ dropped: await db.dropDatabase() }); return;
        case "serverStatus": case "hello": yield* one(await db.command({ [c.method]: 1 }, { signal })); return;
        default: throw new DriverError("syntax", `Unsupported database command db.${c.method}()`);
      }
    }
    const coll = db.collection(c.collection!);
    const a = c.args as Document[];
    const opts = { signal };
    switch (c.method) {
      case "find": {
        let cur = coll.find(a[0] ?? {}, { ...opts, ...(a[1] ? { projection: a[1] } : {}) });
        for (const ch of c.chain) {
          if (ch.method === "sort") cur = cur.sort(ch.args[0] as Document); else if (ch.method === "limit") cur = cur.limit(Number(ch.args[0]));
          else if (ch.method === "skip") cur = cur.skip(Number(ch.args[0])); else if (ch.method === "project") cur = cur.project(ch.args[0] as Document);
          else if (ch.method === "hint") cur = cur.hint(ch.args[0] as string | Document); else if (ch.method === "maxTimeMS") cur = cur.maxTimeMS(Number(ch.args[0]));
          else if (ch.method === "explain") { yield* one(await cur.explain("queryPlanner")); return; }
          else throw new DriverError("syntax", `Unsupported cursor method .${ch.method}()`);
        }
        try { yield* docsToEvents(cur, req, signal, t0); } finally { await cur.close().catch(() => {}); }
        return;
      }
      case "findOne": { const d = await coll.findOne(a[0] ?? {}, { ...opts, ...(a[1] ? { projection: a[1] } : {}) }); yield* docsToEvents(d ? [d] : [], req, signal, t0); return; }
      case "aggregate": { const cur = coll.aggregate(c.args[0] as Document[], { ...opts, ...(a[1] ?? {}) }); try { yield* docsToEvents(cur, req, signal, t0); } finally { await cur.close().catch(() => {}); } return; }
      case "countDocuments": yield* one({ count: await coll.countDocuments(a[0] ?? {}, opts) }); return;
      case "estimatedDocumentCount": yield* one({ count: await coll.estimatedDocumentCount() }); return;
      case "distinct": yield* docsToEvents((await coll.distinct(String(c.args[0]), a[1] ?? {})).map((value) => ({ value })), req, signal, t0); return;
      case "getIndexes": yield* docsToEvents(await coll.indexes(), req, signal, t0); return;
      case "insertOne": { const r = await coll.insertOne(a[0]!); yield { type: "done", rowCount: 0, affectedRows: r.acknowledged ? 1 : 0, durationMs: performance.now() - t0 }; return; }
      case "insertMany": { const r = await coll.insertMany(c.args[0] as Document[]); yield { type: "done", rowCount: 0, affectedRows: r.insertedCount, durationMs: performance.now() - t0 }; return; }
      case "updateOne": case "updateMany": case "replaceOne": {
        const r = c.method === "updateOne" ? await coll.updateOne(a[0]!, a[1]!, (a[2] ?? {})) : c.method === "updateMany" ? await coll.updateMany(a[0]!, a[1]!, (a[2] ?? {})) : await coll.replaceOne(a[0]!, a[1]!, (a[2] ?? {}));
        // affectedRows reports matched documents so a miss is visible as a concurrency conflict.
        yield { type: "done", rowCount: 0, affectedRows: r.matchedCount + (r.upsertedCount ?? 0), durationMs: performance.now() - t0 }; return;
      }
      case "deleteOne": case "deleteMany": { const r = c.method === "deleteOne" ? await coll.deleteOne(a[0] ?? {}) : await coll.deleteMany(a[0] ?? {}); yield { type: "done", rowCount: 0, affectedRows: r.deletedCount, durationMs: performance.now() - t0 }; return; }
      case "createIndex": yield* one({ name: await coll.createIndex(a[0]!, a[1] ?? {}) }); return;
      case "dropIndex": yield* one(await coll.dropIndex(String(c.args[0]))); return;
      case "drop": yield* one({ dropped: await coll.drop() }); return;
      default: throw new DriverError("syntax", `Unsupported collection method ${c.method}()${WRITE_METHODS.has(c.method) ? "" : ""}`);
    }
  }

  introspect(): IntrospectionApi {
    const client = this.client;
    const sampleFields = async (db: string, name: string): Promise<TableInfo> => {
      const docs = await client.db(db).collection(name).aggregate([{ $sample: { size: 100 } }]).toArray().catch(() => [] as Document[]);
      const counts = new Map<string, Map<string, number>>();
      for (const d of docs) for (const [k, v] of Object.entries(d)) { const m = counts.get(k) ?? new Map<string, number>(); const t = bsonTypeName(v); m.set(t, (m.get(t) ?? 0) + 1); counts.set(k, m); }
      const cols = [...counts.entries()].sort(([a], [b]) => (a === "_id" ? -1 : b === "_id" ? 1 : a < b ? -1 : 1)).map(([k, m]) => {
        const present = [...m.values()].reduce((x, y) => x + y, 0);
        const types = [...m.entries()].sort((x, y) => y[1] - x[1]).map(([t, n]) => (m.size > 1 ? `${t} ${Math.round((n / docs.length) * 100)}%` : t)).join(" | ");
        return { name: k, nativeType: types, nullable: k !== "_id" && (present < docs.length || m.has("null")), primaryKey: k === "_id" };
      });
      return { schema: db, name, kind: "table", columns: cols };
    };
    return {
      listSchemas: async () => (await client.db().admin().listDatabases({ nameOnly: true })).databases.map((d) => d.name).filter((n) => !["admin", "local", "config"].includes(n)).sort(),
      listTables: async (schema) => (await this.db(schema).listCollections({}, { nameOnly: false }).toArray()).filter((c) => !c.name.startsWith("system.")).map((c): TableInfo => ({ schema: schema ?? this.defaultDb, name: c.name, kind: c.type === "view" ? "view" : "table" })).sort((a, b) => (a.name < b.name ? -1 : 1)),
      describeTable: async (ref) => sampleFields(ref.schema ?? this.defaultDb, ref.name),
      describeSchema: async (schema) => { const db = schema ?? this.defaultDb; const names = (await this.db(db).listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith("system.")).slice(0, 200); return Promise.all(names.map((n) => sampleFields(db, n))); },
      foreignKeys: async () => [],
      indexes: async (schema) => {
        const db = schema ?? this.defaultDb; const out = [];
        for (const c of await this.db(db).listCollections({}, { nameOnly: true }).toArray()) {
          if (c.name.startsWith("system.")) continue;
          for (const i of await this.db(db).collection(c.name).indexes().catch(() => [])) out.push({ name: String(i.name), schema: db, table: c.name, columns: Object.keys(i.key as object), unique: !!i.unique || i.name === "_id_", primary: i.name === "_id_" });
        }
        return out;
      },
    };
  }

  async ping() { try { await this.db("admin").command({ ping: 1 }); } catch (e) { throw mapError(e); } }
  async close() { await this.client.close(true).catch(() => {}); }
}

const scalar = (v: Value) => v === null || ["string", "number", "boolean", "bigint"].includes(typeof v) || v instanceof Date;
const idType = (t: EditTargetRef, name: string) => t.columns.find((c) => c.name === name)?.nativeType.split(" ")[0];
const coll = (t: { schema?: string; table: string }) => `db${t.schema ? `.getSiblingDB(${JSON.stringify(t.schema)})` : ""}.getCollection(${JSON.stringify(t.table)})`;

export const mongoDriver: DriverPlugin = {
  ...meta,
  openCommand: (ref, limit) => `db${ref.schema ? `.getSiblingDB(${JSON.stringify(ref.schema)})` : ""}.getCollection(${JSON.stringify(ref.name)}).find({}).limit(${limit})`,
  generateChange(t, c) {
    const lit = (name: string, v: Value) => valueToShell(v, idType(t, name));
    const doc = (o: Record<string, Value>) => `{ ${Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${lit(k, v)}`).join(", ")} }`;
    if (c.kind === "insert") return { sql: `${coll(t)}.insertOne(${doc(c.values)})`, params: [], description: "Insert document" };
    const keyOnly = (k: string) => k in c.key;
    const f = `{ ${Object.entries({ ...c.before, ...c.key }).filter(([k, v]) => keyOnly(k) || scalar(v)).map(([k, v]) => `${JSON.stringify(k)}: ${lit(k, v)}`).join(", ")} }`;
    if (c.kind === "update") return { sql: `${coll(t)}.updateOne(${f}, { "$set": ${doc(c.set)} })`, params: [], description: `Update ${Object.keys(c.set).join(", ")}` };
    return { sql: `${coll(t)}.deleteOne(${f})`, params: [], description: "Delete document" };
  },
  async connect(cfg) {
    const opts: MongoClientOptions = { serverSelectionTimeoutMS: 8000, appName: "RizomaDB", ...(cfg.ssl === false ? {} : cfg.uri ? {} : { tls: true }), ...(cfg.sslVerify === false ? { tlsAllowInvalidCertificates: true } : {}) };
    const host = String(cfg.host ?? "localhost"), port = Number(cfg.port ?? 27017);
    const uri = cfg.uri ? String(cfg.uri) : `mongodb://${host}:${port}/${encodeURIComponent(String(cfg.database ?? ""))}`;
    const client = new MongoClient(uri, {
      ...opts, ...(cfg.ssl === false && !cfg.uri ? { tls: false } : {}),
      ...(cfg.user && !cfg.uri ? { auth: { username: String(cfg.user), password: String(cfg.password ?? "") }, authSource: String(cfg.authSource ?? "admin") } : {}),
    });
    try {
      await client.connect();
      const defaultDb = String(cfg.database || client.options.dbName || "test");
      const info = await client.db("admin").command({ buildInfo: 1 });
      return new MongoConnection(client, defaultDb, { product: "MongoDB", version: String(info.version) }, !!cfg.readOnly);
    } catch (e) { await client.close(true).catch(() => {}); throw mapError(e); }
  },
};
export { meta };
