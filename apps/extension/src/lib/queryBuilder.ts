/** Builds a SELECT from choices (table, columns, conditions, order, limit) so no SQL has to be typed. Values become literals of the column's kind; names are quoted by the driver. */
export type BuilderKind = "integer" | "float" | "decimal" | "boolean" | "text" | "date" | "json" | "binary" | "other";
export interface BuilderColumn { name: string; kind: BuilderKind }
export const OPERATORS = ["=", "<>", "<", "<=", ">", ">=", "LIKE", "NOT LIKE", "IN", "IS NULL", "IS NOT NULL"] as const;
export type Operator = (typeof OPERATORS)[number];
export interface Condition { column: string; op: Operator; value?: string }
export interface BuilderInput {
  driver: string;
  quote: (identifier: string) => string;
  table: string; schema?: string | undefined;
  columns: BuilderColumn[];            // every column of the table, to type the literals
  select: string[];                    // empty = all
  where: Condition[];
  orderBy?: { column: string; desc: boolean }[];
  limit: number;
}
export class BuilderError extends Error {}

/** A column's kind from its native type name, enough to decide how a typed value becomes a literal. Unknown types are treated as text. */
export function kindOfNative(nativeType: string): BuilderKind {
  const t = nativeType.toLowerCase();
  if (/bool|bit\b/.test(t)) return "boolean";
  if (/(^|\b)(tiny|small|medium|big)?(int|integer|serial)\d*\b|\bint\d/.test(t)) return "integer";
  if (/float|double|real|decimal|numeric|number|money/.test(t)) return "decimal";
  if (/json/.test(t)) return "json";
  if (/blob|binary|bytea|raw/.test(t)) return "binary";
  return "text";
}

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

function literal(driver: string, col: BuilderColumn, raw: string): string {
  const v = raw.trim();
  if (["integer", "float", "decimal"].includes(col.kind)) { if (!NUMBER.test(v)) throw new BuilderError(`"${raw}" is not a number`); return v; }
  if (col.kind === "boolean") {
    const t = v.toLowerCase();
    const yes = ["true", "1", "t", "yes"].includes(t), no = ["false", "0", "f", "no"].includes(t);
    if (!yes && !no) throw new BuilderError(`"${raw}" is not a boolean`);
    return driver === "mssql" || driver === "oracle" ? (yes ? "1" : "0") : yes ? "TRUE" : "FALSE";
  }
  if (/[\u0000]/.test(raw)) throw new BuilderError("A value cannot contain a null character");
  const body = driver === "mysql" ? raw.replaceAll("\\", "\\\\").replaceAll("'", "''") : raw.replaceAll("'", "''");
  return `${driver === "mssql" && /[^\u0000-\u007f]/.test(raw) ? "N" : ""}'${body}'`;
}

export function buildSelect(i: BuilderInput): string {
  const known = new Map(i.columns.map((c) => [c.name, c]));
  const col = (n: string) => { const c = known.get(n); if (!c) throw new BuilderError(`Unknown column ${n}`); return c; };
  const list = i.select.length ? i.select.map((n) => { col(n); return i.quote(n); }).join(", ") : "*";
  const conds = i.where.map((c) => {
    const column = col(c.column), q = i.quote(c.column);
    if (!(OPERATORS as readonly string[]).includes(c.op)) throw new BuilderError(`Unsupported operator ${c.op}`);
    if (c.op === "IS NULL" || c.op === "IS NOT NULL") return `${q} ${c.op}`;
    if (c.value === undefined || c.value === "") throw new BuilderError(`${c.column} ${c.op} needs a value`);
    if (c.op === "IN") {
      const parts = c.value.split(",").map((p) => p.trim()).filter(Boolean);
      if (!parts.length) throw new BuilderError(`${c.column} IN needs at least one value`);
      return `${q} IN (${parts.map((p) => literal(i.driver, column, p)).join(", ")})`;
    }
    if ((c.op === "LIKE" || c.op === "NOT LIKE") && ["integer", "float", "decimal", "boolean"].includes(column.kind)) throw new BuilderError(`LIKE needs a text column`);
    return `${q} ${c.op} ${literal(i.driver, column, c.value)}`;
  });
  const order = (i.orderBy ?? []).map((o) => { col(o.column); return `${i.quote(o.column)}${o.desc ? " DESC" : ""}`; });
  const from = i.schema && i.driver !== "sqlite" ? `${i.quote(i.schema)}.${i.quote(i.table)}` : i.quote(i.table);
  const n = Math.max(1, Math.floor(i.limit));
  const where = conds.length ? ` WHERE ${conds.join(" AND ")}` : "", ord = order.length ? ` ORDER BY ${order.join(", ")}` : "";
  if (i.driver === "mssql") return `SELECT TOP ${n} ${list} FROM ${from}${where}${ord}`;
  if (i.driver === "oracle") return `SELECT ${list} FROM ${from}${where}${ord} FETCH FIRST ${n} ROWS ONLY`;
  return `SELECT ${list} FROM ${from}${where}${ord} LIMIT ${n}`;
}
