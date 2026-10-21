import { tokenize, type Dialect, type Token } from "./tokenizer.js";

export interface Parameter { name: string; style: "positional" | "named"; occurrences: number[] }

/** Tokens that are real bind parameters for the dialect (excludes MySQL @user vars, T-SQL DECLAREd vars and @@globals). */
function paramTokens(sql: string, dialect: Dialect): Token[] {
  const toks = tokenize(sql, dialect);
  const declared = new Set<string>();
  if (dialect === "mssql") {
    // @names introduced by DECLARE are local variables, not bind parameters.
    const sig = toks.filter((t) => t.type !== "ws" && t.type !== "comment");
    let inDeclare = false;
    for (const t of sig) {
      if (t.type === "word" && /^declare$/i.test(t.text)) inDeclare = true;
      else if (t.text === ";" || (t.type === "word" && /^(select|set|insert|update|delete|exec|execute|if|begin|while|print|with|return|go)$/i.test(t.text))) inDeclare = false;
      else if (inDeclare && t.type === "param") declared.add(t.text.toLowerCase());
    }
  }
  return toks.filter((t) => t.type === "param" && !t.text.startsWith("@@") && dialect !== "mysql" || (t.type === "param" && dialect === "mysql" && t.text === "?"))
    .filter((t) => !declared.has(t.text.toLowerCase()));
}

export function findParameters(sql: string, dialect: Dialect = "ansi"): Parameter[] {
  const map = new Map<string, Parameter>();
  let q = 0;
  for (const t of paramTokens(sql, dialect)) {
    const positional = t.text === "?" || /^\$\d+$/.test(t.text);
    const name = t.text === "?" ? String(++q) : t.text.replace(/^[:@$]/, "");
    const key = positional ? `#${name}` : lcName(name);
    const p = map.get(key) ?? { name, style: positional ? "positional" : "named", occurrences: [] };
    p.occurrences.push(t.start); map.set(key, p);
  }
  return [...map.values()];
}
const lcName = (n: string) => n.toLowerCase();

/**
 * Rewrites parameters to the driver's positional placeholders. Repeated names are bound once per
 * occurrence, which works for every engine regardless of how it numbers binds.
 */
export function bindParameters<V>(sql: string, dialect: Dialect, values: Record<string, V>, placeholder: (index: number) => string): { sql: string; params: V[]; missing: string[] } {
  const toks = paramTokens(sql, dialect);
  let out = "", pos = 0, q = 0;
  const params: V[] = [], missing: string[] = [];
  for (const t of toks) {
    const name = t.text === "?" ? String(++q) : t.text.replace(/^[:@$]/, "");
    const v = name in values ? values[name] : Object.entries(values).find(([k]) => lcName(k) === lcName(name))?.[1];
    if (v === undefined) { if (!missing.includes(name)) missing.push(name); continue; }
    out += sql.slice(pos, t.start) + placeholder(params.length + 1); pos = t.end; params.push(v);
  }
  return { sql: out + sql.slice(pos), params, missing };
}
