import { tr } from "./i18n.js";
import { enableTips } from "./ui.js";

enableTips();
declare function acquireVsCodeApi(): { postMessage(m: unknown): void };

interface Node { label: string; detail?: string; rows?: number; actualRows?: number; cost?: number; timeMs?: number; children: Node[]; slow?: boolean }
interface Msg { v: 1; type: "plan"; title: string; analyzed: boolean; totalCost?: number; executionMs?: number; root: Node[]; raw: string }

const isNode = (n: unknown): n is Node => !!n && typeof n === "object" && typeof (n as Node).label === "string" && Array.isArray((n as Node).children) && (n as Node).children.every(isNode);
const isMsg = (m: unknown): m is Msg => !!m && typeof m === "object" && (m as Msg).v === 1 && (m as Msg).type === "plan" && Array.isArray((m as Msg).root) && (m as Msg).root.every(isNode) && typeof (m as Msg).raw === "string";

const fmt = (n: number | undefined) => (n === undefined ? "" : n >= 1000 ? n.toLocaleString() : String(Math.round(n * 100) / 100));
const el = (tag: string, cls?: string, text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

function render(n: Node, maxCost: number, level: number): HTMLElement {
  const li = el("li");
  li.setAttribute("role", "treeitem"); li.setAttribute("aria-level", String(level)); li.setAttribute("aria-expanded", "true");
  if (n.slow) li.classList.add("slow");
  const row = el("div", "node"); row.tabIndex = -1;
  row.append(el("span", "label", n.slow ? tr("{0} — slow", n.label) : n.label));
  const meta = [n.cost !== undefined ? tr("cost {0}", fmt(n.cost)) : "", n.rows !== undefined ? tr("est. rows {0}", fmt(n.rows)) : "", n.actualRows !== undefined ? tr("actual rows {0}", fmt(n.actualRows)) : "", n.timeMs !== undefined ? tr("{0} ms", fmt(n.timeMs)) : ""].filter(Boolean).join(" · ");
  if (meta) row.append(el("span", "meta", meta));
  if (n.detail) row.append(el("div", "detail", n.detail));
  if (n.cost !== undefined && maxCost > 0) { const bar = el("div", "bar"); const f = el("div", "fill"); f.style.width = `${Math.min(100, (n.cost / maxCost) * 100)}%`; bar.append(f); row.append(bar); }
  li.append(row);
  if (n.children.length) { const ul = el("ul"); ul.setAttribute("role", "group"); n.children.forEach((c) => ul.append(render(c, maxCost, level + 1))); li.append(ul); }
  return li;
}

const maxOf = (ns: Node[]): number => Math.max(0, ...ns.map((n) => Math.max(n.cost ?? 0, maxOf(n.children))));

window.addEventListener("message", (e) => {
  if (!isMsg(e.data)) return;
  const m = e.data;
  document.getElementById("title")!.textContent = m.title;
  document.getElementById("summary")!.textContent = [m.analyzed ? "EXPLAIN ANALYZE" : "EXPLAIN", m.totalCost !== undefined ? tr("total cost {0}", fmt(m.totalCost)) : "", m.executionMs !== undefined ? tr("execution {0} ms", fmt(m.executionMs)) : ""].filter(Boolean).join(" · ");
  const tree = document.getElementById("tree")!;
  tree.replaceChildren(...m.root.map((n) => render(n, maxOf(m.root), 1)));
  document.getElementById("raw")!.textContent = m.raw;
  tree.querySelector<HTMLElement>(".node")?.focus();
});

// Roving focus + expand/collapse with the keyboard (WAI-ARIA tree pattern).
document.addEventListener("keydown", (e) => {
  const items = [...document.querySelectorAll<HTMLElement>('#tree [role="treeitem"]')].filter((i) => i.offsetParent !== null);
  const cur = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[role="treeitem"]') ?? null;
  const idx = cur ? items.indexOf(cur) : -1;
  const go = (i: number) => { const t = items[Math.max(0, Math.min(items.length - 1, i))]; t?.querySelector<HTMLElement>(":scope > .node")?.focus(); };
  if (e.key === "ArrowDown") go(idx + 1); else if (e.key === "ArrowUp") go(idx - 1);
  else if (e.key === "ArrowRight" && cur?.getAttribute("aria-expanded") === "false") cur.setAttribute("aria-expanded", "true");
  else if (e.key === "ArrowLeft" && cur?.getAttribute("aria-expanded") === "true" && cur.querySelector("ul")) cur.setAttribute("aria-expanded", "false");
  else return;
  e.preventDefault();
});
void acquireVsCodeApi;
