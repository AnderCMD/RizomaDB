import type { Dialect } from "./model.js";

/** Canonical form of a column type so designed types and introspected types compare equal. */
export function normalizeType(d: Dialect, raw: string): string {
  let t = raw.toLowerCase().replace(/\s+/g, " ").trim();
  t = t.replace(/\s*\(\s*/g, "(").replace(/\s*,\s*/g, ",").replace(/\s*\)/g, ")");
  const base = t.replace(/\(.*$/, ""), args = t.slice(base.length);
  const alias: Record<string, string> = {};
  if (d === "postgres") Object.assign(alias, { int: "integer", int4: "integer", int8: "bigint", int2: "smallint", bool: "boolean", varchar: "character varying", char: "character", bpchar: "character", float8: "double precision", float4: "real", "timestamp without time zone": "timestamp", "timestamp with time zone": "timestamptz", decimal: "numeric" });
  if (d === "mysql") Object.assign(alias, { integer: "int", bool: "tinyint(1)", boolean: "tinyint(1)", decimal: "decimal", numeric: "decimal" });
  if (d === "mssql") Object.assign(alias, { integer: "int", rowversion: "timestamp", double: "float" });
  if (d === "oracle") Object.assign(alias, { integer: "number(38)", int: "number(38)", smallint: "number(38)", varchar: "varchar2", "double precision": "float", float: "float" });
  if (d === "sqlite") Object.assign(alias, { int: "integer", bool: "boolean" });
  const b = alias[base] ?? base;
  if (d === "oracle" && base === "timestamp" && args === "(6)") return "timestamp";
  if (d === "mysql" && /^(tinyint|smallint|mediumint|int|bigint)$/.test(base) && !(base === "tinyint" && args === "(1)")) return b + (b.includes("(") ? "" : "");
  if (d === "oracle" && b.includes("(")) return b;
  if (d === "oracle" && base === "number" && args === "") return "number";
  if (d === "mssql" && /^(int|bigint|smallint|tinyint|bit|float|real|date|datetime|datetime2|text|ntext|uniqueidentifier)$/.test(base)) return b;
  return b.includes("(") ? b : b + args;
}

/** Strips casts, parentheses and quoting so `'x'::character varying`, `('x')` and `x` compare equal. */
export function normalizeDefault(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  let s = raw.trim().toLowerCase();
  let prev = "";
  while (prev !== s) { prev = s; s = s.replace(/::[a-z_ ]+(\([^)]*\))?(\[\])?/g, "").trim(); if (s.startsWith("(") && s.endsWith(")")) s = s.slice(1, -1).trim(); }
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) s = s.slice(1, -1).replaceAll("''", "'");
  return s === "null" ? undefined : s;
}
