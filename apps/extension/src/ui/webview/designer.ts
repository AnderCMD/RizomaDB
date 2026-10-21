import { HostToDesigner, type DesignTable } from "../../designMessages.js";
import { enableTips, iconButton } from "./ui.js";
import { tr as msg } from "./i18n.js";

enableTips();
declare function acquireVsCodeApi(): { postMessage(m: unknown): void };
const vscode = acquireVsCodeApi();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

let engine = "", existing = false;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}
function input(value: string, label: string, cls = "") { const i = el("input", { type: "text", "aria-label": label, class: cls }); i.value = value; return i; }
function check(value: boolean, label: string) { const i = el("input", { type: "checkbox", "aria-label": label }); i.checked = value; return i; }
const cell = (...c: Node[]) => { const td = el("td"); td.append(...c); return td; };

function colRow(c: { name: string; type: string; nullable: boolean; default?: string; identity?: boolean }, pk: boolean) {
  const tr = el("tr");
  const rm = iconButton("trash", msg("Remove column"));
  rm.addEventListener("click", () => tr.remove());
  tr.append(cell(input(c.name, msg("Column name"), "c-name")), cell(input(c.type, msg("Type"), "c-type")), cell(check(!c.nullable, "NOT NULL")), cell(check(pk, msg("Primary key"))), cell(input(c.default ?? "", msg("Default (SQL expression)"), "c-def")), cell(check(!!c.identity, msg("Auto-increment"))), cell(rm));
  (tr.querySelectorAll("input[type=text]")[1] as HTMLInputElement).setAttribute("list", "types");
  return tr;
}
function idxRow(i: { name: string; columns: string[]; unique: boolean }) {
  const tr = el("tr"); const rm = iconButton("trash", msg("Remove index")); rm.addEventListener("click", () => tr.remove());
  tr.append(cell(input(i.name, msg("Index name"))), cell(input(i.columns.join(", "), msg("Index columns, comma separated"))), cell(check(i.unique, "Unique")), cell(rm)); return tr;
}
function fkRow(f: { name: string; columns: string[]; refTable: string; refColumns: string[] }) {
  const tr = el("tr"); const rm = iconButton("trash", msg("Remove foreign key")); rm.addEventListener("click", () => tr.remove());
  tr.append(cell(input(f.name, msg("Constraint name"))), cell(input(f.columns.join(", "), "Columns")), cell(input(f.refTable, msg("Referenced table"))), cell(input(f.refColumns.join(", "), "Referenced columns")), cell(rm)); return tr;
}

function collect(): DesignTable {
  const rows = [...$("cols").querySelectorAll("tr")];
  const columns = rows.map((tr) => { const t = tr.querySelectorAll<HTMLInputElement>("input"); return { name: t[0]!.value.trim(), type: t[1]!.value.trim(), nullable: !t[2]!.checked, ...(t[4]!.value.trim() ? { default: t[4]!.value.trim() } : {}), ...(t[5]!.checked ? { identity: true } : {}) }; });
  const primaryKey = rows.filter((tr) => tr.querySelectorAll<HTMLInputElement>("input")[3]!.checked).map((tr) => tr.querySelectorAll<HTMLInputElement>("input")[0]!.value.trim());
  const indexes = [...$("idx").querySelectorAll("tr")].map((tr) => { const t = tr.querySelectorAll<HTMLInputElement>("input"); return { name: t[0]!.value.trim(), columns: csv(t[1]!.value), unique: t[2]!.checked }; });
  const foreignKeys = [...$("fks").querySelectorAll("tr")].map((tr) => { const t = tr.querySelectorAll<HTMLInputElement>("input"); return { name: t[0]!.value.trim(), columns: csv(t[1]!.value), refTable: t[2]!.value.trim(), refColumns: csv(t[3]!.value) }; });
  return { name: $<HTMLInputElement>("tname").value.trim(), columns, primaryKey, indexes, foreignKeys };
}

$("add-col").addEventListener("click", () => $("cols").append(colRow({ name: "", type: "", nullable: true }, false)));
$("add-idx").addEventListener("click", () => $("idx").append(idxRow({ name: "", columns: [], unique: false })));
$("add-fk").addEventListener("click", () => $("fks").append(fkRow({ name: "", columns: [], refTable: "", refColumns: [] })));
$("btn-preview").addEventListener("click", () => vscode.postMessage({ v: 1, type: "preview", table: collect() }));
$("btn-apply").addEventListener("click", () => vscode.postMessage({ v: 1, type: "apply", table: collect() }));

window.addEventListener("message", (e) => {
  const p = HostToDesigner.safeParse(e.data);
  if (!p.success) return;
  const m = p.data;
  if (m.type === "load") {
    engine = m.engine; existing = m.existing;
    $("heading").textContent = existing ? msg("Edit table {0} ({1})", m.table.name, engine) : msg("New table ({0})", engine);
    $<HTMLInputElement>("tname").value = m.table.name; $<HTMLInputElement>("tname").disabled = existing;
    $("types").replaceChildren(...m.types.map((t) => el("option", { value: t })));
    $("cols").replaceChildren(...m.table.columns.map((c) => colRow(c, m.table.primaryKey.some((p) => p.toLowerCase() === c.name.toLowerCase()))));
    $("idx").replaceChildren(...m.table.indexes.map(idxRow)); $("fks").replaceChildren(...m.table.foreignKeys.map(fkRow));
  } else if (m.type === "ddl") {
    $("ddl").textContent = m.error ? m.error : m.statements.length ? m.statements.map((s) => `${s.manual ? `-- MANUAL: ${s.manual}\n` : ""}${s.destructive ? `-- DESTRUCTIVE: ${s.destructive}\n` : ""}${s.sql};`).join("\n\n") : "-- " + msg("No changes");
    $("warn").textContent = m.statements.some((s) => s.destructive) ? msg("This change is destructive and cannot be undone automatically.") : "";
    $("ddl").focus();
  } else {
    $("status").textContent = m.message;
    $("status").setAttribute("role", m.ok ? "status" : "alert");
  }
});
