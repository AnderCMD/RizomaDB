import type { Connection, DriverPlugin, Value } from "@rizomadb/driver-api";
import { applyChanges, defaultPolicy, generate, type Change, type EditTarget, type Policy, type Row } from "@rizomadb/core";

export type DataDiff =
  | { kind: "only-in-source"; key: Row; row: Row }
  | { kind: "only-in-target"; key: Row; row: Row }
  | { kind: "different"; key: Row; source: Row; target: Row; columns: string[] };

export interface CompareOptions {
  source: Connection; target: Connection;
  sourceTable: { schema?: string; name: string }; targetTable: { schema?: string; name: string };
  sourcePlugin: DriverPlugin; targetPlugin: DriverPlugin;
  key: string[]; columns: string[];
  /** Hard cap on rows held in memory for the target side. */
  maxRows?: number;
  signal?: AbortSignal;
}

/** Cross-engine canonical form: 1 = true, 1.50 = 1.5, bigint = number, dates in UTC ISO, JSON with sorted keys. */
export function canon(v: Value): string {
  if (v === null) return "\u0000null";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return "x" + Buffer.from(v).toString("hex");
  if (Array.isArray(v)) return JSON.stringify(v.map(canon));
  if (typeof v === "object") return "j" + JSON.stringify(sortKeys((v as { json: unknown }).json));
  if (/^[+-]?\d+\.\d+$/.test(v)) return v.replace(/\.?0+$/, "").replace(/^\+/, "") || "0";
  return v;
}
const sortKeys = (x: unknown): unknown => (Array.isArray(x) ? x.map(sortKeys) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x as object).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, sortKeys(v)])) : typeof x === "bigint" ? String(x) : x);

const tbl = (p: DriverPlugin, t: { schema?: string; name: string }) => (t.schema ? `${p.quoteIdent(t.schema)}.${p.quoteIdent(t.name)}` : p.quoteIdent(t.name));

async function* rowsOf(conn: Connection, p: DriverPlugin, t: { schema?: string; name: string }, cols: string[], signal: AbortSignal) {
  const sql = `SELECT ${cols.map(p.quoteIdent).join(", ")} FROM ${tbl(p, t)}`;
  for await (const ev of conn.execute({ sql, batchSize: 2000 }, signal)) if (ev.type === "rows") for (const r of ev.rows) yield Object.fromEntries(cols.map((c, i) => [c, r[i]!])) as Row;
}

/** Streams the source side against an in-memory index of the target (bounded by maxRows). */
export async function* diffTables(o: CompareOptions): AsyncGenerator<DataDiff> {
  const signal = o.signal ?? new AbortController().signal;
  const max = o.maxRows ?? 2_000_000;
  const keyOf = (r: Row) => o.key.map((k) => canon(r[k] ?? null)).join("\u0001");
  const keyRow = (r: Row): Row => Object.fromEntries(o.key.map((k) => [k, r[k] ?? null]));
  const target = new Map<string, { row: Row; seen: boolean }>();
  for await (const r of rowsOf(o.target, o.targetPlugin, o.targetTable, o.columns, signal)) {
    if (target.size >= max) throw new Error(`Target table has more than ${max.toLocaleString()} rows: comparing it in memory is not supported. Compare a filtered subset instead.`);
    target.set(keyOf(r), { row: r, seen: false });
  }
  for await (const s of rowsOf(o.source, o.sourcePlugin, o.sourceTable, o.columns, signal)) {
    const t = target.get(keyOf(s));
    if (!t) { yield { kind: "only-in-source", key: keyRow(s), row: s }; continue; }
    t.seen = true;
    const columns = o.columns.filter((c) => canon(s[c] ?? null) !== canon(t.row[c] ?? null));
    if (columns.length) yield { kind: "different", key: keyRow(s), source: s, target: t.row, columns };
  }
  for (const t of target.values()) if (!t.seen) yield { kind: "only-in-target", key: keyRow(t.row), row: t.row };
}

/** Changes that make the target equal to the source. Deletes are opt-in. */
export function syncChanges(diffs: DataDiff[], opts: { deletes?: boolean } = {}): Change[] {
  const out: Change[] = [];
  for (const d of diffs) {
    if (d.kind === "only-in-source") out.push({ kind: "insert", values: d.row });
    else if (d.kind === "different") out.push({ kind: "update", key: d.key, before: Object.fromEntries(d.columns.map((c) => [c, d.target[c] ?? null])), set: Object.fromEntries(d.columns.map((c) => [c, d.source[c] ?? null])) });
    else if (opts.deletes) out.push({ kind: "delete", key: d.key, before: Object.fromEntries(Object.entries(d.row).filter(([k]) => !(k in d.key))) });
  }
  return out;
}

export interface ApplySyncOptions { conn: Connection; plugin: DriverPlugin; table: EditTarget; environment: string; readOnly: boolean; policy?: Policy; confirm: (sql: string[]) => Promise<boolean>; signal?: AbortSignal }
export async function applySync(changes: Change[], o: ApplySyncOptions) {
  return applyChanges(changes, { conn: o.conn, plugin: o.plugin, target: o.table, environment: o.environment, readOnly: o.readOnly, policy: o.policy ?? defaultPolicy, confirm: async (s) => o.confirm(s.map((x) => x.sql)), ...(o.signal ? { signal: o.signal } : {}) });
}

/** Dialect-correct SQL literal (for review scripts only: execution always uses bound parameters). */
export function literal(engine: string, v: Value): string {
  if (v === null) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return engine === "postgres" ? (v ? "TRUE" : "FALSE") : v ? "1" : "0";
  if (v instanceof Uint8Array) { const h = Buffer.from(v).toString("hex"); return engine === "postgres" ? `'\\x${h}'::bytea` : engine === "mssql" ? `0x${h}` : engine === "oracle" ? `HEXTORAW('${h}')` : `X'${h}'`; }
  if (v instanceof Date) {
    const iso = v.toISOString();
    if (engine === "oracle") return `TIMESTAMP '${iso.slice(0, 10)} ${iso.slice(11, 23)}'`;
    if (engine === "mysql") return `'${iso.slice(0, 10)} ${iso.slice(11, 23)}'`;
    if (engine === "mssql") return `'${iso.slice(0, 23)}'`;
    return `'${iso}'`;
  }
  const s = typeof v === "string" ? v : JSON.stringify(Array.isArray(v) ? v.map(canon) : (v as { json: unknown }).json, (_, x) => (typeof x === "bigint" ? String(x) : x));
  return `'${s.replaceAll("'", "''")}'`;
}

/** Review script for a change list: the same SQL that applySync would run, with literals inlined. */
export function renderSyncScript(plugin: DriverPlugin, table: EditTarget, changes: Change[]): string {
  return changes.map((c) => {
    const g = generate(plugin, table, c);
    let i = 0;
    // placeholders are numbered in order of appearance; replace in the same order
    const sql = g.sql.replace(/\?|\$\d+|@p\d+|:\d+/g, () => literal(plugin.id, g.params[i++]!));
    return sql + ";";
  }).join("\n") + "\n";
}

