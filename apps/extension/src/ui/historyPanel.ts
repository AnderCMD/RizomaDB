import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { t, effectiveLanguage } from "../i18n.js";
import { i18nBlock } from "./webviewStrings.js";
import { HistoryToHost } from "../historyMessages.js";
import type { History, HistoryEntry } from "../lib/history.js";
import { Favorites } from "../lib/favorites.js";

let current: vscode.WebviewPanel | undefined;

/** The query history as a screen: search, status filter, and open / run again / copy per entry. */
export function openHistoryScreen(
  ctx: vscode.ExtensionContext, history: History, favorites: Favorites,
  deps: { exists: (connectionId: string) => boolean; run: (connectionId: string, sql: string) => Promise<unknown>; open: (connectionId: string, sql: string) => Promise<void>; clear: () => Promise<boolean> },
) {
  if (current) { current.reveal(); return; }
  const root = vscode.Uri.joinPath(ctx.extensionUri, "dist");
  const panel = vscode.window.createWebviewPanel("rizomadb.history", t("Query history"), vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [root] });
  current = panel; panel.onDidDispose(() => { current = undefined; });
  panel.iconPath = vscode.Uri.joinPath(ctx.extensionUri, "media", "icon.png");
  const nonce = randomBytes(16).toString("base64"), w = panel.webview;
  w.html = `<!doctype html><html lang="${effectiveLanguage()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${w.asWebviewUri(vscode.Uri.joinPath(root, "webview.css"))}"><title>${t("Query history")}</title></head>
<body><div id="app"></div>${i18nBlock()}<script nonce="${nonce}" src="${w.asWebviewUri(vscode.Uri.joinPath(root, "history.js"))}"></script></body></html>`;

  // Starred queries that are no longer in the history (cleared or pruned) are listed too, as "saved".
  let entries: HistoryEntry[] = [];
  const load = async () => {
    const [past, stars] = await Promise.all([history.list({ limit: 1000 }), favorites.list()]);
    const starred = new Set(stars.map((f) => f.id));
    const inHistory = new Set(past.map((e) => Favorites.idOf(e.connectionId, e.sql)));
    entries = [...past, ...stars.filter((f) => !inHistory.has(f.id)).map((f): HistoryEntry => ({ ts: f.addedAt, connectionId: f.connectionId, connectionName: f.connectionName, environment: f.environment, sql: f.sql, durationMs: 0, rowCount: 0, status: "saved" as unknown as HistoryEntry["status"] }))];
    void w.postMessage({ v: 1, type: "load", items: entries.map((e, i) => ({ i, ts: e.ts, connectionName: e.connectionName, environment: e.environment, status: e.status, durationMs: e.durationMs, rowCount: e.rowCount, sql: e.sql, ...(e.error ? { error: e.error } : {}), canRun: deps.exists(e.connectionId), starred: starred.has(Favorites.idOf(e.connectionId, e.sql)) })) });
  };
  w.onDidReceiveMessage(async (raw: unknown) => {
    const p = HistoryToHost.safeParse(raw); if (!p.success) return;
    const m = p.data;
    if (m.type === "ready") { await load(); return; }
    if (m.type === "clear") { if (await deps.clear()) await load(); return; }
    const e = entries[m.i]; if (!e) return;
    if (m.type === "copy") await vscode.env.clipboard.writeText(e.sql);
    else if (m.type === "star") { await favorites.toggle({ connectionId: e.connectionId, connectionName: e.connectionName, environment: e.environment, sql: e.sql }); await load(); }
    else if (m.type === "open") await deps.open(e.connectionId, e.sql);
    else await deps.run(e.connectionId, e.sql);
  });
}
