/** Static risk classification of a Trino statement. Default-deny: only recognised reads pass. */
export function stripSql(src: string): string {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i]!, n = src[i + 1];
    if (c === "-" && n === "-") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; out += " "; continue; }
    if (c === "'" || c === '"') { const q = c; i++; while (i < src.length) { if (src[i] === q) { if (src[i + 1] === q) { i += 2; continue; } break; } i++; } i++; out += q === '"' ? ' "id" ' : " "; continue; }
    out += c; i++;
  }
  return out;
}

const WRITE = /\b(INSERT|UPDATE|DELETE|MERGE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|DENY|CALL|COMMENT|SET|RESET|REFRESH|ANALYZE|EXECUTE|PREPARE|DEALLOCATE|USE)\b/i;

export function assessTrino(command: string): { risk: "none" | "write" | "destructive"; reasons: string[] } {
  const code = stripSql(command).trim().replace(/;+\s*$/, "");
  if (!code) return { risk: "none", reasons: [] };
  if (code.includes(";")) return { risk: "write", reasons: ["Several statements in one request: cannot classify safely"] };
  const first = /^\(*\s*(\w+)/.exec(code)?.[1]?.toUpperCase() ?? "";
  if (/^(DROP|DELETE|TRUNCATE)$/.test(first)) return { risk: "destructive", reasons: [`${first} removes data or objects`] };
  if (first === "SHOW" || first === "DESCRIBE" || first === "DESC") return { risk: "none", reasons: [] };
  if (first === "EXPLAIN") {
    // EXPLAIN ANALYZE executes the statement it wraps.
    const inner = code.replace(/^EXPLAIN\s*(\([^)]*\))?\s*(ANALYZE\s*(VERBOSE\s*)?)?/i, "");
    return /^EXPLAIN\s+(\([^)]*\)\s*)?ANALYZE/i.test(code) ? assessTrino(inner) : { risk: "none", reasons: [] };
  }
  if (first === "SELECT" || first === "WITH" || first === "VALUES" || first === "TABLE") {
    return WRITE.test(code) ? { risk: "write", reasons: ["Contains a keyword that modifies data or session state"] } : { risk: "none", reasons: [] };
  }
  return { risk: "write", reasons: [`Statement "${first}" is not a plain read`] };
}
