import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { i18nBlock } from "./webviewStrings.js";
import { slowNodes, type Plan, type PlanNode } from "@rizomadb/sql";

export class PlanPanel {
  private panel: vscode.WebviewPanel | undefined;
  constructor(private ctx: vscode.ExtensionContext) {}

  show(title: string, plan: Plan) {
    const slow = new Set(slowNodes(plan));
    const mark = (n: PlanNode): PlanNode & { slow?: boolean } => ({ ...n, ...(slow.has(n) ? { slow: true } : {}), children: n.children.map(mark) });
    if (!this.panel) {
      const root = vscode.Uri.joinPath(this.ctx.extensionUri, "dist");
      const p = vscode.window.createWebviewPanel("rizomadb.plan", "Query Plan", vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [root] });
      const nonce = randomBytes(16).toString("base64"), w = p.webview;
      w.html = `<!doctype html><html lang="${vscode.env.language}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${w.asWebviewUri(vscode.Uri.joinPath(root, "webview.css"))}"><title>Query Plan</title></head>
<body><header><h1 id="title">Plan</h1><span id="summary" role="status"></span></header>
<main><ul id="tree" role="tree" aria-label="${vscode.l10n.t("Execution plan")}"></ul>
<details><summary>${vscode.l10n.t("Raw plan")}</summary><pre id="raw"></pre></details></main>
${i18nBlock()}<script nonce="${nonce}" src="${w.asWebviewUri(vscode.Uri.joinPath(root, "plan.js"))}"></script></body></html>`;
      p.onDidDispose(() => { this.panel = undefined; });
      this.panel = p;
    }
    this.panel.reveal(vscode.ViewColumn.Beside, true);
    void this.panel.webview.postMessage({ v: 1, type: "plan", title, analyzed: plan.analyzed, totalCost: plan.totalCost, executionMs: plan.executionMs, root: plan.root.map(mark), raw: plan.raw });
  }
}
