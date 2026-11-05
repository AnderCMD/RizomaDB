export interface Statement { text: string; start: number; end: number }
export interface SplitOptions { /** Stop scanning once this many statements were found. */ maxStatements?: number }

/**
 * True when `text` holds nothing but whitespace and comments (`<line>` to end of line, block comments), in one
 * left-to-right pass. Replaces a nested-quantifier regex that backtracked exponentially on `/* a *\/ /* a *\/ ... x`.
 */
export function onlyComments(text: string, line: "--" | "//" = "--"): boolean {
  const n = text.length;
  let i = 0, seen = false;
  while (i < n) {
    if (WS.test(text[i]!)) { i++; continue; }
    if (text.startsWith(line, i)) { const e = text.indexOf("\n", i); i = e < 0 ? n : e; seen = true; continue; }
    if (text.startsWith("/*", i)) { const e = text.indexOf("*/", i + 2); if (e < 0) return false; i = e + 2; seen = true; continue; }
    return false;
  }
  return seen;
}

const WS = /\s/;
const DOLLAR_TAG = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/y;

/**
 * Splits SQL on top-level semicolons. Understands '...', "...", `...`, -- and
 * block comments, and PostgreSQL dollar quotes. Dialect-specific delimiters
 * (MySQL DELIMITER, T-SQL GO) arrive with the language server (Phase 3).
 */
export function splitStatements(sql: string, opts: SplitOptions = {}): Statement[] {
  const max = opts.maxStatements ?? Infinity;
  const out: Statement[] = [];
  let start = 0, i = 0;
  const push = (end: number) => {
    const raw = sql.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    if (text && !onlyComments(text)) out.push({ text, start: start + lead, end: start + lead + text.length });
  };
  while (i < sql.length && out.length < max) {
    const c = sql[i]!, n = sql[i + 1];
    if (c === "-" && n === "-") { const e = sql.indexOf("\n", i); i = e < 0 ? sql.length : e; }
    else if (c === "/" && n === "*") { const e = sql.indexOf("*/", i + 2); i = e < 0 ? sql.length : e + 2; }
    else if (c === "'" || c === '"' || c === "`") {
      i++;
      while (i < sql.length) {
        if (sql[i] === c) { if (sql[i + 1] === c) i += 2; else { i++; break; } } else i++;
      }
    } else if (c === "$") {
      DOLLAR_TAG.lastIndex = i; const m = DOLLAR_TAG.exec(sql);
      if (m) { const e = sql.indexOf(m[0], i + m[0].length); i = e < 0 ? sql.length : e + m[0].length; } else i++;
    } else if (c === ";") { push(i); i++; start = i; }
    else i++;
  }
  if (out.length < max) push(sql.length);
  return out;
}

/** Statement containing the offset, or the nearest one before it. */
export function statementAt(sql: string, offset: number): Statement | undefined {
  const all = splitStatements(sql);
  return all.find((s) => offset >= s.start && offset <= s.end + 1)
    ?? [...all].reverse().find((s) => s.end <= offset) ?? all[0];
}
