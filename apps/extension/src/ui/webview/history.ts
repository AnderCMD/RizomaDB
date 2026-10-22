import { HostToHistory } from "../../historyMessages.js";
import { tr } from "./i18n.js";
import { el, icon, iconButton, enableTips } from "./ui.js";

declare function acquireVsCodeApi(): { postMessage(m: unknown): void };
const api = acquireVsCodeApi();
const send = (m: Record<string, unknown>) => api.postMessage({ v: 1, ...m });
const app = document.getElementById("app")!;
app.setAttribute("role", "main");
enableTips();

type Item = { i: number; ts: string; connectionName: string; environment: string; status: string; durationMs: number; rowCount: number; sql: string; error?: string | undefined; canRun: boolean; starred: boolean };
let items: Item[] = [], query = "", statusFilter: "all" | "ok" | "error" | "starred" = "all", connFilter = "";

const title = el("h1", { id: "title", tabindex: "-1" }, tr("Query history"));
const search = el("input", { type: "search", placeholder: tr("Search the history"), "aria-label": tr("Search the history") });
const field = el("label", { class: "field-icon" }); field.append(icon("search", 14), search);
const conn = el("select", { "aria-label": tr("Connection") });
const chips = el("div", { class: "seg", role: "group", "aria-label": tr("Status") });
const count = el("span", { class: "chip", role: "status" });
const clear = iconButton("trash", tr("Clear the history"), () => send({ type: "clear" }), { danger: true });
const top = el("div", { class: "topbar" });
top.append(el("div", { class: "brand" }, ""), el("span", { class: "grow" }), count, field, conn, chips, clear);
top.firstElementChild!.append(icon("rows", 22), title);
const list = el("div", { class: "hist" });
const main = el("div", { class: "hist-main" }); main.append(list);
app.append(top, main);

const seg = (id: typeof statusFilter, label: string) => {
  const b = el("button", { type: "button", class: "segb", "aria-pressed": String(statusFilter === id) }, label);
  b.addEventListener("click", () => { statusFilter = id; renderChips(); fill(); }); return b;
};
function renderChips() { chips.replaceChildren(seg("all", tr("All")), seg("starred", tr("Starred")), seg("ok", tr("Succeeded")), seg("error", tr("Failed"))); }

function fill() {
  const q = query.trim().toLowerCase();
  const shown = items.filter((x) => (statusFilter === "all" || (statusFilter === "starred" ? x.starred : statusFilter === "ok" ? x.status === "ok" : x.status !== "ok" && x.status !== "saved")) && (!connFilter || x.connectionName === connFilter) && (!q || x.sql.toLowerCase().includes(q) || x.connectionName.toLowerCase().includes(q)));
  count.textContent = tr("{0} of {1} queries", shown.length.toLocaleString(), items.length.toLocaleString());
  list.replaceChildren();
  if (!shown.length) { const e = el("div", { class: "empty-state" }); e.append(icon("search", 28), el("p", {}, items.length ? tr("No query matches the filters") : tr("The history is empty"))); list.append(e); return; }
  let day = "";
  for (const x of shown) {
    const d = new Date(x.ts), dayLabel = d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    if (dayLabel !== day) { day = dayLabel; list.append(el("h2", { class: "day" }, dayLabel)); }
    const card = el("article", { class: "hcard" });
    const ok = x.status === "ok", saved = x.status === "saved";
    const head = el("div", { class: "hhead" });
    const star = iconButton("star", x.starred ? tr("Remove from favorites") : tr("Add to favorites"), () => send({ type: "star", i: x.i }));
    star.setAttribute("aria-pressed", String(x.starred));
    const run = iconButton("refresh", x.canRun ? tr("Run again") : tr("The connection no longer exists"), () => send({ type: "run", i: x.i }), { primary: x.canRun });
    run.disabled = !x.canRun;
    head.append(el("span", { class: `chip ${saved ? "" : ok ? "pass" : "fail"}` }, saved ? tr("Saved") : `${ok ? "✓" : "✗"} ${ok ? tr("OK") : x.status}`), el("strong", {}, x.connectionName), el("span", { class: `chip env-${x.environment}` }, x.environment.toUpperCase()),
      el("span", { class: "muted" }, saved ? d.toLocaleTimeString() : `${d.toLocaleTimeString()} · ${tr("{0} rows", x.rowCount.toLocaleString())} · ${tr("{0} ms", Math.round(x.durationMs))}`), el("span", { class: "grow" }),
      star, iconButton("external", tr("Open in an editor"), () => send({ type: "open", i: x.i })), run,
      iconButton("copy", tr("Copy the query"), () => send({ type: "copy", i: x.i })));
    card.append(head, el("pre", { class: "hsql" }, x.sql.length > 1200 ? `${x.sql.slice(0, 1200)}…` : x.sql));
    if (x.error) card.append(el("p", { class: "err" }, x.error));
    list.append(card);
  }
}
search.addEventListener("input", () => { query = search.value; fill(); });
conn.addEventListener("change", () => { connFilter = conn.value; fill(); });

window.addEventListener("message", (ev: MessageEvent) => {
  const p = HostToHistory.safeParse(ev.data);
  if (!p.success) return;
  items = p.data.items;
  conn.replaceChildren(el("option", { value: "" }, tr("All connections")), ...[...new Set(items.map((x) => x.connectionName))].sort().map((n) => el("option", { value: n }, n)));
  conn.value = [...conn.options].some((o) => o.value === connFilter) ? connFilter : ""; connFilter = conn.value;
  renderChips(); fill();
});
renderChips();
send({ type: "ready" });
