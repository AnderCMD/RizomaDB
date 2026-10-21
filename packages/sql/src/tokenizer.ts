export type Dialect = "ansi" | "postgres" | "mysql" | "sqlite" | "mssql" | "oracle";

export type TokenType = "ws" | "comment" | "word" | "quoted" | "string" | "number" | "param" | "op" | "punct";

export interface Token { type: TokenType; text: string; start: number; end: number }

const isWordStart = (c: string) => /[\p{L}_#]/u.test(c);
const isWordPart = (c: string) => /[\p{L}\p{N}_$#]/u.test(c);

/**
 * Lossless tokenizer: concatenating all token texts always reproduces the input,
 * and it never throws (unterminated strings/comments run to the end of input).
 */
export function tokenize(sql: string, dialect: Dialect = "ansi"): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = sql.length;
  const push = (type: TokenType, start: number, end: number) => out.push({ type, text: sql.slice(start, end), start, end });
  while (i < n) {
    const c = sql[i]!, d = sql[i + 1];
    const s = i;
    if (/\s/.test(c)) { while (i < n && /\s/.test(sql[i]!)) i++; push("ws", s, i); continue; }
    if (c === "-" && d === "-") { while (i < n && sql[i] !== "\n") i++; push("comment", s, i); continue; }
    if (c === "#" && dialect === "mysql") { while (i < n && sql[i] !== "\n") i++; push("comment", s, i); continue; }
    if (c === "/" && d === "*") {
      i += 2; let depth = 1;
      while (i < n && depth > 0) {
        if (dialect === "postgres" && sql[i] === "/" && sql[i + 1] === "*") { depth++; i += 2; }
        else if (sql[i] === "*" && sql[i + 1] === "/") { depth--; i += 2; }
        else i++;
      }
      push("comment", s, i); continue;
    }
    if (c === "'" || (dialect === "postgres" && /[eE]/.test(c) && d === "'") || ((dialect === "oracle" || dialect === "mssql") && /[nN]/.test(c) && d === "'")) {
      if (c !== "'") i++;
      const backslash = dialect === "mysql" || (dialect === "postgres" && /[eE]/.test(c));
      i++;
      while (i < n) {
        if (backslash && sql[i] === "\\") { i += 2; continue; }
        if (sql[i] === "'") { if (sql[i + 1] === "'") { i += 2; continue; } i++; break; }
        i++;
      }
      push("string", s, Math.min(i, n)); i = Math.min(i, n); continue;
    }
    if (c === '"' || (c === "`" && dialect === "mysql") || (c === "[" && dialect === "mssql")) {
      const close = c === "[" ? "]" : c;
      i++;
      while (i < n) {
        if (sql[i] === close) { if (sql[i + 1] === close) { i += 2; continue; } i++; break; }
        i++;
      }
      push("quoted", s, Math.min(i, n)); i = Math.min(i, n); continue;
    }
    if (c === "$" && dialect === "postgres") {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 64));
      if (m) {
        const e = sql.indexOf(m[0], i + m[0].length);
        i = e < 0 ? n : e + m[0].length; push("string", s, i); continue;
      }
      if (/\d/.test(d ?? "")) { i++; while (i < n && /\d/.test(sql[i]!)) i++; push("param", s, i); continue; }
    }
    if (c === "?") { i++; push("param", s, i); continue; }
    if (c === ":" && d !== ":" && d !== "=" && /[\p{L}_\d]/u.test(d ?? "") && dialect !== "mysql") {
      i++; while (i < n && isWordPart(sql[i]!)) i++; push("param", s, i); continue;
    }
    if (c === "@" && (dialect === "mssql" || dialect === "mysql") && /[\p{L}_@\d]/u.test(d ?? "")) {
      i++; while (i < n && (isWordPart(sql[i]!) || sql[i] === "@")) i++; push("param", s, i); continue;
    }
    if (/\d/.test(c) || (c === "." && /\d/.test(d ?? ""))) {
      i++;
      while (i < n && (/[\d.]/.test(sql[i]!) || (/[eE]/.test(sql[i]!) && /[\d+-]/.test(sql[i + 1] ?? "")) || (/[+-]/.test(sql[i]!) && /[eE]/.test(sql[i - 1]!)))) i++;
      push("number", s, i); continue;
    }
    if (isWordStart(c)) { i++; while (i < n && isWordPart(sql[i]!)) i++; push("word", s, i); continue; }
    if (/[()[\],;.]/.test(c)) { i++; push("punct", s, i); continue; }
    // operators: group consecutive symbol chars
    i++;
    while (i < n && /[<>=!|&+\-*/%^~:@]/.test(sql[i]!) && /[<>=!|&+\-*/%^~:@]/.test(c)) i++;
    push("op", s, i);
  }
  return out;
}
