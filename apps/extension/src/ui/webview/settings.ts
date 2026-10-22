import { HostToSettings } from "../../settingsMessages.js";
import { tr as msg } from "./i18n.js";
import { icon, iconButton, enableTips } from "./ui.js";

declare function acquireVsCodeApi(): { postMessage(m: unknown): void };
const vscode = acquireVsCodeApi();
const app = document.getElementById("app")!;
enableTips();

type Item = { key: string; title: string; description: string; kind: string; value: string | number | boolean; modified: boolean; options?: string[] | undefined; min?: number | undefined };
type Group = { id: string; title: string; items: Item[] };
const NS = "http://www.w3.org/2000/svg";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}
const plain = (s: string) => s.replaceAll("`", "");

/** RizomaDB's own mark (a database cylinder with roots to three nodes), drawn with DOM calls. */
function brandMark(size: number) {
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 128 128", width: String(size), height: String(size), "aria-hidden": "true", focusable: "false" })) svg.setAttribute(k, v);
  const add = (tag: string, a: Record<string, string>) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) n.setAttribute(k, v); svg.append(n); };
  add("rect", { width: "128", height: "128", rx: "28", fill: "#0f172a" });
  add("ellipse", { cx: "64", cy: "30", rx: "28", ry: "11", fill: "none", stroke: "#34d399", "stroke-width": "9" });
  add("path", { d: "M36 46c0 12 56 12 56 0M64 56v20m0 0c0 14-26 12-29 27m29-27c0 14 26 12 29 27M64 76v29", fill: "none", stroke: "#34d399", "stroke-width": "9", "stroke-linecap": "round" });
  add("circle", { cx: "35", cy: "105", r: "10", fill: "#34d399" }); add("circle", { cx: "93", cy: "105", r: "10", fill: "#34d399" }); add("circle", { cx: "64", cy: "109", r: "10", fill: "#fbbf24" });
  return svg;
}

let groups: Group[] = [], language = "", query = "", modifiedOnly = false, live: HTMLElement, masonry: HTMLElement;
const status = (m: string, ok = true) => { if (live) { live.textContent = m; live.className = `chip ${ok ? "ok" : "err"}`; } };
const send = (m: Record<string, unknown>) => vscode.postMessage({ v: 1, ...m });

function render() {
  app.replaceChildren();
  const top = el("header", { class: "topbar" });
  const brand = el("div", { class: "brand" }); brand.append(brandMark(36), el("h1", { id: "title", tabindex: "-1" }, "RizomaDB"), el("span", { class: "crumb" }, msg("RizomaDB settings")));
  const label = el("label", { class: "field-icon" }), search = el("input", { type: "search", placeholder: msg("Search settings"), "aria-label": msg("Search settings") });
  search.value = query; label.append(icon("search", 14), search);
  live = el("span", { role: "status", class: "chip" });
  const resetAll = iconButton("undo", msg("Reset every setting to its default"), () => { for (const g of groups) for (const it of g.items) if (it.modified) send({ type: "reset", key: it.key }); }, { text: msg("Reset all") });
  resetAll.id = "reset-all";
  const onlyMod = iconButton("filter", msg("Show modified settings only"), () => { modifiedOnly = !modifiedOnly; onlyMod.setAttribute("aria-pressed", String(modifiedOnly)); fill(); }, { text: msg("Modified") });
  onlyMod.id = "only-modified"; onlyMod.setAttribute("aria-pressed", String(modifiedOnly));
  top.append(brand, el("span", { class: "grow" }), live, label, onlyMod, iconButton("download", msg("Export settings"), () => send({ type: "export" })), iconButton("upload", msg("Import settings"), () => send({ type: "import" })), iconButton("external", msg("Open settings.json"), () => send({ type: "json" }), { text: msg("Open settings.json") }), resetAll);
  masonry = el("div", { class: "masonry" });
  const main = el("main"); main.append(el("p", { class: "hint intro" }, msg("Changes are saved to your user settings as soon as you make them.")), masonry);
  app.append(top, main);
  search.addEventListener("input", () => { query = search.value; fill(); });
  fill(); document.getElementById("title")?.focus();
}

const LABELS: Record<string, string> = { "rizomadb.language:auto": msg("Follow VS Code"), "rizomadb.language:en": "English", "rizomadb.language:es": "Español", "rizomadb.language:pt": "Português (Brasil)", "rizomadb.language:fr": "Français", "rizomadb.results.location:bottom": msg("Bottom half"), "rizomadb.results.location:full": msg("Whole editor area"), "rizomadb.results.location:beside": msg("Beside the editor") };

function info(it: Item) {
  const b = el("span", { class: "info", tabindex: "0", role: "note", "aria-label": `${it.title}: ${plain(it.description)}`, "data-tip": plain(it.description) });
  b.textContent = "i";
  return b;
}

function row(it: Item) {
  const id = `c-${it.key}`;
  const wrap = el("div", { class: `row2${it.modified ? " modified" : ""}`, "data-key": it.key });
  const set = (value: string | number | boolean) => send({ type: "set", key: it.key, value });
  if (it.kind === "boolean") {
    const lab = el("label", { class: "chk" });
    const c = el("input", { type: "checkbox", id }); c.checked = it.value === true; c.addEventListener("change", () => set(c.checked));
    const box = el("span", { class: "cbx" }); box.append(c, icon("check", 14));
    lab.append(box, el("span", {}, it.title));
    wrap.append(lab, info(it));
  } else if (it.kind === "choice") {
    wrap.classList.add("inline");
    const s = el("select", { id }); for (const o of it.options ?? []) s.append(el("option", { value: o }, LABELS[`${it.key}:${o}`] ?? o));
    s.value = String(it.value); s.addEventListener("change", () => set(s.value));
    wrap.append(el("label", { for: id }, it.title), info(it), s);
  } else if (it.kind === "object") {
    wrap.classList.add("inline");
    wrap.append(el("span", {}, it.title), info(it), iconButton("external", msg("Edit in settings.json"), () => send({ type: "json", key: it.key }), { id, text: msg("Edit in settings.json") }));
  } else {
    const i = el("input", { type: it.kind === "number" ? "number" : "text", id, ...(it.min !== undefined ? { min: String(it.min) } : {}) });
    i.value = String(it.value); i.addEventListener("change", () => set(i.value));
    const head = el("div", { class: "lab" }); head.append(el("label", { for: id }, it.title), info(it));
    wrap.append(head, i);
  }
  return wrap;
}

function fill() {
  masonry.replaceChildren();
  const q = query.trim().toLowerCase();
  let shown = 0;
  for (const g of groups) {
    const items = g.items.filter((it) => (!modifiedOnly || it.modified) && (!q || `${it.title} ${it.description} ${it.key} ${g.title}`.toLowerCase().includes(q)));
    const showLang = g.id === "language" && !modifiedOnly && (!q || `${msg("VS Code display language")} ${language}`.toLowerCase().includes(q) || items.length > 0);
    if (!items.length && !showLang) continue;
    const card = el("section", { class: "card2", "aria-labelledby": `g-${g.id}` });
    const head = el("div", { class: "card2-head" });
    const anyModified = g.items.some((it) => it.modified);
    const reset = iconButton("undo", `${msg("Reset to default")}: ${g.title}`, () => { for (const it of g.items) if (it.modified) send({ type: "reset", key: it.key }); });
    reset.disabled = !anyModified;
    head.append(el("h2", { id: `g-${g.id}` }, g.title), reset);
    const body = el("div", { class: "card2-body" });
    for (const it of items) { shown++; body.append(row(it)); }
    if (showLang) {
      shown++;
      const r = el("div", { class: "row2 inline" });
      r.append(el("span", {}, msg("VS Code display language")), iconButton("external", msg("Change VS Code display language…"), () => send({ type: "language" }), { id: "c-vscode-language", text: msg("Change VS Code display language…") }));
      body.append(r, el("p", { class: "desc" }, msg("Command and setting names always follow the VS Code language; changing it restarts VS Code.")));
    }
    card.append(head, body); masonry.append(card);
  }
  if (!shown) masonry.append(el("p", { class: "hint" }, msg("No setting matches your search")));
  const all = document.getElementById("reset-all") as HTMLButtonElement | null;
  if (all) all.disabled = !groups.some((g) => g.items.some((it) => it.modified));
}

window.addEventListener("message", (ev: MessageEvent) => {
  const p = HostToSettings.safeParse(ev.data);
  if (!p.success) return;
  const m = p.data;
  if (m.type === "load") {
    const first = groups.length === 0; groups = m.groups; language = m.language;
    if (first) render(); else { const active = document.activeElement?.id; fill(); if (active) document.getElementById(active)?.focus(); }
  } else status(m.message, m.ok);
});
send({ type: "ready" });
