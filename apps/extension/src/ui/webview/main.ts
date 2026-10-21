import { HostToWebview } from "../../messages.js";

declare function acquireVsCodeApi(): { postMessage(m: unknown): void };
const vscode = acquireVsCodeApi();
const send = (m: Record<string, unknown>) => vscode.postMessage({ v: 1, ...m });

const ROW_H = 24, COL_W = 180, OVERSCAN = 8;
type Cell = string | null;
let columns: { name: string; nativeType: string }[] = [];
let rows: Cell[][] = [];
let editable = false;
let sets = new Map<string, Cell>();
let deletes = new Set<number>();
let inserts: { set: boolean; text: Cell }[][] = [];
let sel = { r: 0, c: 0 };
let editing: { r: number; c: number } | undefined;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const grid = $("grid"), status = $("status"), errorBox = $("error"), live = $("live"), toolbar = $("toolbar");
const spacer = document.createElement("div");
const head = document.createElement("div");
head.className = "head"; head.setAttribute("role", "row"); head.setAttribute("aria-rowindex", "1");
const body = document.createElement("div");
body.setAttribute("role", "rowgroup");
body.style.position = "relative";
grid.append(head, body);
body.append(spacer);

const announce = (s: string) => { live.textContent = s; };
const totalRows = () => rows.length + inserts.length;

function cellText(r: number, c: number): { text: Cell; unset: boolean } {
  if (r >= rows.length) { const x = inserts[r - rows.length]?.[c]; return { text: x?.text ?? null, unset: !x?.set }; }
  const k = `${r}:${c}`;
  return { text: sets.has(k) ? sets.get(k)! : rows[r]![c]!, unset: false };
}

function renderHead() {
  head.replaceChildren(...columns.map((c, i) => {
    const d = document.createElement("div");
    d.className = "cell"; d.setAttribute("role", "columnheader"); d.setAttribute("aria-colindex", String(i + 1));
    d.textContent = c.name;
    const s = document.createElement("small"); s.textContent = c.nativeType; d.append(s);
    return d;
  }));
  head.style.width = `${columns.length * COL_W}px`;
}

function renderBody() {
  const top = grid.scrollTop, h = grid.clientHeight;
  const n = totalRows();
  const first = Math.max(0, Math.floor(top / ROW_H) - OVERSCAN);
  const last = Math.min(n, Math.ceil((top + h) / ROW_H) + OVERSCAN);
  spacer.style.height = `${n * ROW_H}px`;
  spacer.style.width = `${columns.length * COL_W}px`;
  const frag = document.createDocumentFragment();
  for (let r = first; r < last; r++) {
    const row = document.createElement("div");
    const isNew = r >= rows.length;
    row.className = "row" + (deletes.has(r) ? " deleted" : "") + (isNew ? " inserted" : "");
    row.style.top = `${r * ROW_H}px`;
    row.setAttribute("role", "row"); row.setAttribute("aria-rowindex", String(r + 2));
    if (deletes.has(r)) row.setAttribute("aria-description", "marked for deletion");
    for (let c = 0; c < columns.length; c++) {
      const { text: v, unset } = cellText(r, c);
      const d = document.createElement("div");
      const changed = sets.has(`${r}:${c}`);
      d.className = "cell" + (v === null ? " null" : "") + (sel.r === r && sel.c === c ? " sel" : "") + (changed ? " changed" : "");
      d.setAttribute("role", "gridcell"); d.setAttribute("aria-colindex", String(c + 1));
      d.dataset.r = String(r); d.dataset.c = String(c);
      d.textContent = unset ? "DEFAULT" : v === null ? "NULL" : v;
      if (unset) d.classList.add("null");
      if (changed) d.setAttribute("aria-description", "pending change");
      if (v !== null && !unset) d.title = v.length > 200 ? v.slice(0, 200) + "…" : v;
      row.append(d);
    }
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
  else if (y + ROW_H + 26 > grid.scrollTop + grid.clientHeight) grid.scrollTop = y + ROW_H + 26 - grid.clientHeight;
  const x = sel.c * COL_W;
  if (x < grid.scrollLeft) grid.scrollLeft = x;
  else if (x + COL_W > grid.scrollLeft + grid.clientWidth) grid.scrollLeft = x + COL_W - grid.clientWidth;
}

function move(dr: number, dc: number) {
  if (!totalRows()) return;
  sel.r = Math.min(totalRows() - 1, Math.max(0, sel.r + dr));
  sel.c = Math.min(columns.length - 1, Math.max(0, sel.c + dc));
  reveal(); renderBody();
  const { text } = cellText(sel.r, sel.c);
  announce(`${columns[sel.c]!.name}, row ${sel.r + 1}: ${text === null ? "NULL" : text}`);
}

function beginEdit() {
  if (!editable) return;
  editing = { ...sel };
  renderBody();
  const target = body.querySelector<HTMLElement>(`.cell[data-r="${sel.r}"][data-c="${sel.c}"]`);
  if (!target) { editing = undefined; return; }
  const { text } = cellText(sel.r, sel.c);
  const input = document.createElement("input");
  input.value = text ?? ""; input.setAttribute("aria-label", `Edit ${columns[sel.c]!.name}, row ${sel.r + 1}`);
  input.className = "editor";
  target.replaceChildren(input);
  input.focus(); input.select();
  const finish = (commit: boolean) => {
    if (!editing) return;
    const { r, c } = editing; editing = undefined;
    if (commit && input.value !== (text ?? "")) send({ type: "edit", row: r, col: c, text: input.value });
    renderBody(); grid.focus();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); } else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    e.stopPropagation();
  });
  input.addEventListener("blur", () => finish(true));
}

grid.addEventListener("dblclick", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>(".cell[data-r]");
  if (t) { sel = { r: Number(t.dataset.r), c: Number(t.dataset.c) }; beginEdit(); }
});
grid.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>(".cell[data-r]");
  if (t && !editing) { sel = { r: Number(t.dataset.r), c: Number(t.dataset.c) }; renderBody(); }
});

grid.addEventListener("keydown", (e) => {
  if (editing) return;
  const page = Math.max(1, Math.floor(grid.clientHeight / ROW_H) - 1);
  const k = e.key;
  if (k === "ArrowDown") move(1, 0); else if (k === "ArrowUp") move(-1, 0);
  else if (k === "ArrowRight") move(0, 1); else if (k === "ArrowLeft") move(0, -1);
  else if (k === "PageDown") move(page, 0); else if (k === "PageUp") move(-page, 0);
  else if (k === "Home") move(0, -columns.length); else if (k === "End") move(0, columns.length);
  else if (editable && (k === "Enter" || k === "F2")) beginEdit();
  else if (editable && k === "Delete") send({ type: "edit", row: sel.r, col: sel.c, text: null });
  else if (editable && (e.ctrlKey || e.metaKey) && k.toLowerCase() === "z") send({ type: e.shiftKey ? "redo" : "undo" });
  else if (editable && (e.ctrlKey || e.metaKey) && k.toLowerCase() === "y") send({ type: "redo" });
  else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "c") {
    const { text } = cellText(sel.r, sel.c);
    send({ type: "copy", text: text ?? "" });
  } else return;
  e.preventDefault();
});

$("cancel").addEventListener("click", () => send({ type: "cancel" }));
const bind = (id: string, type: string) => $(id).addEventListener("click", () => send({ type }));
bind("btn-insert", "insertRow"); bind("btn-undo", "undo"); bind("btn-redo", "redo");
bind("btn-review", "review"); bind("btn-apply", "apply"); bind("btn-discard", "discard");
$("btn-delete").addEventListener("click", () => { if (totalRows()) send({ type: "toggleDelete", row: sel.r }); });

function setToolbar(count: number, canUndo: boolean, canRedo: boolean) {
  toolbar.hidden = !editable;
  $<HTMLButtonElement>("btn-undo").disabled = !canUndo;
  $<HTMLButtonElement>("btn-redo").disabled = !canRedo;
  for (const id of ["btn-review", "btn-apply", "btn-discard"]) $<HTMLButtonElement>(id).disabled = count === 0;
  $("pending-count").textContent = count ? `${count} pending change${count === 1 ? "" : "s"}` : "No pending changes";
}

window.addEventListener("message", (ev) => {
  const parsed = HostToWebview.safeParse(ev.data);
  if (!parsed.success) return; // drop anything that is not our protocol
  const m = parsed.data;
  if (m.type === "start") {
    columns = m.columns; rows = []; sel = { r: 0, c: 0 }; editable = !!m.editable;
    sets = new Map(); deletes = new Set(); inserts = []; editing = undefined;
    errorBox.hidden = true; errorBox.textContent = "";
    grid.setAttribute("aria-colcount", String(columns.length));
    grid.setAttribute("aria-rowcount", "1");
    $("title").textContent = m.title;
    status.textContent = "Running…"; $("cancel").hidden = false;
    setToolbar(0, false, false);
    renderHead(); renderBody();
  } else if (m.type === "rows") {
    for (const r of m.rows) rows.push(r);
    grid.setAttribute("aria-rowcount", String(rows.length + 1));
    status.textContent = `${rows.length.toLocaleString()} rows…`;
    schedule();
  } else if (m.type === "done") {
    $("cancel").hidden = true;
    const ms = Math.round(m.durationMs);
    const parts = [m.affectedRows !== undefined ? `${m.affectedRows} rows affected` : `${m.rowCount.toLocaleString()} rows`, `${ms} ms`];
    if (m.truncated) parts.push("truncated at the row limit (rizomadb.query.maxRows)");
    status.textContent = parts.join(" · ");
    announce(status.textContent);
    if (columns.length === 0) { renderHead(); renderBody(); }
    setToolbar(0, false, false);
  } else if (m.type === "error") {
    $("cancel").hidden = true;
    errorBox.hidden = false;
    errorBox.textContent = `${m.kind}: ${m.message}`;
    status.textContent = "Failed";
    announce(`Error: ${m.message}`);
  } else if (m.type === "pending") {
    sets = new Map(m.sets.map((s) => [`${s.row}:${s.col}`, s.text]));
    deletes = new Set(m.deletes); inserts = m.inserts;
    grid.setAttribute("aria-rowcount", String(totalRows() + 1));
    setToolbar(m.count, m.canUndo, m.canRedo);
    announce(m.count ? `${m.count} pending changes` : "No pending changes");
    renderBody();
  } else if (m.type === "notice") {
    errorBox.hidden = m.text === "";
    errorBox.textContent = m.text;
    errorBox.setAttribute("role", m.level === "error" ? "alert" : "status");
    if (m.text) announce(m.text);
  }
});
