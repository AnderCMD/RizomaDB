import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { t, effectiveLanguage } from "../i18n.js";
import { i18nBlock } from "./webviewStrings.js";
import { WebviewToHost, type HostToWebview } from "../messages.js";

const EXT = { csv: "csv", tsv: "tsv", json: "json", md: "md" } as const;
export type ResultsLocation = "bottom" | "full" | "beside";

/** One reusable results tab. The webview only receives validated, string-typed messages. */
export class ResultsPanel {
  private panel: vscode.WebviewPanel | undefined;
  /** Messages are delivered in order even while the panel (and its editor group) is still being created. */
  private chain: Promise<void> = Promise.resolve();
  constructor(private ctx: vscode.ExtensionContext, private onMessage: (m: WebviewToHost) => void) {}

  /** Detaches the current tab so it keeps its results; the next query opens a fresh tab. */
  pin(): boolean {
    if (!this.panel) return false;
    this.panel.title = `${this.panel.title} 📌`;
    this.panel = undefined;
    return true;
  }

  post(m: HostToWebview) {
    this.chain = this.chain.then(async () => { const p = await this.ensure(); await p.webview.postMessage(m); }).catch(() => {});
  }

  /** Names the editor tab after what it shows (connection.table) and gives it the engine's logo. */
  describe(title: string, icon?: { light: vscode.Uri; dark: vscode.Uri }) {
    this.chain = this.chain.then(async () => { const p = await this.ensure(); p.title = title; if (icon) p.iconPath = icon; }).catch(() => {});
  }

  private location(): ResultsLocation {
    const v = vscode.workspace.getConfiguration("rizomadb").get<string>("results.location", "bottom");
    return v === "full" || v === "beside" ? v : "bottom";
  }

  private async ensure(): Promise<vscode.WebviewPanel> {
    if (this.panel) { this.panel.reveal(this.panel.viewColumn, true); return this.panel; }
    const loc = this.location();
    let column: vscode.ViewColumn = vscode.ViewColumn.Beside;
    if (loc === "full") column = vscode.ViewColumn.Active;
    else if (loc === "bottom" && vscode.window.tabGroups.all.length === 1) {
      // One editor group only: open an empty one under it so the query stays on top and the results take the lower half.
      const before = vscode.window.activeTextEditor;
      await vscode.commands.executeCommand("workbench.action.newGroupBelow");
      column = vscode.ViewColumn.Active;
      void before;
    }
    const root = vscode.Uri.joinPath(this.ctx.extensionUri, "dist");
    const panel = vscode.window.createWebviewPanel("rizomadb.results", t("RizomaDB Results"), { viewColumn: column, preserveFocus: loc !== "full" }, {
      enableScripts: true, localResourceRoots: [root], retainContextWhenHidden: true,
    });
    const nonce = randomBytes(16).toString("base64");
    const w = panel.webview;
    w.html = `<!doctype html><html lang="${effectiveLanguage()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${w.asWebviewUri(vscode.Uri.joinPath(root, "webview.css"))}"><title>${t("RizomaDB Results")}</title></head>
<body class="results"><div id="app"></div>
${i18nBlock()}
<script nonce="${nonce}" src="${w.asWebviewUri(vscode.Uri.joinPath(root, "webview.js"))}"></script></body></html>`;
    w.onDidReceiveMessage((raw: unknown) => {
      const p = WebviewToHost.safeParse(raw);
      if (!p.success) return;
      if (p.data.type === "copy") void vscode.env.clipboard.writeText(p.data.text);
      else if (p.data.type === "save") void saveResults(p.data.format, p.data.text);
      else this.onMessage(p.data);
    });
    panel.onDidDispose(() => { if (this.panel === panel) this.panel = undefined; });
    this.panel = panel;
    return panel;
  }
}

async function saveResults(format: keyof typeof EXT, text: string) {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const uri = await vscode.window.showSaveDialog({ title: t("Save results"), filters: { [format.toUpperCase()]: [EXT[format]] }, ...(folder ? { defaultUri: vscode.Uri.joinPath(folder.uri, `results.${EXT[format]}`) } : {}) });
  if (!uri) return;
  await vscode.workspace.fs.writeFile(uri, Buffer.from(text, "utf8"));
  void vscode.window.showInformationMessage(t("Saved {0}", uri.fsPath));
}
