import { tokenize, type Dialect, type Token } from "./tokenizer.js";

export interface Statement {
  /** Statement text without its terminator, trimmed. */
  text: string;
  /** Offsets of the trimmed text in the source. */
  start: number;
  end: number;
}

const PLSQL_START = /^(declare|begin)\b/i;
const PLSQL_CREATE = /^create\s+(or\s+replace\s+)?(editionable\s+|noneditionable\s+)?(procedure|function|package|trigger|type\s+body)\b/i;

/**
 * Splits a script into statements for a dialect:
 *  - `;` outside strings/quotes/comments (all dialects)
 *  - MySQL: `DELIMITER xx` client commands
 *  - SQL Server: `GO` on its own line; `;` inside BEGIN..END is not a boundary
 *  - Oracle: PL/SQL blocks end at a line containing only `/`
 */
export function splitScript(sql: string, dialect: Dialect = "ansi"): Statement[] {
  const toks = tokenize(sql, dialect);
  const out: Statement[] = [];
  let delimiter = ";";
  let start = 0;          // start offset of current statement
  let depth = 0;          // BEGIN..END nesting (mssql)
  let plsql = false;      // inside a PL/SQL unit (oracle)
  let atLineStart = true;

  const emit = (end: number) => {
    const raw = sql.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    if (text && !isOnlyComments(text, dialect)) out.push({ text, start: start + lead, end: start + lead + text.length });
  };
  const firstWords = (from: number) => sql.slice(from, from + 200).replace(/^(\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, "");

  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]!;
    if (t.type === "ws") { atLineStart = /\n/.test(t.text) || atLineStart; continue; }
    const stmtEmpty = sql.slice(start, t.start).trim() === "";
    if (stmtEmpty && dialect === "oracle") plsql = PLSQL_START.test(firstWords(t.start)) || PLSQL_CREATE.test(firstWords(t.start));
    if (dialect === "mysql" && atLineStart && t.type === "word" && /^delimiter$/i.test(t.text) && stmtEmpty) {
      // DELIMITER <token> to end of line
      const eol = sql.indexOf("\n", t.end); const lineEnd = eol < 0 ? sql.length : eol;
      const arg = sql.slice(t.end, lineEnd).trim();
      if (arg) delimiter = arg;
      start = lineEnd;
      while (k + 1 < toks.length && toks[k + 1]!.start < lineEnd) k++;
      atLineStart = true; continue;
    }
    if (dialect === "mssql" && atLineStart && t.type === "word" && /^go$/i.test(t.text) && lineIsOnly(sql, t, /^go(\s+\d+)?$/i)) {
      emit(t.start);
      const eol = sql.indexOf("\n", t.end); start = eol < 0 ? sql.length : eol; depth = 0; atLineStart = false;
      while (k + 1 < toks.length && toks[k + 1]!.start < start) k++;
      continue;
    }
    if (dialect === "oracle" && plsql && atLineStart && t.type === "op" && t.text === "/" && lineIsOnly(sql, t, /^\/$/)) {
      emit(t.start); start = t.end; plsql = false; atLineStart = false; continue;
    }
    atLineStart = false;
    if (dialect === "mssql" && t.type === "word") {
      if (/^begin$/i.test(t.text) && !/^\s*(tran|transaction|try|catch)/i.test(sql.slice(t.end, t.end + 20))) depth++;
      else if (/^begin$/i.test(t.text)) { /* BEGIN TRAN is not a block */ }
      else if (/^end$/i.test(t.text) && depth > 0 && !/^\s*(try|catch)/i.test(sql.slice(t.end, t.end + 10))) depth--;
    }
    if (delimiter === ";") {
      if (t.type === "punct" && t.text === ";" && depth === 0 && !(dialect === "oracle" && plsql)) { emit(t.start); start = t.end; }
    } else if (t.type !== "string" && t.type !== "quoted" && t.type !== "comment" && t.text.includes(delimiter)) {
      const at = t.start + t.text.indexOf(delimiter);
      emit(at); start = at + delimiter.length;
      while (k + 1 < toks.length && toks[k + 1]!.start < start) k++;
    }
  }
  emit(sql.length);
  return out;
}

function lineIsOnly(sql: string, t: Token, re: RegExp): boolean {
  const ls = sql.lastIndexOf("\n", t.start - 1) + 1;
  const le = sql.indexOf("\n", t.end);
  return re.test(sql.slice(ls, le < 0 ? sql.length : le).trim());
}

function isOnlyComments(text: string, dialect: Dialect): boolean {
  return tokenize(text, dialect).every((t) => t.type === "ws" || t.type === "comment");
}

/** Statement containing the offset (or the closest preceding one). */
export function statementAtOffset(sql: string, offset: number, dialect: Dialect = "ansi"): Statement | undefined {
  const all = splitScript(sql, dialect);
  return all.find((s) => offset >= s.start && offset <= s.end + 1) ?? [...all].reverse().find((s) => s.end <= offset) ?? all[0];
}
