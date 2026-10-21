export interface Statement { text: string; start: number; end: number }

/**
 * Splits SQL on top-level semicolons. Understands '...', "...", `...`, -- and
 * block comments, and PostgreSQL dollar quotes. Dialect-specific delimiters
 * (MySQL DELIMITER, T-SQL GO) arrive with the language server (Phase 3).
 */
export function splitStatements(sql: string): Statement[] {
  const out: Statement[] = [];
  let start = 0, i = 0;
  const push = (end: number) => {
    const raw = sql.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    if (text && !/^(--[^\n]*\s*|\/\*[\s\S]*?\*\/\s*)+$/.test(text)) out.push({ text, start: start + lead, end: start + lead + text.length });
  };
  while (i < sql.length) {
    const c = sql[i]!, n = sql[i + 1];
    if (c === "-" && n === "-") { const e = sql.indexOf("\n", i); i = e < 0 ? sql.length : e; }
    else if (c === "/" && n === "*") { const e = sql.indexOf("*/", i + 2); i = e < 0 ? sql.length : e + 2; }
    else if (c === "'" || c === '"' || c === "`") {
      i++;
      while (i < sql.length) {
        if (sql[i] === c) { if (sql[i + 1] === c) i += 2; else { i++; break; } } else i++;
      }
    } else if (c === "$") {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m) { const e = sql.indexOf(m[0], i + m[0].length); i = e < 0 ? sql.length : e + m[0].length; } else i++;
    } else if (c === ";") { push(i); i++; start = i; }
    else i++;
  }
  push(sql.length);
  return out;
}

/** Statement containing the offset, or the nearest one before it. */
export function statementAt(sql: string, offset: number): Statement | undefined {
  const all = splitStatements(sql);
  return all.find((s) => offset >= s.start && offset <= s.end + 1)
    ?? [...all].reverse().find((s) => s.end <= offset) ?? all[0];
}
