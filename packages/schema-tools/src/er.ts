import type { SchemaModel, TableM } from "./model.js";

const lc = (s: string) => s.toLowerCase();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const pkSet = (t: TableM) => new Set(t.primaryKey.map(lc));
const fkCols = (t: TableM) => new Set(t.foreignKeys.flatMap((f) => f.columns.map(lc)));

const mermaidId = (n: string) => n.replace(/[^A-Za-z0-9_]/g, "_");
const mermaidType = (t: string) => t.replace(/[^A-Za-z0-9_]/g, "_").replace(/_+$/g, "") || "type";

export function toMermaid(m: SchemaModel): string {
  const out = ["erDiagram"];
  for (const t of m.tables) {
    out.push(`  ${mermaidId(t.name)} {`);
    const pk = pkSet(t), fk = fkCols(t);
    for (const c of t.columns) out.push(`    ${mermaidType(c.type)} ${mermaidId(c.name)}${pk.has(lc(c.name)) ? " PK" : fk.has(lc(c.name)) ? " FK" : ""}`);
    out.push("  }");
  }
  for (const t of m.tables) for (const f of t.foreignKeys) {
    const nullable = f.columns.some((c) => t.columns.find((x) => lc(x.name) === lc(c))?.nullable);
    out.push(`  ${mermaidId(f.refTable)} ||--${nullable ? "o{" : "|{"} ${mermaidId(t.name)} : "${f.name.replace(/"/g, "")}"`);
  }
  return out.join("\n") + "\n";
}

export function toPlantUml(m: SchemaModel): string {
  const out = ["@startuml", "hide circle", "skinparam linetype ortho"];
  for (const t of m.tables) {
    out.push(`entity "${t.name.replace(/"/g, "'")}" as ${mermaidId(t.name)} {`);
    const pk = pkSet(t);
    for (const c of t.columns.filter((c) => pk.has(lc(c.name)))) out.push(`  *${c.name} : ${c.type}`);
    out.push("  --");
    for (const c of t.columns.filter((c) => !pk.has(lc(c.name)))) out.push(`  ${c.nullable ? "" : "*"}${c.name} : ${c.type}`);
    out.push("}");
  }
  for (const t of m.tables) for (const f of t.foreignKeys) out.push(`${mermaidId(f.refTable)} ||--o{ ${mermaidId(t.name)} : ${f.columns.join(",")}`);
  out.push("@enduml");
  return out.join("\n") + "\n";
}

export interface ErNode { table: TableM; x: number; y: number; w: number; h: number }
export interface ErLayout { nodes: ErNode[]; width: number; height: number; edges: { from: string; to: string; label: string }[] }

const ROW = 18, HEAD = 26, PAD = 24, GAP_X = 70, GAP_Y = 28;

/** Layered layout: referenced tables sit left of the tables that reference them. */
export function layoutEr(m: SchemaModel, only?: Set<string>): ErLayout {
  const tables = m.tables.filter((t) => !only || only.has(lc(t.name)));
  const names = new Set(tables.map((t) => lc(t.name)));
  const rank = new Map<string, number>();
  const visit = (t: TableM, stack: Set<string>): number => {
    const k = lc(t.name);
    if (rank.has(k)) return rank.get(k)!;
    if (stack.has(k)) return 0;
    stack.add(k);
    let r = 0;
    for (const f of t.foreignKeys) { const d = tables.find((x) => lc(x.name) === lc(f.refTable)); if (d && d !== t) r = Math.max(r, visit(d, stack) + 1); }
    stack.delete(k); rank.set(k, r); return r;
  };
  tables.forEach((t) => visit(t, new Set()));
  const cols = new Map<number, TableM[]>();
  for (const t of tables) { const r = rank.get(lc(t.name))!; (cols.get(r) ?? cols.set(r, []).get(r)!).push(t); }
  const nodes: ErNode[] = [];
  let x = PAD, height = 0;
  for (const r of [...cols.keys()].sort((a, b) => a - b)) {
    const group = cols.get(r)!.sort((a, b) => (lc(a.name) < lc(b.name) ? -1 : 1));
    const w = Math.max(...group.map((t) => Math.max(t.name.length + 4, ...t.columns.map((c) => c.name.length + c.type.length + 8))), 14) * 7 + 20;
    let y = PAD;
    for (const t of group) { const h = HEAD + t.columns.length * ROW + 8; nodes.push({ table: t, x, y, w, h }); y += h + GAP_Y; }
    height = Math.max(height, y);
    x += w + GAP_X;
  }
  const edges = tables.flatMap((t) => t.foreignKeys.filter((f) => names.has(lc(f.refTable))).map((f) => ({ from: lc(t.name), to: lc(f.refTable), label: f.columns.join(", ") })));
  return { nodes, width: x - GAP_X + PAD, height: height + PAD - GAP_Y, edges };
}

export function toSvg(m: SchemaModel, title = "Entity-relationship diagram", only?: Set<string>): string {
  const L = layoutEr(m, only);
  const byName = new Map(L.nodes.map((n) => [lc(n.table.name), n]));
  const edge = (e: ErLayout["edges"][number]) => {
    const a = byName.get(e.from)!, b = byName.get(e.to)!;
    const ax = a.x < b.x ? a.x + a.w : a.x, bx = a.x < b.x ? b.x : b.x + b.w;
    const ay = a.y + HEAD / 2, by = b.y + HEAD / 2;
    const mx = (ax + bx) / 2;
    return `<path d="M${ax} ${ay} C${mx} ${ay} ${mx} ${by} ${bx} ${by}" fill="none" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"><title>${esc(e.from)} → ${esc(e.to)} (${esc(e.label)})</title></path>`;
  };
  const box = (n: ErNode) => {
    const pk = pkSet(n.table), fk = fkCols(n.table);
    const rows = n.table.columns.map((c, i) => `<text x="${n.x + 10}" y="${n.y + HEAD + 14 + i * ROW}" font-size="12" fill="#0f172a">${pk.has(lc(c.name)) ? "🔑 " : fk.has(lc(c.name)) ? "↗ " : ""}${esc(c.name)}<tspan fill="#475569"> ${esc(c.type)}${c.nullable ? "" : " *"}</tspan></text>`).join("");
    return `<g data-table="${esc(n.table.name)}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6" fill="#ffffff" stroke="#0f172a" stroke-width="1.5"/><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${HEAD}" rx="6" fill="#0f172a"/><text x="${n.x + 10}" y="${n.y + 17}" font-size="13" font-weight="600" fill="#ffffff">${esc(n.table.name)}</text>${rows}</g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 ${Math.max(L.width, 100)} ${Math.max(L.height, 100)}" width="${Math.max(L.width, 100)}" height="${Math.max(L.height, 100)}" font-family="system-ui, sans-serif"><title>${esc(title)}</title><desc>${L.nodes.length} tables and ${L.edges.length} foreign-key relationships</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#64748b"/></marker></defs><rect width="100%" height="100%" fill="#f8fafc"/>${L.edges.map(edge).join("")}${L.nodes.map(box).join("")}</svg>`;
}
