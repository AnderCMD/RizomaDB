import { format as fmt, type SqlLanguage } from "sql-formatter";
import { tokenize, type Dialect } from "./tokenizer.js";

const LANG: Record<Dialect, SqlLanguage> = { ansi: "sql", postgres: "postgresql", mysql: "mysql", sqlite: "sqlite", mssql: "transactsql", oracle: "plsql" };

export type LetterCase = "upper" | "lower" | "preserve";

export interface FormatOptions {
  /** Spaces per indentation level (the editor's tab size). */
  tabWidth?: number;
  /** Indent with tabs (the editor's "insert spaces" turned off). The tabular styles always align with spaces. */
  useTabs?: boolean;
  keywordCase?: LetterCase;
  dataTypeCase?: LetterCase;
  functionCase?: LetterCase;
  indentStyle?: "standard" | "tabularLeft" | "tabularRight";
  logicalOperatorNewline?: "before" | "after";
  /** Parenthesized expressions up to this many characters stay on one line. */
  expressionWidth?: number;
  linesBetweenQueries?: number;
  denseOperators?: boolean;
  newlineBeforeSemicolon?: boolean;
}

/** The defaults keep the output RizomaDB always produced: two spaces, upper-case keywords, everything else as typed. */
export const FORMAT_DEFAULTS: Required<FormatOptions> = {
  tabWidth: 2, useTabs: false, keywordCase: "upper", dataTypeCase: "preserve", functionCase: "preserve", indentStyle: "standard",
  logicalOperatorNewline: "before", expressionWidth: 50, linesBetweenQueries: 1, denseOperators: false, newlineBeforeSemicolon: false,
};

const int = (v: number | undefined, min: number, max: number, d: number) => (v === undefined || !Number.isFinite(v) ? d : Math.min(max, Math.max(min, Math.round(v))));

/**
 * Formats SQL; returns the input unchanged if the formatter cannot parse it. The indentation of the first line is kept
 * on every line (formatting a selection inside indented text leaves it in place), and so is a trailing line break.
 */
export function formatSql(sql: string, dialect: Dialect = "ansi", o: FormatOptions = {}): string {
  const body = sql.trim();
  if (!body) return sql;
  const base = /^(?:[ \t]*\r?\n)*([ \t]*)/.exec(sql)![1]!;
  const trailing = /\r?\n[ \t]*$/.test(sql) ? "\n" : "";
  try {
    const out = fmt(body, {
      language: LANG[dialect],
      tabWidth: int(o.tabWidth, 1, 16, FORMAT_DEFAULTS.tabWidth),
      useTabs: o.useTabs ?? FORMAT_DEFAULTS.useTabs,
      keywordCase: o.keywordCase ?? FORMAT_DEFAULTS.keywordCase,
      dataTypeCase: o.dataTypeCase ?? FORMAT_DEFAULTS.dataTypeCase,
      functionCase: o.functionCase ?? FORMAT_DEFAULTS.functionCase,
      indentStyle: o.indentStyle ?? FORMAT_DEFAULTS.indentStyle,
      logicalOperatorNewline: o.logicalOperatorNewline ?? FORMAT_DEFAULTS.logicalOperatorNewline,
      expressionWidth: int(o.expressionWidth, 10, 1000, FORMAT_DEFAULTS.expressionWidth),
      linesBetweenQueries: int(o.linesBetweenQueries, 0, 10, FORMAT_DEFAULTS.linesBetweenQueries),
      denseOperators: o.denseOperators ?? FORMAT_DEFAULTS.denseOperators,
      newlineBeforeSemicolon: o.newlineBeforeSemicolon ?? FORMAT_DEFAULTS.newlineBeforeSemicolon,
      paramTypes: { positional: true, numbered: ["$"], named: [":", "@"] },
    });
    return (base && !out.includes(MARK) ? indent(out, base, dialect) : out) + trailing;
  } catch { return sql; }
}

const MARK = "\u0000";

/** Prefixes every non-empty line with `base`, except lines that continue a string or quoted name (that would change its value). */
function indent(sql: string, base: string, dialect: Dialect): string {
  let out = base;
  for (const t of tokenize(sql, dialect)) {
    // A placeholder marks the inserted indentation, so lines left empty can lose it again without touching a string's own text.
    out += t.type === "string" || t.type === "quoted" ? t.text : t.text.split("\n").join(`\n${MARK}`);
  }
  const [first, ...rest] = out.split(MARK);
  return first + rest.map((part) => (part === "" || part.startsWith("\n") ? part : base + part)).join("");
}
