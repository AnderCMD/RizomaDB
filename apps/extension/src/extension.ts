import * as vscode from "vscode";
import { join } from "node:path";
import { applyChanges, defaultPolicy, EditError, generate, type EditTarget, type Policy, type SecretStore } from "@rizomadb/core";
import type { ColumnInfo, Value } from "@rizomadb/driver-api";
import { ConnectionManager, type DriverRegistry, type TunnelFactory } from "./lib/connections.js";
import { runStatement, type RunEvent } from "./lib/runner.js";
import { History } from "./lib/history.js";
import { splitStatements, statementAt } from "./lib/splitter.js";
import { formatValue } from "./lib/format.js";
import { Explorer, type Node } from "./ui/explorer.js";
import { ResultsPanel } from "./ui/resultsPanel.js";
import { InputError, TableSession } from "./lib/tableSession.js";
import { newConnectionWizard } from "./ui/wizard.js";
import { createWriteStream } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { HostKeyError, formatEntry, openTunnel } from "@rizomadb/network";
import { exportResult, type ExportFormat } from "@rizomadb/data-tools";
import { decide } from "@rizomadb/core";
import { workerDriver } from "./worker/workerDriver.js";

const t = vscode.l10n.t;
const cfg = () => vscode.workspace.getConfiguration("rizomadb");

// Drivers load lazily so activation stays cheap.
function makeRegistry(workerFile: string): DriverRegistry {
  return {
    sqlite: async () => workerDriver((await import("@rizomadb/driver-sqlite/meta")).meta, workerFile),
    postgres: async () => workerDriver((await import("@rizomadb/driver-postgres/meta")).meta, workerFile),
    mysql: async () => workerDriver((await import("@rizomadb/driver-mysql/meta")).meta, workerFile),
    mssql: async () => workerDriver((await import("@rizomadb/driver-mssql/meta")).meta, workerFile),
    oracle: async () => workerDriver((await import("@rizomadb/driver-oracle/meta")).meta, workerFile),
  };
}

function policy(): Policy {
  return { ...defaultPolicy, readOnlyEnvironments: cfg().get<boolean>("security.prodReadOnlyByDefault", true) ? ["prod"] : [] };
}

export async function activate(ctx: vscode.ExtensionContext) {
  const secrets: SecretStore = {
    get: async (k) => ctx.secrets.get(k),
    set: async (k, v) => ctx.secrets.store(k, v),
    delete: async (k) => ctx.secrets.delete(k),
  };
  const knownHostsFile = join(ctx.globalStorageUri.fsPath, "known_hosts");
  const tunnelFactory: TunnelFactory = async (ssh, target) => {
    for (;;) {
      const read = (f: string) => readFile(f, "utf8").catch(() => "");
      const knownHosts = (await read(join(homedir(), ".ssh", "known_hosts"))) + "\n" + (await read(knownHostsFile));
      try {
        return await openTunnel({
          hops: [{ host: ssh.host, port: ssh.port, username: ssh.username, ...(ssh.password !== undefined ? { password: ssh.password } : {}),
            ...(ssh.keyPath ? { privateKey: await readFile(ssh.keyPath) } : {}), ...(ssh.passphrase ? { passphrase: ssh.passphrase } : {}) }],
          target, knownHosts,
        });
      } catch (e) {
        if (!(e instanceof HostKeyError) || e.reason !== "unknown") throw e;
        const ok = await vscode.window.showWarningMessage(
          t("Unknown SSH host key for {0}:{1}", e.host, e.port),
          { modal: true, detail: t("Fingerprint: {0}\nOnly trust it if you verified it with the server owner.", e.fingerprint) }, t("Trust this host"));
        if (!ok) throw e;
        await mkdir(ctx.globalStorageUri.fsPath, { recursive: true });
        await appendFile(knownHostsFile, formatEntry(e.host, e.port, e.keyType, e.key), { mode: 0o600 });
      }
    }
  };
  const mgr = new ConnectionManager(ctx.globalState, secrets, makeRegistry(vscode.Uri.joinPath(ctx.extensionUri, "dist", "driverWorker.cjs").fsPath), policy, process.env, tunnelFactory);
  const history = new History(join(ctx.globalStorageUri.fsPath, "history.jsonl"));
  void history.prune(cfg().get<number>("history.retentionDays", 90));

  const explorer = new Explorer(mgr);
  let running: AbortController | undefined;
  let session: { s: TableSession; profileId: string; refresh: () => Promise<void> } | undefined;
  const results = new ResultsPanel(ctx, (m) => void onWebviewMessage(m));
  const notice = (level: "error" | "info", text: string) => results.post({ v: 1, type: "notice", level, text });
  const pushPending = () => { if (session) results.post({ v: 1, type: "pending", ...session.s.view(), inserts: session.s.view().inserts.map((r) => r.map((x) => ({ set: x !== undefined, text: x ?? null }))) }); };

  async function onWebviewMessage(m: import("./messages.js").WebviewToHost) {
    if (m.type === "cancel") { running?.abort(); return; }
    if (!session) return;
    const cur = session;
    try {
      if (m.type === "edit") cur.s.edit(m.row, m.col, m.text);
      else if (m.type === "toggleDelete") cur.s.toggleDelete(m.row);
      else if (m.type === "insertRow") cur.s.insertRow();
      else if (m.type === "undo") cur.s.pending.undo();
      else if (m.type === "redo") cur.s.pending.redo();
      else if (m.type === "discard") cur.s.pending.clear();
      else if (m.type === "review") { await reviewChanges(); return; }
      else if (m.type === "apply") { await applyPending(); return; }
      notice("info", "");
      pushPending();
    } catch (e) {
      notice("error", e instanceof InputError || e instanceof EditError ? e.message : (e as Error).message);
    }
  }

  const renderStatements = (plugin: Parameters<typeof generate>[0], target: EditTarget, s: TableSession) =>
    s.pending.toChanges().map((c) => { const g = generate(plugin, target, c); return `${g.sql};\n-- params: ${JSON.stringify(g.params, (_, v) => (typeof v === "bigint" ? v.toString() : v instanceof Uint8Array ? "<binary>" : v))}`; }).join("\n\n");

  async function reviewChanges() {
    if (!session) return;
    const p = mgr.get(session.profileId)!; const plugin = await mgr.loadDriver(p.driver);
    const doc = await vscode.workspace.openTextDocument({ language: "sql", content: `-- ${t("Pending changes (not yet applied). Apply them from the results toolbar.")}\n${renderStatements(plugin, session.s.target, session.s)}\n` });
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true });
  }

  async function applyPending() {
    if (!session || session.s.pending.count === 0) return;
    const cur = session;
    const profile = mgr.get(cur.profileId)!; const plugin = await mgr.loadDriver(profile.driver);
    const conn = await mgr.connect(cur.profileId);
    try {
      const r = await applyChanges(cur.s.pending.toChanges(), {
        conn, plugin, target: cur.s.target, environment: profile.environment, readOnly: mgr.isReadOnly(profile), policy: policy(),
        confirm: async (stmts) => {
          const prod = profile.environment === "prod" || profile.environment === "staging";
          const msg = t("[{0}] {1}: apply {2} change(s)?", profile.environment.toUpperCase(), profile.name, stmts.length);
          return (await vscode.window.showWarningMessage(msg, { modal: true, detail: stmts.map((x) => x.sql).join("\n").slice(0, 1500) }, prod ? t("Apply to {0}", profile.environment.toUpperCase()) : t("Apply"))) !== undefined;
        },
      });
      void vscode.window.showInformationMessage(t("{0} change(s) applied in one transaction.", r.applied));
      await history.add({ connectionId: profile.id, connectionName: profile.name, environment: profile.environment, sql: `-- data edit (${r.applied} changes)\n${renderStatements(plugin, cur.s.target, cur.s)}`, durationMs: 0, rowCount: r.applied, status: "ok" }).catch(() => {});
      await cur.refresh();
    } catch (e) {
      if (e instanceof EditError && e.code === "declined") return;
      notice("error", e instanceof EditError ? (e.code === "conflict" ? t("Nothing was applied. {0}", e.message) : e.message) : (e as Error).message);
    }
  }

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

  async function execute(id: string, sql: string, title: string, edit?: { target: EditTarget }) {
    const profile = mgr.get(id);
    if (!profile) return;
    if (running) { void vscode.window.showWarningMessage(t("A query is already running. Cancel it first.")); return; }
    const ac = new AbortController();
    running = ac;
    void vscode.commands.executeCommand("setContext", "rizomadb.running", true);
    cancelItem.show();
    let columnsSeen = false;
    session = undefined;
    const rawRows: Value[][] = []; let cols: ColumnInfo[] = [];
    const emit = (e: RunEvent) => {
      if (e.type === "start") { columnsSeen = true; cols = e.columns; results.post({ v: 1, type: "start", title, sql: e.sql, columns: e.columns, editable: !!edit }); }
      else if (e.type === "rows") { if (edit) rawRows.push(...e.rows); results.post({ v: 1, type: "rows", rows: e.rows.map((r) => r.map(formatValue)) }); }
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
      if (edit && out.status === "ok") {
        const ts = new TableSession(edit.target, cols, rawRows);
        session = { s: ts, profileId: id, refresh: () => execute(id, sql, title, edit) };
        pushPending();
      }
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
    const profile = n.profile;
    const conn = await mgr.connect(profile.id);
    const plugin = await mgr.loadDriver(profile.driver);
    const name = n.schema ? `${conn.quoteIdent(n.schema)}.${conn.quoteIdent(n.name)}` : conn.quoteIdent(n.name);
    let edit: { target: EditTarget } | undefined;
    if (!n.isView && plugin.capabilities.rowEditing === "primaryKey" && !mgr.isReadOnly(profile)) {
      const info = await conn.introspect().describeTable({ name: n.name, ...(n.schema ? { schema: n.schema } : {}) });
      if (info.columns?.some((c) => c.primaryKey)) edit = { target: { ...(n.schema ? { schema: n.schema } : {}), table: n.name, columns: info.columns } };
    }
    await execute(profile.id, plugin.selectTop(name, cfg().get<number>("table.openRows", 200)), n.name, edit);
    if (!edit) notice("info", n.isView ? t("Views are read-only.") : mgr.isReadOnly(profile) ? t("Read-only connection: editing is disabled.") : t("This table has no primary key, so its rows cannot be edited safely."));
  });
  reg("rizomadb.export", async (n?: Node) => {
    let profileId: string | undefined, sql: string | undefined, quoted: string | undefined;
    if (n?.kind === "table") {
      const conn = await mgr.connect(n.profile.id);
      quoted = n.schema ? `${conn.quoteIdent(n.schema)}.${conn.quoteIdent(n.name)}` : conn.quoteIdent(n.name);
      profileId = n.profile.id; sql = `SELECT * FROM ${quoted}`;
    } else {
      const ed = vscode.window.activeTextEditor; if (!ed) return;
      const text = ed.selection.isEmpty ? statementAt(ed.document.getText(), ed.document.offsetAt(ed.selection.active))?.text : ed.document.getText(ed.selection);
      if (!text) return;
      profileId = await bind(ed.document); sql = text;
    }
    if (!profileId || !sql) return;
    const profile = mgr.get(profileId)!;
    const d = decide(sql, { environment: profile.environment, readOnly: true }, policy());
    if (!d.allowed) { void vscode.window.showErrorMessage(t("Only read-only statements can be exported.")); return; }
    const fmt = await vscode.window.showQuickPick(["csv", "tsv", "json", "jsonl", "sql", "markdown"].map((label) => ({ label })), { title: t("Export format") });
    if (!fmt) return;
    const uri = await vscode.window.showSaveDialog({ saveLabel: t("Export"), defaultUri: vscode.Uri.file(join(homedir(), `export.${fmt.label === "markdown" ? "md" : fmt.label}`)) });
    if (!uri) return;
    const plugin = await mgr.loadDriver(profile.driver);
    const conn = await mgr.connect(profileId);
    const ac = new AbortController();
    try {
      const r = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t("Exporting…"), cancellable: true }, (progress, token) => {
        token.onCancellationRequested(() => ac.abort());
        let last = 0;
        return exportResult(conn.execute({ sql: sql!, batchSize: 2000 }, ac.signal), createWriteStream(uri.fsPath, { mode: 0o600 }), {
          format: fmt.label as ExportFormat, signal: ac.signal,
          ...(fmt.label === "sql" ? { sql: { table: quoted ?? plugin.quoteIdent("exported"), quoteIdent: plugin.quoteIdent } } : {}),
          onProgress: (rows) => { progress.report({ message: t("{0} rows", rows), increment: 0 }); last = rows; void last; },
        });
      });
      void vscode.window.showInformationMessage(t("Exported {0} rows to {1}", r.rows, uri.fsPath));
    } catch (e) {
      if ((e as Error).name !== "AbortError") void vscode.window.showErrorMessage(t("Export failed: {0}", (e as Error).message));
    }
  });
  reg("rizomadb.reviewPendingChanges", () => reviewChanges());
  reg("rizomadb.applyChanges", () => applyPending());
  reg("rizomadb.discardChanges", () => { session?.s.pending.clear(); pushPending(); });
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
