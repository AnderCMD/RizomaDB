import { HostToWebview } from "../../messages.js";

declare function acquireVsCodeApi(): { postMessage(m: unknown): void };
const vscode = acquireVsCodeApi();

const ROW_H = 24, COL_W = 180, OVERSCAN = 8;
let columns: { name: string; nativeType: string }[] = [];
let rows: (string | null)[][] = [];
let sel = { r: 0, c: 0 };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const grid = $("grid"), status = $("status"), errorBox = $("error"), live = $("live");
const spacer = document.createElement("div");
const head = document.createElement("div");
head.className = "head"; head.setAttribute("role", "row"); head.setAttribute("aria-rowindex", "1");
const body = document.createElement("div");
body.setAttribute("role", "rowgroup");
body.style.position = "relative";
grid.append(head, body);
body.append(spacer);

function announce(s: string) { live.textContent = s; }

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
  const first = Math.max(0, Math.floor(top / ROW_H) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((top + h) / ROW_H) + OVERSCAN);
  spacer.style.height = `${rows.length * ROW_H}px`;
  spacer.style.width = `${columns.length * COL_W}px`;
  const frag = document.createDocumentFragment();
  for (let r = first; r < last; r++) {
    const row = document.createElement("div");
    row.className = "row"; row.style.top = `${r * ROW_H}px`;
    row.setAttribute("role", "row"); row.setAttribute("aria-rowindex", String(r + 2));
    rows[r]!.forEach((v, c) => {
      const d = document.createElement("div");
      d.className = "cell" + (v === null ? " null" : "") + (sel.r === r && sel.c === c ? " sel" : "");
      d.setAttribute("role", "gridcell"); d.setAttribute("aria-colindex", String(c + 1));
      d.textContent = v === null ? "NULL" : v;
      if (v !== null) d.title = v.length > 200 ? v.slice(0, 200) + "…" : v;
      row.append(d);
    });
    frag.append(row);
  }
  body.replaceChildren(spacer, frag);
}

let raf = 0;
const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderBody(); }); };
grid.addEventListener("scroll", schedule);
window.addEventListener("resize", schedule);

function move(dr: number, dc: number) {
  if (!rows.length) return;
  sel.r = Math.min(rows.length - 1, Math.max(0, sel.r + dr));
  sel.c = Math.min(columns.length - 1, Math.max(0, sel.c + dc));
  const y = sel.r * ROW_H;
  if (y < grid.scrollTop) grid.scrollTop = y;
  else if (y + ROW_H + 26 > grid.scrollTop + grid.clientHeight) grid.scrollTop = y + ROW_H + 26 - grid.clientHeight;
  const x = sel.c * COL_W;
  if (x < grid.scrollLeft) grid.scrollLeft = x;
  else if (x + COL_W > grid.scrollLeft + grid.clientWidth) grid.scrollLeft = x + COL_W - grid.clientWidth;
  renderBody();
  const v = rows[sel.r]![sel.c];
  announce(`${columns[sel.c]!.name}, row ${sel.r + 1}: ${v === null ? "NULL" : v}`);
}

grid.addEventListener("keydown", (e) => {
  const page = Math.max(1, Math.floor(grid.clientHeight / ROW_H) - 1);
  const k = e.key;
  if (k === "ArrowDown") move(1, 0); else if (k === "ArrowUp") move(-1, 0);
  else if (k === "ArrowRight") move(0, 1); else if (k === "ArrowLeft") move(0, -1);
  else if (k === "PageDown") move(page, 0); else if (k === "PageUp") move(-page, 0);
  else if (k === "Home") move(0, -columns.length); else if (k === "End") move(0, columns.length);
  else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "c") {
    const v = rows[sel.r]?.[sel.c];
    if (v !== undefined) vscode.postMessage({ v: 1, type: "copy", text: v ?? "" });
  } else return;
  e.preventDefault();
});

$("cancel").addEventListener("click", () => vscode.postMessage({ v: 1, type: "cancel" }));

window.addEventListener("message", (ev) => {
  const parsed = HostToWebview.safeParse(ev.data);
  if (!parsed.success) return; // drop anything that is not our protocol
  const m = parsed.data;
  if (m.type === "start") {
    columns = m.columns; rows = []; sel = { r: 0, c: 0 };
    errorBox.hidden = true; errorBox.textContent = "";
    grid.setAttribute("aria-colcount", String(columns.length));
    grid.setAttribute("aria-rowcount", "1");
    $("title").textContent = m.title;
    status.textContent = "Running…"; $("cancel").hidden = false;
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
  } else if (m.type === "error") {
    $("cancel").hidden = true;
    errorBox.hidden = false;
    errorBox.textContent = `${m.kind}: ${m.message}`;
    status.textContent = "Failed";
    announce(`Error: ${m.message}`);
  }
});
