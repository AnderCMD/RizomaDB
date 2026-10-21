import { meta, quoteIdent } from "./meta.js";
import { Connection as Tds, Request, TYPES } from "tedious";

type ColumnMetaData = { colName: string; type: { name: string } };
import {
  DriverError, type ColumnInfo, type Connection, type DriverErrorKind, type DriverPlugin,
  type ExecuteRequest, type ForeignKey, type IndexInfo, type IntrospectionApi, type ResultEvent, type TableInfo, type Transaction, type Value,
} from "@rizomadb/driver-api";



const SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER), SAFE_MIN = BigInt(Number.MIN_SAFE_INTEGER);

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const err = e as { message?: string; code?: string; number?: number; lineNumber?: number };
  const msg = err.message ?? String(e);
  const n = err.number ?? 0;
  const opt = { ...(err.code ? { code: err.code } : {}), cause: e };
  let kind: DriverErrorKind = "unknown";
  if ([102, 105, 156, 170, 207, 208, 2812, 8180, 195, 245].includes(n)) kind = "syntax";
  else if (err.code === "ELOGIN" || n === 18456) kind = "authentication";
  else if ([229, 230, 262, 297, 300, 916, 3701].includes(n)) kind = "permission";
  else if ([515, 547, 2601, 2627, 8152].includes(n)) kind = "constraint";
  else if (err.code === "ECANCEL") kind = "cancelled";
  else if (err.code === "ETIMEOUT") kind = /login|connect/i.test(msg) ? "connection" : "timeout";
  else if (["ESOCKET", "ECONNRESET", "ECLOSE", "EINVALIDSTATE"].includes(err.code ?? "")) kind = "connection";
  return new DriverError(kind, msg, opt);
}

function kindOf(t: string): ColumnInfo["kind"] {
  if (/^(TinyInt|SmallInt|Int|BigInt)$/.test(t)) return "integer";
  if (/^(Float|Real)$/.test(t)) return "float";
  if (/^(Decimal|Numeric|Money|SmallMoney)$/.test(t)) return "decimal";
  if (/Char|Text|Xml|UniqueIdentifier/i.test(t)) return "text";
  if (t === "Bit") return "boolean";
  if (/Date|Time/.test(t)) return "datetime";
  if (/Binary|Image/.test(t)) return "binary";
  return "other";
}

const WRITE_RE = /\b(insert|update|delete|merge|drop|alter|create|truncate|exec|execute|grant|revoke|deny|backup|restore|shutdown|into|bulk|openrowset|openquery|writetext|updatetext|dbcc|kill|sp_)\b/i;
export function isReadOnlySafe(sql: string): boolean {
  const s = sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/'(?:[^']|'')*'/g, "''").replace(/\[(?:[^\]]|\]\])*\]/g, "[]");
  return /^\s*(select|with|waitfor|set\s+nocount|declare)\b/i.test(s) && !WRITE_RE.test(s);
}

function param(req: Request, i: number, v: Value) {
  const name = `p${i + 1}`;
  if (v === null) req.addParameter(name, TYPES.NVarChar, null);
  else if (typeof v === "string") req.addParameter(name, TYPES.NVarChar, v);
  else if (typeof v === "bigint") req.addParameter(name, TYPES.BigInt, v.toString());
  else if (typeof v === "number") req.addParameter(name, Number.isInteger(v) ? (Math.abs(v) < 2 ** 31 ? TYPES.Int : TYPES.BigInt) : TYPES.Float, v);
  else if (typeof v === "boolean") req.addParameter(name, TYPES.Bit, v);
  else if (v instanceof Date) req.addParameter(name, TYPES.DateTime2, v);
  else if (v instanceof Uint8Array) req.addParameter(name, TYPES.VarBinary, Buffer.from(v));
  else req.addParameter(name, TYPES.NVarChar, JSON.stringify(v));
}

function normalize(v: unknown, type: string): Value {
  if (v === null || v === undefined) return null;
  if (type === "BigInt" && typeof v === "string") { const b = BigInt(v); return b > SAFE_MAX || b < SAFE_MIN ? b : Number(b); }
  if (Buffer.isBuffer(v)) return new Uint8Array(v);
  return v as Value;
}

type Item = { row: Value[] } | { cols: ColumnInfo[] } | { end: number } | { err: unknown };

async function* run(tds: Tds, readOnly: boolean, req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
  if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
  if (readOnly && !isReadOnlySafe(req.sql)) throw new DriverError("permission", "Connection is read-only: statement rejected");
  const t0 = performance.now();
  const q: Item[] = [];
  let wake: (() => void) | undefined;
  const push = (i: Item) => { q.push(i); wake?.(); wake = undefined; };
  let types: string[] = [];
  const r = new Request(req.sql, (err, rowCount) => push(err ? { err } : { end: rowCount ?? 0 }));
  (req.params ?? []).forEach((v, i) => param(r, i, v));
  r.on("columnMetadata", (cols: ColumnMetaData[] | Record<string, ColumnMetaData>) => {
    const list = Array.isArray(cols) ? cols : Object.values(cols);
    types = list.map((c) => c.type.name);
    push({ cols: list.map((c) => ({ name: c.colName, nativeType: c.type.name, kind: kindOf(c.type.name) })) });
  });
  r.on("row", (cols: { value: unknown }[]) => {
    push({ row: cols.map((c, i) => normalize(c.value, types[i] ?? "")) });
    if (q.length > 2000) r.pause();
  });
  const onAbort = () => { tds.cancel(); };
  signal.addEventListener("abort", onAbort, { once: true });
  tds.execSql(r);
  const batch = req.batchSize ?? 500, max = req.maxRows ?? Infinity;
  let buf: Value[][] = [], n = 0, ended: number | undefined, stopped = false;
  try {
    while (ended === undefined) {
      if (!q.length) { await new Promise<void>((res) => { wake = res; }); continue; }
      const it = q.shift()!;
      if (q.length < 500) r.resume();
      if ("err" in it) throw it.err;
      if ("cols" in it) { yield { type: "columns", columns: it.cols }; }
      else if ("end" in it) ended = it.end;
      else if (!stopped) {
        buf.push(it.row); n++;
        if (buf.length >= batch) { yield { type: "rows", rows: buf }; buf = []; }
        if (n >= max) { stopped = true; tds.cancel(); }
      }
    }
    if (buf.length) yield { type: "rows", rows: buf };
    yield { type: "done", rowCount: n, durationMs: performance.now() - t0, ...(types.length === 0 ? { affectedRows: ended } : {}) };
  } catch (e) {
    if (stopped && (e as { code?: string }).code === "ECANCEL") {
      if (buf.length) yield { type: "rows", rows: buf };
      yield { type: "done", rowCount: n, durationMs: performance.now() - t0 };
      return;
    }
    throw signal.aborted ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e);
  } finally { signal.removeEventListener("abort", onAbort); }
}

class MssqlConnection implements Connection {
  constructor(private tds: Tds, readonly serverInfo: Connection["serverInfo"], private readOnly: boolean) {}
  execute(req: ExecuteRequest, signal: AbortSignal) { return run(this.tds, this.readOnly, req, signal); }
  quoteIdent = quoteIdent;
  private async rows(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    await new Promise<void>((res, rej) => {
      const r = new Request(sql, (e) => (e ? rej(mapError(e)) : res()));
      params.forEach((p, i) => r.addParameter(`p${i + 1}`, TYPES.NVarChar, p as string | null));
      r.on("row", (cols: { metadata: { colName: string }; value: unknown }[]) => out.push(Object.fromEntries(cols.map((c) => [c.metadata.colName, c.value]))));
      this.tds.execSql(r);
    });
    return out;
  }
  introspect(): IntrospectionApi {
    return {
      describeSchema: async (schema) => {
        const rows = await this.rows(
          `select o.name t, o.type k, c.name n, ty.name + case when ty.name in ('varchar','char','varbinary','binary') then '(' + case when c.max_length = -1 then 'max' else cast(c.max_length as varchar(10)) end + ')' when ty.name in ('nvarchar','nchar') then '(' + case when c.max_length = -1 then 'max' else cast(c.max_length/2 as varchar(10)) end + ')' when ty.name in ('decimal','numeric') then '(' + cast(c.precision as varchar(5)) + ',' + cast(c.scale as varchar(5)) + ')' else '' end ty, c.is_nullable nl, dc.definition d,
                  cast(case when exists (select 1 from sys.index_columns ic join sys.indexes i on i.object_id = ic.object_id and i.index_id = ic.index_id
                    where i.is_primary_key = 1 and ic.object_id = c.object_id and ic.column_id = c.column_id) then 1 else 0 end as bit) pk
           from sys.columns c join sys.objects o on o.object_id = c.object_id and o.type in ('U','V') join sys.schemas s on s.schema_id = o.schema_id
           join sys.types ty on ty.user_type_id = c.user_type_id left join sys.default_constraints dc on dc.object_id = c.default_object_id
           where s.name = coalesce(@p1, schema_name()) order by o.name, c.column_id`, [schema ?? null]);
        const out = new Map<string, TableInfo>();
        for (const r of rows) {
          const t = out.get(String(r.t)) ?? { ...(schema ? { schema } : {}), name: String(r.t), kind: r.k === "V" ? "view" as const : "table" as const, columns: [] };
          t.columns!.push({ name: String(r.n), nativeType: String(r.ty), nullable: Boolean(r.nl), ...(r.d ? { default: String(r.d) } : {}), primaryKey: Boolean(r.pk) });
          out.set(String(r.t), t);
        }
        return [...out.values()];
      },
      foreignKeys: async (schema) => {
        const rows = await this.rows(
          `select fk.name n, fs.name fsn, ft.name ft, fc.name fcn, rs.name rsn, rt.name rt, rc.name rcn, fkc.constraint_column_id o
           from sys.foreign_keys fk join sys.foreign_key_columns fkc on fkc.constraint_object_id = fk.object_id
           join sys.tables ft on ft.object_id = fk.parent_object_id join sys.schemas fs on fs.schema_id = ft.schema_id
           join sys.columns fc on fc.object_id = fkc.parent_object_id and fc.column_id = fkc.parent_column_id
           join sys.tables rt on rt.object_id = fk.referenced_object_id join sys.schemas rs on rs.schema_id = rt.schema_id
           join sys.columns rc on rc.object_id = fkc.referenced_object_id and rc.column_id = fkc.referenced_column_id
           where fs.name = coalesce(@p1, schema_name()) order by fk.name, fkc.constraint_column_id`, [schema ?? null]);
        const out = new Map<string, ForeignKey>();
        for (const r of rows) {
          const k = `${r.ft}.${r.n}`;
          const fk = out.get(k) ?? { name: String(r.n), from: { schema: String(r.fsn), table: String(r.ft), columns: [] }, to: { schema: String(r.rsn), table: String(r.rt), columns: [] } };
          fk.from.columns.push(String(r.fcn)); fk.to.columns.push(String(r.rcn)); out.set(k, fk);
        }
        return [...out.values()];
      },
      indexes: async (schema) => {
        const rows = await this.rows(
          `select i.name n, t.name t, c.name c, i.is_unique u, i.is_primary_key p, ic.key_ordinal o
           from sys.indexes i join sys.tables t on t.object_id = i.object_id join sys.schemas s on s.schema_id = t.schema_id
           join sys.index_columns ic on ic.object_id = i.object_id and ic.index_id = i.index_id and ic.is_included_column = 0
           join sys.columns c on c.object_id = ic.object_id and c.column_id = ic.column_id
           where i.name is not null and s.name = coalesce(@p1, schema_name()) order by t.name, i.name, ic.key_ordinal`, [schema ?? null]);
        const out = new Map<string, IndexInfo>();
        for (const r of rows) {
          const k = `${r.t}.${r.n}`;
          const i = out.get(k) ?? { name: String(r.n), ...(schema ? { schema } : {}), table: String(r.t), columns: [], unique: Boolean(r.u), primary: Boolean(r.p) };
          i.columns.push(String(r.c)); out.set(k, i);
        }
        return [...out.values()];
      },
      listSchemas: async () => (await this.rows("select name from sys.schemas where name not in ('sys','INFORMATION_SCHEMA','guest') and name not like 'db[_]%' order by 1")).map((r) => String(r.name)),
      listTables: async (schema) => (await this.rows(
        "select s.name sn, o.name n, o.type t from sys.objects o join sys.schemas s on s.schema_id = o.schema_id where o.type in ('U','V') and s.name = coalesce(@p1, schema_name()) order by 2", [schema ?? null]))
        .map((r): TableInfo => ({ schema: String(r.sn), name: String(r.n), kind: r.t === "V" ? "view" : "table" })),
      describeTable: async (ref) => {
        const rows = await this.rows(
          `select c.name n, ty.name + case when ty.name in ('varchar','char','varbinary','binary') then '(' + case when c.max_length = -1 then 'max' else cast(c.max_length as varchar(10)) end + ')' when ty.name in ('nvarchar','nchar') then '(' + case when c.max_length = -1 then 'max' else cast(c.max_length/2 as varchar(10)) end + ')' when ty.name in ('decimal','numeric') then '(' + cast(c.precision as varchar(5)) + ',' + cast(c.scale as varchar(5)) + ')' else '' end t, c.max_length ml, c.is_nullable nl, dc.definition d,
                  cast(case when exists (select 1 from sys.index_columns ic join sys.indexes i on i.object_id = ic.object_id and i.index_id = ic.index_id
                    where i.is_primary_key = 1 and ic.object_id = c.object_id and ic.column_id = c.column_id) then 1 else 0 end as bit) pk
           from sys.columns c join sys.objects o on o.object_id = c.object_id join sys.schemas s on s.schema_id = o.schema_id
           join sys.types ty on ty.user_type_id = c.user_type_id left join sys.default_constraints dc on dc.object_id = c.default_object_id
           where o.name = @p2 and s.name = coalesce(@p1, schema_name()) order by c.column_id`, [ref.schema ?? null, ref.name]);
        if (rows.length === 0) throw new DriverError("unknown", `Table not found: ${ref.name}`);
        return {
          name: ref.name, ...(ref.schema ? { schema: ref.schema } : {}), kind: "table",
          columns: rows.map((r) => ({ name: String(r.n), nativeType: String(r.t), nullable: Boolean(r.nl), ...(r.d ? { default: String(r.d) } : {}), primaryKey: Boolean(r.pk) })),
        };
      },
    };
  }
  private batch(sql: string) { return this.rows(sql); }
  async begin(): Promise<Transaction> {
    const tx = (f: (cb: (e?: Error | null) => void) => void) => new Promise<void>((res, rej) => f((e) => (e ? rej(mapError(e)) : res())));
    await tx((cb) => this.tds.beginTransaction(cb));
    return {
      execute: (req, signal) => run(this.tds, this.readOnly, req, signal),
      commit: () => tx((cb) => this.tds.commitTransaction(cb)),
      rollback: () => tx((cb) => this.tds.rollbackTransaction(cb)),
    };
  }
  async ping() { await this.batch("select 1"); }
  async close() { await new Promise<void>((res) => { this.tds.once("end", () => res()); this.tds.close(); setTimeout(res, 1000).unref(); }); }
}

export const mssqlDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const tds = new Tds({
      server: cfg.host as string,
      authentication: { type: "default", options: { userName: cfg.user as string, password: (cfg.password as string | undefined) ?? "" } },
      options: {
        port: (cfg.port as number | undefined) ?? 1433, ...(cfg.database ? { database: cfg.database as string } : {}),
        encrypt: cfg.ssl !== false, trustServerCertificate: cfg.sslVerify === false, rowCollectionOnRequestCompletion: false,
        useColumnNames: false, connectTimeout: 15000, cancelTimeout: 5000,
      },
    });
    tds.on("error", () => {});
    try {
      await new Promise<void>((res, rej) => tds.connect((e) => (e ? rej(e) : res())));
      const conn = new MssqlConnection(tds, { product: "SQL Server", version: "" }, !!cfg.readOnly);
      const v = await (conn as unknown as { rows(s: string): Promise<{ v: string }[]> }).rows("select cast(serverproperty('ProductVersion') as nvarchar(50)) v");
      (conn as { serverInfo: Connection["serverInfo"] }).serverInfo = { product: "SQL Server", version: String(v[0]?.v) };
      return conn;
    } catch (e) { tds.close(); throw mapError(e); }
  },
};

export { quoteIdent };
