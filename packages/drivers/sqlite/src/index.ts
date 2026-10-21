import { meta, quoteIdent } from "./meta.js";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import {
  DriverError, type ColumnInfo, type Connection, type DriverPlugin,
  type ExecuteRequest, type IntrospectionApi, type ResultEvent, type TableInfo, type Transaction, type Value,
} from "@rizomadb/driver-api";



function mapError(e: unknown): DriverError {
  if (e instanceof DriverError) return e;
  const err = e as { message?: string; errcode?: number; code?: string };
  const msg = err.message ?? String(e);
  const code = err.errcode;
  // Primary result code = errcode & 0xff
  const primary = code === undefined ? undefined : code & 0xff;
  const kind =
    /syntax error|incomplete input|near ".*":/i.test(msg) ? "syntax"
    : primary === 19 ? "constraint"
    : primary === 8 || /readonly/i.test(msg) ? "permission"
    : primary === 14 ? "connection"
    : primary === 1 ? "syntax" : "unknown";
  return new DriverError(kind, msg, { code: err.code, cause: e });
}

function kindOf(decl: string | null | undefined): ColumnInfo["kind"] {
  const t = (decl ?? "").toUpperCase();
  if (/INT/.test(t)) return "integer";
  if (/REAL|FLOA|DOUB/.test(t)) return "float";
  if (/DEC|NUM/.test(t)) return "decimal";
  if (/CHAR|CLOB|TEXT/.test(t)) return "text";
  if (/BOOL/.test(t)) return "boolean";
  if (/DATE|TIME/.test(t)) return "datetime";
  if (/BLOB/.test(t)) return "binary";
  if (/JSON/.test(t)) return "json";
  return "other";
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
}

function* run(db: DatabaseSync, req: ExecuteRequest, signal: AbortSignal): Generator<ResultEvent> {
  throwIfAborted(signal);
  const t0 = performance.now();
  let stmt: StatementSync;
  try { stmt = db.prepare(req.sql); } catch (e) { throw mapError(e); }
  stmt.setReadBigInts(true);
  const params = (req.params ?? []).map(toSql);
  const cols = stmt.columns();
  if (cols.length === 0) {
    let info;
    try { info = stmt.run(...params); } catch (e) { throw mapError(e); }
    yield { type: "done", rowCount: 0, affectedRows: Number(info.changes), durationMs: performance.now() - t0 };
    return;
  }
  yield {
    type: "columns",
    columns: cols.map((c) => ({ name: c.name, nativeType: c.type ?? "", kind: kindOf(c.type) })),
  };
  const batch = req.batchSize ?? 500;
  const max = req.maxRows ?? Infinity;
  let buf: Value[][] = [];
  let n = 0;
  try {
    for (const row of stmt.iterate(...params) as Iterable<Record<string, unknown>>) {
      throwIfAborted(signal);
      buf.push(Object.values(row).map(fromSql));
      n++;
      if (buf.length >= batch) { yield { type: "rows", rows: buf }; buf = []; }
      if (n >= max) break;
    }
  } catch (e) { throw mapError(e); }
  if (buf.length) yield { type: "rows", rows: buf };
  yield { type: "done", rowCount: n, durationMs: performance.now() - t0 };
}

function toSql(v: Value): null | number | bigint | string | Uint8Array {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v !== null && typeof v === "object" && !(v instanceof Uint8Array)) return JSON.stringify(v);
  return v as never;
}

/** Integers arrive as bigint; keep bigint only when outside the safe range. */
function fromSql(v: unknown): Value {
  if (typeof v === "bigint" && v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(v);
  return v as Value;
}

class SqliteConnection implements Connection {
  readonly serverInfo;
  constructor(private db: DatabaseSync) {
    const v = db.prepare("select sqlite_version() v").get() as { v: string };
    this.serverInfo = { product: "SQLite", version: v.v };
  }
  async *execute(req: ExecuteRequest, signal: AbortSignal) { yield* run(this.db, req, signal); }
  quoteIdent = quoteIdent;
  introspect(): IntrospectionApi {
    const db = this.db;
    return {
      listSchemas: async () => ["main"],
      listTables: async () =>
        (db.prepare("select name, type from sqlite_schema where type in ('table','view') and name not like 'sqlite_%' order by name").all() as { name: string; type: string }[])
          .map((r): TableInfo => ({ name: r.name, kind: r.type === "view" ? "view" : "table" })),
      describeTable: async (ref) => {
        const rows = db.prepare(`pragma table_info(${quoteIdent(ref.name)})`).all() as
          { name: string; type: string; notnull: number | bigint; dflt_value: string | null; pk: number | bigint }[];
        if (rows.length === 0) throw new DriverError("unknown", `Table not found: ${ref.name}`);
        return {
          name: ref.name, kind: "table",
          columns: rows.map((r) => ({
            name: r.name, nativeType: r.type, nullable: !Number(r.notnull) && !Number(r.pk),
            ...(r.dflt_value !== null ? { default: r.dflt_value } : {}), primaryKey: Number(r.pk) > 0,
          })),
        };
      },
    };
  }
  async begin(): Promise<Transaction> {
    const db = this.db;
    db.exec("BEGIN");
    return {
      async *execute(req, signal) { yield* run(db, req, signal); },
      commit: async () => { db.exec("COMMIT"); },
      rollback: async () => { db.exec("ROLLBACK"); },
    };
  }
  async ping() { this.db.prepare("select 1").get(); }
  async close() { if (this.db.isOpen) this.db.close(); }
}

export const sqliteDriver: DriverPlugin = {
  ...meta,
  async connect(cfg) {
    const path = cfg.path;
    if (typeof path !== "string" || !path) throw new DriverError("connection", "SQLite: 'path' is required");
    try {
      const db = new DatabaseSync(path, { readOnly: false });
      if (cfg.readOnly) db.exec("PRAGMA query_only = ON");
      return new SqliteConnection(db);
    } catch (e) { throw new DriverError("connection", (e as Error).message, { cause: e }); }
  },
};

export { quoteIdent };
