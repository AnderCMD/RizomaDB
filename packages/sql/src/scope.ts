import { splitScript, statementAtOffset } from "./splitter.js";
import { tokenize, type Dialect, type Token } from "./tokenizer.js";

export interface TableRef { name: string; schema?: string; alias?: string; /** set for derived tables/CTEs */ columns?: string[] }

export type Clause = "select" | "from" | "join" | "on" | "where" | "group" | "order" | "having" | "set" | "into" | "update" | "values" | "with" | "none";

export interface CompletionContext {
  prefix: string;
  /** Text before the last dot (alias, table or schema). */
  qualifier?: string;
  clause: Clause;
  tables: TableRef[];
  ctes: TableRef[];
  /** Offsets of the identifier being typed. */
  replaceStart: number;
  replaceEnd: number;
  statementStart: number;
}

const CLAUSE_KW: Record<string, Clause> = {
  select: "select", from: "from", join: "join", on: "on", where: "where", having: "having", set: "set", into: "into", update: "update", values: "values", with: "with",
};
const STOP_AFTER_TABLE = new Set(["where", "group", "order", "having", "limit", "offset", "fetch", "union", "intersect", "except", "set", "on", "using", "join", "inner", "left", "right", "full", "cross", "natural", "outer", "returning", "window", "for", "values", "select"]);

const sigOf = (toks: Token[]) => toks.filter((t) => t.type !== "ws" && t.type !== "comment");
const lower = (t: Token | undefined) => (t?.type === "word" ? t.text.toLowerCase() : "");
export const unquote = (s: string) => (s.startsWith('"') || s.startsWith("`") ? s.slice(1, -1).replaceAll(s[0]! + s[0]!, s[0]!) : s.startsWith("[") ? s.slice(1, -1).replaceAll("]]", "]") : s);
const isIdent = (t: Token | undefined) => t?.type === "word" || t?.type === "quoted";

/** Table references and CTEs visible at one paren-depth range of a statement. */
function collectRefs(sig: Token[], from: number, to: number): { tables: TableRef[]; ctes: TableRef[] } {
  const tables: TableRef[] = [], ctes: TableRef[] = [];
  let depth = 0;
  for (let i = from; i < to; i++) {
    const t = sig[i]!;
    if (t.text === "(") { depth++; continue; }
    if (t.text === ")") { depth--; continue; }
    if (depth !== 0) continue;
    const kw = lower(t);
    if (kw === "from" || kw === "join" || kw === "update" || kw === "into" || (kw === "using" && false)) {
      let j = i + 1;
      for (;;) {
        // optional ONLY / LATERAL
        while (/^(only|lateral)$/.test(lower(sig[j]))) j++;
        if (sig[j]?.text === "(") {
          // derived table: skip to matching paren, alias follows
          let d = 0, k = j;
          for (; k < to; k++) { if (sig[k]!.text === "(") d++; else if (sig[k]!.text === ")" && --d === 0) break; }
          let a = k + 1;
          if (lower(sig[a]) === "as") a++;
          const alias = isIdent(sig[a]) && !STOP_AFTER_TABLE.has(lower(sig[a])) ? unquote(sig[a]!.text) : undefined;
          if (alias) tables.push({ name: alias, alias, columns: selectListNames(sig, j + 1, k) });
          j = alias ? a + 1 : k + 1;
        } else if (isIdent(sig[j])) {
          const parts = [unquote(sig[j]!.text)]; j++;
          while (sig[j]?.text === "." && isIdent(sig[j + 1])) { parts.push(unquote(sig[j + 1]!.text)); j += 2; }
          let alias: string | undefined;
          if (lower(sig[j]) === "as") j++;
          if (isIdent(sig[j]) && !STOP_AFTER_TABLE.has(lower(sig[j]))) { alias = unquote(sig[j]!.text); j++; }
          const name = parts.at(-1)!, schema = parts.length > 1 ? parts.at(-2) : undefined;
          tables.push({ name, ...(schema ? { schema } : {}), ...(alias ? { alias } : {}) });
        } else break;
        if (sig[j]?.text === "," && (kw === "from")) { j++; continue; }
        break;
      }
      i = Math.max(i, j - 1);
    }
  }
  // CTEs: WITH [RECURSIVE] name [(cols)] AS [NOT] [MATERIALIZED] ( ... ) [, name AS (...)]
  if (lower(sig[from]) === "with") {
    let j = from + 1;
    if (lower(sig[j]) === "recursive") j++;
    while (j < to && isIdent(sig[j])) {
      const name = unquote(sig[j]!.text); j++;
      let cols: string[] | undefined;
      if (sig[j]?.text === "(") { // explicit column list
        const list: string[] = []; j++;
        while (j < to && sig[j]!.text !== ")") { if (isIdent(sig[j])) list.push(unquote(sig[j]!.text)); j++; }
        j++; cols = list;
      }
      if (lower(sig[j]) !== "as") break;
      j++;
      while (/^(not|materialized)$/.test(lower(sig[j]))) j++;
      if (sig[j]?.text !== "(") break;
      let d = 0, k = j;
      for (; k < to; k++) { if (sig[k]!.text === "(") d++; else if (sig[k]!.text === ")" && --d === 0) break; }
      ctes.push({ name, columns: cols ?? selectListNames(sig, j + 1, k) });
      j = k + 1;
      if (sig[j]?.text === ",") j++; else break;
    }
  }
  return { tables, ctes };
}

/** Output column names of the first SELECT in sig[from,to): alias, or last identifier of each expression. */
function selectListNames(sig: Token[], from: number, to: number): string[] {
  let i = from;
  while (i < to && lower(sig[i]) !== "select") { if (lower(sig[i]) === "with") return []; i++; }
  i++;
  if (/^(distinct|all)$/.test(lower(sig[i]))) i++;
  const names: string[] = [];
  let depth = 0, exprStart = i;
  const flush = (end: number) => {
    if (end <= exprStart) return;
    const last = sig[end - 1]!, prev = sig[end - 2];
    if (last.text === "*") return;
    if (isIdent(last) && (lower(prev) === "as" || isIdent(prev) || prev?.text === "." || end - exprStart === 1)) names.push(unquote(last.text));
    else if (isIdent(last)) names.push(unquote(last.text));
  };
  for (; i < to; i++) {
    const t = sig[i]!;
    if (t.text === "(") depth++; else if (t.text === ")") depth--;
    else if (depth === 0 && t.text === ",") { flush(i); exprStart = i + 1; }
    else if (depth === 0 && /^(from|where|group|order|having|limit|union|into)$/.test(lower(t))) break;
  }
  flush(i);
  return names;
}

export function analyzeContext(sql: string, offset: number, dialect: Dialect = "ansi"): CompletionContext {
  const stmt = statementAtOffset(sql, offset, dialect);
  const stmtStart = stmt && offset >= stmt.start - 1 && offset <= stmt.end + 1 ? stmt.start : offset;
  const stmtEnd = stmt && stmtStart === stmt.start ? Math.max(stmt.end, offset) : offset;
  const text = sql.slice(stmtStart, stmtEnd);
  const rel = offset - stmtStart;
  const all = sigOf(tokenize(text, dialect));

  // token under/before the cursor
  const before = all.filter((t) => t.start < rel || (t.start === rel && false));
  let last = before.at(-1);
  let prefix = "", replaceStart = offset, replaceEnd = offset;
  if (last && (last.type === "word" || last.type === "quoted") && last.end >= rel) {
    prefix = unquote(last.text.slice(0, rel - last.start)); replaceStart = stmtStart + last.start; replaceEnd = stmtStart + last.end;
    before.pop(); last = before.at(-1);
  }
  let qualifier: string | undefined;
  if (last?.text === ".") {
    const q = before.at(-2);
    if (q && isIdent(q)) {
      // schema.table. -> qualifier is the table name
      qualifier = unquote(q.text);
    }
  }
  // clause at cursor: innermost open paren scope
  const stack: { clause: Clause; open: number }[] = [{ clause: "none", open: -1 }];
  for (let i = 0; i < before.length; i++) {
    const t = before[i]!;
    if (t.text === "(") stack.push({ clause: "none", open: i });
    else if (t.text === ")") { if (stack.length > 1) stack.pop(); }
    else {
      const kw = lower(t);
      const top = stack.at(-1)!;
      if (CLAUSE_KW[kw]) top.clause = CLAUSE_KW[kw]!;
      else if (kw === "by" && /^(group|order)$/.test(lower(before[i - 1]))) top.clause = lower(before[i - 1]) === "group" ? "group" : "order";
      else if (kw === "delete") top.clause = "none";
    }
  }
  const scope = stack.at(-1)!;
  // table refs: the whole statement at the cursor's paren depth + every enclosing scope (correlated subqueries)
  const tables: TableRef[] = [], ctes: TableRef[] = [];
  const sigAll = all;
  const addRefs = (from: number, to: number) => { const r = collectRefs(sigAll, from, to); tables.push(...r.tables); ctes.push(...r.ctes); };
  // innermost scope range
  const scopeStart = scope.open + 1;
  let scopeEnd = sigAll.length;
  if (scope.open >= 0) { let d = 0; for (let i = scope.open; i < sigAll.length; i++) { if (sigAll[i]!.text === "(") d++; else if (sigAll[i]!.text === ")" && --d === 0) { scopeEnd = i; break; } } }
  addRefs(scopeStart, scopeEnd);
  for (let s = stack.length - 2; s >= 0; s--) {
    const open = stack[s]!.open; let end = sigAll.length;
    if (open >= 0) { let d = 0; for (let i = open; i < sigAll.length; i++) { if (sigAll[i]!.text === "(") d++; else if (sigAll[i]!.text === ")" && --d === 0) { end = i; break; } } }
    addRefs(open + 1, end);
  }
  // CTE definitions precede the main statement: always scan from statement start
  ctes.push(...collectRefs(sigAll, 0, sigAll.length).ctes.filter((c) => !ctes.some((x) => x.name === c.name)));
  // DELETE FROM / INSERT INTO handled by collectRefs through FROM/INTO keywords
  return { prefix, ...(qualifier ? { qualifier } : {}), clause: scope.clause, tables, ctes, replaceStart, replaceEnd, statementStart: stmtStart };
}

export { splitScript };
