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
import { openConnectionScreen } from "./ui/connectionPanel.js";
import { openSettingsScreen } from "./ui/settingsPanel.js";
import { runColumnAction } from "./ui/columnActions.js";
import { engineOf } from "./ui/explorer.js";
import { ENGINE_LOGOS } from "./engineLogos.js";
import { tableProperties } from "./lib/tableProperties.js";
import { openHistoryScreen } from "./ui/historyPanel.js";
import { Favorites } from "./lib/favorites.js";
import { buildSelect, kindOfNative, OPERATORS, BuilderError, type Condition } from "./lib/queryBuilder.js";
import { seal, unseal, SealedCatalogError, MIN_PASSPHRASE } from "./lib/encryptedCatalog.js";
import { readOnlyUserScript, supportsReadOnlyUser, ReadOnlyUserError } from "./lib/readOnlyUser.js";
import { customEnvironmentPolicy } from "./lib/environments.js";
import { databaseOf } from "./lib/connectionInfo.js";
import { friendly, friendlyReasons } from "./ui/driverMessages.js";
import { buildTableQuery, filterKindOf, FilterError } from "./lib/tableQuery.js";
import { keysetOrder, keysetStatement, keysetSupported, lastKey, type KeysetKey } from "./lib/keysetPaging.js";
import { registerEditorTools } from "./ui/editorTools.js";
import { statementRanges } from "./lib/statements.js";
import { openGuide, offerGuideOnce } from "./ui/guidePanel.js";
import { logoSvg } from "./lib/logoSvg.js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
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
import { t, initI18n } from "./i18n.js";

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
    hydradb: async () => workerDriver((await import("@rizomadb/driver-hydradb/meta")).meta, workerFile),
    duckdb: async () => workerDriver((await import("@rizomadb/driver-duckdb/meta")).meta, workerFile),
  };
}

export async function activate(ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(initI18n(ctx));
  ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration("rizomadb.language")) void vscode.commands.executeCommand("rizomadb.refresh"); }));
  const secrets: SecretStore = {
    get: async (k) => ctx.secrets.get(k),
    set: async (k, v) => ctx.secrets.store(k, v),
    delete: async (k) => ctx.secrets.delete(k),
  };
  // ---- policy: built-in < team settings < project file (trusted workspaces only) < user file; the strictest layer always wins ----
  let effective: EffectivePolicy = defaultEffectivePolicy;
  let setProd: (v: boolean) => void = () => {};
  let prodReadOnly = true;  // the built-in default now lives on the connection (see ConnectionManager.prodReadOnly), not in the policy layers
  const policy = () => effective;
  const policyOutput = vscode.window.createOutputChannel("RizomaDB policy");
  const reloadPolicy = async () => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const files = [
      ...(vscode.workspace.isTrusted ? folders.map((f) => ({ label: `project ${f.name}`, path: join(f.uri.fsPath, ".rizomadb", "policy.json") })) : []),
      { label: "user", path: join(ctx.globalStorageUri.fsPath, "policy.json") },
    ];
    const r = await loadPolicy({ builtinProdReadOnly: false, files, inline: [{ label: "team (settings)", value: cfg().get("policy.team") }, { label: "environments (settings)", value: customEnvironmentPolicy(cfg().get("environments")) }] });
    effective = r.policy;
    prodReadOnly = cfg().get<boolean>("security.prodReadOnlyByDefault", true);
    setProd(prodReadOnly);
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
    const typed = await vscode.window.showInputBox({ title: t("Approval required on {0}", name), prompt: t("{0}\n\n{1}\n\nType the connection name to approve.", friendlyReasons(reason), statement.slice(0, 300)), ignoreFocusOut: true });
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
  setProd = (v) => { mgr.prodReadOnly = v; }; setProd(prodReadOnly);
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
    vscode.workspace.onDidGrantWorkspaceTrust(() => void reloadPolicy()), vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration("rizomadb.security") || e.affectsConfiguration("rizomadb.environments") || e.affectsConfiguration("rizomadb.policy")) void reloadPolicy(); }));
  const history = new History(join(ctx.globalStorageUri.fsPath, "history.jsonl"));
  const favorites = new Favorites(join(ctx.globalStorageUri.fsPath, "favorites.json"));
  setTimeout(() => { void history.prune(cfg().get<number>("history.retentionDays", 90)).catch(() => {}); }, 30_000);  // not at startup: it reads the whole history file

  const explorer = new Explorer(mgr);
  // The connection in use: the one bound to the active query editor, else the last one that ran something.
  let lastUsedId: string | undefined;
  const activeEmitter = new vscode.EventEmitter<void>();
  const activeId = (): string | undefined => {
    const ed = vscode.window.activeTextEditor;
    const bound = ed && isQueryLanguage(ed.document.languageId) ? ctx.workspaceState.get<string>(`doc:${ed.document.uri.toString()}`) : undefined;
    const id = bound && mgr.get(bound) ? bound : lastUsedId;
    return id && mgr.get(id) ? id : undefined;
  };
  explorer.activeId = activeId;
  let running: AbortController | undefined;
  type TableRef = { schema?: string; name: string; isView?: boolean };
  /** Keyset paging of a table: the key columns, and the key of the last row loaded (undefined = continue by skipping rows). */
  type KeysetState = { keys: KeysetKey[]; last?: Value[] };
  let lastRun: { id: string; sql: string; title: string; edit?: { target: EditTarget } | undefined; params?: Value[] | undefined; table?: TableRef | undefined; loaded?: number; filter?: { where: string; order: string } | undefined; keyset?: KeysetState | undefined } | undefined;
  let lastRaw: Value[][] = [];
  let session: { s: TableSession; profileId: string; refresh: () => Promise<unknown> } | undefined;
  const results = new ResultsPanel(ctx, (m) => void onWebviewMessage(m));
  const notice = (level: "error" | "info", text: string) => results.post({ v: 1, type: "notice", level, text });
  const pushPending = () => { if (session) results.post({ v: 1, type: "pending", ...session.s.view(), inserts: session.s.view().inserts.map((r) => r.map((x) => ({ set: x !== undefined, text: x ?? null }))) }); };

  /** Pending edits are lost when the grid is replaced: ask first. */
  const confirmDiscard = async () => {
    if (!session || session.s.pending.count === 0) return true;
    const go = t("Discard changes");
    return (await vscode.window.showWarningMessage(t("You have {0} pending change(s). Discard them and continue?", session.s.pending.count), { modal: true }, go)) === go;
  };
  async function onWebviewMessage(m: import("./messages.js").WebviewToHost) {
    if (m.type === "cancel") { running?.abort(); return; }
    if (m.type === "pin") { session = undefined; results.pin(); return; }
    if (m.type === "openText") {
      const doc = await vscode.workspace.openTextDocument({ language: "sql", content: m.text });
      if (lastRun) await ctx.workspaceState.update(`doc:${doc.uri.toString()}`, lastRun.id);
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
      return;
    }
    if (m.type === "loadProperties") {
      const run = lastRun; if (!run?.table) return;
      const empty = { columns: [], indexes: [], foreignKeys: [], referencedBy: [], ddl: "" };
      try {
        const conn = await mgr.connect(run.id);
        results.post({ v: 1, type: "properties", ok: true, ...(await tableProperties(conn, mgr.get(run.id)!.driver, run.table)) });
      } catch (e) { results.post({ v: 1, type: "properties", ok: false, error: (e as Error).message, ...empty }); }
      return;
    }
    if (m.type === "showEr") {
      const run = lastRun; const p = run && mgr.get(run.id); if (!run?.table || !p) return;
      await vscode.commands.executeCommand("rizomadb.showER", { kind: "table", profile: p, ...(run.table.schema ? { schema: run.table.schema } : {}), name: run.table.name, isView: !!run.table.isView });
      return;
    }
    if (m.type === "openRelated") {
      const run = lastRun; const p = run && mgr.get(run.id); if (!p) return;
      await vscode.commands.executeCommand("rizomadb.openTable", { kind: "table", profile: p, ...(m.schema ? { schema: m.schema } : {}), name: m.name, isView: false });
      return;
    }
    if (m.type === "filterTable") {
      const run = lastRun; const p = run && mgr.get(run.id); if (!run?.table || !p) return;
      if (!(await confirmDiscard())) return;
      try {
        const conn = await mgr.connect(run.id);
        const quoted = run.table.schema ? `${conn.quoteIdent(run.table.schema)}.${conn.quoteIdent(run.table.name)}` : conn.quoteIdent(run.table.name);
        const limit = Math.min(cfg().get<number>("query.maxRows", 100000), p.driver === "elasticsearch" ? 10000 : Infinity);
        const keyset = m.order.trim() ? undefined : await keysetFor(p, conn, run.table);
        const sql = buildTableQuery({ driver: p.driver, quoted, schema: run.table.schema, name: run.table.name, where: m.where, order: keyset ? keysetOrder(keyset.keys) : m.order, limit });
        await execute(run.id, sql, run.title, run.edit, undefined, run.table, keyset ? { skip: 0, keyset } : undefined, { where: m.where.trim(), order: m.order.trim() });
      } catch (e) { notice("error", friendly(e instanceof FilterError ? e.message : (e as Error).message)); }
      return;
    }
    if (m.type === "runSql") {
      const run = lastRun; const sql = m.sql.trim(); if (!run || !sql) return;
      if (sql === run.sql.trim()) { await execute(run.id, run.sql, run.title, run.edit, run.params, run.table, run.loaded ? { skip: 0, size: run.loaded, ...(run.keyset ? { keyset: run.keyset } : {}) } : undefined, run.filter); return; }
      if (!(await confirmDiscard())) return;
      const bound = await promptParameters(run.id, sql); if (!bound) return;
      // Edited text is a new query: it no longer says which table it shows, so the grid is read-only.
      await execute(run.id, bound.sql, run.title, undefined, bound.params);
      return;
    }
    if (m.type === "openSql") {
      if (!lastRun) return;
      const doc = await vscode.workspace.openTextDocument({ language: "sql", content: lastRun.sql });
      await ctx.workspaceState.update(`doc:${doc.uri.toString()}`, lastRun.id);
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, preserveFocus: false });
      return;
    }
    if (m.type === "refresh") { if (lastRun) await execute(lastRun.id, lastRun.sql, lastRun.title, lastRun.edit, lastRun.params, lastRun.table, lastRun.loaded ? { skip: 0, size: lastRun.loaded, ...(lastRun.keyset ? { keyset: lastRun.keyset } : {}) } : undefined, lastRun.filter); return; }
    if (m.type === "loadMore") {
      const run = lastRun; if (!run) return;
      if (session && session.s.pending.count > 0) { notice("error", t("Apply or discard your changes before loading more rows.")); return; }
      const cap = cfg().get<number>("query.maxRows", 100000), loaded = run.loaded ?? 0;
      const size = m.mode === "all" ? cap - loaded : cfg().get<number>("query.pageSize", 1000);
      if (size <= 0) return;
      const p = mgr.get(run.id);
      if (run.keyset?.last && p && run.table) {
        const conn = await mgr.connect(run.id);
        const quoted = run.table.schema ? `${conn.quoteIdent(run.table.schema)}.${conn.quoteIdent(run.table.name)}` : conn.quoteIdent(run.table.name);
        const statement = keysetStatement({ driver: p.driver, quoted, schema: run.table.schema, name: run.table.name, where: run.filter?.where ?? "", keys: run.keyset.keys, last: run.keyset.last, limit: cap });
        if (statement) { await execute(run.id, run.sql, run.title, run.edit, run.params, run.table, { skip: loaded, size, keyset: run.keyset, statement }, run.filter); return; }
      }
      await execute(run.id, run.sql, run.title, run.edit, run.params, run.table, { skip: loaded, size, ...(run.keyset ? { keyset: run.keyset } : {}) }, run.filter);
      return;
    }
    if (m.type === "columnAction") {
      const run = lastRun; if (!run?.table) return;
      try {
        await runColumnAction({ mgr, profileId: run.id, policy, afterApply: async () => { schemaCache.invalidate(run.id); lang.refreshAll(); void vscode.commands.executeCommand("rizomadb.refresh"); await execute(run.id, run.sql, run.title, run.edit, run.params, run.table, undefined, run.filter); } }, run.table, m.action, m.column);
      } catch (e) { void vscode.window.showErrorMessage(friendly((e as Error).message)); }
      return;
    }
    if (!session) return;
    const cur = session;
    try {
      if (m.type === "edit") cur.s.edit(m.row, m.col, m.text);
      else if (m.type === "editMany") cur.s.editMany(m.cells);
      else if (m.type === "toggleDelete") cur.s.toggleDelete(m.row);
      else if (m.type === "setDeleted") { const has = new Set(cur.s.view().deletes); for (const r of m.rows) if (has.has(r) !== m.deleted) cur.s.toggleDelete(r); }
      else if (m.type === "insertRow") cur.s.insertRow();
      else if (m.type === "undo") cur.s.pending.undo();
      else if (m.type === "redo") cur.s.pending.redo();
      else if (m.type === "discard") cur.s.pending.clear();
      else if (m.type === "review") { await reviewChanges(); return; }
      else if (m.type === "apply") { await applyPending(); return; }
      notice("info", "");
      pushPending();
      if ((m.type === "edit" || m.type === "editMany") && cfg().get<boolean>("edit.applyImmediately", false) && cur.s.pending.count > 0) await applyPending(true);
    } catch (e) {
      notice("error", friendly(e instanceof InputError || e instanceof EditError ? e.message : (e as Error).message));
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

  async function applyPending(immediate = false) {
    if (!session || session.s.pending.count === 0) return;
    const cur = session;
    const profile = mgr.get(cur.profileId)!; const plugin = await mgr.loadDriver(profile.driver);
    const conn = await mgr.connect(cur.profileId);
    try {
      const r = await applyChanges(cur.s.pending.toChanges(), {
        conn, plugin, target: cur.s.target, environment: profile.environment, readOnly: mgr.isReadOnly(profile), policy: policy(),
        confirm: async (stmts) => {
          // "Save each edit immediately" skips the prompt only on dev: every other environment keeps asking.
          if (immediate && profile.environment === "dev") return true;
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
  const editorToolsRef: { current?: { refresh: () => void } } = {};
  const refreshStatus = () => {
    explorer.redraw(); activeEmitter.fire(); editorToolsRef.current?.refresh();
    const p = mgr.get(activeId() ?? "");
    if (!p) { if (!mgr.list().length) { status.hide(); return; } status.text = `$(database) ${t("No connection")}`; status.tooltip = t("Select connection for this editor"); status.show(); return; }
    const db = databaseOf(p), engine = engineOf(p)?.name ?? p.driver;
    status.text = `$(database) [${p.environment.toUpperCase()}] ${p.name}${db ? ` · ${db}` : ""}${mgr.isReadOnly(p) ? " 🔒" : ""}${mgr.isConnected(p.id) ? "" : ` (${t("disconnected")})`}`;
    status.tooltip = new vscode.MarkdownString(`**${p.name}** — ${engine}\n\n${db ? `${t("Database")}: \`${db}\`\n\n` : ""}${t("Environment")}: ${p.environment}${mgr.isReadOnly(p) ? ` · ${t("read-only")}` : ""}\n\n${t("Click to change the connection of this editor")}`);
    status.show();
  };

  async function pickConnection(): Promise<string | undefined> {
    const list = mgr.list();
    if (!list.length) { return newConnectionWizard(mgr); }
    const pick = await vscode.window.showQuickPick(
      [...list.map((p) => ({ label: `${p.id === activeId() ? "$(check) " : mgr.isConnected(p.id) ? "$(plug) " : ""}${p.name}`, description: `[${p.environment}] ${p.driver}${mgr.isReadOnly(p) ? " 🔒" : ""}`, detail: p.id === activeId() ? t("In use now") : mgr.isConnected(p.id) ? t("Connected") : t("Not connected yet: it connects when you run something"), id: p.id })), { label: `$(add) ${t("New connection…")}`, id: "" }],
      { title: t("Select connection"), matchOnDescription: true });
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

  /** The key columns to page a table by, when the user turned keyset paging on and the table and engine allow it. */
  async function keysetFor(profile: NonNullable<ReturnType<typeof mgr.get>>, conn: Awaited<ReturnType<typeof mgr.connect>>, ref: TableRef): Promise<KeysetState | undefined> {
    if (!cfg().get<boolean>("query.keysetPaging", true) || !keysetSupported(profile.driver) || ref.isView) return undefined;
    const info = await conn.introspect().describeTable({ name: ref.name, ...(ref.schema ? { schema: ref.schema } : {}) });
    const keys = (info.columns ?? []).filter((c) => c.primaryKey).map((c) => ({ name: c.name, quoted: conn.quoteIdent(c.name) }));
    return keys.length ? { keys } : undefined;
  }

  async function execute(id: string, sql: string, title: string, edit?: { target: EditTarget }, params?: Value[], tableRef?: TableRef, page?: { skip: number; size?: number; keyset?: KeysetState; statement?: string }, filter?: { where: string; order: string }): Promise<string | undefined> {
    let result: string = "error";
    const profile = mgr.get(id);
    if (!profile) return;
    lastUsedId = id; refreshStatus();
    if (running) { void vscode.window.showWarningMessage(t("A query is already running. Cancel it first.")); return; }
    const ac = new AbortController();
    running = ac;
    void vscode.commands.executeCommand("setContext", "rizomadb.running", true);
    cancelItem.show();
    let columnsSeen = false;
    session = undefined;
    const skip = page?.skip ?? 0, cap = cfg().get<number>("query.maxRows", 100000), pageSize = cfg().get<number>("query.pageSize", 1000);
    const size = Math.max(1, Math.min(page?.size ?? (tableRef ? cfg().get<number>("table.openRows", 200) : pageSize), cap - skip));
    const keyset = page?.keyset ? { keys: page.keyset.keys } as KeysetState : undefined;
    lastRun = { id, sql, title, edit, params, table: tableRef, loaded: skip, filter, keyset };
    const tabIcon = (): { light: vscode.Uri; dark: vscode.Uri } | undefined => {
      const eng = engineOf(profile), logo = eng ? ENGINE_LOGOS[eng.key] : undefined;
      if (!eng || !logo || logo.wordmark) return undefined;
      try {
        const dir = join(ctx.globalStorageUri.fsPath, "icons"), file = (theme: "light" | "dark") => join(dir, `${eng.key}-${theme}.svg`);
        for (const theme of ["light", "dark"] as const) if (!existsSync(file(theme))) { mkdirSync(dir, { recursive: true }); writeFileSync(file(theme), logoSvg(logo, eng.key, theme)); }
        return { light: vscode.Uri.file(file("light")), dark: vscode.Uri.file(file("dark")) };
      } catch { return undefined; }
    };
    const connectionInfo = () => { const eng = engineOf(profile); return { name: profile.name, environment: profile.environment, key: eng?.key ?? profile.driver, color: eng?.color ?? "#555555", fg: eng?.fg ?? "#ffffff", mark: eng?.mark ?? profile.driver.slice(0, 2), ...(eng && ENGINE_LOGOS[eng.key] ? { logo: ENGINE_LOGOS[eng.key]! } : {}) }; };
    let mask: ((r: Value[]) => Value[]) | undefined;
    const rawRows: Value[][] = skip > 0 ? lastRaw : []; lastRaw = rawRows; let cols: ColumnInfo[] = [];
    const emit = (e: RunEvent) => {
      if (e.type === "start") { columnsSeen = true; cols = e.columns; mask = maskFor(policy().maskColumns, e.columns.map((c) => c.name)); if (mask) edit = undefined; results.describe(tableRef ? `${profile.name}.${tableRef.name}` : `${profile.name} · ${title}`, tabIcon()); results.post({ v: 1, type: "start", title, sql: e.sql, columns: e.columns, editable: !!edit, ...(skip > 0 ? { append: true } : {}), connection: connectionInfo(), ...(edit ? { flags: { pk: edit.target.columns.filter((c) => c.primaryKey).map((c) => c.name), required: edit.target.columns.filter((c) => !c.nullable).map((c) => c.name) } } : {}), ...(tableRef ? { table: { name: tableRef.name, ...(tableRef.schema ? { schema: tableRef.schema } : {}), alter: !tableRef.isView && !mgr.isReadOnly(profile) && profile.driver in DIALECT_OF && ["sqlite", "postgres", "mysql", "mssql", "oracle"].includes(profile.driver), ...(filterKindOf(profile.driver) ? { filter: { kind: filterKindOf(profile.driver)!, where: filter?.where ?? "", order: filter?.order ?? "" } } : {}) } } : {}) }); }
      else if (e.type === "rows") { if (keyset && e.rows.length) { keyset.last = lastKey(keyset.keys, cols, e.rows[e.rows.length - 1]!); } const shown = mask ? e.rows.map(mask) : e.rows; if (edit) rawRows.push(...e.rows); results.post({ v: 1, type: "rows", rows: shown.map((r) => r.map(formatValue)) }); }
      else if (e.type === "done") {
        if (!columnsSeen) results.post({ v: 1, type: "start", title, sql: "", columns: [] });
        // "truncated" means the page was full and at least one more row exists: offer the next page unless the row cap is reached.
        const loaded = skip + e.rowCount, capped = e.truncated && loaded >= cap;
        if (lastRun) lastRun.loaded = loaded;
        results.post({ v: 1, ...e, rowCount: e.affectedRows !== undefined ? e.rowCount : loaded, more: e.truncated && !capped, capped, next: Math.max(0, Math.min(pageSize, cap - loaded)) });
      } else {
        if (!columnsSeen) results.post({ v: 1, type: "start", title, sql: "", columns: [] });
        results.post({ v: 1, type: "error", kind: e.kind, message: friendly(e.message), ...(e.position !== undefined ? { position: e.position } : {}) });
      }
    };
    try {
      const conn = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: t("Connecting…") }, () => mgr.connect(id));
      const drv = await mgr.loadDriver(profile.driver);
      const timeout = cfg().get<number>("query.timeoutSeconds", 0);
      const out = await runStatement({
        conn, profile, sql: page?.statement ?? sql, ...(params ? { params } : {}), ...(drv.assess ? { assess: drv.assess } : {}), signal: ac.signal, policy: policy(), readOnly: mgr.isReadOnly(profile),
        maxRows: size, ...(skip > 0 && !keyset ? { skip } : {}), ...(timeout > 0 ? { timeoutMs: timeout * 1000 } : {}),
        confirmDestructive: cfg().get<boolean>("security.confirmDestructive", true),
        confirm: async (reason) => (await vscode.window.showWarningMessage(
          t("[{0}] {1}: {2}", profile.environment.toUpperCase(), profile.name, friendlyReasons(reason)), { modal: true, detail: sql.slice(0, 500) }, t("Run anyway"))) === t("Run anyway"),
        onEvent: emit,
      });
      result = out.status;
      if (out.status === "ok" && /^\s*(create|alter|drop|rename|truncate)\b/i.test(sql)) { schemaCache.invalidate(id); lang.refreshAll(); void vscode.commands.executeCommand("rizomadb.refresh"); }
      if (edit && out.status === "ok") {
        const ts = new TableSession(edit.target, cols, rawRows);
        session = { s: ts, profileId: id, refresh: () => execute(id, sql, title, edit, undefined, tableRef, lastRun?.loaded ? { skip: 0, size: lastRun.loaded, ...(lastRun.keyset ? { keyset: lastRun.keyset } : {}) } : undefined, filter) };
        pushPending();
      }
      if (cfg().get<boolean>("history.enabled", true) && skip === 0) {
        await history.add({ connectionId: id, connectionName: profile.name, environment: profile.environment, sql, durationMs: Math.round(out.durationMs), rowCount: out.rowCount, status: out.status, ...(out.error ? { error: out.error } : {}) });
      }
    } catch (e) {
      emit({ type: "error", kind: "connection", message: (e as Error).message });
      void mgr.disconnect(id);
    } finally {
      running = undefined; cancelItem.hide();
      void vscode.commands.executeCommand("setContext", "rizomadb.running", false);
    }
    return result;
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

  reg("rizomadb.openSettings", async () => { openSettingsScreen(ctx); });
  reg("rizomadb.newConnection", async () => { openConnectionScreen(ctx, mgr, { get: activeId, onChange: activeEmitter.event }); });
  reg("rizomadb.newQuery", async (n?: Node) => {
    const id = n && "profile" in n ? n.profile.id : await pickConnection();
    const plugin = id ? await mgr.loadDriver(mgr.get(id)!.driver) : undefined;
    const language = plugin?.language === "mongo" ? "rizomadb-mongo" : plugin?.language === "redis" ? "rizomadb-redis" : plugin?.language === "json" ? "rizomadb-es" : plugin?.language === "cypher" ? "rizomadb-cypher" : "sql";
    const sample = language === "rizomadb-es" ? (plugin?.id === "firestore" ? "{ \"from\": \"collection\", \"limit\": 20 }\n" : "GET /_cluster/health\n") : language === "rizomadb-cypher" ? `// ${t("run with Ctrl/Cmd+Enter; end statements with ;")}\nMATCH (n) RETURN n LIMIT 25;\n` : language === "rizomadb-mongo" ? "db.getCollection(\"collection\").find({}).limit(20)\n" : language === "rizomadb-redis" ? `# ${t("one command per line; run with Ctrl/Cmd+Enter")}\nSCAN 0 MATCH * COUNT 100\n` : "";
    const doc = await vscode.workspace.openTextDocument({ language, content: sample });
    await vscode.window.showTextDocument(doc);
    if (id) await ctx.workspaceState.update(`doc:${doc.uri.toString()}`, id);
    refreshStatus();
  });
  reg("rizomadb.selectConnection", async () => {
    const d = editorDoc();
    const id = await pickConnection();
    if (!id) return;
    // With a query editor open the choice is stored for that editor; without one it becomes the connection in use.
    if (d && isQueryLanguage(d.languageId)) await ctx.workspaceState.update(`doc:${d.uri.toString()}`, id); else lastUsedId = id;
    refreshStatus();
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
  /** Brings the document to the front with the cursor at `offset`, so the existing run/explain commands act on that statement. */
  const focusAt = async (uri: string, offset: number) => {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
    const col = vscode.window.visibleTextEditors.find((x) => x.document.uri.toString() === uri)?.viewColumn;
    const ed = await vscode.window.showTextDocument(doc, { preview: false, ...(col ? { viewColumn: col } : {}) });
    const pos = doc.positionAt(offset); ed.selection = new vscode.Selection(pos, pos);
    return doc;
  };
  reg("rizomadb.runAt", async (uri: string, offset: number) => { await focusAt(uri, offset); await vscode.commands.executeCommand("rizomadb.runQuery"); });
  reg("rizomadb.explainAt", async (uri: string, offset: number) => { await focusAt(uri, offset); await vscode.commands.executeCommand("rizomadb.explain"); });
  reg("rizomadb.runAll", async (uri?: string) => {
    const doc = uri ? await focusAt(uri, 0) : vscode.window.activeTextEditor?.document; if (!doc) return;
    const stmts = statementRanges(doc.languageId, doc.getText());
    if (!stmts.length) { void vscode.window.showInformationMessage(t("Nothing to run.")); return; }
    const id = await bind(doc); if (!id) return;
    const profile = mgr.get(id)!;
    if (stmts.length > 1 && profile.environment !== "dev") {
      const go = t("Run {0} statements", stmts.length);
      if ((await vscode.window.showWarningMessage(t("[{0}] {1}: run {2} statements in order?", profile.environment.toUpperCase(), profile.name, stmts.length), { modal: true }, go)) !== go) return;
    }
    for (let i = 0; i < stmts.length; i++) {
      const bound = await promptParameters(id, stmts[i]!.text); if (!bound) return;
      const status = await execute(id, bound.sql, t("Statement {0} of {1}", i + 1, stmts.length), undefined, bound.params);
      if (status !== "ok") { void vscode.window.showWarningMessage(t("Stopped at statement {0} of {1}.", i + 1, stmts.length)); return; }
    }
    void vscode.window.setStatusBarMessage(t("Ran {0} statements.", stmts.length), 4000);
  });
  reg("rizomadb.openGuide", async (step?: string) => { openGuide(ctx, typeof step === "string" ? step : undefined); });
  reg("rizomadb.cancelQuery", () => running?.abort());
  reg("rizomadb.openTable", async (given?: Node) => {
    // From the command palette (or the "…and N more" row) there is no table yet: search every table of a connection.
    let n = given;
    if (n?.kind !== "table") {
      const id = await pickConnection(); const profile = id ? mgr.get(id) : undefined; if (!profile) return;
      const conn = await mgr.connect(profile.id), api = conn.introspect(), drv = await mgr.loadDriver(profile.driver);
      let schema: string | undefined;
      if (drv.capabilities.schemas) {
        const s = await vscode.window.showQuickPick((await api.listSchemas()).map((x) => ({ label: x })), { title: t("Schema"), matchOnDescription: true }); if (!s) return;
        schema = s.label;
      }
      const list = await api.listTables(schema);
      const shown = list.slice(0, 20000);
      const pick = await vscode.window.showQuickPick(shown.map((x) => ({ label: x.name, description: x.kind === "view" ? t("view") : "", info: x })), { title: shown.length < list.length ? t("Table (first {0} of {1}: type to narrow)", shown.length, list.length) : t("Table"), matchOnDescription: true });
      if (!pick) return;
      n = { kind: "table", profile, ...(schema ? { schema } : {}), name: pick.info.name, isView: pick.info.kind === "view" };
    }
    const profile = n.profile;
    const conn = await mgr.connect(profile.id);
    const plugin = await mgr.loadDriver(profile.driver);
    const name = n.schema ? `${conn.quoteIdent(n.schema)}.${conn.quoteIdent(n.name)}` : conn.quoteIdent(n.name);
    let edit: { target: EditTarget } | undefined;
    if (!n.isView && (plugin.capabilities.rowEditing === "primaryKey" || plugin.capabilities.rowEditing === "documentId") && !mgr.isReadOnly(profile)) {
      const info = await conn.introspect().describeTable({ name: n.name, ...(n.schema ? { schema: n.schema } : {}) });
      if (info.columns?.some((c) => c.primaryKey)) edit = { target: { ...(n.schema ? { schema: n.schema } : {}), table: n.name, columns: info.columns } };
    }
    // The statement carries the row cap, not the first page: the runner reads pages of it and "Load more" continues from there.
    const limit = Math.min(cfg().get<number>("query.maxRows", 100000), profile.driver === "elasticsearch" ? 10000 : Infinity);
    const ref: TableRef = { name: n.name, ...(n.schema ? { schema: n.schema } : {}), isView: !!n.isView };
    const keyset = await keysetFor(profile, conn, ref);
    const open = keyset ? buildTableQuery({ driver: profile.driver, quoted: name, schema: n.schema, name: n.name, where: "", order: keysetOrder(keyset.keys), limit }) : plugin.openCommand ? plugin.openCommand({ ...(n.schema ? { schema: n.schema } : {}), name: n.name }, limit) : plugin.selectTop(name, limit);
    await execute(profile.id, open, n.name, edit, undefined, ref, keyset ? { skip: 0, keyset } : undefined);
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
      if ((e as Error).name !== "AbortError") void vscode.window.showErrorMessage(t("Export failed: {0}", friendly((e as Error).message)));
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
    } catch (e) { void vscode.window.showErrorMessage(t("Could not build the diagram: {0}", friendly((e as Error).message))); }
  });
  reg("rizomadb.designTable", async (n?: Node) => {
    const id = await sqlConnOf(n); if (!id) return;
    const profile = mgr.get(id)!;
    const plugin = await mgr.loadDriver(profile.driver);
    if (!plugin.capabilities.ddlGeneration) { void vscode.window.showWarningMessage(t("This engine does not support the table designer.")); return; }
    try {
      const model = await loadModel(mgr, id);
      openDesigner(ctx, mgr, policy, id, model, n?.kind === "table" ? n.name : undefined, () => { schemaCache.invalidate(id); explorer.refresh(); });
    } catch (e) { void vscode.window.showErrorMessage(t("Could not open the designer: {0}", friendly((e as Error).message))); }
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
    const summary = describeChanges(current, source, { table: t("table"), column: t("column"), index: t("index"), foreignKey: t("foreign key"), primaryKeyOf: t("primary key of"), on: t("on") });
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
    const lines = missing.map((m) => { const tb = model.tables.find((x) => x.name === m.table)!; return `-- ${t("{0}.{1}: joins and cascades on {2} scan the whole table", m.table, m.fk, m.columns.join(", "))}\n${renderScript([{ sql: createIndex(model.dialect, tb, { name: `ix_${m.table}_${m.columns.join("_")}`.slice(0, 60), columns: m.columns, unique: false }) }]).trim()}`; });
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
    const p = n.profile;
    if (mgr.isShared(p.id)) { void vscode.window.showInformationMessage(t("This connection comes from a shared catalog and cannot be changed here.")); return; }
    if (!mgr.isReadOnly(p)) { await mgr.setEditable(p.id, false); return; }
    if (mgr.policyLocked(p)) { void vscode.window.showWarningMessage(t("A policy blocks writes in the “{0}” environment, so this connection cannot be made editable.", p.environment)); return; }
    if (p.environment === "prod" && !(await vscode.window.showWarningMessage(t("Allow writes on “{0}”? It is a prod connection; every write will still ask for confirmation.", p.name), { modal: true }, t("Allow writes")))) return;
    await mgr.setEditable(p.id, true);
  });
  reg("rizomadb.buildQuery", async (n: Node) => {
    if (n?.kind !== "connection") return;
    const p = n.profile;
    if (filterKindOf(p.driver) !== "sql") { void vscode.window.showInformationMessage(t("The query builder is for SQL engines.")); return; }
    const conn = await mgr.connect(p.id), api = conn.introspect();
    const tables = await api.listTables();
    const tpick = await vscode.window.showQuickPick(tables.map((x) => ({ label: x.name, description: x.schema ?? "", ref: x })), { title: t("Table to query"), matchOnDescription: true }); if (!tpick) return;
    const info = await api.describeTable({ name: tpick.ref.name, ...(tpick.ref.schema ? { schema: tpick.ref.schema } : {}) });
    const columns = (info.columns ?? []).map((c) => ({ name: c.name, kind: kindOfNative(c.nativeType) }));
    if (!columns.length) { void vscode.window.showWarningMessage(t("Could not read the table definition.")); return; }
    const chosen = await vscode.window.showQuickPick(columns.map((c) => ({ label: c.name, description: c.kind })), { title: t("Columns to show (none selected = all)"), canPickMany: true }); if (!chosen) return;
    const where: Condition[] = [];
    for (;;) {
      const next = await vscode.window.showQuickPick([{ label: where.length ? t("Add another condition…") : t("Add a condition…"), v: "add" }, { label: t("Continue"), v: "go" }], { title: t("Conditions: {0}", String(where.length)) }); if (!next) return;
      if (next.v === "go") break;
      const col = await vscode.window.showQuickPick(columns.map((c) => ({ label: c.name, description: c.kind })), { title: t("Column")}); if (!col) continue;
      const op = await vscode.window.showQuickPick([...OPERATORS], { title: t("Operator") }); if (!op) continue;
      const needsValue = op !== "IS NULL" && op !== "IS NOT NULL";
      const value = needsValue ? await vscode.window.showInputBox({ title: `${col.label} ${op}`, prompt: op === "IN" ? t("Values separated by commas") : undefined }) : "";
      if (value === undefined) continue;
      where.push({ column: col.label, op: op as Condition["op"], ...(needsValue ? { value } : {}) });
    }
    const ord = await vscode.window.showQuickPick([{ label: t("No ordering"), v: "" }, ...columns.map((c) => ({ label: c.name, v: c.name }))], { title: t("Order by") }); if (!ord) return;
    let desc = false;
    if (ord.v) { const d = await vscode.window.showQuickPick([{ label: t("ascending"), v: false }, { label: t("descending"), v: true }], { title: t("Direction") }); if (!d) return; desc = d.v; }
    const lim = await vscode.window.showInputBox({ title: t("Maximum rows"), value: "100", validateInput: (v) => (/^[1-9]\d{0,6}$/.test(v) ? undefined : t("Enter a whole number")) }); if (!lim) return;
    try {
      const sql = buildSelect({ driver: p.driver, quote: conn.quoteIdent, table: info.name, schema: info.schema, columns, select: chosen.map((c) => c.label), where, orderBy: ord.v ? [{ column: ord.v, desc }] : [], limit: Number(lim) });
      const doc = await vscode.workspace.openTextDocument({ language: "sql", content: `${sql};\n` });
      await ctx.workspaceState.update(`doc:${doc.uri.toString()}`, p.id);
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
    } catch (e) { void vscode.window.showErrorMessage(e instanceof BuilderError ? friendly(e.message) : (e as Error).message); }
  });
  reg("rizomadb.exportCatalog", async () => {
    const mine = mgr.list().filter((p) => !mgr.isShared(p.id));
    if (!mine.length) { void vscode.window.showInformationMessage(t("You have no saved connections yet")); return; }
    const ask = (title: string) => vscode.window.showInputBox({ title, password: true, ignoreFocusOut: true, validateInput: (v) => (v.length >= MIN_PASSPHRASE ? undefined : t("Use at least {0} characters.", MIN_PASSPHRASE)) });
    const pass = await ask(t("Passphrase to seal the connections (needed to open the file)")); if (!pass) return;
    if ((await ask(t("Repeat the passphrase"))) !== pass) { void vscode.window.showErrorMessage(t("The passphrases do not match.")); return; }
    const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file("rizomadb-connections.rzcat"), filters: { [t("Sealed connections")]: ["rzcat"] } }); if (!target) return;
    await vscode.workspace.fs.writeFile(target, Buffer.from(seal(mine, pass), "utf8"));
    void vscode.window.showInformationMessage(t("Exported {0} connections. Passwords are not included: they are asked for on first connect.", String(mine.length)));
  });
  reg("rizomadb.importCatalog", async () => {
    const picked = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { [t("Sealed connections")]: ["rzcat"] } }); if (!picked?.[0]) return;
    const bytes = await vscode.workspace.fs.readFile(picked[0]);
    if (bytes.byteLength > 5_000_000) { void vscode.window.showErrorMessage(t("This is not a sealed connections file.")); return; }
    const pass = await vscode.window.showInputBox({ title: t("Passphrase of the sealed file"), password: true, ignoreFocusOut: true }); if (!pass) return;
    try {
      const list = unseal(Buffer.from(bytes).toString("utf8"), pass);
      let added = 0, skipped = 0;
      for (const p of list) { if (mgr.get(p.id)) { skipped++; continue; } await mgr.add({ id: p.id, name: p.name, driver: p.driver, environment: p.environment, readOnly: p.readOnly, tags: p.tags, secretKeys: p.secretKeys, values: p.options }); added++; }
      void vscode.window.showInformationMessage(t("Imported {0} connections ({1} already existed).", String(added), String(skipped)));
    } catch (e) {
      const c = e instanceof SealedCatalogError ? e.code : "invalid";
      void vscode.window.showErrorMessage(c === "wrong-passphrase" ? t("Wrong passphrase, or the file was altered.") : c === "not-sealed" ? t("This is not a sealed connections file.") : t("The file is damaged or has unsupported content."));
    }
  });
  reg("rizomadb.readOnlyUser", async (n: Node) => {
    if (n.kind !== "connection") return;
    const key = engineOf(n.profile)?.key ?? n.profile.driver;
    if (!supportsReadOnlyUser(key)) { void vscode.window.showInformationMessage(t("A read-only user script is not available for {0} yet.", engineOf(n.profile)?.name ?? n.profile.driver)); return; }
    const user = await vscode.window.showInputBox({ title: t("Name of the read-only account"), value: "rizoma_readonly", validateInput: (v) => (/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(v) ? undefined : t("Use letters, digits and underscores, starting with a letter or underscore.")) });
    if (!user) return;
    let database = databaseOf(n.profile);
    if (key !== "redis" && !database) database = (await vscode.window.showInputBox({ title: t("Database the account may read"), validateInput: (v) => (v.trim() ? undefined : t("A database name is required.")) }))?.trim() ?? "";
    if (key !== "redis" && !database) return;
    try {
      const script = readOnlyUserScript(key, { user, database }, t("Review this script, replace the password placeholder and run it with an administrator account. RizomaDB does not run it."));
      const doc = await vscode.workspace.openTextDocument({ language: script.language, content: script.text });
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
    } catch (e) { void vscode.window.showErrorMessage(e instanceof ReadOnlyUserError ? t("That name cannot be used in the script.") : (e as Error).message); }
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
    } catch (e) { void vscode.window.showErrorMessage(t("Could not get a plan: {0}", friendly((e as Error).message))); }
  });
  reg("rizomadb.openHistory", async () => {
    openHistoryScreen(ctx, history, favorites, {
      exists: (id) => !!mgr.get(id),
      run: (id, sql) => execute(id, sql, t("Query")),
      open: async (id, sql) => {
        const doc = await vscode.workspace.openTextDocument({ language: "sql", content: sql });
        if (mgr.get(id)) await ctx.workspaceState.update(`doc:${doc.uri.toString()}`, id);
        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
      },
      clear: async () => { const ok = await vscode.window.showWarningMessage(t("Delete the whole query history?"), { modal: true }, t("Delete")); if (!ok) return false; await history.prune(-1); return true; },
    });
  });

  ctx.subscriptions.push(
    vscode.window.createTreeView("rizomadb.connections", { treeDataProvider: explorer, showCollapseAll: true }),
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
  editorToolsRef.current = registerEditorTools(ctx, { label: (doc) => { const p = mgr.get(docConn(doc) ?? ""); if (!p) return undefined; const db = databaseOf(p); return `[${p.environment.toUpperCase()}] ${p.name}${db ? ` · ${db}` : ""}`; } });
  refreshStatus();
  // The first time only: offer the guide (never blocks activation).
  setTimeout(() => { void offerGuideOnce(ctx).catch(() => {}); }, 2500);
}

let pendingAudit: AuditLog | undefined;
/** Written audit entries must survive a window close. */
export async function deactivate() { await pendingAudit?.flush(); }
