import { collect, DriverError, type ColumnInfo, type Connection, type DriverPlugin, type Value } from "@rizomadb/driver-api";

export interface TargetColumn { name: string; kind: ColumnInfo["kind"]; nullable: boolean; hasDefault?: boolean }

export class ConversionError extends Error {
  constructor(readonly column: string, readonly value: unknown, message: string) { super(message); this.name = "ConversionError"; }
}

export interface ConvertOptions { nullTokens?: string[]; emptyAsNull?: boolean; trueTokens?: string[]; falseTokens?: string[]; dateFormat?: "iso" | "dmy" | "mdy" }

const DEFAULT_TRUE = ["true", "t", "yes", "y", "1", "si", "sí", "verdadero"];
const DEFAULT_FALSE = ["false", "f", "no", "n", "0", "falso"];

/** Converts one source cell into a typed Value for the target column; throws ConversionError with a clear message. */
export function convertCell(raw: unknown, col: TargetColumn, o: ConvertOptions = {}): Value {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return convertNonString(raw, col);
  const s = raw.trim();
  const nulls = o.nullTokens ?? [];
  if ((o.emptyAsNull !== false && s === "" && col.kind !== "text") || nulls.includes(s)) return null;
  const fail = (what: string) => new ConversionError(col.name, raw, `"${raw.length > 40 ? raw.slice(0, 40) + "…" : raw}" is not a valid ${what} for column ${col.name}`);
  switch (col.kind) {
    case "integer": {
      if (!/^[+-]?\d+$/.test(s)) { if (/^[+-]?\d+\.0+$/.test(s)) return convertCell(s.replace(/\.0+$/, ""), col, o); throw fail("integer"); }
      const b = BigInt(s); return b > BigInt(Number.MAX_SAFE_INTEGER) || b < BigInt(Number.MIN_SAFE_INTEGER) ? b : Number(b);
    }
    case "float": { const n = Number(s.replace(",", ".")); if (s === "" || Number.isNaN(n)) throw fail("number"); return n; }
    case "decimal": { const t = s.replace(/^\+/, ""); if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) throw fail("decimal number"); return t.replace(",", "."); }
    case "boolean": {
      const l = s.toLowerCase();
      if ((o.trueTokens ?? DEFAULT_TRUE).includes(l)) return true;
      if ((o.falseTokens ?? DEFAULT_FALSE).includes(l)) return false;
      throw fail("boolean");
    }
    case "datetime": return parseDate(s, o.dateFormat ?? "iso", fail);
    case "json": try { return { json: JSON.parse(s) }; } catch { throw fail("JSON document"); }
    case "binary": { const h = s.replace(/^\\x|^0x/i, ""); if (!/^([0-9a-f]{2})*$/i.test(h)) throw fail("hex binary value"); return new Uint8Array(Buffer.from(h, "hex")); }
    default: return raw;
  }
}

function convertNonString(raw: unknown, col: TargetColumn): Value {
  if (col.kind === "json") return { json: raw };
  if (typeof raw === "boolean") return col.kind === "boolean" ? raw : String(raw);
  if (typeof raw === "number") { if (col.kind === "integer" && !Number.isInteger(raw)) throw new ConversionError(col.name, raw, `${raw} is not an integer (column ${col.name})`); return col.kind === "decimal" ? String(raw) : col.kind === "text" ? String(raw) : raw; }
  if (typeof raw === "object") return col.kind === "text" ? JSON.stringify(raw) : { json: raw };
  return String(raw);
}

function parseDate(s: string, fmt: "iso" | "dmy" | "mdy", fail: (w: string) => Error): Value {
  let iso = s;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m && fmt !== "iso") {
    const [d, mo] = fmt === "dmy" ? [m[1]!, m[2]!] : [m[2]!, m[1]!];
    iso = `${m[3]}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}${m[4] ? `T${m[4].padStart(2, "0")}:${m[5]}:${m[6] ?? "00"}` : ""}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(iso)) throw fail("date/time (use ISO 8601, or choose a day/month order)");
  const d = new Date(/[Z+]|-\d{2}:?\d{2}$/.test(iso.slice(10)) ? iso.replace(" ", "T") : iso.replace(" ", "T") + (iso.length > 10 ? "Z" : "T00:00:00Z"));
  if (Number.isNaN(d.getTime())) throw fail("date/time");
  return d;
}

/** Suggests a target column kind from sample values (used when creating a table from a file). */
export function inferKind(values: (string | null | unknown)[]): ColumnInfo["kind"] {
  const v = values.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim());
  if (!v.length) return "text";
  if (v.every((x) => /^[+-]?\d{1,15}$/.test(x))) return "integer";
  if (v.every((x) => /^[+-]?\d+([.,]\d+)?$/.test(x))) return "decimal";
  if (v.every((x) => /^(true|false)$/i.test(x))) return "boolean";
  if (v.every((x) => /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/.test(x))) return "datetime";
  return "text";
}

export interface ImportMapping { /** index in the source row */ source: number; target: TargetColumn }

export interface ImportOptions extends ConvertOptions {
  conn: Connection;
  plugin: DriverPlugin;
  table: { schema?: string; name: string };
  mapping: ImportMapping[];
  rows: AsyncIterable<unknown[]>;
  /** abort = first bad row rolls everything back; skip = bad rows are reported and skipped (database errors still abort). */
  /** Rows already hold typed Values (generated data): skip text conversion. */
  typed?: boolean;
  onError?: "abort" | "skip";
  batchRows?: number;
  signal?: AbortSignal;
  onProgress?: (p: { read: number; inserted: number; skipped: number }) => void;
}

export interface ImportResult { read: number; inserted: number; skipped: number; errors: { row: number; message: string }[] }

/** Engine limits for a single INSERT: bound parameters and rows per statement. */
export function batchLimits(engine: string, columns: number, requested = 1000): number {
  const params = engine === "sqlite" ? 32000 : engine === "mssql" ? 2000 : engine === "postgres" ? 60000 : engine === "oracle" ? 30000 : 60000;
  const rowCap = engine === "mssql" ? 1000 : requested;
  return Math.max(1, Math.min(rowCap, requested, Math.floor(params / Math.max(1, columns))));
}

function insertSql(plugin: DriverPlugin, table: { schema?: string; name: string }, cols: string[], n: number): { sql: string; perRow: number } {
  const q = plugin.quoteIdent;
  const target = table.schema ? `${q(table.schema)}.${q(table.name)}` : q(table.name);
  const list = cols.map(q).join(", ");
  let i = 0;
  const tuple = () => `(${cols.map(() => plugin.placeholder(++i)).join(", ")})`;
  if (plugin.id === "oracle") {
    // Oracle has no multi-row VALUES: INSERT ALL with one INTO per row.
    const intos = Array.from({ length: n }, () => `INTO ${target} (${list}) VALUES ${tuple()}`).join(" ");
    return { sql: `INSERT ALL ${intos} SELECT 1 FROM dual`, perRow: cols.length };
  }
  return { sql: `INSERT INTO ${target} (${list}) VALUES ${Array.from({ length: n }, tuple).join(", ")}`, perRow: cols.length };
}

/** Streams rows into a table inside one transaction: all-or-nothing, cancellable, with progress. */
export async function importRows(o: ImportOptions): Promise<ImportResult> {
  if (!o.conn.begin) throw new Error("This engine cannot run imports transactionally.");
  const cols = o.mapping.map((m) => m.target.name);
  const size = batchLimits(o.plugin.id, cols.length, o.batchRows);
  const res: ImportResult = { read: 0, inserted: 0, skipped: 0, errors: [] };
  const signal = o.signal ?? new AbortController().signal;
  const tx = await o.conn.begin();
  let buf: Value[][] = [];
  const stmtCache = new Map<number, string>();
  const flush = async () => {
    if (!buf.length) return;
    const n = buf.length;
    let sql = stmtCache.get(n);
    if (!sql) { sql = insertSql(o.plugin, o.table, cols, n).sql; if (n === size) stmtCache.set(n, sql); }
    try { await collect(tx.execute({ sql, params: buf.flat() }, signal), ); }
    catch (e) { throw e instanceof DriverError ? new Error(`Database rejected rows ${res.read - n + 1}–${res.read}: ${e.message}`, { cause: e }) : e; }
    res.inserted += n; buf = [];
    o.onProgress?.({ read: res.read, inserted: res.inserted, skipped: res.skipped });
  };
  try {
    for await (const src of o.rows) {
      if (signal.aborted) throw new DriverError("cancelled", "Import cancelled");
      res.read++;
      try {
        buf.push(o.typed ? o.mapping.map((m) => (src[m.source] ?? null) as Value) : o.mapping.map((m) => convertCell(src[m.source], m.target, o)));
      } catch (e) {
        if (!(e instanceof ConversionError)) throw e;
        if (o.onError === "skip") { res.skipped++; if (res.errors.length < 1000) res.errors.push({ row: res.read, message: e.message }); continue; }
        throw new Error(`Row ${res.read}: ${e.message}`, { cause: e });
      }
      if (buf.length >= size) await flush();
    }
    await flush();
    await tx.commit();
    return res;
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}

/** Maps a native column type name to the coarse kind used for conversion and generation. */
export function kindFromNative(nativeType: string): ColumnInfo["kind"] {
  const t = nativeType.toLowerCase();
  if (/json/.test(t)) return "json";
  if (/bool|^bit$|tinyint\(1\)/.test(t)) return "boolean";
  if (/blob|bytea|binary|raw|image/.test(t) && !/clob/.test(t)) return "binary";
  if (/timestamp|datetime|^date|^time/.test(t)) return "datetime";
  if (/float|double|real/.test(t)) return "float";
  if (/numeric|decimal|money|number\(\d+,\s*[1-9]/.test(t) || (/^number$/.test(t))) return "decimal";
  if (/int|serial|number\(\d+\)/.test(t)) return "integer";
  return "text";
}
