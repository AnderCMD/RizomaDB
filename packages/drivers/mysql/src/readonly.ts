/**
 * Client-side read-only check for servers whose read-only session is a no-op (TiDB accepts SET ... READ ONLY only as a
 * noop function). Default-deny: only statements recognised as plain reads pass.
 */
export function stripSql(src: string): string {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i]!, n = src[i + 1];
    if ((c === "-" && n === "-" && /\s/.test(src[i + 2] ?? " ")) || c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; out += " "; continue; }
    if (c === "'" || c === '"' || c === "`") { const q = c; i++; while (i < src.length) { if (src[i] === "\\" && q !== "`") { i += 2; continue; } if (src[i] === q) { if (src[i + 1] === q) { i += 2; continue; } break; } i++; } i++; out += q === "`" ? " id " : " "; continue; }
    out += c; i++;
  }
  return out;
}

const READ_START = new Set(["SELECT", "SHOW", "DESC", "DESCRIBE", "EXPLAIN", "WITH", "TABLE", "VALUES", "USE"]);
const WRITE_WORD = /\b(INSERT|UPDATE|DELETE|REPLACE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|CALL|LOAD|SET|KILL|FLUSH|ANALYZE|BACKUP|RESTORE|IMPORT|ADMIN|LOCK|RENAME|OPTIMIZE|REPAIR)\b|\bINTO\s+(OUTFILE|DUMPFILE)\b|\bFOR\s+UPDATE\b|\bLOCK\s+IN\s+SHARE\s+MODE\b/i;

export function isReadOnlyStatement(sql: string): boolean {
  const code = stripSql(sql).trim().replace(/;+\s*$/, "");
  if (!code || code.includes(";")) return false;
  const first = /^\(*\s*(\w+)/.exec(code)?.[1]?.toUpperCase() ?? "";
  if (!READ_START.has(first)) return false;
  if (first === "SHOW" || first === "DESC" || first === "DESCRIBE" || first === "USE") return true;
  return !WRITE_WORD.test(code);
}
