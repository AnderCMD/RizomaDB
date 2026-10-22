import type { ColumnInfo, Value } from "@rizomadb/driver-api";
import { buildTableQuery } from "./tableQuery.js";

/** Engines whose keyset statements are tested against a real server (rule 4): the rest keep offset paging. */
const TESTED = new Set(["sqlite", "postgres", "mysql", "mssql", "oracle"]);
export const keysetSupported = (driver: string): boolean => TESTED.has(driver);

export interface KeysetKey { name: string; quoted: string }

/** A key value as a SQL literal, or undefined when it cannot be written safely (then paging falls back to skipping rows). */
export function keyLiteral(v: Value): string | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : undefined;
  if (typeof v === "bigint") return String(v);
  if (typeof v === "string") return /[\\\0]/.test(v) ? undefined : `'${v.replace(/'/g, "''")}'`;
  return undefined;
}

/** ORDER BY the key, so every page continues exactly where the last one ended. */
export const keysetOrder = (keys: KeysetKey[]): string => keys.map((k) => k.quoted).join(", ");

/** The condition "the key comes after these values", written without row-value comparison so it holds on every dialect. */
export function keysetAfter(keys: KeysetKey[], last: Value[]): string | undefined {
  if (!keys.length || keys.length !== last.length) return undefined;
  const lits = last.map(keyLiteral);
  if (lits.some((l) => l === undefined)) return undefined;
  const terms = keys.map((k, i) => {
    const eq = keys.slice(0, i).map((p, j) => `${p.quoted} = ${lits[j]}`);
    return `(${[...eq, `${k.quoted} > ${lits[i]}`].join(" AND ")})`;
  });
  return terms.length === 1 ? terms[0]!.slice(1, -1) : `(${terms.join(" OR ")})`;
}

/** The user's filter and the keyset condition together. */
export function withKeyset(where: string, after: string): string {
  const w = where.trim();
  return w ? `(${w}) AND ${after}` : after;
}

/** The key of a row, found by column name; undefined when a key column is not in the result. */
export function lastKey(keys: KeysetKey[], columns: Pick<ColumnInfo, "name">[], row: Value[]): Value[] | undefined {
  const at = keys.map((k) => columns.findIndex((c) => c.name === k.name));
  return at.every((i) => i >= 0) ? at.map((i) => row[i]!) : undefined;
}

export interface KeysetPage { driver: string; quoted: string; schema?: string | undefined; name: string; where: string; keys: KeysetKey[]; last: Value[]; limit: number }
/** The statement for the page after `last`, or undefined when the key cannot be written safely (the caller then skips rows instead). */
export function keysetStatement(i: KeysetPage): string | undefined {
  const after = keysetAfter(i.keys, i.last);
  return after === undefined ? undefined : buildTableQuery({ driver: i.driver, quoted: i.quoted, schema: i.schema, name: i.name, where: withKeyset(i.where, after), order: keysetOrder(i.keys), limit: i.limit });
}
