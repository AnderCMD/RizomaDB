import type { SchemaIndex, SchemaTable } from "./schema.js";
import { analyzeContext, type CompletionContext, type TableRef } from "./scope.js";
import { functionsFor, keywordsFor } from "./keywords.js";
import type { Dialect } from "./tokenizer.js";

export type CompletionKind = "table" | "view" | "column" | "keyword" | "function" | "schema" | "alias" | "join";
export interface CompletionItem { label: string; kind: CompletionKind; detail?: string; insertText: string; sortText: string }
export interface CompletionResult { items: CompletionItem[]; replaceStart: number; replaceEnd: number; context: CompletionContext }

const lc = (s: string) => s.toLowerCase();
const starts = (label: string, prefix: string) => !prefix || lc(label).startsWith(lc(prefix));

const ord = (n: number) => String(n).padStart(5, "0");
const needsQuote = (n: string) => !/^[a-z_][a-z0-9_$]*$/.test(n);
export function quoteIfNeeded(n: string, d: Dialect): string {
  if (!needsQuote(n)) return n;
  if (d === "mysql") return `\`${n.replaceAll("`", "``")}\``;
  if (d === "mssql") return `[${n.replaceAll("]", "]]")}]`;
  return `"${n.replaceAll('"', '""')}"`;
}

/** Resolve a table reference from the statement to schema info (CTEs and derived tables carry their own columns). */
function resolve(ref: TableRef, schema: SchemaIndex, ctes: TableRef[]): { name: string; alias: string; table?: SchemaTable; columns: { name: string; type?: string; pk?: boolean }[] } {
  const alias = ref.alias ?? ref.name;
  if (ref.columns) return { name: ref.name, alias, columns: ref.columns.map((n) => ({ name: n })) };
  const cte = !ref.schema ? ctes.find((c) => lc(c.name) === lc(ref.name)) : undefined;
  if (cte) return { name: cte.name, alias, columns: (cte.columns ?? []).map((n) => ({ name: n })) };
  const t = schema.find(ref.name, ref.schema);
  return { name: ref.name, alias, ...(t ? { table: t } : {}), columns: t?.columns ?? [] };
}

export function complete(sql: string, offset: number, schema: SchemaIndex, dialect: Dialect = "ansi"): CompletionResult {
  const ctx = analyzeContext(sql, offset, dialect);
  const items: CompletionItem[] = [];
  const { prefix, qualifier, clause } = ctx;
  const resolved = ctx.tables.map((t) => resolve(t, schema, ctx.ctes));
  const add = (i: CompletionItem) => items.push(i);
  const q = (n: string) => quoteIfNeeded(n, dialect);

  const tableItems = (limit = 300) => {
    for (const t of schema.tablesWithPrefix(prefix, limit)) {
      add({ label: t.name, kind: t.kind === "view" ? "view" : "table", detail: t.schema ? `${t.schema}` : undefined, insertText: q(t.name), sortText: `1${lc(t.name)}` } as CompletionItem);
    }
    for (const c of ctx.ctes) if (starts(c.name, prefix)) add({ label: c.name, kind: "table", detail: "CTE", insertText: q(c.name), sortText: `0${lc(c.name)}` });
    for (const s of schema.schemas()) if (starts(s, prefix)) add({ label: s, kind: "schema", insertText: q(s), sortText: `2${lc(s)}` });
  };

  if (qualifier) {
    const ql = lc(qualifier);
    const known = (r: (typeof resolved)[number]) => !!r.table || r.columns.length > 0;
    const hit = resolved.find((r) => lc(r.alias) === ql && known(r)) ?? resolved.find((r) => lc(r.name) === ql && known(r));
    if (hit) {
      hit.columns.forEach((c, n) => { if (starts(c.name, prefix)) add({ label: c.name, kind: "column", ...(c.type ? { detail: c.type } : {}), insertText: q(c.name), sortText: `${c.pk ? 0 : 1}${ord(n)}` }); });
    } else if (schema.schemas().some((s) => lc(s) === ql)) {
      for (const t of schema.tables) if (t.schema && lc(t.schema) === ql && starts(t.name, prefix)) add({ label: t.name, kind: t.kind === "view" ? "view" : "table", insertText: q(t.name), sortText: lc(t.name) });
    } else {
      const t = schema.find(qualifier);
      if (t) t.columns.forEach((c, n) => { if (starts(c.name, prefix)) add({ label: c.name, kind: "column", detail: c.type, insertText: q(c.name), sortText: `1${ord(n)}` }); });
    }
  } else if (clause === "from" || clause === "join" || clause === "update" || clause === "into") {
    if (clause === "join") {
      // tables related by FK to the ones already in scope first
      const related = new Map<string, SchemaTable>();
      for (const r of resolved) if (r.table) for (const x of schema.relatedTables(r.table)) related.set(lc(x.name), x);
      for (const t of related.values()) if (starts(t.name, prefix)) add({ label: t.name, kind: "table", detail: "related by foreign key", insertText: q(t.name), sortText: `0${lc(t.name)}` });
    }
    tableItems();
  } else if (clause === "on") {
    // join condition suggestions from foreign keys between the last joined table and the others
    const last = resolved.at(-1);
    if (last?.table) {
      for (const other of resolved.slice(0, -1)) {
        if (!other.table) continue;
        for (const fk of schema.fksBetween(last.table, other.table)) {
          const lcols = fk.from.table.toLowerCase() === lc(last.table.name) ? fk.from.columns : fk.to.columns;
          const ocols = fk.from.table.toLowerCase() === lc(last.table.name) ? fk.to.columns : fk.from.columns;
          const cond = lcols.map((c, i) => `${last.alias}.${q(c)} = ${other.alias}.${q(ocols[i]!)}`).join(" AND ");
          if (!prefix || lc(cond).includes(lc(prefix))) add({ label: cond, kind: "join", detail: `FK ${fk.name}`, insertText: cond, sortText: "0" + cond });
        }
      }
    }
    columnItems();
  } else if (["select", "where", "group", "order", "having", "set", "values", "none", "with"].includes(clause)) {
    columnItems();
    for (const f of functionsFor(dialect)) if (starts(f, prefix)) add({ label: f, kind: "function", insertText: `${f}(`, sortText: `3${f}` });
    for (const k of keywordsFor(dialect)) if (starts(k, prefix)) add({ label: k, kind: "keyword", insertText: k, sortText: `4${k}` });
    if (clause === "none" && resolved.length === 0) tableItems(50);
  }

  function columnItems() {
    const multiple = resolved.length > 1;
    const seen = new Map<string, number>();
    for (const r of resolved) for (const c of r.columns) seen.set(lc(c.name), (seen.get(lc(c.name)) ?? 0) + 1);
    for (const r of resolved) {
      if (starts(r.alias, prefix)) add({ label: r.alias, kind: "alias", detail: r.name === r.alias ? "table" : `alias of ${r.name}`, insertText: q(r.alias), sortText: `2${lc(r.alias)}` });
      for (const [n, c] of r.columns.entries()) {
        if (!starts(c.name, prefix)) continue;
        const ambiguous = (seen.get(lc(c.name)) ?? 0) > 1;
        add({ label: ambiguous ? `${r.alias}.${c.name}` : c.name, kind: "column", detail: [c.type, multiple && !ambiguous ? r.alias : ""].filter(Boolean).join(" · "),
          insertText: ambiguous ? `${r.alias}.${q(c.name)}` : q(c.name), sortText: `${c.pk ? 0 : 1}${ord(n)}${lc(r.alias)}` });
      }
    }
  }

  // de-duplicate by label+kind, keep order by sortText
  const uniq = new Map<string, CompletionItem>();
  for (const i of items) if (!uniq.has(`${i.kind}:${i.label}`)) uniq.set(`${i.kind}:${i.label}`, i);
  return { items: [...uniq.values()].sort((a, b) => (a.sortText < b.sortText ? -1 : a.sortText > b.sortText ? 1 : 0)), replaceStart: ctx.replaceStart, replaceEnd: ctx.replaceEnd, context: ctx };
}
