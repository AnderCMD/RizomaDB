import { format as fmt, type SqlLanguage } from "sql-formatter";
import type { Dialect } from "./tokenizer.js";

const LANG: Record<Dialect, SqlLanguage> = { ansi: "sql", postgres: "postgresql", mysql: "mysql", sqlite: "sqlite", mssql: "transactsql", oracle: "plsql" };

export interface FormatOptions { tabWidth?: number; keywordCase?: "upper" | "lower" | "preserve" }

/** Formats SQL; returns the input unchanged if the formatter cannot parse it. */
export function formatSql(sql: string, dialect: Dialect = "ansi", o: FormatOptions = {}): string {
  try {
    return fmt(sql, {
      language: LANG[dialect], tabWidth: o.tabWidth ?? 2, keywordCase: o.keywordCase ?? "upper",
      paramTypes: { positional: true, numbered: ["$"], named: [":", "@"] },
    });
  } catch { return sql; }
}
