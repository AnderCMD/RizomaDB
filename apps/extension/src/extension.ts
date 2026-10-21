import * as vscode from "vscode";
import { join } from "node:path";
import { applyChanges, AuditLog, decideEffective, defaultEffectivePolicy, EditError, featureEnabled, generate, type EditTarget, type EffectivePolicy, type SecretStore } from "@rizomadb/core";
import { loadPolicy } from "./lib/policyFiles.js";
import { loadCatalog } from "./lib/catalog.js";
import type { ColumnInfo, Value } from "@rizomadb/driver-api";
import { ConnectionManager, type DriverRegistry, type TunnelFactory } from "./lib/connections.js";
import { runStatement, type RunEvent } from "./lib/runner.js";
import { History } from "./lib/history.js";
import { splitStatements, statementAt } from "./lib/splitter.js";
import { commandAt, isQueryLanguage } from "./lib/commandAt.js";
import { formatValue } from "./lib/format.js";
import { Explorer, type Node } from "./ui/explorer.js";
import { ResultsPanel } from "./ui/resultsPanel.js";
import { InputError, TableSession } from "./lib/tableSession.js";
import { newConnectionWizard } from "./ui/wizard.js";
import { registerLanguage } from "./ui/language.js";
import { PlanPanel } from "./ui/planPanel.js";
import { registerNotebooks } from "./ui/notebook.js";
import { showEr } from "./ui/erPanel.js";
import { openDesigner } from "./ui/designerPanel.js";
import { loadModel, missingFkIndexes, describeChanges } from "./lib/schemaModel.js";
import { diffModels, migrationStatements, toHtml, toMarkdown, toMigration, createIndex, renderScript, type MigrationFormat, type SchemaModel } from "@rizomadb/schema-tools";
import { writeFile } from "node:fs/promises";
import { registerDataCommands } from "./ui/dataCommands.js";
import { registerNoSqlCommands } from "./ui/nosqlCommands.js";
import { registerAdminCommands } from "./ui/adminCommands.js";
import { registerAiCommands } from "./ui/aiCommands.js";
import { registerMcpProvider } from "./ui/mcpProvider.js";
import { registerImportWizard } from "./ui/importWizard.js";
import { SchemaCache, DIALECT_OF } from "./lib/schemaCache.js";
import { bindParameters, explain, findParameters } from "@rizomadb/sql";
import { createWriteStream } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { HostKeyError, formatEntry, openTunnel } from "@rizomadb/network";
import { exportResult, maskFor, type ExportFormat } from "@rizomadb/data-tools";
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
    mongodb: async () => workerDriver((await import("@rizomadb/driver-mongodb/meta")).meta, workerFile),
    redis: async () => workerDriver((await import("@rizomadb/driver-redis/meta")).meta, workerFile),
    clickhouse: async () => workerDriver((await import("@rizomadb/driver-clickhouse/meta")).meta, workerFile),
    elasticsearch: async () => workerDriver((await import("@rizomadb/driver-elasticsearch/meta")).meta, workerFile),
    influxdb3: async () => workerDriver((await import("@rizomadb/driver-influxdb3/meta")).meta, workerFile),
    trino: async () => workerDriver((await import("@rizomadb/driver-trino/meta")).meta, workerFile),
    firestore: async () => workerDriver((await import("@rizomadb/driver-firestore/meta")).meta, workerFile),
    cassandra: async () => workerDriver((await import("@rizomadb/driver-cassandra/meta")).meta, workerFile),
    influxdb: async () => workerDriver((await import("@rizomadb/driver-influxdb/meta")).meta, workerFile),
    dynamodb: async () => workerDriver((await import("@rizomadb/driver-dynamodb/meta")).meta, workerFile),
    neo4j: async () => workerDriver((await import("@rizomadb/driver-neo4j/meta")).meta, workerFile),
    duckdb: async () => workerDriver((await import("@rizomadb/driver-duckdb/meta")).meta, workerFile),
  };
}

export async function activate(ctx: vscode.ExtensionContext) {
  const secrets: SecretStore = {
    get: async (k) => ctx.secrets.get(k),
    set: async (k, v) => ctx.secrets.store(k, v),
    delete: async (k) => ctx.secrets.delete(k),
  };
  // ---- policy: built-in < team settings < project file (trusted workspaces only) < user file; the strictest layer always wins ----
  let effective: EffectivePolicy = defaultEffectivePolicy;
  const policy = () => effective;
  const policyOutput = vscode.window.createOutputChannel("RizomaDB policy");
  const reloadPolicy = async () => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const files = [
      ...(vscode.workspace.isTrusted ? folders.map((f) => ({ label: `project ${f.name}`, path: join(f.uri.fsPath, ".rizomadb", "policy.json") })) : []),
      { label: "user", path: join(ctx.globalStorageUri.fsPath, "policy.json") },
    ];
    const r = await loadPolicy({ builtinProdReadOnly: cfg().get<boolean>("security.prodReadOnlyByDefault", true), files, inline: [{ label: "team (settings)", value: cfg().get("policy.team") }] });
    effective = r.policy;
    policyOutput.clear();
    policyOutput.appendLine(r.loaded.length ? `Policy layers loaded: ${r.loaded.join(", ")}` : "Policy: built-in defaults only.");
    if (!vscode.workspace.isTrusted && folders.length) policyOutput.appendLine("Workspace is not trusted: project policy and catalog are not loaded.");
    for (const e of r.errors) policyOutput.appendLine(`ERROR ${e}`);
    if (r.errors.length) void vscode.window.showErrorMessage(t("RizomaDB policy has errors, so writes are blocked until it is fixed (see the 'RizomaDB policy' output)."), t("Show")).then((a) => { if (a) policyOutput.show(); });
  };
  await reloadPolicy();
  const audit = new AuditLog({ file: cfg().get<string>("audit.path") || join(ctx.globalStorageUri.fsPath, "audit.jsonl"), includeValues: cfg().get<boolean>("audit.includeValues", false) });
  pendingAudit = audit;
  const approve = async (name: string, reason: string, statement: string) => {
    const typed = await vscode.window.showInputBox({ title: t("Approval required on {0}", name), prompt: t("{0}\n\n{1}\n\nType the connection name to approve.", reason, statement.slice(0, 300)), ignoreFocusOut: true });
    return typed?.trim() === name;
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
  const mgr = new ConnectionManager(ctx.globalState, secrets, makeRegistry(vscode.Uri.joinPath(ctx.extensionUri, "dist", "driverWorker.cjs").fsPath), policy, process.env, tunnelFactory, { ...(cfg().get<boolean>("audit.enabled", true) ? { audit } : {}), approve,
    promptSecret: async (p, key) => vscode.window.showInputBox({ title: t("{0}: {1}", p.name, key), prompt: t("This shared connection does not store secrets. Your answer stays in your own secure storage."), password: /pass|secret|token|key/i.test(key), ignoreFocusOut: true }) });
  const reloadCatalog = async () => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const team = cfg().get<string>("catalog.teamFile");
    const files = [...(team ? [{ source: "team", path: team }] : []), ...(vscode.workspace.isTrusted ? folders.map((f) => ({ source: `project ${f.name}`, path: join(f.uri.fsPath, ".rizomadb", "connections.json") })) : [])];
    const r = await loadCatalog(files);
    mgr.setCatalog(r.connections);
    for (const e of r.errors) policyOutput.appendLine(`CATALOG ${e}`);
    if (r.errors.length) void vscode.window.showWarningMessage(t("Some shared connections were not loaded (see the 'RizomaDB policy' output)."), t("Show")).then((a) => { if (a) policyOutput.show(); });
  };
  await reloadCatalog();
  ctx.subscriptions.push(watcher2(reloadCatalog));
  function watcher2(fn: () => Promise<void>) { const w = vscode.workspace.createFileSystemWatcher("**/.rizomadb/connections.json"); w.onDidChange(() => void fn()); w.onDidCreate(() => void fn()); w.onDidDelete(() => void fn()); vscode.workspace.onDidGrantWorkspaceTrust(() => void fn()); return w; }
  const watcher = vscode.workspace.createFileSystemWatcher("**/.rizomadb/{policy,connections}.json");
  ctx.subscriptions.push(watcher, watcher.onDidChange(() => void reloadPolicy()), watcher.onDidCreate(() => void reloadPolicy()), watcher.onDidDelete(() => void reloadPolicy()),
    vscode.workspace.onDidGrantWorkspaceTrust(() => void reloadPolicy()), vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration("rizomadb.security") || e.affectsConfiguration("rizomadb.policy")) void reloadPolicy(); }));
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
  const schemaCache = new SchemaCache(mgr);
  const planPanel = new PlanPanel(ctx);
  const lang = registerLanguage(ctx, mgr, schemaCache, docConn);
  registerNotebooks(ctx, mgr, policy, cfg, () => pickConnection());
  const refreshStatus = () => {
    const ed = vscode.window.activeTextEditor;
    const p = ed && isQueryLanguage(ed.document.languageId) ? mgr.get(docConn(ed.document) ?? "") : undefined;
    if (!ed || !isQueryLanguage(ed.document.languageId)) { status.hide(); return; }
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

  async function execute(id: string, sql: string, title: string, edit?: { target: EditTarget }, params?: Value[]) {
    const profile = mgr.get(id);
    if (!profile) return;
    if (running) { void vscode.window.showWarningMessage(t("A query is already running. Cancel it first.")); return; }
    const ac = new AbortController();
    running = ac;
    void vscode.commands.executeCommand("setContext", "rizomadb.running", true);
    cancelItem.show();
    let columnsSeen = false;
    session = undefined;
    let mask: ((r: Value[]) => Value[]) | undefined;
    const rawRows: Value[][] = []; let cols: ColumnInfo[] = [];
    const emit = (e: RunEvent) => {
      if (e.type === "start") { columnsSeen = true; cols = e.columns; mask = maskFor(policy().maskColumns, e.columns.map((c) => c.name)); if (mask) edit = undefined; results.post({ v: 1, type: "start", title, sql: e.sql, columns: e.columns, editable: !!edit }); }
      else if (e.type === "rows") { const shown = mask ? e.rows.map(mask) : e.rows; if (edit) rawRows.push(...e.rows); results.post({ v: 1, type: "rows", rows: shown.map((r) => r.map(formatValue)) }); }
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
      const drv = await mgr.loadDriver(profile.driver);
      const timeout = cfg().get<number>("query.timeoutSeconds", 0);
      const out = await runStatement({
        conn, profile, sql, ...(params ? { params } : {}), ...(drv.assess ? { assess: drv.assess } : {}), signal: ac.signal, policy: policy(), readOnly: mgr.isReadOnly(profile),
        maxRows: cfg().get<number>("query.maxRows", 10000), ...(timeout > 0 ? { timeoutMs: timeout * 1000 } : {}),
        confirmDestructive: cfg().get<boolean>("security.confirmDestructive", true),
        confirm: async (reason) => (await vscode.window.showWarningMessage(
          t("[{0}] {1}: {2}", profile.environment.toUpperCase(), profile.name, reason), { modal: true, detail: sql.slice(0, 500) }, t("Run anyway"))) === t("Run anyway"),
        onEvent: emit,
      });
      if (out.status === "ok" && /^\s*(create|alter|drop|rename|truncate)\b/i.test(sql)) { schemaCache.invalidate(id); lang.refreshAll(); void vscode.commands.executeCommand("rizomadb.refresh"); }
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

  /** Replaces :name / $1 / @name / ? placeholders with the driver's positional binds after asking for values. */
  async function promptParameters(id: string, sql: string): Promise<{ sql: string; params?: Value[] } | undefined> {
    const profile = mgr.get(id); if (!profile) return { sql };
    const dialect = DIALECT_OF[profile.driver] ?? "ansi";
    const found = findParameters(sql, dialect);
    if (!found.length) return { sql };
    const plugin = await mgr.loadDriver(profile.driver);
    const values: Record<string, Value> = {};
    for (const p of found) {
      const key = `param:${profile.id}:${p.name}`;
      const raw = await vscode.window.showInputBox({ title: t("Parameter {0}", p.style === "positional" ? `#${p.name}` : p.name), prompt: t("Value (null, true/false, numbers and \"quoted text\" are typed; anything else is text)"), value: ctx.workspaceState.get<string>(key) ?? "", ignoreFocusOut: true });
      if (raw === undefined) return undefined;
      await ctx.workspaceState.update(key, raw);
      values[p.name] = parseParam(raw);
    }
    const b = bindParameters(sql, dialect, values, plugin.placeholder);
    return { sql: b.sql, params: b.params };
  }
  const parseParam = (raw: string): Value => {
    const s = raw.trim();
    if (/^null$/i.test(s)) return null;
    if (/^(true|false)$/i.test(s)) return s.toLowerCase() === "true";
    if (/^-?\d+$/.test(s)) { const b = BigInt(s); return b > BigInt(Number.MAX_SAFE_INTEGER) || b < BigInt(Number.MIN_SAFE_INTEGER) ? b : Number(b); }
    if (/^-?\d*\.\d+$/.test(s)) return Number(s);
    return /^".*"$/s.test(s) ? s.slice(1, -1) : raw;
  };
  const editorDoc = () => vscode.window.activeTextEditor?.document;
  // Commands that a policy can switch off for everyone (team/project/user layers are merged; any layer can disable).
  const FEATURE: Record<string, string> = { "rizomadb.export": "export", "rizomadb.import": "import", "rizomadb.backup": "backup", "rizomadb.restore": "restore", "rizomadb.compareData": "dataSync", "rizomadb.generateData": "dataSync", "rizomadb.designTable": "designer", "rizomadb.admin": "admin", "rizomadb.admin.kill": "admin", "rizomadb.admin.setVariable": "admin", "rizomadb.admin.grant": "admin", "rizomadb.admin.metrics": "admin", "rizomadb.admin.privileges": "admin", "rizomadb.ai.explain": "ai", "rizomadb.ai.optimize": "ai", "rizomadb.ai.textToSql": "ai", "rizomadb.ai.describe": "ai", "rizomadb.mcp.generateConfig": "ai" };
  const reg = (id: string, fn: (...a: never[]) => unknown) => ctx.subscriptions.push(vscode.commands.registerCommand(id, ((...a: unknown[]) => {
    const f = FEATURE[id];
    if (f && !featureEnabled(policy(), f)) { void vscode.window.showWarningMessage(t("'{0}' is disabled by your organisation's RizomaDB policy.", f)); return undefined; }
    return (fn as (...x: unknown[]) => unknown)(...a);
  }) as never));

  reg("rizomadb.newConnection", async () => { await newConnectionWizard(mgr); });
  reg("rizomadb.newQuery", async (n?: Node) => {
    const id = n && "profile" in n ? n.profile.id : await pickConnection();
    const plugin = id ? await mgr.loadDriver(mgr.get(id)!.driver) : undefined;
    const language = plugin?.language === "mongo" ? "rizomadb-mongo" : plugin?.language === "redis" ? "rizomadb-redis" : plugin?.language === "json" ? "rizomadb-es" : plugin?.language === "cypher" ? "rizomadb-cypher" : "sql";
    const sample = language === "rizomadb-es" ? (plugin?.id === "firestore" ? "{ \"from\": \"collection\", \"limit\": 20 }\n" : "GET /_cluster/health\n") : language === "rizomadb-cypher" ? "// run with Ctrl/Cmd+Enter; end statements with ;\nMATCH (n) RETURN n LIMIT 25;\n" : language === "rizomadb-mongo" ? "db.getCollection(\"collection\").find({}).limit(20)\n" : language === "rizomadb-redis" ? "# one command per line; run with Ctrl/Cmd+Enter\nSCAN 0 MATCH * COUNT 100\n" : "";
    const doc = await vscode.workspace.openTextDocument({ language, content: sample });
    await vscode.window.showTextDocument(doc);
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
    const lang = ed.document.languageId;
    const text = !sel.isEmpty ? ed.document.getText(sel) : lang === "sql" ? statementAt(ed.document.getText(), ed.document.offsetAt(sel.active))?.text : commandAt(lang, ed.document.getText(), ed.document.offsetAt(sel.active));
    if (!text?.trim()) { void vscode.window.showInformationMessage(t("Nothing to run.")); return; }
    const id = await bind(ed.document); if (!id) return;
    const bound = await promptParameters(id, text); if (!bound) return;
    await execute(id, bound.sql, t("Query"), undefined, bound.params);
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
    if (!n.isView && (plugin.capabilities.rowEditing === "primaryKey" || plugin.capabilities.rowEditing === "documentId") && !mgr.isReadOnly(profile)) {
      const info = await conn.introspect().describeTable({ name: n.name, ...(n.schema ? { schema: n.schema } : {}) });
      if (info.columns?.some((c) => c.primaryKey)) edit = { target: { ...(n.schema ? { schema: n.schema } : {}), table: n.name, columns: info.columns } };
    }
    const limit = cfg().get<number>("table.openRows", 200);
    await execute(profile.id, plugin.openCommand ? plugin.openCommand({ ...(n.schema ? { schema: n.schema } : {}), name: n.name }, limit) : plugin.selectTop(name, limit), n.name, edit);
    if (!edit) notice("info", n.isView ? t("Views are read-only.") : mgr.isReadOnly(profile) ? t("Read-only connection: editing is disabled.") : t("This table has no primary key, so its rows cannot be edited safely."));
  });
  reg("rizomadb.export", async (n?: Node) => {
    let profileId: string | undefined, sql: string | undefined, quoted: string | undefined;
    if (n?.kind === "table") {
      const conn = await mgr.connect(n.profile.id);
      quoted = n.schema ? `${conn.quoteIdent(n.schema)}.${conn.quoteIdent(n.name)}` : conn.quoteIdent(n.name);
      profileId = n.profile.id;
      const plug = await mgr.loadDriver(n.profile.driver);
      sql = plug.openCommand ? plug.openCommand({ ...(n.schema ? { schema: n.schema } : {}), name: n.name }, 50_000_000) : `SELECT * FROM ${quoted}`;
    } else {
      const ed = vscode.window.activeTextEditor; if (!ed) return;
      const text = ed.selection.isEmpty ? statementAt(ed.document.getText(), ed.document.offsetAt(ed.selection.active))?.text : ed.document.getText(ed.selection);
      if (!text) return;
      profileId = await bind(ed.document); sql = text;
    }
    if (!profileId || !sql) return;
    const profile = mgr.get(profileId)!;
    const d = decideEffective(sql, { environment: profile.environment, readOnly: true }, policy());
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
          format: fmt.label as ExportFormat, signal: ac.signal, mask: policy().maskColumns,
          ...(fmt.label === "sql" ? { sql: { table: quoted ?? plugin.quoteIdent("exported"), quoteIdent: plugin.quoteIdent } } : {}),
          onProgress: (rows) => { progress.report({ message: t("{0} rows", rows), increment: 0 }); last = rows; void last; },
        });
      });
      void vscode.window.showInformationMessage(t("Exported {0} rows to {1}", r.rows, uri.fsPath));
    } catch (e) {
      if ((e as Error).name !== "AbortError") void vscode.window.showErrorMessage(t("Export failed: {0}", (e as Error).message));
    }
  });
  const connOf = async (n?: Node) => (n && "profile" in n ? n.profile.id : await pickConnection());
  /** Schema tools speak SQL DDL: other engines get an honest message instead of a broken feature. */
  const sqlConnOf = async (n?: Node) => {
    const id = await connOf(n); if (!id) return undefined;
    const plugin = await mgr.loadDriver(mgr.get(id)!.driver);
    if (!plugin.capabilities.sql) { void vscode.window.showInformationMessage(t("{0} is not a SQL engine: this tool is not available for it.", plugin.displayName)); return undefined; }
    return id;
  };
  const doc = async (content: string, language = "sql") => vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ language, content }), { preview: false });

  reg("rizomadb.showER", async (n?: Node) => {
    const id = await sqlConnOf(n); if (!id) return;
    try {
      const model = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t("Reading schema…") }, () => loadModel(mgr, id));
      const only = n?.kind === "table" ? new Set([n.name.toLowerCase(), ...model.tables.flatMap((x) => x.foreignKeys.flatMap((f) => (x.name.toLowerCase() === n.name.toLowerCase() ? [f.refTable.toLowerCase()] : f.refTable.toLowerCase() === n.name.toLowerCase() ? [x.name.toLowerCase()] : [])))]) : undefined;
      showEr(ctx, mgr.get(id)!.name, model, only);
    } catch (e) { void vscode.window.showErrorMessage(t("Could not build the diagram: {0}", (e as Error).message)); }
  });
  reg("rizomadb.designTable", async (n?: Node) => {
    const id = await sqlConnOf(n); if (!id) return;
    const profile = mgr.get(id)!;
    const plugin = await mgr.loadDriver(profile.driver);
    if (!plugin.capabilities.ddlGeneration) { void vscode.window.showWarningMessage(t("This engine does not support the table designer.")); return; }
    try {
      const model = await loadModel(mgr, id);
      openDesigner(ctx, mgr, policy, id, model, n?.kind === "table" ? n.name : undefined, () => { schemaCache.invalidate(id); explorer.refresh(); });
    } catch (e) { void vscode.window.showErrorMessage(t("Could not open the designer: {0}", (e as Error).message)); }
  });
  reg("rizomadb.exportSchemaSnapshot", async (n?: Node) => {
    const id = await sqlConnOf(n); if (!id) return;
    const model = await loadModel(mgr, id);
    const uri = await vscode.window.showSaveDialog({ filters: { JSON: ["json"] }, defaultUri: vscode.Uri.file(`${mgr.get(id)!.name}.schema.json`) });
    if (uri) await writeFile(uri.fsPath, JSON.stringify({ version: 1, model }, null, 2) + "\n");
  });
  reg("rizomadb.compareSchemas", async (n?: Node) => {
    const targetId = await sqlConnOf(n); if (!targetId) return;
    const target = mgr.get(targetId)!;
    const srcKind = await vscode.window.showQuickPick([{ label: t("Another connection"), k: "conn" }, { label: t("A schema snapshot file (.json)"), k: "file" }], { title: t("Make {0} match…", target.name) });
    if (!srcKind) return;
    let source: SchemaModel;
    if (srcKind.k === "conn") {
      const others = mgr.list().filter((p) => p.id !== targetId && p.driver === target.driver);
      const pick = await vscode.window.showQuickPick(others.map((p) => ({ label: p.name, description: `[${p.environment}]`, id: p.id })), { title: t("Source connection (same engine as the target)") });
      if (!pick) return;
      source = await loadModel(mgr, pick.id);
    } else {
      const f = await vscode.window.showOpenDialog({ filters: { JSON: ["json"] }, canSelectMany: false }); if (!f?.[0]) return;
      const j = JSON.parse(await (await import("node:fs/promises")).readFile(f[0].fsPath, "utf8")) as { version?: number; model?: SchemaModel };
      if (j.version !== 1 || !j.model?.tables || j.model.dialect !== target.driver) { void vscode.window.showErrorMessage(t("Snapshot is invalid or was taken from a different engine.")); return; }
      source = j.model;
    }
    const current = await loadModel(mgr, targetId);
    const plan = diffModels(current, source);
    if (plan.identical) { void vscode.window.showInformationMessage(t("Schemas are identical.")); return; }
    const summary = describeChanges(current, source);
    const picked = await vscode.window.showQuickPick(summary.map((label, i) => ({ label, picked: true, i })), { canPickMany: true, title: t("{0} difference(s): choose what to include", summary.length) });
    if (!picked?.length) return;
    const chosen = plan.changes.filter((_, i) => picked.some((p) => p.i === i));
    const fmt = await vscode.window.showQuickPick([{ label: "Plain SQL", f: "plain" }, { label: "Flyway (V…__.sql)", f: "flyway" }, { label: "Liquibase (formatted SQL)", f: "liquibase" }], { title: t("Migration format") });
    if (!fmt) return;
    const mig = toMigration(fmt.f as MigrationFormat, "sync schema", migrationStatements(target.driver as never, chosen));
    await doc(`-- ${mig.fileName}\n${mig.content}`);
  });
  reg("rizomadb.generateDocs", async (n?: Node) => {
    const id = await sqlConnOf(n); if (!id) return;
    const model = await loadModel(mgr, id); const name = mgr.get(id)!.name;
    const fmt = await vscode.window.showQuickPick([{ label: "Markdown", e: "md" }, { label: "HTML", e: "html" }], { title: t("Documentation format") }); if (!fmt) return;
    const uri = await vscode.window.showSaveDialog({ filters: { [fmt.label]: [fmt.e] }, defaultUri: vscode.Uri.file(`${name}-schema.${fmt.e}`) }); if (!uri) return;
    await writeFile(uri.fsPath, fmt.e === "md" ? toMarkdown(model, name) : toHtml(model, name));
    void vscode.window.showInformationMessage(t("Documentation written to {0}", uri.fsPath));
  });
  reg("rizomadb.suggestIndexes", async (n?: Node) => {
    const id = await sqlConnOf(n); if (!id) return;
    const model = await loadModel(mgr, id); const missing = missingFkIndexes(model);
    if (!missing.length) { void vscode.window.showInformationMessage(t("Every foreign key is covered by an index.")); return; }
    const lines = missing.map((m) => { const tb = model.tables.find((x) => x.name === m.table)!; return `-- ${m.table}.${m.fk}: joins and cascades on ${m.columns.join(", ")} scan the whole table\n${renderScript([{ sql: createIndex(model.dialect, tb, { name: `ix_${m.table}_${m.columns.join("_")}`.slice(0, 60), columns: m.columns, unique: false }) }]).trim()}`; });
    await doc(`-- ${t("Suggested indexes (review before running)")}\n\n${lines.join("\n\n")}\n`);
  });
  const showTable = (title: string, table: { columns: string[]; rows: Value[][] }) => {
    session = undefined;
    results.post({ v: 1, type: "start", title, sql: "", columns: table.columns.map((name) => ({ name, nativeType: "", kind: "text" })) });
    results.post({ v: 1, type: "rows", rows: table.rows.map((r) => r.map(formatValue)) });
    results.post({ v: 1, type: "done", rowCount: table.rows.length, durationMs: 0, truncated: false });
  };
  registerAdminCommands({ ctx, mgr, policy, pick: () => pickConnection(), reg, show: showTable });
  registerImportWizard(mgr, reg, () => explorer.refresh());
  registerAiCommands({ ctx, mgr, cache: schemaCache, reg, pick: () => pickConnection(), bind });
  registerMcpProvider(ctx);
  registerNoSqlCommands({ mgr, policy, reg, refresh: () => explorer.refresh(), bind });
  registerDataCommands({ ctx, mgr, policy, pick: () => pickConnection(), reg, refresh: () => explorer.refresh() });
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
    if (mgr.isShared(n.profile.id)) { void vscode.window.showInformationMessage(t("'{0}' comes from the {1} catalog: edit the catalog file to remove it.", n.profile.name, mgr.sourceOf(n.profile.id) ?? "shared")); return; }
    const ok = await vscode.window.showWarningMessage(t("Delete connection '{0}'? Stored secrets are removed too.", n.profile.name), { modal: true }, t("Delete"));
    if (ok) await mgr.remove(n.profile.id);
  });
  reg("rizomadb.pinResults", () => { session = undefined; if (!results.pin()) void vscode.window.showInformationMessage(t("No results to pin.")); });
  reg("rizomadb.newNotebook", async () => {
    const data = new vscode.NotebookData([new vscode.NotebookCellData(vscode.NotebookCellKind.Code, "SELECT 1;", "sql")]);
    await vscode.window.showNotebookDocument(await vscode.workspace.openNotebookDocument("rizomadb-sql-notebook", data));
  });
  reg("rizomadb.openAudit", async () => {
    const status = await vscode.window.showQuickPick([{ label: t("All"), v: undefined }, { label: t("Blocked by policy"), v: "blocked" as const }, { label: t("Errors"), v: "error" as const }, { label: t("Succeeded"), v: "ok" as const }], { title: t("Audit log: which entries?") }); if (!status) return;
    const entries = await audit.read({ limit: 2000, ...(status.v ? { status: status.v } : {}) });
    showTable(t("Audit log"), { columns: ["time", "user", "connection", "environment", "kind", "status", "rows", "ms", "statement", "detail"], rows: entries.map((e) => [e.ts, e.user, e.connection, e.environment, e.kind, e.status, e.rows ?? null, e.durationMs ?? null, e.statement, e.detail ?? null]) });
  });
  reg("rizomadb.exportAudit", async () => {
    const uri = await vscode.window.showSaveDialog({ filters: { JSONL: ["jsonl"] }, defaultUri: vscode.Uri.file("rizomadb-audit.jsonl") }); if (!uri) return;
    const all = await audit.read({ limit: 1_000_000 });
    await writeFile(uri.fsPath, all.reverse().map((e) => JSON.stringify(e)).join("\n") + "\n");
    void vscode.window.showInformationMessage(t("Exported {0} audit entries.", all.length));
  });
  reg("rizomadb.refresh", () => { schemaCache.invalidate(); lang.refreshAll(); explorer.refresh(); });
  reg("rizomadb.explain", async (analyze?: boolean) => {
    const ed = vscode.window.activeTextEditor; if (!ed) return;
    const sel = ed.selection;
    const text = sel.isEmpty ? statementAt(ed.document.getText(), ed.document.offsetAt(sel.active))?.text : ed.document.getText(sel);
    if (!text) return;
    const id = await bind(ed.document); if (!id) return;
    const profile = mgr.get(id)!;
    const bound = await promptParameters(id, text); if (!bound) return;
    const conn = await mgr.connect(id);
    if (bound.params?.length) { void vscode.window.showWarningMessage(t("Explain does not support bind parameters; replace them with literal values.")); return; }
    const d = decideEffective(text, { environment: profile.environment, readOnly: true }, policy());
    if (analyze === true) {
      if (profile.driver !== "postgres") { void vscode.window.showWarningMessage(t("EXPLAIN ANALYZE is only available for PostgreSQL.")); return; }
      if (!d.allowed) { void vscode.window.showErrorMessage(t("EXPLAIN ANALYZE executes the statement, so it is limited to read-only statements.")); return; }
      const ok = await vscode.window.showWarningMessage(t("EXPLAIN ANALYZE will execute this query on {0}.", profile.name), { modal: true }, t("Run it"));
      if (!ok) return;
    }
    try {
      const sqlText = bound.sql;
      const plan = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t("Planning…") }, () => explain(conn, profile.driver as never, sqlText, { analyze: analyze === true }));
      planPanel.show(`${profile.name}`, plan);
    } catch (e) { void vscode.window.showErrorMessage(t("Could not get a plan: {0}", (e as Error).message)); }
  });
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
    vscode.languages.registerCodeLensProvider([{ language: "sql" }, { language: "rizomadb-mongo" }, { language: "rizomadb-redis" }, { language: "rizomadb-es" }, { language: "rizomadb-cypher" }], {
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

let pendingAudit: AuditLog | undefined;
/** Written audit entries must survive a window close. */
export async function deactivate() { await pendingAudit?.flush(); }
