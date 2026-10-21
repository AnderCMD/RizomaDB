import { HostToConnect } from "../../connectMessages.js";
import { tr as msg } from "./i18n.js";
import { icon, iconButton, enableTips, engineLogo as logo } from "./ui.js";

declare function acquireVsCodeApi(): { postMessage(m: unknown): void };
const vscode = acquireVsCodeApi();
const app = document.getElementById("app")!;
enableTips();

type Shape = { t: string; a: Record<string, string>; c?: Shape[] | undefined };
type EngineInfo = { key: string; name: string; family: string; color: string; fg: string; mark: string; logo?: { bg: string; vb: string; shapes: Shape[]; wordmark?: boolean | undefined } | undefined };

type Field = { key: string; title: string; description?: string | undefined; kind: "text" | "number" | "boolean"; required: boolean; secret: boolean; value: string | boolean };

const FAMILIES: [string, string][] = [
  ["relational", "Relational"], ["analytics", "Analytics"], ["document", "Document and cloud NoSQL"], ["keyvalue", "Key-value"],
  ["search", "Search"], ["graph", "Graph"], ["timeseries", "Time series"], ["widecolumn", "Wide-column"],
];
let engines: EngineInfo[] = [];
let lastSearch = "";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

type Conn = { id: string; name: string; engine: string; environment: string; readOnly: boolean; connected: boolean; shared: boolean; target: string; active: boolean; database: string };
let conns: Conn[] = [];
let page: "new" | "saved" = "new";
const savedTabLabel = () => `${msg("Saved connections")} (${conns.length})`;

function tabBar(active: "new" | "saved") {
  const bar = el("div", { class: "tabs", role: "tablist", "aria-label": msg("Connections") });
  const mk = (id: "new" | "saved", label: string, ic: "plus" | "rows", go: () => void) => {
    const b = el("button", { type: "button", role: "tab", class: "tab", "aria-selected": String(active === id), tabindex: active === id ? "0" : "-1" });
    b.append(icon(ic, 15), el("span", { "data-tab": id }, label)); b.addEventListener("click", go); return b;
  };
  bar.append(mk("new", msg("New connection"), "plus", showGrid), mk("saved", savedTabLabel(), "rows", showSaved));
  return bar;
}

function showSaved() {
  page = "saved"; app.replaceChildren();
  const screen = el("div", { class: "screen" });
  const h1 = el("h1", { id: "title", tabindex: "-1" }, msg("Saved connections"));
  screen.append(tabBar("saved"), h1);
  if (!conns.length) {
    const empty = el("div", { class: "empty-state" });
    empty.append(icon("plug", 28), el("p", {}, msg("You have no saved connections yet")), iconButton("plus", msg("New connection"), showGrid, { primary: true, text: msg("New connection") }));
    screen.append(empty); app.append(screen); h1.focus(); return;
  }
  const list = el("ul", { class: "conn-list" });
  const act = (action: "connect" | "disconnect" | "query" | "readonly" | "delete", id: string) => vscode.postMessage({ v: 1, type: "conn", action, id });
  for (const c of conns) {
    const e = engines.find((x) => x.key === c.engine);
    const li = el("li", { class: `conn-card${c.active ? " is-active" : ""}` });
    li.append(e ? logo(e, 40) : icon("rows", 28));
    const info_ = el("div", { class: "conn-info" });
    const title = el("div", { class: "conn-title" }); title.append(el("strong", {}, c.name), el("span", { class: `chip env-${c.environment}` }, c.environment.toUpperCase()));
    if (c.active) title.append(el("span", { class: "chip active" }, `● ${msg("Active")}`));
    if (c.readOnly) title.append(el("span", { class: "chip" }, msg("read-only")));
    if (c.shared) title.append(el("span", { class: "chip" }, msg("shared")));
    info_.append(title, el("div", { class: "muted" }, `${e?.name ?? c.engine}${c.target ? ` · ${c.target}` : ""}${c.database ? ` · ${msg("Database")}: ${c.database}` : ""}`),
      el("div", { class: c.connected ? "status ok" : "muted" }, c.connected ? `● ${msg("Connected")}` : `○ ${msg("Disconnected")}`));
    const tools_ = el("div", { class: "conn-tools" });
    tools_.append(
      c.connected ? iconButton("plug", `${msg("Disconnect")}: ${c.name}`, () => act("disconnect", c.id)) : iconButton("plug", `${msg("Connect")}: ${c.name}`, () => act("connect", c.id), { primary: true }),
      iconButton("code", `${msg("New query")}: ${c.name}`, () => act("query", c.id)),
      iconButton("lock", `${c.readOnly ? msg("Allow writes") : msg("Make read-only")}: ${c.name}`, () => act("readonly", c.id), { pressed: c.readOnly }),
      iconButton("trash", `${msg("Delete")}: ${c.name}`, () => act("delete", c.id), { danger: true, hidden: c.shared }));
    li.append(info_, tools_); list.append(li);
  }
  screen.append(list); app.append(screen); h1.focus();
}

function showGrid() {
  page = "new";
  app.replaceChildren();
  const h1 = el("h1", { id: "title", tabindex: "-1" }, msg("New connection"));
  const sub = el("p", { class: "hint" }, msg("Choose a database engine"));
  const label = el("label", { class: "search" });
  const search = el("input", { type: "search", placeholder: msg("Search engines") });
  search.value = lastSearch;
  label.append(el("span", { class: "sr-only" }, msg("Search engines")), search);
  const live = el("p", { class: "sr-only", role: "status" });
  const groups = el("div", { class: "groups" });
  const empty = el("p", { class: "hint", hidden: "" }, msg("No engine matches your search"));
  const sections: { sec: HTMLElement; items: { li: HTMLElement; name: string }[] }[] = [];
  for (const [fam, title] of FAMILIES) {
    const list = engines.filter((e) => e.family === fam);
    if (!list.length) continue;
    const sec = el("section", { "aria-labelledby": `fam-${fam}` });
    const ul = el("ul", { class: "engine-list" });
    sec.append(el("h2", { id: `fam-${fam}` }, msg(title)), ul);
    const items = list.map((e) => {
      const b = el("button", { type: "button", class: "engine-card" });
      b.append(logo(e, 40), el("span", { class: e.logo?.wordmark ? "sr-only" : "engine-name" }, e.name));
      if (e.logo?.wordmark) b.setAttribute("title", e.name);
      b.addEventListener("click", () => vscode.postMessage({ v: 1, type: "pick", key: e.key }));
      const li = el("li"); li.append(b);
      ul.append(li);
      return { li, name: e.name.toLowerCase() };
    });
    sections.push({ sec, items });
    groups.append(sec);
  }
  const apply = () => {
    lastSearch = search.value;
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    for (const s of sections) {
      let any = 0;
      for (const it of s.items) { const hit = !q || it.name.includes(q); it.li.hidden = !hit; if (hit) any++; }
      s.sec.hidden = any === 0; shown += any;
    }
    empty.hidden = shown > 0;
    live.textContent = msg("{0} engines shown", shown);
  };
  search.addEventListener("input", apply);
  app.append(el("div", { class: "screen" }));
  const screen = app.firstElementChild!;
  screen.append(tabBar("new"), h1, sub, label, live, groups, empty, el("p", { class: "hint small" }, msg("Logos identify each product and belong to their owners; RizomaDB is not affiliated with them.")));
  apply();
  h1.focus();
}

function showForm(m: { key: string; fields: Field[]; tunnel: boolean; defaultName: string; environments: string[] }) {
  const engine = engines.find((e) => e.key === m.key)!;
  app.replaceChildren();
  const screen = el("form", { class: "screen connect-form", novalidate: "" });
  screen.addEventListener("submit", (ev) => ev.preventDefault());
  const back = iconButton("left", msg("Back to engines"), showGrid);
  back.classList.add("back");
  const head = el("div", { class: "form-head" });
  const h1 = el("h1", { id: "title", tabindex: "-1" }, engine.name);
  head.append(logo(engine, 40), h1);

  const inputs = new Map<string, HTMLInputElement | HTMLSelectElement>();
  const row = (key: string, title: string, control: HTMLInputElement | HTMLSelectElement, hint?: string, required = false) => {
    const label = el("label", { class: "field" });
    label.append(el("span", {}, required ? `${title} *` : title), control);
    if (hint) { const id = `hint-${key}`; label.append(el("small", { id }, hint)); control.setAttribute("aria-describedby", id); }
    inputs.set(key, control);
    return label;
  };
  const text = (value: string, secret = false) => { const i = el("input", { type: secret ? "password" : "text", autocomplete: "off" }); i.value = value; return i; };
  const selectOf = (opts: [string, string][]) => { const s = el("select"); for (const [v, l] of opts) s.append(el("option", { value: v }, l)); return s; };

  const name = text(m.defaultName);
  const envOptions: [string, string][] = m.environments.map((n) => [n, n === "prod" ? `prod — ${msg("read-only by default")}` : n]);
  envOptions.push(["__new__", msg("New environment…")]);
  const env = selectOf(envOptions);
  const newEnvName = text(""); newEnvName.setAttribute("maxlength", "24"); newEnvName.placeholder = "qa";
  const newEnvProt = selectOf([["confirm", msg("Ask before every write")], ["readOnly", msg("Block writes")], ["none", msg("No protection")]]);
  const general = el("fieldset"); general.append(el("legend", {}, msg("General")), row("name", msg("Connection name"), name, undefined, true), row("env", msg("Environment"), env));
  const newEnvRow = el("div", { class: "newenv", hidden: "" });
  newEnvRow.append(row("env.name", msg("New environment name"), newEnvName, msg("Lowercase letters, digits and dashes"), true), row("env.prot", msg("Protection"), newEnvProt));
  env.addEventListener("change", () => { newEnvRow.hidden = env.value !== "__new__"; });
  general.append(newEnvRow);

  const conn = el("fieldset"); conn.append(el("legend", {}, msg("Connection")));
  for (const f of m.fields) {
    if (f.kind === "boolean") {
      const c = el("input", { type: "checkbox" }); c.checked = f.value === true;
      const label = el("label", { class: "check" }); label.append(c, el("span", {}, f.title));
      if (f.description) { const id = `hint-${f.key}`; label.append(el("small", { id }, f.description)); c.setAttribute("aria-describedby", id); }
      inputs.set(`v.${f.key}`, c); conn.append(label);
    } else conn.append(row(`v.${f.key}`, f.title, text(String(f.value), f.secret), f.description, f.required));
  }

  // Local servers rarely speak TLS: follow the host field until the user decides about TLS themselves.
  const hostIn = inputs.get("v.host") as HTMLInputElement | undefined, sslIn = inputs.get("v.ssl") as HTMLInputElement | undefined;
  if (hostIn && sslIn) {
    const sslDefault = sslIn.checked; let touched = false;
    const loopback = () => /^(localhost|127\.\d+\.\d+\.\d+|::1|\[::1\])$/i.test(hostIn.value.trim());
    const follow = () => { if (!touched) sslIn.checked = loopback() ? false : sslDefault; };
    sslIn.addEventListener("change", () => { touched = true; });
    hostIn.addEventListener("input", follow); follow();
  }

  const net = el("fieldset", m.tunnel ? {} : { hidden: "" });
  net.append(el("legend", {}, msg("Network path")));
  const via = selectOf([["none", msg("Direct")], ["ssh", msg("SSH tunnel")], ["http", msg("HTTP proxy")], ["socks5", msg("SOCKS5 proxy")]]);
  const proxy = el("div", { hidden: "" }), ssh = el("div", { hidden: "" });
  proxy.append(row("net.proxyHost", msg("Proxy host"), text(""), undefined, true), row("net.proxyPort", msg("Proxy port"), text("1080"), undefined, true),
    row("net.proxyUser", msg("Proxy user (leave empty if none)"), text("")), row("net.proxyPassword", msg("Proxy password"), text("", true)));
  const auth = selectOf([["key", msg("Private key file")], ["pw", msg("Password")]]);
  const keyRows = el("div"), pwRows = el("div", { hidden: "" });
  keyRows.append(row("net.sshKeyPath", msg("Path to private key"), text("~/.ssh/id_ed25519"), undefined, true), row("net.sshPassphrase", msg("Key passphrase (leave empty if none)"), text("", true)));
  pwRows.append(row("net.sshPassword", msg("SSH password"), text("", true), undefined, true));
  ssh.append(row("net.sshHost", msg("SSH host"), text(""), undefined, true), row("net.sshPort", msg("SSH port"), text("22"), undefined, true), row("net.sshUser", msg("SSH user"), text(""), undefined, true),
    row("net.sshAuth", msg("SSH authentication"), auth), keyRows, pwRows);
  net.append(row("via", msg("Connect through"), via), proxy, ssh);
  const syncNet = () => {
    proxy.hidden = !(via.value === "http" || via.value === "socks5"); ssh.hidden = via.value !== "ssh";
    (inputs.get("net.proxyPort") as HTMLInputElement).value = via.value === "http" ? "3128" : "1080";
  };
  via.addEventListener("change", syncNet);
  auth.addEventListener("change", () => { keyRows.hidden = auth.value !== "key"; pwRows.hidden = auth.value !== "pw"; });

  const status = el("p", { class: "status", role: "status" });
  const test = iconButton("plug", msg("Test connection"), undefined, { text: msg("Test connection") });
  const save = iconButton("save", msg("Save connection"), undefined, { primary: true, text: msg("Save connection") });
  const force = iconButton("check", msg("Save without connecting"), undefined, { hidden: true, text: msg("Save without connecting") });
  const done = iconButton("plus", msg("Add another connection"), undefined, { hidden: true, text: msg("Add another connection") });
  done.addEventListener("click", showGrid);
  const buttons = el("div", { class: "buttons" }); buttons.append(save, test, force, done);

  const collect = (forceSave: boolean) => {
    const values: Record<string, string | boolean> = {}, netv: Record<string, string> = {};
    for (const [k, i] of inputs) {
      if (k.startsWith("v.")) values[k.slice(2)] = i instanceof HTMLInputElement && i.type === "checkbox" ? i.checked : i.value;
      else if (k.startsWith("net.")) netv[k.slice(4)] = i.value;
    }
    return { key: m.key, name: name.value, environment: env.value === "__new__" ? newEnvName.value.trim().toLowerCase() : env.value, ...(env.value === "__new__" ? { newEnvProtection: newEnvProt.value } : {}), values, via: via.value, net: netv, force: forceSave };
  };
  const busy = (b: boolean) => { for (const x of [test, save, force]) (x as HTMLButtonElement).disabled = b; };
  const send = (type: "test" | "save", forceSave = false) => {
    for (const i of inputs.values()) i.removeAttribute("aria-invalid");
    status.className = "status"; status.textContent = msg("Working…"); busy(true); force.hidden = true;
    vscode.postMessage({ v: 1, type, form: collect(forceSave) });
  };
  test.addEventListener("click", () => send("test"));
  save.addEventListener("click", () => send("save"));
  force.addEventListener("click", () => send("save", true));

  onResult = (r) => {
    busy(false);
    status.className = `status ${r.ok ? "ok" : "err"}`; status.textContent = r.message;
    if (r.field) { const i = inputs.get(r.field.startsWith("net.") ? r.field : `v.${r.field}`); if (i) { i.setAttribute("aria-invalid", "true"); i.focus(); } }
    if (r.canForce) force.hidden = false;
    if (r.ok && r.action === "save") { for (const x of [test, save, force]) x.hidden = true; done.hidden = false; done.focus(); }
  };
  screen.append(back, head, general, conn, net, status, buttons);
  app.append(screen);
  h1.focus();
}

let onResult: (r: { action: string; ok: boolean; message: string; field?: string | undefined; canForce?: boolean | undefined }) => void = () => {};

window.addEventListener("message", (ev: MessageEvent) => {
  const p = HostToConnect.safeParse(ev.data);
  if (!p.success) return;
  const m = p.data;
  if (m.type === "engines") { engines = m.engines; showGrid(); }
  else if (m.type === "connections") { conns = m.items; if (page === "saved") showSaved(); else document.querySelectorAll<HTMLElement>('[data-tab="saved"]').forEach((x) => { x.textContent = savedTabLabel(); }); }
  else if (m.type === "form") showForm(m);
  else onResult(m);
});
vscode.postMessage({ v: 1, type: "ready" });
