import { meta, quoteIdent } from "./meta.js";
import { readFile } from "node:fs/promises";
import pg from "pg";
import Cursor from "pg-cursor";
import {
  ConnectionLoss, DriverError, type ColumnInfo, type Connection, type DriverPlugin,
  type ExecuteRequest, type ForeignKey, type IndexInfo, type IntrospectionApi, type ResultEvent, type TableInfo, type Transaction, type Value,
} from "@rizomadb/driver-api";

const { Client, types } = pg;



const SAFE_MIN = BigInt(Number.MIN_SAFE_INTEGER), SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER);
const typeParser = {
  getTypeParser(oid: number, format?: "text" | "binary") {
    if (oid === types.builtins.INT8) {
      return (s: string) => { const b = BigInt(s); return b >= SAFE_MIN && b <= SAFE_MAX ? Number(b) : b; };
    }
    if (oid === types.builtins.JSON || oid === types.builtins.JSONB) return (s: string) => ({ json: JSON.parse(s) });
    return types.getTypeParser(oid, format as "text");
  },
};

function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const err = e as { message?: string; code?: string; position?: string };
  const code = err.code ?? "";
  const msg = err.message ?? String(e);
  const position = err.position ? Number(err.position) : undefined;
  const opt = { code, cause: e, ...(position !== undefined ? { position } : {}) };
  if (code === "57014") return new DriverError(msg.includes("timeout") ? "timeout" : "cancelled", msg, opt);
  if (code.startsWith("28")) return new DriverError("authentication", msg, opt);
  if (code.startsWith("42") && code !== "42501") return new DriverError("syntax", msg, opt);
  if (code === "42501" || code === "25006") return new DriverError("permission", msg, opt);
  if (code.startsWith("23")) return new DriverError("constraint", msg, opt);
  if (code.startsWith("08") || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Connection terminated/.test(`${code} ${msg}`)) {
    return new DriverError("connection", msg, opt);
  }
  return new DriverError("unknown", msg, opt);
}

function kindOf(oid: number): ColumnInfo["kind"] {
  const b = types.builtins;
  switch (oid) {
    case b.INT2: case b.INT4: case b.INT8: case b.OID: return "integer";
    case b.FLOAT4: case b.FLOAT8: return "float";
    case b.NUMERIC: return "decimal";
    case b.BOOL: return "boolean";
    case b.TEXT: case b.VARCHAR: case b.BPCHAR: case 19: return "text";
    case b.TIMESTAMP: case b.TIMESTAMPTZ: case b.DATE: case b.TIME: case b.TIMETZ: return "datetime";
    case b.BYTEA: return "binary";
    case b.JSON: case b.JSONB: return "json";
    default: return "other";
  }
}

const toParam = (v: Value) => (v !== null && typeof v === "object" && !(v instanceof Date) && !(v instanceof Uint8Array) && !Array.isArray(v)
  ? JSON.stringify((v as { json: unknown }).json) : v);

type Runner = { client: pg.Client; cancel: (pid: number) => Promise<void>; pid: number; lost: ConnectionLoss };

async function* run(r: Runner, req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
  if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
  const t0 = performance.now();
  const cursor = r.client.query(new Cursor(req.sql, (req.params ?? []).map(toParam) as unknown[], { rowMode: "array", types: typeParser }));
  // A cancel still in flight when the cursor closes would hit whatever statement runs next on this backend, so it is awaited below.
  let pending: Promise<void> | undefined, finished = false;
  const onAbort = () => { if (!finished) pending = r.cancel(r.pid).catch(() => {}); };
  signal.addEventListener("abort", onAbort, { once: true });
  const batch = req.batchSize ?? 500;
  const max = req.maxRows ?? Infinity;
  let n = 0, sentCols = false;
  try {
    for (;;) {
      const want = Math.min(batch, max - n);
      if (want <= 0) break;
      // pg-cursor never settles when the server terminates the backend mid-read, so race against connection loss.
      const rows = await r.lost.race(cursor.read(want)) as unknown as Value[][];
      if (!sentCols) {
        // pg-cursor exposes fields after the first read
        const fields = (cursor as unknown as { _result: { fields: pg.FieldDef[] } })._result.fields;
        sentCols = true;
        if (fields.length) {
          yield { type: "columns", columns: fields.map((f) => ({ name: f.name, nativeType: String(f.dataTypeID), kind: kindOf(f.dataTypeID) })) };
        }
      }
      if (rows.length === 0) break;
      n += rows.length;
      yield { type: "rows", rows };
    }
    const res = (cursor as unknown as { _result: { rowCount: number | null; command: string; fields?: unknown[] } })._result;
    yield {
      type: "done", rowCount: n, durationMs: performance.now() - t0,
      ...(res.fields?.length === 0 && res.rowCount !== null ? { affectedRows: res.rowCount } : {}),
    };
  } catch (e) {
    throw signal.aborted ? new DriverError("cancelled", "Query cancelled", { cause: e }) : mapError(e);
  } finally {
    finished = true;
    signal.removeEventListener("abort", onAbort);
    await pending;
    // a dead connection never answers the close request either
    await r.lost.race(new Promise<void>((res) => cursor.close(() => res()))).catch(() => undefined);
  }
}

class PgConnection implements Connection {
  private cancelClient: pg.Client | undefined;
  private lost = new ConnectionLoss();
  constructor(private client: pg.Client, readonly serverInfo: Connection["serverInfo"], private pid: number, private cfg: pg.ClientConfig, private cockroachSession?: string) {
    const gone = (e?: Error) => this.lost.fire(new DriverError("connection", e?.message ?? "The server closed the connection", { cause: e }));
    client.once("end", () => gone());
    client.once("error", (e) => gone(e));
  }
  private runner(): Runner {
    return {
      client: this.client, pid: this.pid, lost: this.lost,
      cancel: async (pid) => {
        const c = new Client(this.cfg);
        await c.connect();
        try {
          // CockroachDB has no pg_cancel_backend(pid): its queries are cancelled through the session id.
          if (this.cockroachSession) await c.query(`CANCEL QUERIES (SELECT query_id FROM [SHOW CLUSTER STATEMENTS] WHERE session_id = '${this.cockroachSession}')`);
          else await c.query("select pg_cancel_backend($1)", [pid]);
        } finally { await c.end(); }
      },
    };
  }
  execute(req: ExecuteRequest, signal: AbortSignal) { return run(this.runner(), req, signal); }
  quoteIdent = quoteIdent;
  introspect(): IntrospectionApi {
    const q = async (sql: string, p: unknown[] = []) => { try { return (await this.client.query(sql, p)).rows; } catch (e) { throw mapError(e); } };
    return {
      describeSchema: async (schema) => {
        const rows = await q(
          `select c.relname t, c.relkind k, a.attname n, format_type(a.atttypid, a.atttypmod) ty, a.attnotnull nn, pg_get_expr(d.adbin, d.adrelid) def,
                  coalesce(a.attnum = any(i.indkey), false) pk
           from pg_class c join pg_namespace s on s.oid = c.relnamespace
           join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
           left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
           left join pg_index i on i.indrelid = c.oid and i.indisprimary
           where c.relkind in ('r','v','m','p') and s.nspname = coalesce($1, current_schema()) order by c.relname, a.attnum`, [schema ?? null]);
        const out = new Map<string, TableInfo>();
        for (const r of rows) {
          const t: TableInfo = out.get(r.t) ?? { ...(schema ? { schema } : {}), name: r.t, kind: r.k === "v" || r.k === "m" ? "view" as const : "table" as const, columns: [] };
          t.columns!.push({ name: r.n, nativeType: r.ty, nullable: !r.nn, ...(r.def ? { default: r.def } : {}), primaryKey: r.pk });
          out.set(r.t, t);
        }
        return [...out.values()];
      },
      foreignKeys: async (schema) => (await q(
        `select con.conname n, c.relname ft, fs.nspname fsn, rc.relname tt, rs.nspname rsn,
                (select array_agg(a.attname::text order by u.ord) from unnest(con.conkey) with ordinality u(k, ord) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = u.k) fc,
                (select array_agg(a.attname::text order by u.ord) from unnest(con.confkey) with ordinality u(k, ord) join pg_attribute a on a.attrelid = con.confrelid and a.attnum = u.k) tc
         from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace fs on fs.oid = c.relnamespace
         join pg_class rc on rc.oid = con.confrelid join pg_namespace rs on rs.oid = rc.relnamespace
         where con.contype = 'f' and fs.nspname = coalesce($1, current_schema())`, [schema ?? null]))
        .map((r): ForeignKey => ({ name: r.n, from: { schema: r.fsn, table: r.ft, columns: r.fc }, to: { schema: r.rsn, table: r.tt, columns: r.tc } })),
      indexes: async (schema) => (await q(
        `select i.relname n, t.relname tn, ix.indisunique u, ix.indisprimary p,
                (select array_agg(a.attname::text order by k.ord) from unnest(ix.indkey::int2[]) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum where k.attnum > 0) cols
         from pg_index ix join pg_class i on i.oid = ix.indexrelid join pg_class t on t.oid = ix.indrelid join pg_namespace s on s.oid = t.relnamespace
         where s.nspname = coalesce($1, current_schema()) and t.relkind in ('r','p') order by t.relname, i.relname`, [schema ?? null]))
        .map((r): IndexInfo => ({ name: r.n, ...(schema ? { schema } : {}), table: r.tn, columns: r.cols ?? [], unique: r.u, primary: r.p })),
      listSchemas: async () => (await q("select nspname from pg_namespace where nspname not like 'pg\\_%' and nspname <> 'information_schema' order by 1")).map((r) => r.nspname as string),
      listTables: async (schema) => (await q(
        "select table_schema, table_name, table_type from information_schema.tables where table_schema = coalesce($1, current_schema()) order by 2", [schema ?? null]))
        .map((r): TableInfo => ({ schema: r.table_schema, name: r.table_name, kind: r.table_type === "VIEW" ? "view" : "table" })),
      describeTable: async (ref) => {
        const rows = await q(
          `select a.attname, format_type(a.atttypid, a.atttypmod) as type, a.attnotnull, pg_get_expr(d.adbin, d.adrelid) as def,
                  coalesce(i.indisprimary, false) as pk
           from pg_attribute a
           join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
           left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
           left join pg_index i on i.indrelid = a.attrelid and i.indisprimary and a.attnum = any(i.indkey)
           where c.relname = $2 and n.nspname = coalesce($1, current_schema()) and a.attnum > 0 and not a.attisdropped
           order by a.attnum`, [ref.schema ?? null, ref.name]);
        if (rows.length === 0) throw new DriverError("unknown", `Table not found: ${ref.name}`);
        return {
          name: ref.name, ...(ref.schema ? { schema: ref.schema } : {}), kind: "table",
          columns: rows.map((r) => ({ name: r.attname, nativeType: r.type, nullable: !r.attnotnull, ...(r.def ? { default: r.def } : {}), primaryKey: r.pk })),
        };
      },
    };
  }
  async begin(): Promise<Transaction> {
    await this.client.query("BEGIN");
    const r = this.runner();
    return {
      execute: (req, signal) => run(r, req, signal),
      commit: async () => { await this.client.query("COMMIT"); },
      rollback: async () => { await this.client.query("ROLLBACK"); },
    };
  }
  async ping() { try { await this.client.query("select 1"); } catch (e) { throw mapError(e); } }
  async close() { await this.cancelClient?.end().catch(() => {}); await this.client.end().catch(() => {}); }
}

export const postgresDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const ca = cfg.sslCaFile ? await readFile(String(cfg.sslCaFile)) : undefined;
    const ssl = cfg.ssl ? { rejectUnauthorized: cfg.sslVerify !== false, ...(ca ? { ca } : {}) } : false;
    const config: pg.ClientConfig = {
      host: cfg.host as string, port: (cfg.port as number | undefined) ?? 5432,
      database: cfg.database as string, user: cfg.user as string,
      ...(cfg.password !== undefined ? { password: cfg.password as string } : {}),
      ssl, types: typeParser as never,
      ...(cfg.readOnly ? { options: "-c default_transaction_read_only=on" } : {}),
    };
    const client = new Client(config);
    client.on("error", () => {});
    try {
      await client.connect();
      const v = await client.query("select current_setting('server_version') v, pg_backend_pid() pid, version() full");
      // CockroachDB answers the PostgreSQL wire protocol but identifies itself in version().
      if (/^CockroachDB/.test(String(v.rows[0].full))) {
        const sid = String((await client.query("SHOW session_id")).rows[0].session_id);
        if (!/^[0-9a-f]+$/.test(sid)) throw new DriverError("unknown", "Unexpected CockroachDB session id");
        return new PgConnection(client, { product: "CockroachDB", version: /v(\d+\.\d+\.\d+)/.exec(String(v.rows[0].full))?.[1] ?? v.rows[0].v }, v.rows[0].pid, config, sid);
      }
      const yb = /-YB-/.test(String(v.rows[0].full));
      return new PgConnection(client, { product: yb ? "YugabyteDB" : "PostgreSQL", version: yb ? (/-YB-([\d.]+)/.exec(String(v.rows[0].full))?.[1] ?? v.rows[0].v) : v.rows[0].v }, v.rows[0].pid, config);
    } catch (e) {
      await client.end().catch(() => {});
      throw mapError(e);
    }
  },
};

export { quoteIdent };
