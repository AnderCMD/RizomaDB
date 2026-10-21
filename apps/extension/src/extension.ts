import * as vscode from "vscode";
import { join } from "node:path";
import { defaultPolicy, type Policy, type SecretStore } from "@rizomadb/core";
import { ConnectionManager, type DriverRegistry } from "./lib/connections.js";
import { runStatement, type RunEvent } from "./lib/runner.js";
import { History } from "./lib/history.js";
import { splitStatements, statementAt } from "./lib/splitter.js";
import { formatValue } from "./lib/format.js";
import { Explorer, type Node } from "./ui/explorer.js";
import { ResultsPanel } from "./ui/resultsPanel.js";
import { newConnectionWizard } from "./ui/wizard.js";

const t = vscode.l10n.t;
const cfg = () => vscode.workspace.getConfiguration("rizomadb");

// Drivers load lazily so activation stays cheap.
const registry: DriverRegistry = {
  sqlite: async () => (await import("@rizomadb/driver-sqlite")).sqliteDriver,
  postgres: async () => (await import("@rizomadb/driver-postgres")).postgresDriver,
};

function policy(): Policy {
  return { ...defaultPolicy, readOnlyEnvironments: cfg().get<boolean>("security.prodReadOnlyByDefault", true) ? ["prod"] : [] };
}

export async function activate(ctx: vscode.ExtensionContext) {
  const secrets: SecretStore = {
    get: async (k) => ctx.secrets.get(k),
    set: async (k, v) => ctx.secrets.store(k, v),
    delete: async (k) => ctx.secrets.delete(k),
  };
  const mgr = new ConnectionManager(ctx.globalState, secrets, registry, policy);
  const history = new History(join(ctx.globalStorageUri.fsPath, "history.jsonl"));
  void history.prune(cfg().get<number>("history.retentionDays", 90));

  const explorer = new Explorer(mgr);
  let running: AbortController | undefined;
  const results = new ResultsPanel(ctx, () => running?.abort());

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.command = "rizomadb.selectConnection";
  const cancelItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 49);
  cancelItem.command = "rizomadb.cancelQuery";
  cancelItem.text = `$(sync~spin) ${t("Running… click to cancel")}`;

  const docConn = (d: vscode.TextDocument) => ctx.workspaceState.get<string>(`doc:${d.uri.toString()}`);
  const refreshStatus = () => {
    const ed = vscode.window.activeTextEditor;
    const p = ed && ed.document.languageId === "sql" ? mgr.get(docConn(ed.document) ?? "") : undefined;
    if (!ed || ed.document.languageId !== "sql") { status.hide(); return; }
    status.text = p ? `$(database) [${p.environment.toUpperCase()}] ${p.name}${mgr.isReadOnly(p) ? " 🔒" : ""}` : `$(database) ${t("No connection")}`;
    status.tooltip = t("Select connection for this editor");
    status.show();
  };

  async function pickConnection(): Promise<string | undefined> {
    const list = mgr.list();
    if (!list.length) { return newConnectionWizard(mgr); }
    const pick = await vscode.window.showQuickPick(
      [...list.map((p) => ({ label: p.name, description: `[${p.environment}] ${p.driver}`, id: p.id })), { label: `$(add) ${t("New connection…")}`, id: "" }],
      { title: t("Select connection") });
    if (!pick) return;
    return pick.id || newConnectionWizard(mgr);
  }

  async function bind(doc: vscode.TextDocument): Promise<string | undefined> {
    let id = docConn(doc);
    if (!id || !mgr.get(id)) {
      id = await pickConnection();
      if (!id) return;
      await ctx.workspaceState.update(`doc:${doc.uri.toString()}`, id);
      refreshStatus();
    }
    return id;
  }

  async function execute(id: string, sql: string, title: string) {
    const profile = mgr.get(id);
    if (!profile) return;
    if (running) { void vscode.window.showWarningMessage(t("A query is already running. Cancel it first.")); return; }
    const ac = new AbortController();
    running = ac;
    void vscode.commands.executeCommand("setContext", "rizomadb.running", true);
    cancelItem.show();
    let columnsSeen = false;
    const emit = (e: RunEvent) => {
      if (e.type === "start") { columnsSeen = true; results.post({ v: 1, type: "start", title, sql: e.sql, columns: e.columns }); }
      else if (e.type === "rows") results.post({ v: 1, type: "rows", rows: e.rows.map((r) => r.map(formatValue)) });
      else if (e.type === "done") {
        if (!columnsSeen) results.post({ v: 1, type: "start", title, sql: "", columns: [] });
        results.post({ v: 1, ...e });
      } else {
        if (!columnsSeen) results.post({ v: 1, type: "start", title, sql: "", columns: [] });
        results.post({ v: 1, type: "error", kind: e.kind, message: e.message, ...(e.position !== undefined ? { position: e.position } : {}) });
      }
    };
    try {
      const conn = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: t("Connecting…") }, () => mgr.connect(id));
      const timeout = cfg().get<number>("query.timeoutSeconds", 0);
      const out = await runStatement({
        conn, profile, sql, signal: ac.signal, policy: policy(), readOnly: mgr.isReadOnly(profile),
        maxRows: cfg().get<number>("query.maxRows", 10000), ...(timeout > 0 ? { timeoutMs: timeout * 1000 } : {}),
        confirmDestructive: cfg().get<boolean>("security.confirmDestructive", true),
        confirm: async (reason) => (await vscode.window.showWarningMessage(
          t("[{0}] {1}: {2}", profile.environment.toUpperCase(), profile.name, reason), { modal: true, detail: sql.slice(0, 500) }, t("Run anyway"))) === t("Run anyway"),
        onEvent: emit,
      });
      if (cfg().get<boolean>("history.enabled", true)) {
        await history.add({ connectionId: id, connectionName: profile.name, environment: profile.environment, sql, durationMs: Math.round(out.durationMs), rowCount: out.rowCount, status: out.status, ...(out.error ? { error: out.error } : {}) });
      }
    } catch (e) {
      emit({ type: "error", kind: "connection", message: (e as Error).message });
      void mgr.disconnect(id);
    } finally {
      running = undefined; cancelItem.hide();
      void vscode.commands.executeCommand("setContext", "rizomadb.running", false);
    }
  }

  const editorDoc = () => vscode.window.activeTextEditor?.document;
  const reg = (id: string, fn: (...a: never[]) => unknown) => ctx.subscriptions.push(vscode.commands.registerCommand(id, fn as never));

  reg("rizomadb.newConnection", async () => { await newConnectionWizard(mgr); });
  reg("rizomadb.newQuery", async (n?: Node) => {
    const doc = await vscode.workspace.openTextDocument({ language: "sql", content: "" });
    await vscode.window.showTextDocument(doc);
    const id = n?.kind === "connection" ? n.profile.id : await pickConnection();
    if (id) await ctx.workspaceState.update(`doc:${doc.uri.toString()}`, id);
    refreshStatus();
  });
  reg("rizomadb.selectConnection", async () => {
    const d = editorDoc(); if (!d) return;
    const id = await pickConnection();
    if (id) { await ctx.workspaceState.update(`doc:${d.uri.toString()}`, id); refreshStatus(); }
  });
  reg("rizomadb.runQuery", async () => {
    const ed = vscode.window.activeTextEditor; if (!ed) return;
    const sel = ed.selection;
    const text = sel.isEmpty ? statementAt(ed.document.getText(), ed.document.offsetAt(sel.active))?.text : ed.document.getText(sel);
    if (!text?.trim()) { void vscode.window.showInformationMessage(t("Nothing to run.")); return; }
    const id = await bind(ed.document); if (id) await execute(id, text, t("Query"));
  });
  reg("rizomadb.runSelection", async () => {
    const ed = vscode.window.activeTextEditor; if (!ed) return;
    const text = ed.selection.isEmpty ? ed.document.getText() : ed.document.getText(ed.selection);
    const stmts = splitStatements(text);
    const id = await bind(ed.document); if (!id) return;
    for (const s of stmts) { await execute(id, s.text, t("Query")); }
  });
  reg("rizomadb.cancelQuery", () => running?.abort());
  reg("rizomadb.openTable", async (n: Node) => {
    if (n.kind !== "table") return;
    const conn = await mgr.connect(n.profile.id);
    const q = conn.quoteIdent;
    const name = n.schema ? `${q(n.schema)}.${q(n.name)}` : q(n.name);
    await execute(n.profile.id, `SELECT * FROM ${name} LIMIT 100`, n.name);
  });
  reg("rizomadb.toggleReadOnly", async (n: Node) => {
    if (n.kind !== "connection") return;
    await mgr.update(n.profile.id, { readOnly: !n.profile.readOnly });
  });
  reg("rizomadb.disconnect", (n: Node) => { if (n.kind === "connection") return mgr.disconnect(n.profile.id); });
  reg("rizomadb.deleteConnection", async (n: Node) => {
    if (n.kind !== "connection") return;
    const ok = await vscode.window.showWarningMessage(t("Delete connection '{0}'? Stored secrets are removed too.", n.profile.name), { modal: true }, t("Delete"));
    if (ok) await mgr.remove(n.profile.id);
  });
  reg("rizomadb.refresh", () => explorer.refresh());
  reg("rizomadb.openHistory", async () => {
    const items = await history.list({ limit: 200 });
    const pick = await vscode.window.showQuickPick(items.map((e) => ({
      label: e.sql.replace(/\s+/g, " ").slice(0, 100), description: `${e.status} · ${e.rowCount} rows · ${e.durationMs} ms`,
      detail: `${e.ts} · [${e.environment}] ${e.connectionName}`, sql: e.sql,
    })), { title: t("Query history"), matchOnDetail: true });
    if (pick) await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ language: "sql", content: pick.sql }));
  });

  ctx.subscriptions.push(
    vscode.window.registerTreeDataProvider("rizomadb.connections", explorer),
    vscode.window.onDidChangeActiveTextEditor(refreshStatus),
    mgr.onChange(refreshStatus), status, cancelItem,
    vscode.languages.registerCodeLensProvider({ language: "sql" }, {
      provideCodeLenses(doc) {
        const p = mgr.get(docConn(doc) ?? "");
        const r = new vscode.Range(0, 0, 0, 0);
        return [
          new vscode.CodeLens(r, { title: p ? `$(database) [${p.environment}] ${p.name}` : `$(database) ${t("Select connection")}`, command: "rizomadb.selectConnection" }),
          new vscode.CodeLens(r, { title: `$(play) ${t("Run")}`, command: "rizomadb.runQuery" }),
        ];
      },
    }),
    { dispose: () => void mgr.disposeAll() },
  );
  refreshStatus();
}

export function deactivate() {}
