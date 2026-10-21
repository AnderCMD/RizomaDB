/** Static risk classification of a PartiQL statement for DynamoDB. Default-deny. */
export function stripPartiql(src: string): string {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i]!, n = src[i + 1];
    if (c === "-" && n === "-") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; out += " "; continue; }
    if (c === "'" || c === '"') { const q = c; i++; while (i < src.length) { if (src[i] === q) { if (src[i + 1] === q) { i += 2; continue; } break; } i++; } i++; out += c === '"' ? ' "id" ' : " "; continue; }
    out += c; i++;
  }
  return out;
}

export function assessPartiql(command: string): { risk: "none" | "write" | "destructive"; reasons: string[] } {
  const code = stripPartiql(command).trim().replace(/;+\s*$/, "");
  if (!code) return { risk: "none", reasons: [] };
  if (code.includes(";")) return { risk: "write", reasons: ["Several statements in one request: cannot classify safely"] };
  const first = /^(\w+)/.exec(code)?.[1]?.toUpperCase() ?? "";
  if (first === "SELECT" || first === "EXISTS") return { risk: "none", reasons: first === "SELECT" && !/\bWHERE\b/i.test(code) ? ["Without a WHERE clause on the key this is a full table scan (consumes read capacity)"] : [] };
  if (first === "DELETE") return { risk: "destructive", reasons: ["DELETE removes items"] };
  if (first === "INSERT" || first === "UPDATE") return { risk: "write", reasons: [`${first} modifies items`] };
  return { risk: "write", reasons: [`Unrecognised statement "${first}"`] };
}
