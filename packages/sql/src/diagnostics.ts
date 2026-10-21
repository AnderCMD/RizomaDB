import { splitScript } from "./splitter.js";
import { tokenize, type Dialect } from "./tokenizer.js";
import { analyzeContext, unquote } from "./scope.js";
import type { SchemaIndex } from "./schema.js";

export interface Diagnostic { start: number; end: number; severity: "error" | "warning" | "info"; code: string; message: string }

const lc = (s: string) => s.toLowerCase();

export function diagnose(sql: string, dialect: Dialect, schema?: SchemaIndex, opts: { warnSelectStar?: boolean } = {}): Diagnostic[] {
  const out: Diagnostic[] = [];
  const all = tokenize(sql, dialect);
  // unterminated constructs
  const last = all.at(-1);
  if (last?.type === "string" && !/(?:'|\$\w*\$)$/.test(last.text.slice(1)) && last.text.length < 2) out.push({ start: last.start, end: last.end, severity: "error", code: "unterminated-string", message: "Unterminated string literal" });
  for (const t of all) {
    if (t.type === "string" && /^[eEnN]?'/.test(t.text) && !/'$/.test(t.text.slice(t.text.startsWith("'") ? 1 : 2)) ) out.push({ start: t.start, end: t.end, severity: "error", code: "unterminated-string", message: "Unterminated string literal" });
    if (t.type === "comment" && t.text.startsWith("/*") && !t.text.endsWith("*/")) out.push({ start: t.start, end: t.end, severity: "error", code: "unterminated-comment", message: "Unterminated block comment" });
    if (t.type === "quoted" && t.text.length < 2) out.push({ start: t.start, end: t.end, severity: "error", code: "unterminated-identifier", message: "Unterminated quoted identifier" });
  }
  for (const st of splitScript(sql, dialect)) {
    const sig = tokenize(st.text, dialect).filter((t) => t.type !== "ws" && t.type !== "comment");
    const words = sig.filter((t) => t.type === "word").map((t) => lc(t.text));
    const first = words[0];
    const wordTok = (kw: string) => sig.find((t) => t.type === "word" && lc(t.text) === kw)!;
    if ((first === "update" || first === "delete") && !words.includes("where") && !(dialect === "oracle" && words.includes("current"))) {
      const t = wordTok(first);
      out.push({ start: st.start + t.start, end: st.start + t.end, severity: "warning", code: "no-where", message: `${first.toUpperCase()} without WHERE affects every row` });
    }
    if (first === "truncate" || first === "drop") {
      const t = sig[0]!; out.push({ start: st.start + t.start, end: st.start + t.end, severity: "warning", code: "destructive", message: `${first.toUpperCase()} is destructive` });
    }
    if (opts.warnSelectStar && first === "select" && sig.some((t, i) => t.text === "*" && (sig[i - 1]?.text === "select" || sig[i - 1]?.text === "," || lc(sig[i - 1]?.text ?? "") === "select"))) {
      const t = sig.find((x) => x.text === "*")!; out.push({ start: st.start + t.start, end: st.start + t.end, severity: "info", code: "select-star", message: "SELECT * reads every column; list the columns you need" });
    }
    if (schema && schema.tables.length && ["select", "with", "update", "delete", "insert"].includes(first ?? "")) {
      // evaluate table refs at the end of the statement (all FROM/JOIN visible)
      const ctx = analyzeContext(sql, st.end, dialect);
      for (const ref of ctx.tables) {
        if (ref.columns) continue;
        if (ctx.ctes.some((c) => lc(c.name) === lc(ref.name))) continue;
        if (!schema.find(ref.name, ref.schema)) {
          const tok = sig.find((t) => (t.type === "word" || t.type === "quoted") && lc(unquote(t.text)) === lc(ref.name));
          if (tok) out.push({ start: st.start + tok.start, end: st.start + tok.end, severity: "warning", code: "unknown-table", message: `Table or view "${ref.name}" was not found in the loaded schema` });
        }
      }
    }
  }
  return out;
}
