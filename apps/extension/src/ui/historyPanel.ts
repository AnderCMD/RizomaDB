import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { t, effectiveLanguage } from "../i18n.js";
import { i18nBlock } from "./webviewStrings.js";
import { HistoryToHost } from "../historyMessages.js";
import type { History, HistoryEntry } from "../lib/history.js";

let current: vscode.WebviewPanel | undefined;

/** The query history as a screen: search, status filter, and open / run again / copy per entry. */
export function openHistoryScreen(
  ctx: vscode.ExtensionContext, history: History,
  deps: { exists: (connectionId: string) => boolean; run: (connectionId: string, sql: string) => Promise<unknown>; open: (connectionId: string, sql: string) => Promise<void>; clear: () => Promise<boolean> },
) {
  if (current) { current.reveal(); return; }
  const root = vscode.Uri.joinPath(ctx.extensionUri, "dist");
  const panel = vscode.window.createWebviewPanel("rizomadb.history", t("Query history"), vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [root] });
  current = panel; panel.onDidDispose(() => { current = undefined; });
  panel.iconPath = vscode.Uri.joinPath(ctx.extensionUri, "media", "icon.png");
  const nonce = randomBytes(16).toString("base64"), w = panel.webview;
  w.html = `<!doctype html><html lang="${effectiveLanguage()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${w.asWebviewUri(vscode.Uri.joinPath(root, "webview.css"))}"><title>${t("Query history")}</title></head>
<body><div id="app"></div>${i18nBlock()}<script nonce="${nonce}" src="${w.asWebviewUri(vscode.Uri.joinPath(root, "history.js"))}"></script></body></html>`;

  let entries: HistoryEntry[] = [];
  const load = async () => {
    entries = await history.list({ limit: 1000 });
    void w.postMessage({ v: 1, type: "load", items: entries.map((e, i) => ({ i, ts: e.ts, connectionName: e.connectionName, environment: e.environment, status: e.status, durationMs: e.durationMs, rowCount: e.rowCount, sql: e.sql, ...(e.error ? { error: e.error } : {}), canRun: deps.exists(e.connectionId) })) });
  };
  w.onDidReceiveMessage(async (raw: unknown) => {
    const p = HistoryToHost.safeParse(raw); if (!p.success) return;
    const m = p.data;
    if (m.type === "ready") { await load(); return; }
    if (m.type === "clear") { if (await deps.clear()) await load(); return; }
    const e = entries[m.i]; if (!e) return;
    if (m.type === "copy") await vscode.env.clipboard.writeText(e.sql);
    else if (m.type === "open") await deps.open(e.connectionId, e.sql);
    else await deps.run(e.connectionId, e.sql);
  });
}
