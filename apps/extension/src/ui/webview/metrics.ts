import { enableTips } from "./ui.js";
enableTips();
declare function acquireVsCodeApi(): { postMessage(m: unknown): void };

interface Def { name: string; label: string; kind: string }
interface Msg { v: 1; type: "sample"; title: string; defs: Def[]; values: Record<string, number>; t: number }
const isMsg = (m: unknown): m is Msg => !!m && typeof m === "object" && (m as Msg).v === 1 && (m as Msg).type === "sample" && Array.isArray((m as Msg).defs) && typeof (m as Msg).values === "object";

const NS = "http://www.w3.org/2000/svg", MAX = 90;
const series = new Map<string, number[]>();
const root = document.getElementById("charts")!, live = document.getElementById("live")!;
const cards = new Map<string, { value: HTMLElement; line: SVGPolylineElement }>();

function card(d: Def) {
  const c = document.createElement("section"); c.className = "card"; c.setAttribute("aria-label", d.label);
  const h = document.createElement("h2"); h.textContent = d.label;
  const v = document.createElement("div"); v.className = "big"; v.textContent = "–";
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 200 50"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `${d.label} over time`);
  const line = document.createElementNS(NS, "polyline"); line.setAttribute("fill", "none"); line.setAttribute("stroke", "currentColor"); line.setAttribute("stroke-width", "2");
  svg.append(line); c.append(h, v, svg); root.append(c);
  return { value: v, line };
}

window.addEventListener("message", (e) => {
  if (!isMsg(e.data)) return;
  const m = e.data;
  document.getElementById("title")!.textContent = m.title;
  const parts: string[] = [];
  for (const d of m.defs) {
    const val = m.values[d.name];
    if (val === undefined) continue;
    let c = cards.get(d.name); if (!c) { c = card(d); cards.set(d.name, c); }
    const s = series.get(d.name) ?? []; s.push(val); if (s.length > MAX) s.shift(); series.set(d.name, s);
    const max = Math.max(...s, 1);
    c.line.setAttribute("points", s.map((y, i) => `${(i / (MAX - 1)) * 200},${48 - (y / max) * 44}`).join(" "));
    const shown = d.kind === "ratio" ? `${val.toFixed(1)}%` : val >= 100 ? Math.round(val).toLocaleString() : val.toFixed(1);
    c.value.textContent = shown; parts.push(`${d.label} ${shown}`);
  }
  live.textContent = parts.join(", ");
});
void acquireVsCodeApi;
