import { HostToWebview } from "../../messages.js";
import { tr } from "./i18n.js";
import { parsePasted } from "./clipboard.js";
import { columnStats } from "./stats.js";
import { el, icon, iconButton, openMenu, enableTips, engineLogo, type MenuItem } from "./ui.js";

declare function acquireVsCodeApi(): { postMessage(m: unknown): void; getState(): unknown; setState(s: unknown): void };
const api = acquireVsCodeApi();
const send = (m: Record<string, unknown>) => api.postMessage({ v: 1, ...m });

type Props = Extract<HostToWebview, { type: "properties" }>;
let props: Props | undefined;
type TabId = "data" | "properties" | "relations" | "ddl";
let tab: TabId = "data";
const GUT = 56, HEAD_H = 32, FILT_H = 32, OVERSCAN = 8, MIN_W = 56, MAX_ROWS_STATS = 200_000;
let ROW_H = 28;

type Cell = string | null;
type Col = { name: string; nativeType: string; kind: string };
interface Saved { compact?: boolean; cols?: Record<string, { w: number[]; hidden: number[] }> }
const saved = ((api.getState() as Saved | undefined) ?? {}) as Saved;

// ---- data ----
let columns: Col[] = [];
let rows: Cell[][] = [];
let editable = false;
let table: { name: string; schema?: string | undefined; alter: boolean } | undefined;
let sets = new Map<string, Cell>();
let deletes = new Set<number>();
let inserts: { set: boolean; text: Cell }[][] = [];

// ---- view state ----
let widths: number[] = [];
let hidden = new Set<number>();
let vcols: number[] = [];
let colX: number[] = [];
let totalW = GUT;
let filters: string[] = [];
let filtersOn = false;
let sort: { col: number; dir: 1 | -1 } | undefined;
let view: number[] | undefined;
let sel = { r: 0, c: 0 };
let selRows = new Set<number>();
let anchor = 0;
let editing: { r: number; c: number } | undefined;
let findQuery = "";
let matches: { r: number; c: number }[] = [];
let matchSet = new Set<string>();
let detailOpen = false;
let pkCols = new Set<string>();
let requiredCols = new Set<string>();
let currentSql = "";

// ---- skeleton ----
const app = document.getElementById("app")!;
app.setAttribute("role", "main");
enableTips();
const titleEl = el("h1", { id: "title" }, "RizomaDB");
const statusEl = el("span", { id: "status", role: "status", class: "chip" }, tr("No results yet"));
const cancelBtn = iconButton("stop", tr("Cancel running query"), () => send({ type: "cancel" }), { hidden: true, danger: true });
const header = el("div", { class: "tb hdr" });
const connBox = el("span", { class: "conn", hidden: "" });
header.append(connBox, titleEl, statusEl, el("span", { class: "grow" }), cancelBtn);  // the table tabs join this row (see below): one line instead of two
const sqlInput = el("textarea", { class: "sqlinput", rows: "1", spellcheck: "false", "aria-label": tr("Query (editable)") });
const growSql = () => { sqlInput.style.height = "auto"; sqlInput.style.height = `${Math.min(sqlInput.scrollHeight, 160)}px`; };
const runEdited = () => send({ type: "runSql", sql: sqlInput.value });
sqlInput.addEventListener("input", growSql);
sqlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runEdited(); }
  else if (e.key === "Escape") { sqlInput.value = currentSql; growSql(); }
});
const sqlBar = el("div", { class: "tb sqlbar", hidden: "" });
sqlBar.append(sqlInput, iconButton("play", tr("Run this query (Ctrl/⌘+Enter)"), runEdited, { primary: true }), iconButton("copy", tr("Copy the query"), () => send({ type: "copy", text: currentSql })), iconButton("external", tr("Open the query in an editor"), () => send({ type: "openSql" })));

const findInput = el("input", { id: "find", type: "search", placeholder: tr("Find in results"), "aria-label": tr("Find in results") });
const findCount = el("span", { id: "find-count", role: "status", class: "muted" });
const findBox = el("label", { class: "field-icon" }); findBox.append(icon("search", 14), findInput);
const btnFilter = iconButton("filter", tr("Filter by column"), () => toggleFilters(), { pressed: false });
// The database filter (condition + order) stays folded until asked for, so the results get the room.
let filterAvail = false, whereOpen = false;
const syncFilterBar = () => { filterBar.hidden = !filterAvail || !(whereOpen || whereInput.value.trim() !== "" || orderInput.value.trim() !== ""); btnWhere.setAttribute("aria-pressed", String(!filterBar.hidden)); };
const btnWhere = iconButton("sortAsc", tr("Filter and order in the database"), () => { if (whereInput.value.trim() || orderInput.value.trim()) { whereInput.focus(); return; } whereOpen = !whereOpen; syncFilterBar(); if (!filterBar.hidden) whereInput.focus(); }, { pressed: false });
const btnColumns = iconButton("columns", tr("Show or hide columns"), () => columnsMenu(btnColumns));
const btnDetail = iconButton("panel", tr("Record panel (Alt+Enter)"), () => toggleDetail(), { pressed: false });
const btnDensity = iconButton("rows", tr("Compact rows"), () => setCompact(!document.body.classList.contains("compact")), { pressed: false });
const btnCopy = iconButton("copy", tr("Copy results as…"), () => formatMenu(btnCopy, "copy"));
const btnSave = iconButton("download", tr("Save results as…"), () => formatMenu(btnSave, "save"));
const btnPin = iconButton("pin", tr("Keep these results: the next query opens in a new tab"), () => { send({ type: "pin" }); btnPin.setAttribute("aria-pressed", "true"); btnPin.disabled = true; btnPin.setAttribute("data-tip", tr("Pinned: the next query opens in a new tab")); }, { pressed: false });
const btnRefresh = iconButton("refresh", tr("Run again"), () => send({ type: "refresh" }));
const btnKeys = iconButton("keyboard", tr("Keyboard shortcuts"), () => showShortcuts());
const tools = el("div", { id: "tools", class: "tb", role: "toolbar", "aria-label": tr("Result tools") });
tools.append(findBox, iconButton("up", tr("Previous match"), () => step(-1)), iconButton("down", tr("Next match"), () => step(1)), findCount, el("span", { class: "grow" }), btnWhere, btnFilter, btnColumns, btnDetail, btnDensity, btnCopy, btnSave, btnPin, btnRefresh, btnKeys);

const btnDelete = iconButton("trash", tr("Delete or restore selected rows"), () => deleteSelected(), { danger: true });
const btnUndo = iconButton("undo", tr("Undo"), () => send({ type: "undo" })), btnRedo = iconButton("redo", tr("Redo"), () => send({ type: "redo" }));
const btnReview = iconButton("code", tr("Review the SQL"), () => send({ type: "review" }));
const btnApply = iconButton("check", tr("Apply changes"), () => send({ type: "apply" }), { primary: true, text: tr("Apply") });
const btnDiscard = iconButton("x", tr("Discard changes"), () => send({ type: "discard" }));
const pendingEl = el("span", { id: "pending-count", role: "status", class: "muted" });
const editBar = el("div", { id: "toolbar", class: "tb", role: "toolbar", "aria-label": tr("Edit actions"), hidden: "" });
editBar.append(iconButton("pencil", tr("Edit the selected cell (Enter)"), () => beginEdit()), iconButton("plus", tr("Add row"), () => send({ type: "insertRow" })), btnDelete, btnUndo, btnRedo, el("span", { class: "grow" }), pendingEl, btnReview, btnDiscard, btnApply);

const errorBox = el("div", { id: "error", role: "alert", hidden: "" });
const grid = el("div", { id: "grid", role: "grid", tabindex: "0", "aria-label": tr("Query results") });
const head = el("div", { class: "head", role: "row", "aria-rowindex": "1" });
const filterRow = el("div", { class: "filters", hidden: "" });
const body = el("div", { role: "rowgroup", class: "rows" });
const spacer = el("div");
body.append(spacer);
grid.append(head, filterRow, body);
const detail = el("aside", { id: "detail", "aria-label": tr("Record"), hidden: "" });
const split = el("div", { class: "split" }); split.append(grid, detail);
const foot = el("div", { id: "foot", class: "tb foot" });
const live = el("div", { id: "live", class: "sr-only", "aria-live": "polite" });
const tabsBar = el("div", { class: "tabs", role: "tablist", "aria-label": tr("Table views"), hidden: "" });
const pane = el("div", { id: "pane", class: "pane", role: "tabpanel", tabindex: "-1", hidden: "" });
const TABS: { id: TabId; label: string; ic: "rows" | "columns" | "json" | "code" }[] = [
  { id: "data", label: tr("Data"), ic: "rows" }, { id: "properties", label: tr("Properties"), ic: "columns" },
  { id: "relations", label: tr("Relations"), ic: "json" }, { id: "ddl", label: "DDL", ic: "code" },
];
const tabBtns = TABS.map((x) => {
  const b = el("button", { type: "button", role: "tab", class: "tab", id: `tab-${x.id}`, "aria-selected": "false", tabindex: "-1" });
  b.append(icon(x.ic, 15), el("span", {}, x.label));
  b.addEventListener("click", () => setTab(x.id));
  b.addEventListener("keydown", (e) => {
    const i = TABS.findIndex((t) => t.id === x.id);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = TABS[(i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length]!; setTab(n.id); document.getElementById(`tab-${n.id}`)?.focus(); }
  });
  tabsBar.append(b); return b;
});
const filterBar = el("div", { class: "tb filterbar", hidden: "", role: "search", "aria-label": tr("Filter in the database") });
const whereInput = el("input", { type: "text", class: "fwhere", spellcheck: "false" });
const orderInput = el("input", { type: "text", class: "forder", spellcheck: "false" });
const applyFilter = () => send({ type: "filterTable", where: whereInput.value, order: orderInput.value });
const clearFilter = () => { whereInput.value = ""; orderInput.value = ""; applyFilter(); };
for (const i of [whereInput, orderInput]) i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyFilter(); } else if (e.key === "Escape") clearFilter(); });
const whereBox = el("label", { class: "field-icon grow" }); whereBox.append(icon("filter", 14), whereInput);
const orderBox = el("label", { class: "field-icon" }); orderBox.append(icon("sortAsc", 14), orderInput);
filterBar.append(whereBox, orderBox, iconButton("check", tr("Apply the filter in the database"), applyFilter, { primary: true }), iconButton("x", tr("Clear the filter"), clearFilter));
const FILTER_HINTS: Record<string, [string, string]> = {
  sql: [tr("Filter rows (SQL condition), e.g. age > 30"), tr("Order by, e.g. name DESC")],
  mongo: [tr('Filter (Mongo query), e.g. { "status": "A" }'), tr('Sort, e.g. { "total": -1 }')],
  es: [tr("Filter (search text), e.g. level:error"), tr("Sort, e.g. timestamp:desc")],
  cypher: [tr("Filter (condition on n), e.g. n.age > 30"), tr("Order by, e.g. n.name")],
};
function buildFilterBar(f?: { kind: string; where: string; order: string }) {
  filterAvail = !!f;
  if (!f) { syncFilterBar(); return; }
  const [w, o] = FILTER_HINTS[f.kind] ?? FILTER_HINTS["sql"]!;
  whereInput.placeholder = w; whereInput.setAttribute("aria-label", w); orderInput.placeholder = o; orderInput.setAttribute("aria-label", o);
  whereInput.value = f.where; orderInput.value = f.order;
  syncFilterBar();  // a filter that is active keeps the bar open
}
header.insertBefore(tabsBar, header.querySelector(".grow"));
// Search/tools and the edit buttons share one row (the edit side wraps under on narrow windows).
const actionRow = el("div", { class: "tbrow" }); actionRow.append(tools, editBar);
app.append(header, sqlBar, filterBar, actionRow, errorBox, split, pane, foot, live);
const dataParts = [sqlBar, filterBar, actionRow, errorBox, split, foot];

const announce = (s: string) => { live.textContent = s; };
let toastT = 0;
const toastEl = el("div", { class: "toast", role: "status", hidden: "" });
app.append(toastEl);
function toast(text: string) { toastEl.textContent = text; toastEl.hidden = false; clearTimeout(toastT); toastT = window.setTimeout(() => { toastEl.hidden = true; }, 2200); }

function showShortcuts() {
  const rows_: [string, string][] = [["← ↑ → ↓", tr("Move between cells")], ["Shift + ↑ ↓", tr("Extend the row selection")], ["Space", tr("Select or unselect the row")], ["Ctrl/⌘ + A", tr("Select all rows")], ["Enter · F2", tr("Edit the cell")], ["Delete", tr("Set NULL, or delete the selected rows")], ["Ctrl/⌘ + Z · Y", tr("Undo · Redo")], ["Ctrl/⌘ + C", tr("Copy the cell or the selected rows")], ["Ctrl/⌘ + F", tr("Find in results")], ["Alt + Enter", tr("Record panel")], ["Shift + F10", tr("Open the context menu")], ["Esc", tr("Clear the selection")]];
  const dlg = el("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "dlg-title" });
  const list = el("dl", { class: "keys" });
  for (const [k, d] of rows_) { list.append(el("dt", {}, k), el("dd", {}, d)); }
  const close = () => { dlg.remove(); back.remove(); btnKeys.focus(); };
  const head_ = el("div", { class: "tb flat" }); head_.append(el("strong", { id: "dlg-title" }, tr("Keyboard shortcuts")), el("span", { class: "grow" }), iconButton("x", tr("Close"), close));
  dlg.append(head_, list);
  const back = el("div", { class: "backdrop" }); back.addEventListener("click", close);
  dlg.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  app.append(back, dlg); dlg.querySelector("button")?.focus();
}

// Statistics and a distribution for one column, over the rows currently shown (filters and the find box apply).
function showStats(ci: number) {
  const c = columns[ci]!;
  const s = columnStats(Array.from({ length: vlen() }, (_, r) => raw(stor(r), ci).text), c.kind);
  const dlg = el("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "dlg-title" });
  const close = () => { dlg.remove(); back.remove(); };
  const head_ = el("div", { class: "tb flat" }); head_.append(el("strong", { id: "dlg-title" }, tr("Column statistics for {0}", c.name)), el("span", { class: "grow" }), iconButton("x", tr("Close"), close));
  const facts = el("dl", { class: "keys" });
  const fact = (k: string, v: string) => { facts.append(el("dt", {}, k), el("dd", {}, v)); };
  fact(tr("Values"), s.count.toLocaleString()); fact(tr("Nulls"), s.nulls.toLocaleString()); fact(tr("Distinct"), s.distinct.toLocaleString());
  if (s.min !== undefined) { fact(tr("Minimum"), s.min); fact(tr("Maximum"), s.max ?? ""); }
  if (s.numeric) { fact(tr("Average"), String(Number(s.numeric.avg.toPrecision(10)))); fact(tr("Sum"), String(Number(s.numeric.sum.toPrecision(12)))); }
  const bars = el("div", { class: "hbars", tabindex: "0", role: "group", "aria-label": tr("Distribution") });
  const binned = !!s.numeric && s.numeric.histogram.length > 1 && s.distinct > 10;
  const peak = Math.max(1, ...(binned ? s.numeric!.histogram.map((b) => b.count) : s.top.map((t) => t.count)));
  const bar = (label: string, count: number) => {
    const row = el("div", { class: "hbar" }), fill = el("span", { class: "hbar-fill", "aria-hidden": "true" });
    fill.style.width = `${Math.max(1, Math.round((count / peak) * 100))}%`;
    const track = el("span", { class: "hbar-track" }); track.append(fill);
    row.append(el("span", { class: "hbar-label", title: label }, label), track, el("span", { class: "hbar-n" }, count.toLocaleString()));
    bars.append(row);
  };
  const fmt = (n: number) => String(Number(n.toPrecision(6)));
  if (binned) for (const b of s.numeric!.histogram) bar(`${fmt(b.from)} – ${fmt(b.to)}`, b.count);
  else for (const t of s.top) bar(t.value === "" ? tr("(empty)") : t.value, t.count);
  dlg.append(head_, facts, el("h2", { class: "sub" }, binned ? tr("Distribution") : tr("Most frequent values")), bars, el("p", { class: "muted pad" }, tr("Computed over the {0} rows shown in the grid", s.count.toLocaleString())));
  const back = el("div", { class: "backdrop" }); back.addEventListener("click", close);
  dlg.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  app.append(back, dlg); dlg.querySelector("button")?.focus();
}

// ---- helpers ----
const vlen = () => (view ? view.length : rows.length);
const totalRows = () => vlen() + inserts.length;
const stor = (r: number) => (view ? (r < view.length ? view[r]! : rows.length + (r - view.length)) : r);
function raw(s: number, c: number): { text: Cell; unset: boolean; changed: boolean } {
  if (s >= rows.length) { const x = inserts[s - rows.length]?.[c]; return { text: x?.text ?? null, unset: !x?.set, changed: !!x?.set }; }
  const k = `${s}:${c}`;
  return sets.has(k) ? { text: sets.get(k)!, unset: false, changed: true } : { text: rows[s]![c]!, unset: false, changed: false };
}
const isNumeric = (c: Col) => c.kind === "integer" || c.kind === "float" || c.kind === "decimal";
const sig = () => columns.map((c) => c.name).join("\u0001");
const persist = () => { const cols = { ...(saved.cols ?? {}) }; if (columns.length) { cols[sig()] = { w: widths, hidden: [...hidden] }; const keys = Object.keys(cols); for (const k of keys.slice(0, Math.max(0, keys.length - 30))) delete cols[k]; } saved.cols = cols; api.setState(saved); };
const fmtNum = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

function setCompact(on: boolean) {
  document.body.classList.toggle("compact", on); ROW_H = on ? 22 : 28; saved.compact = on; api.setState(saved);
  btnDensity.setAttribute("aria-pressed", String(on)); renderBody();
}

// ---- layout ----
function layout() {
  vcols = columns.map((_, i) => i).filter((i) => !hidden.has(i));
  colX = []; let x = GUT;
  for (const i of vcols) { colX.push(x); x += widths[i]!; }
  totalW = x;
  for (const e of [head, filterRow]) e.style.width = `${totalW}px`;
  spacer.style.width = `${totalW}px`;
  grid.setAttribute("aria-colcount", String(vcols.length));
}

function renderHead() {
  const gut = el("div", { class: "gut hgut", role: "columnheader" });
  const all = iconButton("check", tr("Select all rows"), () => { selRows = new Set(Array.from({ length: totalRows() }, (_, r) => stor(r))); renderBody(); updateFooter(); });
  gut.append(all);
  const cells = vcols.map((ci, vi) => {
    const c = columns[ci]!;
    const d = el("div", { class: `cell hcell${isNumeric(c) ? " num" : ""}`, role: "columnheader", "aria-colindex": String(vi + 1) });
    d.style.width = `${widths[ci]}px`;
    const dir = sort?.col === ci ? sort.dir : 0;
    d.setAttribute("aria-sort", dir === 1 ? "ascending" : dir === -1 ? "descending" : "none");
    const label = el("button", { type: "button", class: "hlabel", "data-tip": tr("Sort by {0}", c.name) });
    label.setAttribute("aria-label", `${c.name} ${c.nativeType} — ${tr("Sort by {0}", c.name)}`);
    const flagsEl = el("span", { class: "hflags" });
    if (pkCols.has(c.name)) { const k = icon("key", 13); k.setAttribute("class", "pk"); flagsEl.append(k); flagsEl.title = tr("Primary key"); }
    const nameEl = el("span", { class: "hname" }, c.name);
    if (requiredCols.has(c.name) && !pkCols.has(c.name)) nameEl.prepend(el("span", { class: "req", "aria-hidden": "true" }, "* "));
    label.append(flagsEl, nameEl, " ", el("small", {}, c.nativeType));
    if (dir) label.append(icon(dir === 1 ? "sortAsc" : "sortDesc", 14));
    label.addEventListener("click", () => sortBy(ci));
    const more = iconButton("more", tr("Column options for {0}", c.name), () => headerMenu(ci, more));
    more.classList.add("hmore");
    const hf = iconButton("filter", tr("Filter {0}", c.name), () => { toggleFilters(true); filterRow.querySelector<HTMLInputElement>(`input[data-col="${ci}"]`)?.focus(); });
    hf.classList.add("hfilter"); if (filters[ci]) hf.classList.add("on");
    const rs = el("div", { class: "rs", "aria-hidden": "true" });
    rs.addEventListener("pointerdown", (e) => startResize(e, ci, rs));
    rs.addEventListener("dblclick", () => autosize(ci));
    d.addEventListener("contextmenu", (e) => { e.preventDefault(); headerMenu(ci, { x: e.clientX, y: e.clientY }); });
    d.append(label, hf, more, rs);
    return d;
  });
  head.replaceChildren(gut, ...cells);
}

function renderFilters() {
  filterRow.hidden = !filtersOn;
  const gut = el("div", { class: "gut" }); gut.append(icon("filter", 14));
  filterRow.replaceChildren(gut, ...vcols.map((ci) => {
    const d = el("div", { class: "cell fcell" }); d.style.width = `${widths[ci]}px`;
    const i = el("input", { type: "search", placeholder: tr("Filter"), "aria-label": tr("Filter {0}", columns[ci]!.name), "data-col": String(ci) });
    i.value = filters[ci] ?? "";
    let t = 0;
    i.addEventListener("input", () => { filters[ci] = i.value; clearTimeout(t); t = window.setTimeout(() => { rebuildView(); }, 120); });
    d.append(i); return d;
  }));
}
const headTop = () => HEAD_H + (filtersOn ? FILT_H : 0);

function toggleFilters(force?: boolean) {
  filtersOn = force ?? !filtersOn;
  btnFilter.setAttribute("aria-pressed", String(filtersOn));
  if (!filtersOn) { filters = columns.map(() => ""); rebuildView(); }
  renderFilters();
  if (filtersOn) filterRow.querySelector<HTMLInputElement>("input")?.focus();
}

// ---- view (filter + sort) ----
const COLLATOR = new Intl.Collator(undefined, { numeric: true });
function rebuildView() {
  const fs = filters.map((f, i) => [i, f.trim().toLowerCase()] as const).filter((x) => x[1]);
  if (!fs.length && !sort) view = undefined;
  else {
    let idx = rows.map((_, i) => i);
    if (fs.length) idx = idx.filter((i) => fs.every(([c, q]) => { const v = rows[i]![c]!; return (v === null ? "null" : v.toLowerCase()).includes(q); }));
    if (sort) {
      const { col, dir } = sort;
      // Parse each cell once, not once per comparison, and reuse one collator: sorting 100,000 text rows took seconds otherwise.
      const num = new Float64Array(rows.length).fill(NaN);
      for (const i of idx) { const v = rows[i]![col]; if (v !== null && v !== undefined && v.trim() !== "") { const n = Number(v); if (Number.isFinite(n)) num[i] = n; } }
      idx.sort((a, b) => {
        const x = rows[a]![col]!, y = rows[b]![col]!;
        if (x === null || y === null) return x === y ? a - b : x === null ? 1 : -1;
        const nx = num[a]!, ny = num[b]!;
        const d = !Number.isNaN(nx) && !Number.isNaN(ny) ? nx - ny : COLLATOR.compare(x, y);
        return d === 0 ? a - b : d * dir;
      });
    }
    view = idx;
  }
  sel.r = Math.min(sel.r, Math.max(0, totalRows() - 1));
  findAll(false); renderBody(); updateFooter();
  if (filtersOn || fs.length) announce(tr("{0} of {1} rows", vlen().toLocaleString(), rows.length.toLocaleString()));
}

function sortBy(col: number, dir?: 1 | -1) {
  sort = dir ? { col, dir } : sort?.col !== col ? { col, dir: 1 } : sort.dir === 1 ? { col, dir: -1 } : undefined;
  renderHead(); rebuildView();
  announce(sort ? `${columns[col]!.name}: ${sort.dir === 1 ? tr("ascending") : tr("descending")}` : tr("Sorting cleared"));
}

// ---- body ----
function renderBody() {
  const top = Math.max(0, grid.scrollTop - headTop()), h = grid.clientHeight;
  const n = totalRows();
  const first = Math.max(0, Math.floor(top / ROW_H) - OVERSCAN), last = Math.min(n, Math.ceil((top + h) / ROW_H) + OVERSCAN);
  spacer.style.height = `${n * ROW_H}px`;
  const frag = document.createDocumentFragment();
  for (let r = first; r < last; r++) {
    const s = stor(r), isNew = s >= rows.length;
    const row = el("div", { class: `row${deletes.has(s) ? " deleted" : ""}${isNew ? " inserted" : ""}${r % 2 ? " alt" : ""}${selRows.has(s) ? " rowsel" : ""}`, role: "row", "aria-rowindex": String(r + 2) });
    row.style.top = `${r * ROW_H}px`; row.style.height = `${ROW_H}px`; row.style.lineHeight = `${ROW_H}px`;
    if (deletes.has(s)) row.setAttribute("aria-description", tr("marked for deletion"));
    const g = el("div", { class: "gut", role: "rowheader", "data-r": String(r) }, isNew ? "＋" : String(r + 1));
    row.append(g);
    vcols.forEach((ci, vi) => {
      const { text: v, unset, changed } = raw(s, ci);
      const d = el("div", { class: `cell${v === null ? " null" : ""}${unset ? " null" : ""}${sel.r === r && sel.c === vi ? " sel" : ""}${changed ? " changed" : ""}${matchSet.has(`${r}:${vi}`) ? " match" : ""}${isNumeric(columns[ci]!) ? " num" : ""}`, role: "gridcell", "aria-colindex": String(vi + 1), "data-r": String(r), "data-c": String(vi) });
      d.style.width = `${widths[ci]}px`;
      const kind = columns[ci]!.kind;
      d.textContent = unset ? "DEFAULT" : v === null ? "NULL" : kind === "boolean" && /^(true|false|1|0|t|f)$/i.test(v) ? `${/^(true|1|t)$/i.test(v) ? "✓" : "✗"} ${v}` : v;
      if (v !== null && !unset) { if (kind === "json") d.classList.add("k-json"); else if (kind === "boolean") d.classList.add(/^(true|1|t)$/i.test(v) ? "k-yes" : "k-no"); else if (kind === "binary") d.classList.add("k-bin"); }
      if (changed) d.setAttribute("aria-description", tr("pending change"));
      if (v !== null && !unset && v.length > 40) d.title = v.length > 300 ? `${v.slice(0, 300)}…` : v;
      row.append(d);
    });
    frag.append(row);
  }
  body.replaceChildren(spacer, frag);
}

let raf = 0;
const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (!editing) renderBody(); }); };
grid.addEventListener("scroll", schedule);
window.addEventListener("resize", schedule);

function reveal() {
  const y = sel.r * ROW_H;
  if (y < grid.scrollTop) grid.scrollTop = y;
  else if (y + ROW_H + headTop() > grid.scrollTop + grid.clientHeight) grid.scrollTop = y + ROW_H + headTop() - grid.clientHeight;
  const x = colX[sel.c] ?? GUT, w = widths[vcols[sel.c] ?? 0] ?? 0;
  if (x - GUT < grid.scrollLeft) grid.scrollLeft = x - GUT;
  else if (x + w > grid.scrollLeft + grid.clientWidth) grid.scrollLeft = x + w - grid.clientWidth;
}

// ---- selection ----
let footRaf = 0;
function selectionChanged() {
  if (footRaf) return;
  footRaf = requestAnimationFrame(() => { footRaf = 0; updateFooter(); if (detailOpen) renderDetail(); });
}
function move(dr: number, dc: number, extend = false) {
  if (!totalRows() || !vcols.length) return;
  sel.r = Math.min(totalRows() - 1, Math.max(0, sel.r + dr));
  sel.c = Math.min(vcols.length - 1, Math.max(0, sel.c + dc));
  if (extend) { selRows = new Set(); for (let r = Math.min(anchor, sel.r); r <= Math.max(anchor, sel.r); r++) selRows.add(stor(r)); } else anchor = sel.r;
  reveal(); renderBody(); selectionChanged();
  const ci = vcols[sel.c]!, { text } = raw(stor(sel.r), ci);
  announce(tr("{0}, row {1}: {2}", columns[ci]!.name, sel.r + 1, text === null ? "NULL" : text));
}
function pickRow(r: number, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) {
  const s = stor(r);
  if (e.shiftKey) { selRows = new Set(); for (let i = Math.min(anchor, r); i <= Math.max(anchor, r); i++) selRows.add(stor(i)); }
  else if (e.ctrlKey || e.metaKey) { if (selRows.has(s)) selRows.delete(s); else selRows.add(s); anchor = r; }
  else { selRows = new Set([s]); anchor = r; }
  sel.r = r; renderBody(); selectionChanged();
}
const targetRows = (): number[] => (selRows.size ? [...selRows] : totalRows() ? [stor(sel.r)] : []);

function deleteSelected() {
  if (!editable) return;
  const rs = targetRows().filter((s) => s < rows.length);
  if (!rs.length) { announce(tr("Added rows are discarded with Undo")); return; }
  const allDeleted = rs.every((s) => deletes.has(s));
  send({ type: "setDeleted", rows: rs, deleted: !allDeleted });
}

// ---- columns ----
function startResize(e: PointerEvent, ci: number, handle: HTMLElement) {
  e.preventDefault(); e.stopPropagation();
  handle.setPointerCapture(e.pointerId);
  const x0 = e.clientX, w0 = widths[ci]!;
  const move_ = (ev: PointerEvent) => {
    widths[ci] = Math.max(MIN_W, Math.min(900, w0 + ev.clientX - x0)); layout();
    head.querySelectorAll<HTMLElement>(".hcell").forEach((h, i) => { h.style.width = `${widths[vcols[i]!]}px`; });
    filterRow.querySelectorAll<HTMLElement>(".fcell").forEach((h, i) => { h.style.width = `${widths[vcols[i]!]}px`; });
    schedule();
  };
  const up = () => { handle.removeEventListener("pointermove", move_); handle.removeEventListener("pointerup", up); persist(); };
  handle.addEventListener("pointermove", move_); handle.addEventListener("pointerup", up);
}
function relayout() { layout(); renderHead(); renderFilters(); findAll(false); renderBody(); persist(); }
function autosize(ci: number) {
  let max = columns[ci]!.name.length + 4;
  const n = Math.min(rows.length, 400);
  for (let i = 0; i < n; i++) { const v = rows[i]![ci]; if (v !== null && v !== undefined) max = Math.max(max, Math.min(v.length, 80)); }
  widths[ci] = Math.max(MIN_W, Math.min(600, max * 7.6 + 28)); relayout();
}
function hideColumn(ci: number) {
  if (vcols.length <= 1) { announce(tr("At least one column must stay visible")); return; }
  hidden.add(ci); sel.c = Math.min(sel.c, vcols.length - 2); relayout();
}
function columnsMenu(anchorEl: HTMLElement) {
  const items: MenuItem[] = columns.map((c, i) => ({ label: c.name, checked: !hidden.has(i), run: () => { if (hidden.has(i)) { hidden.delete(i); relayout(); } else hideColumn(i); } }));
  items.push({ separator: true, label: "" }, { label: tr("Show all columns"), icon: "columns", disabled: hidden.size === 0, run: () => { hidden = new Set(); relayout(); } });
  openMenu(anchorEl, items);
}
function headerMenu(ci: number, anchorEl: HTMLElement | { x: number; y: number }) {
  const c = columns[ci]!;
  const items: MenuItem[] = [
    { label: tr("Sort ascending"), icon: "sortAsc", run: () => sortBy(ci, 1) },
    { label: tr("Sort descending"), icon: "sortDesc", run: () => sortBy(ci, -1) },
    { label: tr("Clear sorting"), icon: "x", disabled: sort?.col !== ci, run: () => { sort = undefined; renderHead(); rebuildView(); } },
    { label: tr("Filter this column"), icon: "filter", run: () => { toggleFilters(true); filterRow.querySelector<HTMLInputElement>(`input[data-col="${ci}"]`)?.focus(); } },
    { label: tr("Fit width to content"), icon: "columns", run: () => autosize(ci) },
    { label: tr("Hide column"), icon: "eyeOff", run: () => hideColumn(ci) },
    { label: tr("Column statistics…"), icon: "rows", run: () => showStats(ci) },
    { label: tr("Copy column name"), icon: "copy", run: () => { send({ type: "copy", text: c.name }); toast(tr("Copied")); } },
    { label: tr("Copy column values"), icon: "copy", run: () => send({ type: "copy", text: Array.from({ length: vlen() }, (_, r) => rows[stor(r)]![ci] ?? "").join("\n") }) },
  ];
  if (table?.alter) items.push({ separator: true, label: "" },
    { label: tr("Rename column…"), icon: "pencil", run: () => send({ type: "columnAction", action: "rename", column: c.name }) },
    { label: tr("Change type…"), icon: "text", run: () => send({ type: "columnAction", action: "type", column: c.name }) },
    { label: tr("Toggle NOT NULL"), icon: "lock", run: () => send({ type: "columnAction", action: "nullable", column: c.name }) },
    { label: tr("Set default…"), icon: "pencil", run: () => send({ type: "columnAction", action: "default", column: c.name }) },
    { label: tr("Add column…"), icon: "plus", run: () => send({ type: "columnAction", action: "add", column: c.name }) },
    { label: tr("Drop column…"), icon: "trash", danger: true, run: () => send({ type: "columnAction", action: "drop", column: c.name }) });
  openMenu(anchorEl, items);
}
const rowObject = (s: number) => Object.fromEntries(columns.map((c, i) => [c.name, raw(s, i).text]));
function cellMenu(r: number, vi: number, at: { x: number; y: number }) {
  const s = stor(r), ci = vcols[vi]!, { text } = raw(s, ci);
  const items: MenuItem[] = [
    { label: tr("Copy cell"), icon: "copy", run: () => { send({ type: "copy", text: text ?? "" }); toast(tr("Copied")); } },
    { label: tr("Copy row as JSON"), icon: "json", run: () => send({ type: "copy", text: JSON.stringify(rowObject(s), null, 2) }) },
    { label: tr("Filter by this value"), icon: "filter", disabled: text === null, run: () => { toggleFilters(true); filters[ci] = text ?? ""; renderFilters(); rebuildView(); } },
    { label: tr("Open in record panel"), icon: "panel", run: () => { sel = { r, c: vi }; toggleDetail(true); } },
    { label: tr("Edit value…"), icon: "pencil", run: () => { sel = { r, c: vi }; beginEdit(); } },
  ];
  if (editable) items.push({ separator: true, label: "" },
    { label: tr("Set to NULL"), icon: "nullish", run: () => send({ type: "edit", row: s, col: ci, text: null }) },
    { label: tr("Set to empty text"), icon: "text", run: () => send({ type: "edit", row: s, col: ci, text: "" }) },
    { label: s < rows.length && deletes.has(s) ? tr("Restore row") : tr("Delete row"), icon: "trash", danger: true, disabled: s >= rows.length, run: () => send({ type: "toggleDelete", row: s }) });
  openMenu(at, items);
}

// ---- find ----
function findAll(jump: boolean) {
  const q = findQuery.trim().toLowerCase();
  matches = []; matchSet = new Set();
  if (q) for (let r = 0; r < vlen(); r++) vcols.forEach((ci, vi) => { const v = rows[stor(r)]![ci]; if (v !== null && v !== undefined && v.toLowerCase().includes(q)) { matches.push({ r, c: vi }); matchSet.add(`${r}:${vi}`); } });
  findCount.textContent = !q ? "" : matches.length ? tr("{0} matches", matches.length.toLocaleString()) : tr("No matches");
  if (jump && matches.length) goTo(matches.find((x) => x.r > sel.r || (x.r === sel.r && x.c >= sel.c)) ?? matches[0]!); else renderBody();
}
function goTo(m: { r: number; c: number }) { sel = { ...m }; anchor = m.r; reveal(); renderBody(); selectionChanged(); announce(tr("{0}, row {1}: {2}", columns[vcols[m.c]!]!.name, m.r + 1, raw(stor(m.r), vcols[m.c]!).text ?? "NULL")); }
function step(dir: 1 | -1) {
  if (!matches.length) return;
  const i = matches.findIndex((x) => x.r === sel.r && x.c === sel.c);
  goTo(matches[i < 0 ? (dir === 1 ? 0 : matches.length - 1) : (i + dir + matches.length) % matches.length]!);
}
let findTimer = 0;
// Searching 100,000 rows takes a noticeable moment: wait for a pause in typing on big results.
findInput.addEventListener("input", () => { findQuery = findInput.value; clearTimeout(findTimer); if (rows.length > 20000) findTimer = window.setTimeout(() => findAll(true), 150); else findAll(true); });
findInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
  else if (e.key === "Escape") { findInput.value = ""; findQuery = ""; findAll(false); grid.focus(); }
});
window.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") { e.preventDefault(); findInput.focus(); findInput.select(); } });

// ---- copy / save ----
const csvCell = (v: string | null) => (v === null ? "" : /[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
function tableText(fmt: string): { text: string; count: number } {
  const idx = selRows.size ? [...selRows].sort((a, b) => a - b) : Array.from({ length: vlen() }, (_, r) => stor(r));
  const names = vcols.map((i) => columns[i]!.name);
  const data = idx.map((s) => vcols.map((ci) => raw(s, ci).text));
  let text: string;
  if (fmt === "json") text = JSON.stringify(data.map((r) => Object.fromEntries(names.map((n, i) => [n, r[i]]))), null, 2);
  else if (fmt === "tsv") text = [names, ...data].map((r) => r.map((v) => (v ?? "").replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");
  else if (fmt === "md") { const e = (v: string | null) => (v ?? "NULL").replace(/\|/g, "\\|").replace(/\r?\n/g, " "); text = [`| ${names.map(e).join(" | ")} |`, `| ${names.map(() => "---").join(" | ")} |`, ...data.map((r) => `| ${r.map(e).join(" | ")} |`)].join("\n"); }
  else text = [names, ...data].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return { text, count: idx.length };
}
function formatMenu(anchorEl: HTMLElement, kind: "copy" | "save") {
  if (!columns.length) return;
  const go = (fmt: "csv" | "tsv" | "json" | "md") => {
    const { text, count } = tableText(fmt);
    if (text.length > 5_000_000) { announce(tr("Too large to copy; use RizomaDB: Export instead.")); statusEl.textContent = tr("Too large to copy; use RizomaDB: Export instead."); return; }
    send(kind === "copy" ? { type: "copy", text } : { type: "save", text, format: fmt });
    announce(kind === "copy" ? tr("Copied {0} rows", count.toLocaleString()) : tr("Saving…")); toast(kind === "copy" ? tr("Copied {0} rows", count.toLocaleString()) : tr("Saving…"));
  };
  openMenu(anchorEl, [{ label: "CSV", icon: "rows", run: () => go("csv") }, { label: "TSV", icon: "rows", run: () => go("tsv") }, { label: "JSON", icon: "json", run: () => go("json") }, { label: "Markdown", icon: "text", run: () => go("md") }]);
}

// ---- footer ----
function updateFooter() {
  foot.replaceChildren();
  const add = (t: string, cls = "chip") => foot.append(el("span", { class: cls }, t));
  if (!columns.length) return;
  add(rows.length === vlen() ? tr("{0} rows", rows.length.toLocaleString()) : tr("{0} of {1} rows", vlen().toLocaleString(), rows.length.toLocaleString()));
  if (run.state === "done") add(tr("{0} ms", run.ms));
  if (more) {
    const busy = run.state === "running";
    const next = iconButton("down", tr("Load the next {0} rows", nextPage.toLocaleString()), () => send({ type: "loadMore", mode: "page" }), { text: tr("Load {0} more", nextPage.toLocaleString()), primary: true });
    const all = iconButton("rows", tr("Load every remaining row, up to the row limit"), () => send({ type: "loadMore", mode: "all" }), { text: tr("Load all") });
    next.disabled = busy; all.disabled = busy; foot.append(next, all);
  } else if (capped) foot.append(el("span", { class: "chip warn" }, tr("Row limit reached ({0} rows): refine the query or export the data", rows.length.toLocaleString())));
  if (selRows.size) add(tr("{0} selected", selRows.size.toLocaleString()));
  const ci = vcols[sel.c]; if (ci === undefined || !vlen()) return;
  let nulls = 0, nums = 0, sum = 0, min = Infinity, max = -Infinity, nonNum = false; const distinct = new Set<string>();
  const n = Math.min(vlen(), MAX_ROWS_STATS);
  for (let r = 0; r < n; r++) {
    const v = rows[stor(r)]![ci];
    if (v === null || v === undefined) { nulls++; continue; }
    if (distinct.size < 100_000) distinct.add(v);
    if (!nonNum) { const x = Number(v); if (v.trim() !== "" && Number.isFinite(x)) { nums++; sum += x; if (x < min) min = x; if (x > max) max = x; } else nonNum = true; }
  }
  foot.append(el("span", { class: "grow" }));
  add(columns[ci]!.name, "chip strong");
  add(tr("{0} NULL", nulls.toLocaleString())); add(tr("{0} distinct", distinct.size.toLocaleString()));
  if (!nonNum && nums) { add(tr("min {0}", fmtNum(min))); add(tr("max {0}", fmtNum(max))); add(`Σ ${fmtNum(sum)}`); add(tr("avg {0}", fmtNum(sum / nums))); }
}

// ---- record panel ----
function toggleDetail(force?: boolean) {
  detailOpen = force ?? !detailOpen;
  btnDetail.setAttribute("aria-pressed", String(detailOpen));
  detail.hidden = !detailOpen; split.classList.toggle("with-detail", detailOpen);
  if (detailOpen) renderDetail();
  schedule();
}
function renderDetail() {
  if (!detailOpen) return;
  detail.replaceChildren();
  if (!totalRows()) { detail.append(el("p", { class: "muted pad" }, tr("No record selected"))); return; }
  const s = stor(sel.r);
  const bar = el("div", { class: "tb" });
  bar.append(el("strong", {}, tr("Record {0}", sel.r + 1)), el("span", { class: "grow" }),
    iconButton("up", tr("Previous record"), () => move(-1, 0)), iconButton("down", tr("Next record"), () => move(1, 0)),
    iconButton("json", tr("Copy record as JSON"), () => send({ type: "copy", text: JSON.stringify(rowObject(s), null, 2) })),
    iconButton("x", tr("Close record panel"), () => { toggleDetail(false); grid.focus(); }));
  const list = el("div", { class: "fields" });
  columns.forEach((c, ci) => {
    const { text, unset, changed } = raw(s, ci);
    const wrap = el("div", { class: `fld${changed ? " changed" : ""}` });
    const id = `fld-${ci}`;
    const lab = el("label", { for: id }, c.name); lab.append(el("small", {}, c.nativeType));
    const ta = el("textarea", { id, rows: "1", spellcheck: "false" });
    ta.value = unset ? "" : text ?? ""; if (text === null || unset) ta.placeholder = unset ? "DEFAULT" : "NULL";
    ta.readOnly = !editable;
    const fit = () => { ta.style.height = "auto"; ta.style.height = `${Math.min(220, ta.scrollHeight)}px`; };
    ta.addEventListener("input", fit); queueMicrotask(fit);
    ta.addEventListener("change", () => send({ type: "edit", row: s, col: ci, text: ta.value }));
    const tl = el("div", { class: "fld-tools" });
    if (ta.value && /^\s*[[{]/.test(ta.value)) tl.append(iconButton("json", tr("Format as JSON"), () => { try { ta.value = JSON.stringify(JSON.parse(ta.value), null, 2); fit(); if (editable) ta.dispatchEvent(new Event("change")); } catch { announce(tr("Not valid JSON")); } }));
    tl.append(iconButton("copy", tr("Copy value"), () => send({ type: "copy", text: text ?? "" })));
    if (editable) tl.append(iconButton("nullish", tr("Set to NULL"), () => send({ type: "edit", row: s, col: ci, text: null })));
    wrap.append(lab, ta, tl); list.append(wrap);
  });
  detail.append(bar, list);
}

// ---- editing ----
const READ_ONLY_WHY = () => tr("This result cannot be edited: open a table that has a primary key (not a view, a custom query or a read-only connection).");
function beginEdit() {
  if (!editable) { toast(READ_ONLY_WHY()); announce(READ_ONLY_WHY()); return; }
  if (!vcols.length) return;
  editing = { ...sel };
  renderBody();
  const target = body.querySelector<HTMLElement>(`.cell[data-r="${sel.r}"][data-c="${sel.c}"]`);
  if (!target) { editing = undefined; return; }
  const s = stor(sel.r), ci = vcols[sel.c]!, { text } = raw(s, ci);
  const input = el("input", { class: "editor", "aria-label": tr("Edit {0}, row {1}", columns[ci]!.name, sel.r + 1) });
  input.value = text ?? "";
  target.replaceChildren(input); input.focus(); input.select();
  const finish = (commit: boolean) => {
    if (!editing) return; editing = undefined;
    if (commit && input.value !== (text ?? "")) send({ type: "edit", row: s, col: ci, text: input.value });
    renderBody(); grid.focus();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); } else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    e.stopPropagation();
  });
  input.addEventListener("blur", () => finish(true));
}

// A double click is detected on the second click (detail 2): the first click re-renders the rows, so a native dblclick would land on a node that is already gone.
grid.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const g = t.closest<HTMLElement>(".gut[data-r]");
  if (g) { pickRow(Number(g.dataset.r), e); return; }
  const c = t.closest<HTMLElement>(".cell[data-r]");
  if (c && !editing) {
    sel = { r: Number(c.dataset.r), c: Number(c.dataset.c) };
    if (!(e.ctrlKey || e.metaKey || e.shiftKey)) { selRows = new Set(); anchor = sel.r; }
    renderBody(); selectionChanged();
    if (e.detail >= 2 && !(e.ctrlKey || e.metaKey || e.shiftKey)) beginEdit();
  }
});
grid.addEventListener("contextmenu", (e) => {
  const c = (e.target as HTMLElement).closest<HTMLElement>(".cell[data-r]");
  if (!c) return; e.preventDefault();
  sel = { r: Number(c.dataset.r), c: Number(c.dataset.c) }; renderBody(); selectionChanged();
  cellMenu(sel.r, sel.c, { x: e.clientX, y: e.clientY });
});
grid.addEventListener("keydown", (e) => {
  if (editing) return;
  const page = Math.max(1, Math.floor(grid.clientHeight / ROW_H) - 2), k = e.key, mod = e.ctrlKey || e.metaKey;
  if (k === "ArrowDown") move(1, 0, e.shiftKey); else if (k === "ArrowUp") move(-1, 0, e.shiftKey);
  else if (k === "ArrowRight") move(0, 1); else if (k === "ArrowLeft") move(0, -1);
  else if (k === "PageDown") move(page, 0, e.shiftKey); else if (k === "PageUp") move(-page, 0, e.shiftKey);
  else if (k === "Home") move(mod ? -totalRows() : 0, -vcols.length); else if (k === "End") move(mod ? totalRows() : 0, vcols.length);
  else if (k === "Enter" && e.altKey) toggleDetail();
  else if (k === "Enter" || k === "F2") beginEdit();
  else if (k === " ") pickRow(sel.r, { shiftKey: false, ctrlKey: true, metaKey: false });
  else if (editable && k === "Delete") { if (selRows.size) deleteSelected(); else send({ type: "edit", row: stor(sel.r), col: vcols[sel.c]!, text: null }); }
  else if (mod && k.toLowerCase() === "a") { selRows = new Set(Array.from({ length: totalRows() }, (_, r) => stor(r))); renderBody(); selectionChanged(); announce(tr("{0} selected", selRows.size.toLocaleString())); }
  else if (editable && mod && k.toLowerCase() === "z") send({ type: e.shiftKey ? "redo" : "undo" });
  else if (editable && mod && k.toLowerCase() === "y") send({ type: "redo" });
  else if (mod && k.toLowerCase() === "c") {
    if (selRows.size) send({ type: "copy", text: tableText("tsv").text }); else send({ type: "copy", text: raw(stor(sel.r), vcols[sel.c]!).text ?? "" });
  } else if (k === "Escape" && selRows.size) { selRows = new Set(); renderBody(); selectionChanged(); }
  else if (k === "F10" && e.shiftKey) { const r = grid.querySelector(".sel")?.getBoundingClientRect(); cellMenu(sel.r, sel.c, { x: r?.left ?? 0, y: r?.bottom ?? 0 }); }
  else return;
  e.preventDefault();
});

// Paste from a spreadsheet: tab-separated cells land from the selected cell down and to the right; a single value fills the selected rows. Empty cells become NULL.
const MAX_PASTE = 5000;
grid.addEventListener("paste", (e) => {
  if (!editable || editing) return;
  const text = e.clipboardData?.getData("text/plain") ?? "";
  if (!text) return;
  e.preventDefault();
  const data = parsePasted(text);
  const cells: { row: number; col: number; text: string | null }[] = [];
  const value = (v: string | undefined) => (v === undefined || v === "" ? null : v);
  if (data.length === 1 && data[0]!.length === 1 && selRows.size) for (const r of selRows) cells.push({ row: r, col: vcols[sel.c]!, text: value(data[0]![0]) });
  else data.forEach((line, i) => line.forEach((v, j) => { const vr = sel.r + i, vc = sel.c + j; if (vr < totalRows() && vc < vcols.length) cells.push({ row: stor(vr), col: vcols[vc]!, text: value(v) }); }));
  if (!cells.length) return;
  if (cells.length > MAX_PASTE) { toast(tr("Too many cells to paste at once (limit {0})", MAX_PASTE.toLocaleString())); return; }
  send({ type: "editMany", cells });
  announce(tr("Pasted {0} cells", cells.length.toLocaleString())); toast(tr("Pasted {0} cells", cells.length.toLocaleString()));
});

// ---- toolbar state ----
function setToolbar(count: number, canUndo: boolean, canRedo: boolean) {
  editBar.hidden = !editable;
  btnUndo.disabled = !canUndo; btnRedo.disabled = !canRedo;
  for (const b of [btnReview, btnApply, btnDiscard]) b.disabled = count === 0;
  pendingEl.textContent = count ? tr("{0} pending change(s)", count) : tr("No pending changes");
  pendingEl.classList.toggle("sr-only", count === 0);  // announced to screen readers, but takes no room when there is nothing to say
}

// ---- table tabs ----
function setTab(t: TabId) {
  tab = t;
  tabBtns.forEach((b, i) => { const on = TABS[i]!.id === t; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  for (const e of dataParts) e.classList.toggle("tab-off", t !== "data");
  pane.hidden = t === "data";
  if (t !== "data") { pane.setAttribute("aria-labelledby", `tab-${t}`); if (!props) { pane.replaceChildren(el("p", { class: "muted pad" }, tr("Loading…"))); send({ type: "loadProperties" }); } else renderPane(); }
  else renderBody();
}
function dtable(caption: string, heads: string[], body: (string | Node)[][]) {
  const t = el("table", { class: "dt" }); t.append(el("caption", {}, caption));
  const h = el("tr"); for (const x of heads) { const th = el("th", { scope: "col" }); if (x) th.textContent = x; else th.append(el("span", { class: "sr-only" }, tr("Actions"))); h.append(th); } const th = el("thead"); th.append(h); t.append(th);
  const tb = el("tbody"); for (const r of body) { const tr_ = el("tr"); for (const c of r) { const td = el("td"); td.append(c); tr_.append(td); } tb.append(tr_); } t.append(tb);
  return t;
}
const chipNode = (s: string, cls = "") => el("span", { class: `chip ${cls}` }, s);
function renderPane() {
  pane.replaceChildren();
  if (!props) return;
  if (!props.ok) { pane.append(el("p", { class: "pad err" }, tr("Error: {0}", props.error ?? ""))); return; }
  const wrap = el("div", { class: "pane-in" });
  if (tab === "properties") {
    wrap.append(dtable(tr("Columns"), ["#", tr("Name"), tr("Type"), tr("Nullable"), tr("Default"), tr("Key")],
      props.columns.map((c, i) => [String(i + 1), c.name, c.type, c.nullable ? tr("Yes") : chipNode("NOT NULL", "strong"), c.default ?? "", c.pk ? chipNode(tr("Primary key"), "strong") : ""])));
    wrap.append(dtable(tr("Indexes"), [tr("Name"), tr("Columns"), tr("Unique"), tr("Primary key")],
      props.indexes.map((x) => [x.name, x.columns.join(", "), x.unique ? tr("Yes") : "", x.primary ? tr("Yes") : ""])));
    if (!props.indexes.length) wrap.append(el("p", { class: "muted" }, tr("No indexes")));
  } else if (tab === "relations") {
    const open = (name: string, schema?: string) => iconButton("external", tr("Open {0}", name), () => send({ type: "openRelated", name, ...(schema ? { schema } : {}) }));
    wrap.append(dtable(tr("References (this table → others)"), [tr("Constraint"), tr("Columns"), tr("Table"), tr("Referenced columns"), ""],
      props.foreignKeys.map((f) => [f.name, f.columns.join(", "), f.refTable, f.refColumns.join(", "), open(f.refTable, f.refSchema)])));
    wrap.append(dtable(tr("Referenced by (others → this table)"), [tr("Constraint"), tr("Table"), tr("Columns"), tr("Referenced columns"), ""],
      props.referencedBy.map((f) => [f.name, f.table, f.columns.join(", "), f.refColumns.join(", "), open(f.table, f.schema)])));
    if (!props.foreignKeys.length && !props.referencedBy.length) wrap.append(el("p", { class: "muted" }, tr("This table has no foreign keys in either direction")));
    wrap.append(iconButton("json", tr("Open the ER diagram"), () => send({ type: "showEr" }), { text: tr("Open the ER diagram"), primary: true }));
  } else {
    const bar = el("div", { class: "tb flat" });
    bar.append(el("span", { class: "grow" }), iconButton("copy", tr("Copy DDL"), () => send({ type: "copy", text: props!.ddl })), iconButton("external", tr("Open DDL in an editor"), () => send({ type: "openText", text: props!.ddl })));
    wrap.append(props.ddl ? bar : el("p", { class: "muted" }, tr("DDL is not available for this engine")));
    if (props.ddl) wrap.append(el("pre", { class: "ddl", tabindex: "0", "aria-label": tr("Generated DDL") }, props.ddl));
  }
  pane.append(wrap);
}

// ---- host messages ----
function resetView() {
  sort = undefined; view = undefined; sel = { r: 0, c: 0 }; selRows = new Set(); anchor = 0; matches = []; matchSet = new Set(); editing = undefined;
  filters = columns.map(() => ""); filtersOn = false; btnFilter.setAttribute("aria-pressed", "false");
  const s = saved.cols?.[sig()];
  widths = columns.map((c, i) => (s?.w[i] && s.w.length === columns.length ? s.w[i]! : Math.max(140, Math.min(340, c.name.length * 9 + c.nativeType.length * 6 + 104))));
  hidden = new Set(s && s.w.length === columns.length ? s.hidden.filter((i) => i < columns.length) : []);
  if (hidden.size >= columns.length) hidden = new Set();
}

/** Status of the last run, kept as data so the header and the footer can always be redrawn from it. */
let run: { state: "idle" | "running" | "done" | "error"; rows: number; ms: number; truncated: boolean; affected?: number } = { state: "idle", rows: 0, ms: 0, truncated: false };
/** More pages exist on the server; `capped` means the row limit was reached; `nextPage` is how many rows one click loads. */
let more = false, capped = false, nextPage = 0;
function runText(): string {
  if (run.state === "running") return run.rows ? tr("{0} rows…", run.rows.toLocaleString()) : tr("Running…");
  if (run.state === "error") return tr("Failed");
  if (run.state === "idle") return tr("No results yet");
  const parts = [run.affected !== undefined ? tr("{0} rows affected", run.affected) : tr("{0} rows", run.rows.toLocaleString()), tr("{0} ms", run.ms)];
  if (more) parts.push(tr("more rows available"));
  if (capped) parts.push(tr("row limit reached (rizomadb.query.maxRows)"));
  return parts.join(" · ");
}
function renderStatus() { statusEl.textContent = runText(); cancelBtn.hidden = run.state !== "running"; updateFooter(); }

const kindLabel = (k: string): string => ({ syntax: tr("Syntax error"), connection: tr("Connection error"), authentication: tr("Authentication error"), permission: tr("Permission denied"), constraint: tr("Constraint violation"), timeout: tr("Timeout"), cancelled: tr("Cancelled"), blocked: tr("Blocked") } as Record<string, string>)[k] ?? k;

function onMessage(m: HostToWebview) {
  if (m.type === "start" && m.append) {
    // The next page of the same result: keep columns, rows, sorting, filters and selection.
    run = { ...run, state: "running" }; errorBox.hidden = true; more = false; renderStatus();
  } else if (m.type === "start") {
    more = false; capped = false; nextPage = 0;
    columns = m.columns; rows = []; editable = !!m.editable; table = m.table ? { name: m.table.name, schema: m.table.schema, alter: m.table.alter } : undefined;
    sets = new Map(); deletes = new Set(); inserts = [];
    run = { state: "running", rows: 0, ms: 0, truncated: false };
    pkCols = new Set(m.flags?.pk ?? []); requiredCols = new Set(m.flags?.required ?? []);
    errorBox.hidden = true; errorBox.textContent = "";
    titleEl.textContent = m.title;
    connBox.replaceChildren();
    if (m.connection) {
      const c = m.connection;
      connBox.append(engineLogo({ key: c.key, color: c.color, fg: c.fg, mark: c.mark, logo: c.logo }, 22), el("strong", {}, c.name), el("span", { class: `chip env-${c.environment}` }, c.environment.toUpperCase()), el("span", { class: "sep", "aria-hidden": "true" }, "›"));
      connBox.hidden = false;
    } else connBox.hidden = true;
    currentSql = m.sql; sqlInput.value = m.sql; sqlBar.hidden = !m.sql.trim(); growSql();
    buildFilterBar(m.table?.filter);
    statusEl.textContent = runText(); cancelBtn.hidden = false;
    props = undefined; tabsBar.hidden = !table;
    resetView(); layout();
    setTab("data"); renderHead(); renderFilters();
    grid.setAttribute("aria-rowcount", "1");
    setToolbar(0, false, false); renderBody(); renderStatus(); if (detailOpen) renderDetail();
  } else if (m.type === "rows") {
    for (const r of m.rows) rows.push(r);
    run.rows = rows.length;
    grid.setAttribute("aria-rowcount", String(rows.length + 1));
    statusEl.textContent = runText();
    if (!sort && !filters.some((f) => f.trim())) view = undefined;
    schedule();
  } else if (m.type === "done") {
    more = !!m.more; capped = !!m.capped; nextPage = m.next ?? 0;
    run = { state: "done", rows: m.affectedRows !== undefined ? m.rowCount : Math.max(m.rowCount, rows.length), ms: Math.round(m.durationMs), truncated: m.truncated, ...(m.affectedRows !== undefined ? { affected: m.affectedRows } : {}) };
    renderStatus(); announce(statusEl.textContent ?? "");
    if (!columns.length) { layout(); renderHead(); renderBody(); }
    if (sort || filters.some((f) => f.trim())) rebuildView(); else { findAll(false); renderBody(); updateFooter(); }
    setToolbar(0, false, false);
  } else if (m.type === "error") {
    run = { ...run, state: "error" }; errorBox.hidden = false; errorBox.textContent = `${kindLabel(m.kind)}: ${m.message}`;
    renderStatus(); announce(tr("Error: {0}", m.message));
  } else if (m.type === "pending") {
    sets = new Map(m.sets.map((s) => [`${s.row}:${s.col}`, s.text]));
    deletes = new Set(m.deletes); inserts = m.inserts;
    grid.setAttribute("aria-rowcount", String(totalRows() + 1));
    setToolbar(m.count, m.canUndo, m.canRedo);
    announce(m.count ? tr("{0} pending change(s)", m.count) : tr("No pending changes"));
    renderBody(); if (detailOpen) renderDetail();
  } else if (m.type === "properties") {
    props = m; if (tab !== "data") renderPane();
  } else if (m.type === "notice") {
    errorBox.hidden = m.text === ""; errorBox.textContent = m.text;
    errorBox.setAttribute("role", m.level === "error" ? "alert" : "status");
    if (m.text) announce(m.text);
  }
}

window.addEventListener("message", (ev) => {
  const parsed = HostToWebview.safeParse(ev.data);
  if (!parsed.success) return;
  // A bug in one handler must not swallow the status line or the following messages.
  try { onMessage(parsed.data); } catch (e) { errorBox.hidden = false; errorBox.textContent = `UI: ${(e as Error).message}`; renderStatus(); }
});

setCompact(!!saved.compact);
layout(); renderHead(); renderFilters(); renderBody();
