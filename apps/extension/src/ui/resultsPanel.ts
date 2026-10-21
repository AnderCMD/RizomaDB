import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { WebviewToHost, type HostToWebview } from "../messages.js";

/** One reusable results tab. The webview only receives validated, string-typed messages. */
export class ResultsPanel {
  private panel: vscode.WebviewPanel | undefined;
  constructor(private ctx: vscode.ExtensionContext, private onMessage: (m: WebviewToHost) => void) {}

  post(m: HostToWebview) {
    this.ensure();
    void this.panel!.webview.postMessage(m);
  }

  private ensure() {
    if (this.panel) { this.panel.reveal(vscode.ViewColumn.Beside, true); return; }
    const root = vscode.Uri.joinPath(this.ctx.extensionUri, "dist");
    const panel = vscode.window.createWebviewPanel("rizomadb.results", "RizomaDB Results", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, {
      enableScripts: true, localResourceRoots: [root], retainContextWhenHidden: true,
    });
    const nonce = randomBytes(16).toString("base64");
    const w = panel.webview;
    w.html = `<!doctype html><html lang="${vscode.env.language}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${w.asWebviewUri(vscode.Uri.joinPath(root, "webview.css"))}"><title>RizomaDB Results</title></head>
<body><header><strong id="title">RizomaDB</strong><span id="status" role="status">${vscode.l10n.t("No results yet")}</span><button id="cancel" hidden>${vscode.l10n.t("Cancel")}</button></header>
<div id="toolbar" hidden role="toolbar" aria-label="${vscode.l10n.t("Edit actions")}"><button id="btn-insert">${vscode.l10n.t("Add row")}</button><button id="btn-delete">${vscode.l10n.t("Delete/restore row")}</button><button id="btn-undo">${vscode.l10n.t("Undo")}</button><button id="btn-redo">${vscode.l10n.t("Redo")}</button><button id="btn-review">${vscode.l10n.t("Review SQL")}</button><button id="btn-apply">${vscode.l10n.t("Apply")}</button><button id="btn-discard">${vscode.l10n.t("Discard")}</button><span id="pending-count" role="status"></span></div>
<div id="error" role="alert" hidden></div>
<div id="grid" role="grid" tabindex="0" aria-label="${vscode.l10n.t("Query results")}"></div>
<div id="live" class="sr-only" aria-live="polite"></div>
<script nonce="${nonce}" src="${w.asWebviewUri(vscode.Uri.joinPath(root, "webview.js"))}"></script></body></html>`;
    w.onDidReceiveMessage((raw: unknown) => {
      const p = WebviewToHost.safeParse(raw);
      if (!p.success) return;
      if (p.data.type === "copy") void vscode.env.clipboard.writeText(p.data.text);
      else this.onMessage(p.data);
    });
    panel.onDidDispose(() => { this.panel = undefined; });
    this.panel = panel;
  }
}
