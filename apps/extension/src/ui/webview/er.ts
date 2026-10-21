import { enableTips } from "./ui.js";
enableTips();
declare function acquireVsCodeApi(): { postMessage(m: unknown): void };
const vscode = acquireVsCodeApi();

interface Col { name: string; type: string; pk: boolean; fk: boolean; nullable: boolean }
interface Node { name: string; x: number; y: number; w: number; h: number; cols: Col[] }
interface Edge { from: string; to: string; label: string }
interface Msg { v: 1; type: "er"; title: string; width: number; height: number; nodes: Node[]; edges: Edge[] }

const isMsg = (m: unknown): m is Msg => !!m && typeof m === "object" && (m as Msg).v === 1 && (m as Msg).type === "er" && Array.isArray((m as Msg).nodes) && Array.isArray((m as Msg).edges)
  && (m as Msg).nodes.every((n) => typeof n.name === "string" && typeof n.x === "number" && typeof n.y === "number" && Array.isArray(n.cols));

const NS = "http://www.w3.org/2000/svg", HEAD = 26, ROW = 18;
const svg = document.getElementById("svg") as unknown as SVGSVGElement;
const live = document.getElementById("live")!;
let scale = 1, tx = 0, ty = 0;

const mk = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
};

let data: Msg | undefined;
function apply() { (document.getElementById("viewport") as unknown as SVGGElement).setAttribute("transform", `translate(${tx} ${ty}) scale(${scale})`); }

function draw(m: Msg, focus?: string) {
  data = m;
  const vp = document.getElementById("viewport")!;
  vp.replaceChildren();
  const byName = new Map(m.nodes.map((n) => [n.name.toLowerCase(), n]));
  const related = new Set<string>();
  if (focus) { related.add(focus); for (const e of m.edges) { if (e.from === focus) related.add(e.to); if (e.to === focus) related.add(e.from); } }
  for (const e of m.edges) {
    const a = byName.get(e.from), b = byName.get(e.to); if (!a || !b) continue;
    const ax = a.x < b.x ? a.x + a.w : a.x, bx = a.x < b.x ? b.x : b.x + b.w, ay = a.y + HEAD / 2, by = b.y + HEAD / 2, mx = (ax + bx) / 2;
    const dim = focus && !(related.has(e.from) && related.has(e.to) && (e.from === focus || e.to === focus));
    const p = mk("path", { d: `M${ax} ${ay} C${mx} ${ay} ${mx} ${by} ${bx} ${by}`, fill: "none", stroke: "var(--vscode-charts-blue, #3794ff)", "stroke-width": 1.5, opacity: dim ? 0.15 : 1, "marker-end": "url(#arrow)" });
    p.append(mk("title", {}, `${e.from} → ${e.to} (${e.label})`));
    vp.append(p);
  }
  for (const n of m.nodes) {
    const g = mk("g", { tabindex: 0, role: "button", "aria-description": `Table with ${n.cols.length} columns. Press Enter to highlight its relations.`, opacity: focus && !related.has(n.name.toLowerCase()) ? 0.25 : 1 });
    g.setAttribute("class", "tbl");
    g.append(mk("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: 6, class: "box" }), mk("rect", { x: n.x, y: n.y, width: n.w, height: HEAD, rx: 6, class: "hd" }), mk("text", { x: n.x + 10, y: n.y + 17, class: "name" }, n.name));
    n.cols.forEach((c, i) => g.append(mk("text", { x: n.x + 10, y: n.y + HEAD + 14 + i * ROW, class: "col" }, `${c.pk ? "🔑 " : c.fk ? "↗ " : ""}${c.name}  ${c.type}${c.nullable ? "" : " *"}`)));
    const pick = () => { draw(m, n.name.toLowerCase() === focus ? undefined : n.name.toLowerCase()); live.textContent = focus === n.name.toLowerCase() ? "Selection cleared" : `${n.name} and its relations highlighted`; };
    g.addEventListener("click", pick);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    vp.append(g);
  }
}

window.addEventListener("message", (e) => {
  if (!isMsg(e.data)) return;
  document.getElementById("title")!.textContent = e.data.title;
  scale = 1; tx = 0; ty = 0; apply(); draw(e.data);
  live.textContent = `${e.data.nodes.length} tables, ${e.data.edges.length} relationships`;
});

svg.addEventListener("wheel", (e) => { e.preventDefault(); const f = e.deltaY < 0 ? 1.1 : 1 / 1.1; scale = Math.min(4, Math.max(0.15, scale * f)); apply(); }, { passive: false });
let drag: { x: number; y: number } | undefined;
svg.addEventListener("pointerdown", (e) => { if ((e.target as Element).closest(".tbl")) return; drag = { x: e.clientX - tx, y: e.clientY - ty }; svg.setPointerCapture(e.pointerId); });
svg.addEventListener("pointermove", (e) => { if (!drag) return; tx = e.clientX - drag.x; ty = e.clientY - drag.y; apply(); });
svg.addEventListener("pointerup", () => { drag = undefined; });
document.getElementById("zin")!.addEventListener("click", () => { scale = Math.min(4, scale * 1.2); apply(); });
document.getElementById("zout")!.addEventListener("click", () => { scale = Math.max(0.15, scale / 1.2); apply(); });
document.getElementById("zfit")!.addEventListener("click", () => { if (!data) return; const r = svg.getBoundingClientRect(); scale = Math.min(1.5, r.width / data.width, r.height / data.height); tx = 0; ty = 0; apply(); });
for (const fmt of ["svg", "mermaid", "plantuml"]) document.getElementById(`x-${fmt}`)!.addEventListener("click", () => vscode.postMessage({ v: 1, type: "export", format: fmt }));
document.getElementById("x-png")!.addEventListener("click", () => {
  if (!data) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelector("#viewport")!.setAttribute("transform", "");
  clone.setAttribute("width", String(data.width)); clone.setAttribute("height", String(data.height)); clone.setAttribute("viewBox", `0 0 ${data.width} ${data.height}`);
  clone.setAttribute("xmlns", NS);
  const style = document.createElementNS(NS, "style");
  style.textContent = ".box{fill:#fff;stroke:#0f172a;stroke-width:1.5}.hd{fill:#0f172a}.name{fill:#fff;font:600 13px system-ui}.col{fill:#0f172a;font:12px system-ui}";
  clone.prepend(style);
  const bg = document.createElementNS(NS, "rect"); bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%"); bg.setAttribute("fill", "#f8fafc"); clone.prepend(bg);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = data!.width * 2; c.height = data!.height * 2;
    const ctx = c.getContext("2d")!; ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
    vscode.postMessage({ v: 1, type: "png", data: c.toDataURL("image/png").split(",")[1] });
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
});
