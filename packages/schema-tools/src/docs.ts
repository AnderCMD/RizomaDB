import type { SchemaModel } from "./model.js";
import { toMermaid } from "./er.js";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const md = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function toMarkdown(m: SchemaModel, title = "Database schema"): string {
  const out = [`# ${md(title)}`, "", `Dialect: ${m.dialect} · ${m.tables.length} tables`, "", "## Relationships", "", "```mermaid", toMermaid(m).trimEnd(), "```", ""];
  for (const t of [...m.tables].sort((a, b) => a.name.localeCompare(b.name))) {
    out.push(`## ${md(t.name)}`, "");
    if (t.comment) out.push(md(t.comment), "");
    out.push("| Column | Type | Null | Default | Notes |", "|---|---|---|---|---|");
    for (const c of t.columns) {
      const notes = [t.primaryKey.some((p) => p.toLowerCase() === c.name.toLowerCase()) ? "PK" : "", ...t.foreignKeys.filter((f) => f.columns.some((x) => x.toLowerCase() === c.name.toLowerCase())).map((f) => `FK → ${f.refTable}(${f.refColumns.join(", ")})`), c.comment ?? ""].filter(Boolean).join("; ");
      out.push(`| ${md(c.name)} | ${md(c.type)} | ${c.nullable ? "yes" : "no"} | ${c.default ? md(c.default) : ""} | ${md(notes)} |`);
    }
    if (t.indexes.length) { out.push("", "Indexes:", ""); for (const i of t.indexes) out.push(`- ${md(i.name)}${i.unique ? " (unique)" : ""}: ${i.columns.map(md).join(", ")}`); }
    out.push("");
  }
  return out.join("\n");
}

export function toHtml(m: SchemaModel, title = "Database schema"): string {
  const tables = [...m.tables].sort((a, b) => a.name.localeCompare(b.name)).map((t) => `<section id="t-${esc(t.name)}"><h2>${esc(t.name)}</h2>${t.comment ? `<p>${esc(t.comment)}</p>` : ""}<table><thead><tr><th scope="col">Column</th><th scope="col">Type</th><th scope="col">Null</th><th scope="col">Default</th><th scope="col">Notes</th></tr></thead><tbody>${t.columns.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.type)}</td><td>${c.nullable ? "yes" : "no"}</td><td>${esc(c.default ?? "")}</td><td>${[t.primaryKey.some((p) => p.toLowerCase() === c.name.toLowerCase()) ? "PK" : "", ...t.foreignKeys.filter((f) => f.columns.some((x) => x.toLowerCase() === c.name.toLowerCase())).map((f) => `FK → <a href="#t-${esc(f.refTable)}">${esc(f.refTable)}</a>`), esc(c.comment ?? "")].filter(Boolean).join("; ")}</td></tr>`).join("")}</tbody></table></section>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;color:#0f172a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:.35rem .6rem;text-align:left}th{background:#f1f5f9}a{color:#0f766e}</style></head><body><h1>${esc(title)}</h1><p>Dialect: ${esc(m.dialect)} · ${m.tables.length} tables</p>${tables}</body></html>`;
}
