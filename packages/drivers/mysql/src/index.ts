import { isReadOnlyStatement } from "./readonly.js";
import { meta, quoteIdent } from "./meta.js";
import { readFile } from "node:fs/promises";
import mysql from "mysql2";
import {
  ConnectionLoss, DriverError, type ColumnInfo, type Connection, type DriverPlugin, type DriverErrorKind,
  type ExecuteRequest, type ForeignKey, type IndexInfo, type IntrospectionApi, type ResultEvent, type TableInfo, type Transaction, type Value,
} from "@rizomadb/driver-api";



const SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER), SAFE_MIN = BigInt(Number.MIN_SAFE_INTEGER);

type Field = { type?: string; string(): string | null; buffer(): Buffer | null; name: string; columnType?: number; flags?: number };
/** Lossless integers, JSON as {json}, everything else default (DECIMAL stays string). */
function typeCast(field: Field, next: () => unknown): unknown {
  switch (field.type) {
    case "LONGLONG": {
      const s = field.string();
      if (s === null) return null;
      const b = BigInt(s);
      return b > SAFE_MAX || b < SAFE_MIN ? b : Number(b);
    }
    case "JSON": { const s = field.string(); return s === null ? null : { json: JSON.parse(s) }; }
    case "BIT": case "BLOB": case "TINY_BLOB": case "MEDIUM_BLOB": case "LONG_BLOB": case "GEOMETRY": {
      // Text columns also report BLOB types; binary flag is 128.
      const bin = ((field.flags ?? 0) & 128) !== 0 || field.type === "BIT" || field.type === "GEOMETRY";
      if (!bin) return field.string();
      const b = field.buffer();
      return b === null ? null : new Uint8Array(b);
    }
    default: return next();
  }
}

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const err = e as { message?: string; code?: string; errno?: number; sqlMessage?: string };
  const msg = err.sqlMessage ?? err.message ?? String(e);
  const errno = err.errno ?? 0;
  const code = err.code;
  const opt = { ...(code ? { code } : {}), cause: e };
  let kind: DriverErrorKind = "unknown";
  if (errno === 1064 || errno === 1149 || errno === 1054 || errno === 1146 || errno === 1060 || errno === 1050) kind = "syntax";
  else if (errno === 1045 || errno === 1698) kind = "authentication";
  else if ([1044, 1142, 1143, 1227, 1792, 1290, 1370].includes(errno)) kind = "permission";
  else if ([1062, 1451, 1452, 1048, 1216, 1217, 1406].includes(errno)) kind = "constraint";
  else if (errno === 1317 || errno === 3024) kind = errno === 3024 ? "timeout" : "cancelled";
  else if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|PROTOCOL_CONNECTION_LOST|EPIPE/.test(code ?? "") || /Connection lost|closed state/i.test(msg)) kind = "connection";
  return new DriverError(kind, msg, opt);
}

function kindOf(type: string | undefined): ColumnInfo["kind"] {
  switch (type) {
    case "TINY": case "SHORT": case "LONG": case "INT24": case "LONGLONG": case "YEAR": return "integer";
    case "FLOAT": case "DOUBLE": return "float";
    case "DECIMAL": case "NEWDECIMAL": return "decimal";
    case "VAR_STRING": case "STRING": case "VARCHAR": case "ENUM": case "SET": return "text";
    case "DATE": case "DATETIME": case "TIMESTAMP": case "TIME": case "NEWDATE": return "datetime";
    case "BLOB": case "TINY_BLOB": case "MEDIUM_BLOB": case "LONG_BLOB": case "BIT": case "GEOMETRY": return "binary";
    case "JSON": return "json";
    default: return "other";
  }
}

const toParam = (v: Value): unknown => (v !== null && typeof v === "object" && !(v instanceof Date) && !(v instanceof Uint8Array) && !Array.isArray(v) ? JSON.stringify((v as { json: unknown }).json) : v);

interface Ctx { conn: mysql.Connection; threadId: number; killer: () => Promise<mysql.Connection>; lost: ConnectionLoss; clientReadOnly?: boolean }

async function* run(c: Ctx, req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
  if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
  if (c.clientReadOnly && !isReadOnlyStatement(req.sql)) throw new DriverError("permission", "Connection is read-only: statement rejected");
  const t0 = performance.now();
  const q = c.conn.query({ sql: req.sql, values: (req.params ?? []).map(toParam), rowsAsArray: true, typeCast: typeCast as never });
  let fields: mysql.FieldPacket[] | undefined;
  let header: { affectedRows?: number } | undefined;
  let failure: unknown;
  q.on("fields", (f: mysql.FieldPacket[]) => { fields = f; });
  q.on("result", (r: unknown) => { if (r && !Array.isArray(r) && typeof r === "object" && "affectedRows" in r) header = r as { affectedRows: number }; });
  const stream = q.stream({ highWaterMark: 64 });
  stream.on("error", (e: unknown) => { failure = e; });
  const onAbort = () => {
    void (async () => {
      const k = await c.killer();
      try { await k.promise().query(`KILL QUERY ${c.threadId}`); } finally { k.destroy(); }
    })().catch(() => {});
  };
  signal.addEventListener("abort", onAbort, { once: true });
  const batch = req.batchSize ?? 500, max = req.maxRows ?? Infinity;
  let buf: Value[][] = [], n = 0, sentCols = false;
  try {
    // A killed or dropped connection can leave the row stream waiting forever, so every read races against connection loss.
    const rows = (stream as AsyncIterable<Value[]>)[Symbol.asyncIterator]();
    for (;;) {
      const step = await c.lost.race(rows.next());
      if (step.done) break;
      const row = step.value;
      if (!sentCols && fields) { sentCols = true; yield { type: "columns", columns: colsOf(fields) }; }
      buf.push(row); n++;
      if (buf.length >= batch) { yield { type: "rows", rows: buf }; buf = []; }
      if (n >= max) { stream.destroy(); break; }
    }
    if (failure) throw failure;
    // SLEEP() interrupted by KILL QUERY returns normally; the abort is what counts.
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    if (!sentCols && fields && fields.length) { sentCols = true; yield { type: "columns", columns: colsOf(fields) }; }
    if (buf.length) yield { type: "rows", rows: buf };
    yield { type: "done", rowCount: n, durationMs: performance.now() - t0, ...(header && !(fields && fields.length) ? { affectedRows: header.affectedRows ?? 0 } : {}) };
  } catch (e) {
    throw signal.aborted && !(e instanceof DriverError && e.kind !== "cancelled") ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e);
  } finally { signal.removeEventListener("abort", onAbort); }
}

const colsOf = (f: mysql.FieldPacket[]): ColumnInfo[] =>
  f.map((x) => ({ name: x.name, nativeType: String((x as { type?: string }).type ?? x.columnType ?? ""), kind: kindOf((x as { type?: string }).type) }));

class MysqlConnection implements Connection {
  private lost = new ConnectionLoss();
  constructor(private conn: mysql.Connection, readonly serverInfo: Connection["serverInfo"], private threadId: number, private cfg: mysql.ConnectionOptions, private clientReadOnly = false) {
    const gone = (e?: Error) => this.lost.fire(new DriverError("connection", e?.message ?? "The server closed the connection", { cause: e }));
    conn.once("error", gone); conn.once("end", () => gone());
  }
  private ctx(): Ctx {
    return { conn: this.conn, threadId: this.threadId, lost: this.lost, clientReadOnly: this.clientReadOnly, killer: () => new Promise((res, rej) => { const k = mysql.createConnection(this.cfg); k.connect((e) => (e ? rej(e) : res(k))); }) };
  }
  execute(req: ExecuteRequest, signal: AbortSignal) { return run(this.ctx(), req, signal); }
  quoteIdent = quoteIdent;
  introspect(): IntrospectionApi {
    const q = async (sql: string, p: unknown[] = []) => { try { return (await this.conn.promise().query({ sql, values: p, rowsAsArray: false })) [0] as Record<string, unknown>[]; } catch (e) { throw mapError(e); } };
    return {
      describeSchema: async (schema) => {
        const rows = await q(
          `select c.table_name t, t.table_type tt, c.column_name n, c.column_type ty, c.is_nullable nl, c.column_default d, c.column_key k
           from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
           where c.table_schema = coalesce(?, database()) order by c.table_name, c.ordinal_position`, [schema ?? null]);
        const out = new Map<string, TableInfo>();
        for (const r of rows) {
          const t = out.get(String(r.t)) ?? { ...(schema ? { schema } : {}), name: String(r.t), kind: r.tt === "VIEW" ? "view" as const : "table" as const, columns: [] };
          t.columns!.push({ name: String(r.n), nativeType: String(r.ty), nullable: r.nl === "YES", ...(r.d !== null && r.d !== undefined ? { default: String(r.d) } : {}), primaryKey: r.k === "PRI" });
          out.set(String(r.t), t);
        }
        return [...out.values()];
      },
      foreignKeys: async (schema) => {
        const rows = await q(
          `select constraint_name n, table_schema s, table_name t, column_name c, referenced_table_schema rs, referenced_table_name rt, referenced_column_name rc, ordinal_position o
           from information_schema.key_column_usage where referenced_table_name is not null and table_schema = coalesce(?, database()) order by constraint_name, ordinal_position`, [schema ?? null]);
        const out = new Map<string, ForeignKey>();
        for (const r of rows) {
          const k = `${r.t}.${r.n}`;
          const fk = out.get(k) ?? { name: String(r.n), from: { schema: String(r.s), table: String(r.t), columns: [] }, to: { schema: String(r.rs), table: String(r.rt), columns: [] } };
          fk.from.columns.push(String(r.c)); fk.to.columns.push(String(r.rc)); out.set(k, fk);
        }
        return [...out.values()];
      },
      indexes: async (schema) => {
        const rows = await q(
          `select index_name n, table_name t, column_name c, non_unique nu, seq_in_index o from information_schema.statistics
           where table_schema = coalesce(?, database()) and index_type <> 'FULLTEXT' order by table_name, index_name, seq_in_index`, [schema ?? null]);
        const out = new Map<string, IndexInfo>();
        for (const r of rows) {
          const k = `${r.t}.${r.n}`;
          const i = out.get(k) ?? { name: String(r.n), ...(schema ? { schema } : {}), table: String(r.t), columns: [], unique: Number(r.nu) === 0, primary: r.n === "PRIMARY" };
          i.columns.push(String(r.c)); out.set(k, i);
        }
        return [...out.values()];
      },
      listSchemas: async () => (await q("select schema_name n from information_schema.schemata where schema_name not in ('mysql','sys','performance_schema','information_schema') order by 1")).map((r) => String(r.n)),
      listTables: async (schema) => (await q(
        "select table_schema s, table_name n, table_type t from information_schema.tables where table_schema = coalesce(?, database()) order by 2", [schema ?? null]))
        .map((r): TableInfo => ({ schema: String(r.s), name: String(r.n), kind: r.t === "VIEW" ? "view" : "table" })),
      describeTable: async (ref) => {
        const rows = await q(
          "select column_name n, column_type t, is_nullable nl, column_default d, column_key k from information_schema.columns where table_schema = coalesce(?, database()) and table_name = ? order by ordinal_position",
          [ref.schema ?? null, ref.name]);
        if (rows.length === 0) throw new DriverError("unknown", `Table not found: ${ref.name}`);
        return {
          name: ref.name, ...(ref.schema ? { schema: ref.schema } : {}), kind: "table",
          columns: rows.map((r) => ({ name: String(r.n), nativeType: String(r.t), nullable: r.nl === "YES", ...(r.d !== null && r.d !== undefined ? { default: String(r.d) } : {}), primaryKey: r.k === "PRI" })),
        };
      },
    };
  }
  async begin(): Promise<Transaction> {
    await this.conn.promise().query("START TRANSACTION");
    const c = this.ctx();
    return {
      execute: (req, signal) => run(c, req, signal),
      commit: async () => { await this.conn.promise().query("COMMIT"); },
      rollback: async () => { await this.conn.promise().query("ROLLBACK"); },
    };
  }
  async ping() { try { await this.conn.promise().query("select 1"); } catch (e) { throw mapError(e); } }
  async close() { await new Promise<void>((res) => this.conn.end(() => res())); }
}

export const mysqlDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const options: mysql.ConnectionOptions = {
      host: cfg.host as string, port: (cfg.port as number | undefined) ?? 3306, user: cfg.user as string,
      ...(cfg.database ? { database: cfg.database as string } : {}),
      ...(cfg.password !== undefined ? { password: cfg.password as string } : {}),
      ...(cfg.ssl ? { ssl: { rejectUnauthorized: cfg.sslVerify !== false, ...(cfg.sslCaFile ? { ca: await readFile(String(cfg.sslCaFile)) } : {}) } } : {}),
      timezone: "Z", multipleStatements: false, rowsAsArray: true,
    };
    const conn = mysql.createConnection(options);
    try {
      await new Promise<void>((res, rej) => conn.connect((e) => (e ? rej(e) : res())));
      conn.on("error", () => {});
      const p = conn.promise();
      const [rows] = await p.query({ sql: "select version() v, connection_id() id", rowsAsArray: false }) as unknown as [{ v: string; id: number }[]];
      // TiDB only has a no-op READ ONLY session: enforce read-only in the driver instead of pretending the server does.
      const tidb = /-TiDB-/i.test(rows[0]!.v);
      if (cfg.readOnly && !tidb) await p.query("SET SESSION TRANSACTION READ ONLY");
      return new MysqlConnection(conn, { product: tidb ? "TiDB" : /mariadb/i.test(rows[0]!.v) ? "MariaDB" : "MySQL", version: tidb ? (/-TiDB-v([\d.]+)/i.exec(rows[0]!.v)?.[1] ?? rows[0]!.v) : rows[0]!.v }, rows[0]!.id, options, !!cfg.readOnly && tidb);
    } catch (e) { conn.destroy(); throw mapError(e); }
  },
};

export { quoteIdent };
