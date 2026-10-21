/** Static risk classification of a Cypher statement. Default-deny: anything not recognised as a read is a write. */
export type Risk = "none" | "write" | "destructive";

/** Removes comments and string/backtick-quoted contents so keyword scans see only code. */
export function stripCypher(src: string): string {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i]!, n = src[i + 1];
    if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; out += " "; continue; }
    if (c === "'" || c === '"' || c === "`") {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === "\\" && q !== "`") i++; i++; }
      i++; out += c === "`" ? " id " : " "; continue;
    }
    out += c; i++;
  }
  return out;
}

const READ_PROCEDURES = /^(db\.(labels|relationshipTypes|propertyKeys|schema\.\w+|indexes|constraints|info|ping|stats\.retrieve)|dbms\.(components|queryJmx|listConfig|showCurrentUser|listCapabilities)|apoc\.(meta\.\w+|help))$/i;

export function assessCypher(command: string): { risk: Risk; reasons: string[] } {
  const code = stripCypher(command).trim().replace(/;+\s*$/, "");
  if (!code) return { risk: "none", reasons: [] };
  if (code.includes(";")) return { risk: "write", reasons: ["Several statements in one request: cannot classify safely"] };
  const reasons: string[] = [];
  let risk: Risk = "none";
  const raise = (r: Risk, why: string) => { if (r === "destructive" || risk === "none") risk = r; reasons.push(why); };

  if (/\bDETACH\s+DELETE\b/i.test(code)) raise("destructive", "DETACH DELETE removes nodes and all their relationships");
  else if (/\bDELETE\b/i.test(code)) raise("destructive", "DELETE removes graph data");
  if (/\bDROP\b/i.test(code)) raise("destructive", "DROP removes a database, index or constraint");
  if (/\b(GRANT|DENY|REVOKE|ALTER|RENAME|START|STOP|TERMINATE|ENABLE|DISABLE)\b/i.test(code)) raise("write", "Administration command");
  if (/\bLOAD\s+CSV\b/i.test(code)) raise("write", "LOAD CSV reads files or URLs chosen by the query");
  if (/\bCOPY\b/i.test(code)) raise("write", "Bulk data movement");
  if (/\b(CREATE|MERGE|SET|REMOVE|FOREACH)\b/i.test(code)) raise("write", "Statement modifies the graph");
  // CALL: only an allow-list of procedures is a read; subqueries are scanned recursively through the keyword checks above.
  for (const m of code.matchAll(/\bCALL\s+([A-Za-z_][\w.]*)\s*\(/g)) {
    if (!READ_PROCEDURES.test(m[1]!)) raise("write", `Procedure ${m[1]} is not on the read-only list`);
  }
  if (/\bCALL\s+\{/i.test(code) && /\b(IN\s+TRANSACTIONS)\b/i.test(code)) raise("write", "Batched subquery transaction");
  const first = /^\s*(\w+)/.exec(code)?.[1]?.toUpperCase() ?? "";
  const READ_START = new Set(["MATCH", "OPTIONAL", "RETURN", "WITH", "UNWIND", "CALL", "SHOW", "EXPLAIN", "USE"]);
  if (risk === "none" && !READ_START.has(first)) raise("write", `Unrecognised statement start "${first}"`);
  // PROFILE executes the inner statement for real; classify it by its content only (already done above) and start-word.
  if (risk === "none" && first === "PROFILE") raise("write", "PROFILE executes the statement");
  return { risk, reasons };
}
