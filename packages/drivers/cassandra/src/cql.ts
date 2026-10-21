/** Static risk classification of a CQL statement. Default-deny. */
export function stripCql(src: string): string {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i]!, n = src[i + 1];
    if ((c === "-" && n === "-") || (c === "/" && n === "/")) { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; out += " "; continue; }
    if (c === "$" && n === "$") { const e = src.indexOf("$$", i + 2); i = e < 0 ? src.length : e + 2; out += " "; continue; }
    if (c === "'" || c === '"') { const q = c; i++; while (i < src.length) { if (src[i] === q) { if (src[i + 1] === q) { i += 2; continue; } break; } i++; } i++; out += q === '"' ? ' "id" ' : " "; continue; }
    out += c; i++;
  }
  return out;
}

export function assessCql(command: string): { risk: "none" | "write" | "destructive"; reasons: string[] } {
  const code = stripCql(command).trim().replace(/;+\s*$/, "");
  if (!code) return { risk: "none", reasons: [] };
  if (code.includes(";")) return { risk: "write", reasons: ["Several statements in one request: cannot classify safely"] };
  const first = /^(\w+)/.exec(code)?.[1]?.toUpperCase() ?? "";
  switch (first) {
    case "SELECT": case "USE": case "DESCRIBE": case "DESC": case "LIST":
      return { risk: "none", reasons: first === "SELECT" && /\bALLOW\s+FILTERING\b/i.test(code) ? ["ALLOW FILTERING can scan whole tables"] : [] };
    case "DELETE": return { risk: "destructive", reasons: ["DELETE removes data"] };
    case "TRUNCATE": return { risk: "destructive", reasons: ["TRUNCATE removes all rows of the table"] };
    case "DROP": return { risk: "destructive", reasons: ["DROP removes a schema object"] };
    case "INSERT": case "UPDATE": return { risk: "write", reasons: [`${first} modifies data`] };
    case "BEGIN": case "APPLY": return { risk: /\bDELETE\b|\bTRUNCATE\b/i.test(code) ? "destructive" : "write", reasons: ["Batch"] };
    default: return { risk: "write", reasons: [`Statement "${first}" is not a read`] };
  }
}
