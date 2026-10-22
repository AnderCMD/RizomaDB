import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { SettingsToHost } from "../settingsMessages.js";
import { i18nBlock } from "./webviewStrings.js";
import { t, effectiveLanguage } from "../i18n.js";
import { buildExport, parseImport } from "../lib/settingsTransfer.js";

let current: vscode.WebviewPanel | undefined;

interface Prop { type?: string; default?: unknown; enum?: string[]; minimum?: number; description?: string; markdownDescription?: string }

/** Human names for every contributed setting (descriptions come from the manifest's translated strings). */
const TITLES: Record<string, () => string> = {
  "language": () => t("Extension language"),
  "results.location": () => t("Where results open"),
  "editor.codeLens": () => t("Run buttons above each statement"),
  "editor.highlightStatement": () => t("Highlight the statement at the cursor"),
  "edit.applyImmediately": () => t("Save each edit immediately"),
  "query.pageSize": () => t("Rows per page"),
  "query.keysetPaging": () => t("Page tables by primary key"),
  "environments": () => t("Extra environments"),
  "explorer.groupByFamily": () => t("Group connections by engine type"),
  "security.confirmDestructive": () => t("Confirm destructive statements"),
  "security.prodReadOnlyByDefault": () => t("Production is read-only by default"),
  "query.maxRows": () => t("Maximum rows per result"),
  "query.timeoutSeconds": () => t("Query timeout (seconds)"),
  "history.enabled": () => t("Keep query history"),
  "history.retentionDays": () => t("History retention (days)"),
  "table.openRows": () => t("Rows loaded when opening a table"),
  "policy.team": () => t("Team policy"),
  "catalog.teamFile": () => t("Shared connections file"),
  "audit.enabled": () => t("Write the audit log"),
  "audit.path": () => t("Audit log location"),
  "audit.includeValues": () => t("Include values in the audit log"),
  "mcp.autoRegister": () => t("Offer the read-only MCP server to VS Code"),
  "ai.enabled": () => t("Enable AI assistance"),
  "ai.provider": () => t("AI provider"),
  "ai.endpoint": () => t("AI endpoint"),
  "ai.model": () => t("AI model"),
  "ai.redactLiterals": () => t("Redact literals before sending"),
};
const GROUPS: Record<string, () => string> = {
  language: () => t("Language"), environments: () => t("Environments"), results: () => t("Results"), editor: () => t("Query editor"), edit: () => t("Editing"), explorer: () => t("Connections tree"),
  security: () => t("Security"), query: () => t("Queries"), history: () => t("History"), table: () => t("Tables"), policy: () => t("Policy"),
  catalog: () => t("Shared connections"), audit: () => t("Audit"), mcp: () => t("MCP server"), ai: () => t("AI assistant"),
};

function nls(ctx: vscode.ExtensionContext): Record<string, string> {
  const read = (f: string) => { try { return JSON.parse(readFileSync(vscode.Uri.joinPath(ctx.extensionUri, f).fsPath, "utf8")) as Record<string, string>; } catch { return {}; } };
  const lang = effectiveLanguage().toLowerCase(), file = lang.startsWith("es") ? "package.nls.es.json" : "";
  return { ...read("package.nls.json"), ...(file ? read(file) : {}) };
}

function contributed(ctx: vscode.ExtensionContext): Record<string, Prop> {
  const cfg = (ctx.extension.packageJSON as { contributes?: { configuration?: { properties?: Record<string, Prop> } } }).contributes?.configuration?.properties ?? {};
  return cfg;
}

/** The one-screen settings editor: every contributed setting, grouped, editable in place and written to the user settings. */
export function openSettingsScreen(ctx: vscode.ExtensionContext) {
  if (current) { current.reveal(); return; }
  const root = vscode.Uri.joinPath(ctx.extensionUri, "dist");
  const panel = vscode.window.createWebviewPanel("rizomadb.settings", t("RizomaDB settings"), vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [root] });
  current = panel;
  panel.iconPath = vscode.Uri.joinPath(ctx.extensionUri, "media", "icon.png");
  const nonce = randomBytes(16).toString("base64"), w = panel.webview;
  w.html = `<!doctype html><html lang="${effectiveLanguage()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${w.asWebviewUri(vscode.Uri.joinPath(root, "webview.css"))}"><title>${t("RizomaDB settings")}</title></head>
<body><div id="app"></div>${i18nBlock()}<script nonce="${nonce}" src="${w.asWebviewUri(vscode.Uri.joinPath(root, "settings.js"))}"></script></body></html>`;

  const props = contributed(ctx), strings = nls(ctx);
  const text = (p: Prop) => { const raw = p.markdownDescription ?? p.description ?? ""; return raw.replace(/^%(.+)%$/, (_, k: string) => strings[k] ?? k); };
  const send = () => {
    const cfg = vscode.workspace.getConfiguration();
    const groups = new Map<string, { id: string; title: string; items: unknown[] }>();
    for (const [full, p] of Object.entries(props)) {
      const key = full.replace(/^rizomadb\./, ""), gid = key.split(".")[0]!;
      const kind = p.enum ? "choice" : p.type === "boolean" ? "boolean" : p.type === "number" ? "number" : p.type === "string" ? "text" : "object";
      const value = cfg.get(full);
      const g = groups.get(gid) ?? { id: gid, title: GROUPS[gid]?.() ?? gid, items: [] };
      g.items.push({
        key: full, title: TITLES[key]?.() ?? key, description: text(p), kind,
        value: kind === "object" ? "" : (value as string | number | boolean | undefined) ?? (kind === "boolean" ? false : kind === "number" ? 0 : ""),
        modified: cfg.inspect(full)?.globalValue !== undefined,
        ...(p.enum ? { options: p.enum } : {}), ...(p.minimum !== undefined ? { min: p.minimum } : {}),
      });
      groups.set(gid, g);
    }
    void w.postMessage({ v: 1, type: "load", language: vscode.env.language, groups: [...groups.values()] });
  };
  const sub = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("rizomadb.language")) { panel.dispose(); setTimeout(() => openSettingsScreen(ctx), 50); return; }
    if (e.affectsConfiguration("rizomadb")) send();
  });
  panel.onDidDispose(() => { current = undefined; sub.dispose(); });

  w.onDidReceiveMessage(async (raw: unknown) => {
    const p = SettingsToHost.safeParse(raw); if (!p.success) return;
    const m = p.data;
    if (m.type === "ready") { send(); return; }
    if (m.type === "language") { await vscode.commands.executeCommand("workbench.action.configureLocale"); return; }
    if (m.type === "export" || m.type === "import") { await transfer(m.type, props, (ok, message) => void w.postMessage({ v: 1, type: "saved", key: "", ok, message })); return; }
    if (m.type === "json") { await vscode.commands.executeCommand("workbench.action.openSettingsJson"); return; }
    const prop = props[m.key];
    const reply = (ok: boolean, message: string) => void w.postMessage({ v: 1, type: "saved", key: m.key, ok, message });
    if (!prop || !m.key.startsWith("rizomadb.")) return;
    if (m.type === "reset") { await vscode.workspace.getConfiguration().update(m.key, undefined, vscode.ConfigurationTarget.Global); reply(true, t("Reset to default.")); return; }
    let value: string | number | boolean = m.value;
    if (prop.type === "boolean" && typeof value !== "boolean") return reply(false, t("Invalid value."));
    if (prop.type === "number") {
      value = typeof value === "string" ? Number(value.trim() === "" ? NaN : value) : value;
      if (typeof value !== "number" || !Number.isFinite(value) || (prop.minimum !== undefined && value < prop.minimum)) { send(); return reply(false, t("Invalid value.")); }
    }
    if (prop.type === "string" && typeof value !== "string") return reply(false, t("Invalid value."));
    if (prop.enum && !prop.enum.includes(String(value))) return reply(false, t("Invalid value."));
    if (prop.type === "object") return;
    await vscode.workspace.getConfiguration().update(m.key, value, vscode.ConfigurationTarget.Global);
    reply(true, t("Saved."));
  });
}

/** Writes the modified settings to a JSON file, or applies a previously exported one (each value checked against the manifest). */
async function transfer(kind: "export" | "import", props: Record<string, Prop>, report: (ok: boolean, message: string) => void) {
  const cfg = vscode.workspace.getConfiguration();
  if (kind === "export") {
    const values: Record<string, unknown> = {};
    for (const key of Object.keys(props)) { const v = cfg.inspect(key)?.globalValue; if (v !== undefined) values[key] = v; }
    const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file("rizomadb-settings.json"), filters: { JSON: ["json"] }, saveLabel: t("Export settings") });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, Buffer.from(`${JSON.stringify(buildExport(values), null, 2)}\n`, "utf8"));
    return report(true, t("Exported {0} settings.", String(Object.keys(values).length)));
  }
  const picked = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { JSON: ["json"] }, openLabel: t("Import settings") });
  if (!picked?.[0]) return;
  try {
    const bytes = await vscode.workspace.fs.readFile(picked[0]);
    if (bytes.byteLength > 1_000_000) return report(false, t("This is not a RizomaDB settings file."));
    const { accepted, rejected } = parseImport(Buffer.from(bytes).toString("utf8"), props);
    for (const [key, value] of Object.entries(accepted)) await cfg.update(key, value, vscode.ConfigurationTarget.Global);
    report(rejected.length === 0, rejected.length ? t("Imported {0} settings; skipped {1} that are not valid: {2}", String(Object.keys(accepted).length), String(rejected.length), rejected.slice(0, 3).join(", ")) : t("Imported {0} settings.", String(Object.keys(accepted).length)));
  } catch { report(false, t("This is not a RizomaDB settings file.")); }
}
