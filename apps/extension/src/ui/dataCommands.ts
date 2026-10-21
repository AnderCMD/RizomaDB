import * as vscode from "vscode";
import { homedir } from "node:os";
import { join } from "node:path";
import { collect, type ColumnDef, type Value } from "@rizomadb/driver-api";
import { decideEffective, type EditTarget, type EffectivePolicy } from "@rizomadb/core";
import { backupSpec, backupSqlite, diffTables, generateRows, importRows, kindFromNative, openSource, renderSyncScript, restoreSpec, runTool, syncChanges, applySync, verifyBackup, type GenColumn, type ImportMapping, type DataDiff } from "@rizomadb/data-tools";
import type { ConnectionManager } from "../lib/connections.js";
import type { Node } from "./explorer.js";

const t = vscode.l10n.t;
const sig = () => new AbortController().signal;

interface Deps { ctx: vscode.ExtensionContext; mgr: ConnectionManager; policy: () => EffectivePolicy; pick: () => Promise<string | undefined>; reg: (id: string, fn: (...a: never[]) => unknown) => void; refresh: () => void }

export function registerDataCommands({ mgr, policy, pick, reg, refresh }: Deps) {
  const tableOf = (n: Node | undefined) => (n?.kind === "table" ? n : undefined);
  const ensureWritable = (profile: NonNullable<ReturnType<ConnectionManager["get"]>>, sql: string) => {
    const d = decideEffective(sql, { environment: profile.environment, readOnly: mgr.isReadOnly(profile) }, policy());
    if (!d.allowed) { void vscode.window.showErrorMessage(d.reason ?? t("Blocked by policy")); return false; }
    return true;
  };
  const confirmEnv = async (profile: { environment: string; name: string }, what: string, detail?: string) => {
    const strong = profile.environment === "prod" || profile.environment === "staging";
    return (await vscode.window.showWarningMessage(t("[{0}] {1}: {2}", profile.environment.toUpperCase(), profile.name, what), { modal: true, ...(detail ? { detail } : {}) }, strong ? t("Yes, on {0}", profile.environment.toUpperCase()) : t("Continue"))) !== undefined;
  };
  const needSql = async (profile: { driver: string }) => {
    const p = await mgr.loadDriver(profile.driver);
    if (!p.capabilities.sql) { void vscode.window.showInformationMessage(t("{0} is not a SQL engine: this tool is not available for it.", p.displayName)); return false; }
    return true;
  };
  const describe = async (n: Extract<Node, { kind: "table" }>) => {
    const conn = await mgr.connect(n.profile.id);
    const info = await conn.introspect().describeTable({ name: n.name, ...(n.schema ? { schema: n.schema } : {}) });
    const target: EditTarget = { ...(n.schema ? { schema: n.schema } : {}), table: n.name, columns: info.columns as ColumnDef[] };
    return { conn, target, plugin: await mgr.loadDriver(n.profile.driver) };
  };

  reg("rizomadb.import", async (n?: Node) => {
    const tb = tableOf(n); if (!tb) { void vscode.window.showInformationMessage(t("Right-click a table and choose Import Data.")); return; }
    const profile = tb.profile;
    if (!(await needSql(profile))) return;
    if (!ensureWritable(profile, "INSERT INTO t VALUES (1)")) return;
    const f = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Data: ["csv", "tsv", "json", "jsonl", "ndjson", "txt"] } }); if (!f?.[0]) return;
    try {
      const { conn, target, plugin } = await describe(tb);
      const src = await openSource(f[0].fsPath);
      const lower = new Map(src.columns.map((c, i) => [c.toLowerCase(), i]));
      const mapping: ImportMapping[] = [];
      const unmapped: string[] = [];
      for (const c of target.columns) { const i = lower.get(c.name.toLowerCase()); if (i === undefined) unmapped.push(c.name); else mapping.push({ source: i, target: { name: c.name, kind: kindFromNative(c.nativeType), nullable: c.nullable, hasDefault: !!c.default } }); }
      const missingRequired = unmapped.filter((u) => { const c = target.columns.find((x) => x.name === u)!; return !c.nullable && !c.default; });
      if (!mapping.length) { void vscode.window.showErrorMessage(t("No file column matches a table column. Rename the header row to match.")); return; }
      if (missingRequired.length) { void vscode.window.showErrorMessage(t("These required columns are missing from the file: {0}", missingRequired.join(", "))); return; }
      const mode = await vscode.window.showQuickPick([{ label: t("Stop at the first bad row and roll everything back"), v: "abort" as const }, { label: t("Skip bad rows and report them"), v: "skip" as const }],
        { title: t("{0} → {1}: {2} of {3} columns mapped ({4}, {5})", f[0].fsPath.split(/[\\/]/).pop() ?? "", tb.name, mapping.length, target.columns.length, src.format, src.encoding), ignoreFocusOut: true });
      if (!mode) return;
      if (!(await confirmEnv(profile, t("import into {0}?", tb.name), unmapped.length ? t("Not in the file (left to defaults/NULL): {0}", unmapped.join(", ")) : undefined))) return;
      const ac = new AbortController();
      const res = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t("Importing into {0}", tb.name), cancellable: true }, (progress, token) => {
        token.onCancellationRequested(() => ac.abort());
        let last = 0;
        return importRows({ conn, plugin, table: { ...(tb.schema ? { schema: tb.schema } : {}), name: tb.name }, mapping, rows: src.rows, onError: mode.v, signal: ac.signal, batchRows: 1000,
          onProgress: (p) => { progress.report({ message: t("{0} rows", p.inserted.toLocaleString()), increment: 0 }); last = p.inserted; void last; } });
      });
      void vscode.window.showInformationMessage(t("Imported {0} rows ({1} skipped).", res.inserted.toLocaleString(), res.skipped));
      if (res.errors.length) { const d = await vscode.workspace.openTextDocument({ content: res.errors.map((e) => `row ${e.row}: ${e.message}`).join("\n") }); await vscode.window.showTextDocument(d, { preview: true }); }
      refresh();
    } catch (e) { void vscode.window.showErrorMessage(t("Import failed (nothing was imported): {0}", (e as Error).message)); }
  });

  reg("rizomadb.backup", async (n?: Node) => {
    const id = n && "profile" in n ? n.profile.id : await pick(); if (!id) return;
    const profile = mgr.get(id)!;
    const ext = profile.driver === "postgres" ? "dump" : profile.driver === "mysql" ? "sql" : profile.driver === "mongodb" ? "archive.gz" : "db";
    if (!["postgres", "mysql", "sqlite", "mongodb"].includes(profile.driver)) { void vscode.window.showWarningMessage(t("No supported native backup tool for this engine; use the vendor's tool.")); return; }
    const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(join(homedir(), `${profile.name}.${ext}`)) }); if (!uri) return;
    try {
      const { resolveConfig } = await import("@rizomadb/core");
      const run = async (progress: vscode.Progress<{ message?: string }>, token: vscode.CancellationToken) => {
        const ac = new AbortController(); token.onCancellationRequested(() => ac.abort());
        if (profile.driver === "sqlite") { await backupSqlite(await mgr.connect(id), uri.fsPath, ac.signal); return { code: 0, stderr: "" }; }
        const cfg = await resolveConfig(profile, mgrSecrets(), process.env);
        return runTool(await backupSpec(profile.driver as "postgres" | "mysql" | "mongodb", cfg, uri.fsPath), { signal: ac.signal, onOutput: (l) => progress.report({ message: l.slice(0, 80) }) });
      };
      const r = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t("Backing up {0}", profile.name), cancellable: true }, run);
      if (r.code !== 0) { void vscode.window.showErrorMessage(t("Backup tool failed: {0}", r.stderr.slice(0, 400))); return; }
      const v = await verifyBackup(profile.driver as "postgres" | "mysql" | "mongodb" | "sqlite", uri.fsPath);
      void (v.ok ? vscode.window.showInformationMessage(t("Backup written and verified: {0}", v.detail)) : vscode.window.showErrorMessage(t("Backup written but NOT verified: {0}", v.detail)));
    } catch (e) { void vscode.window.showErrorMessage(t("Backup failed: {0}", (e as Error).message)); }
  });

  reg("rizomadb.restore", async (n?: Node) => {
    const id = n && "profile" in n ? n.profile.id : await pick(); if (!id) return;
    const profile = mgr.get(id)!;
    if (!["postgres", "mysql", "mongodb"].includes(profile.driver)) { void vscode.window.showWarningMessage(t("Restore is supported for PostgreSQL, MySQL/MariaDB and MongoDB. For SQLite, replace the database file.")); return; }
    if (!ensureWritable(profile, "DROP TABLE x")) return;
    const f = await vscode.window.showOpenDialog({ canSelectMany: false }); if (!f?.[0]) return;
    if (!(await confirmEnv(profile, t("restore {0} from this file? Existing objects with the same names are replaced.", profile.name), f[0].fsPath))) return;
    try {
      const { resolveConfig } = await import("@rizomadb/core");
      const cfg = await resolveConfig(profile, mgrSecrets(), process.env);
      const r = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t("Restoring {0}", profile.name), cancellable: true }, async (progress, token) => {
        const ac = new AbortController(); token.onCancellationRequested(() => ac.abort());
        return runTool(await restoreSpec(profile.driver as "postgres" | "mysql" | "mongodb", cfg, f[0]!.fsPath), { signal: ac.signal, onOutput: (l) => progress.report({ message: l.slice(0, 80) }) });
      });
      void (r.code === 0 ? vscode.window.showInformationMessage(t("Restore completed.")) : vscode.window.showErrorMessage(t("Restore reported errors: {0}", r.stderr.slice(0, 400))));
      refresh();
    } catch (e) { void vscode.window.showErrorMessage(t("Restore failed: {0}", (e as Error).message)); }
  });

  reg("rizomadb.compareData", async (n?: Node) => {
    const tb = tableOf(n); if (!tb) { void vscode.window.showInformationMessage(t("Right-click a table and choose Compare Data.")); return; }
    if (!(await needSql(tb.profile))) return;
    const others = mgr.list().filter((p) => p.driver !== "mongodb" && p.driver !== "redis");
    const pickT = await vscode.window.showQuickPick(others.map((p) => ({ label: p.name, description: `[${p.environment}] ${p.driver}`, id: p.id })), { title: t("Target connection (will be made to match {0})", tb.name) });
    if (!pickT) return;
    const tProfile = mgr.get(pickT.id)!;
    const tName = await vscode.window.showInputBox({ title: t("Target table name"), value: tb.name, ignoreFocusOut: true }); if (!tName) return;
    try {
      const s = await describe(tb);
      const tConn = await mgr.connect(pickT.id); const tPlugin = await mgr.loadDriver(tProfile.driver);
      const tInfo = await tConn.introspect().describeTable({ name: tName });
      const tCols = new Map(tInfo.columns!.map((c) => [c.name.toLowerCase(), c]));
      const common = s.target.columns.filter((c) => tCols.has(c.name.toLowerCase()));
      const pk = common.filter((c) => c.primaryKey).map((c) => c.name);
      if (!pk.length) { void vscode.window.showErrorMessage(t("The table needs a primary key to match rows.")); return; }
      const names = common.map((c) => tCols.get(c.name.toLowerCase())!.name);
      const keyT = pk.map((k) => tCols.get(k.toLowerCase())!.name);
      // Both sides must be read with the same column names; the target's spelling is authoritative for generated SQL.
      const sCols = common.map((c) => c.name);
      void sCols;
      const diffs: DataDiff[] = [];
      const ac = new AbortController();
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t("Comparing rows…"), cancellable: true }, async (_p, token) => {
        token.onCancellationRequested(() => ac.abort());
        for await (const d of diffTables({ source: s.conn, target: tConn, sourcePlugin: s.plugin, targetPlugin: tPlugin, sourceTable: { ...(tb.schema ? { schema: tb.schema } : {}), name: tb.name }, targetTable: { name: tName }, key: keyT, columns: names, signal: ac.signal })) diffs.push(d);
      });
      const c = { ins: diffs.filter((d) => d.kind === "only-in-source").length, upd: diffs.filter((d) => d.kind === "different").length, del: diffs.filter((d) => d.kind === "only-in-target").length };
      if (!diffs.length) { void vscode.window.showInformationMessage(t("The tables have identical data.")); return; }
      const act = await vscode.window.showQuickPick([
        { label: t("Show sync script ({0} insert, {1} update)", c.ins, c.upd), v: "script" as const, d: false }, { label: t("Show sync script including {0} delete(s)", c.del), v: "script" as const, d: true },
        { label: t("Apply now (insert/update only)"), v: "apply" as const, d: false }], { title: t("{0} to insert, {1} to update, {2} extra in target", c.ins, c.upd, c.del) });
      if (!act) return;
      const target: EditTarget = { table: tName, columns: tInfo.columns as ColumnDef[] };
      const changes = syncChanges(diffs, { deletes: act.d });
      if (act.v === "script") { await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ language: "sql", content: renderSyncScript(tPlugin, target, changes) })); return; }
      if (!ensureWritable(tProfile, "UPDATE t SET a = 1 WHERE id = 1")) return;
      const r = await applySync(changes, { conn: tConn, plugin: tPlugin, table: target, environment: tProfile.environment, readOnly: mgr.isReadOnly(tProfile), policy: policy(), confirm: async (sql) => confirmEnv(tProfile, t("apply {0} change(s)?", sql.length), sql.slice(0, 5).join("\n")) });
      void vscode.window.showInformationMessage(t("{0} change(s) applied in one transaction.", r.applied));
    } catch (e) { void vscode.window.showErrorMessage(t("Comparison failed: {0}", (e as Error).message)); }
  });

  reg("rizomadb.generateData", async (n?: Node) => {
    const tb = tableOf(n); if (!tb) { void vscode.window.showInformationMessage(t("Right-click a table and choose Generate Test Data.")); return; }
    const profile = tb.profile;
    if (!(await needSql(profile))) return;
    if (profile.environment === "prod") { void vscode.window.showErrorMessage(t("Test data generation is disabled on prod connections.")); return; }
    if (!ensureWritable(profile, "INSERT INTO t VALUES (1)")) return;
    const count = await vscode.window.showInputBox({ title: t("How many rows?"), value: "1000", validateInput: (v) => (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 5_000_000 ? undefined : t("Enter a number from 1 to 5,000,000")) }); if (!count) return;
    const seed = await vscode.window.showInputBox({ title: t("Seed (same seed = same data)"), value: "42", validateInput: (v) => (/^\d+$/.test(v) ? undefined : t("Enter a whole number")) }); if (!seed) return;
    const loc = await vscode.window.showQuickPick([{ label: "Español", v: "es" as const }, { label: "English", v: "en" as const }], { title: t("Language of generated text") }); if (!loc) return;
    try {
      const { conn, target, plugin } = await describe(tb);
      const api = conn.introspect();
      const fks = api.foreignKeys ? await api.foreignKeys(tb.schema) : [];
      const idx = api.indexes ? await api.indexes(tb.schema) : [];
      const mine = fks.filter((f) => f.from.table.toLowerCase() === tb.name.toLowerCase());
      const cols: GenColumn[] = [], mapping: ImportMapping[] = [];
      let startAt = 1;
      for (const c of target.columns) {
        const kind = kindFromNative(c.nativeType);
        const autoPk = c.primaryKey && !!c.default;
        if (autoPk) continue;
        const fk = mine.find((f) => f.from.columns.length === 1 && f.from.columns[0]!.toLowerCase() === c.name.toLowerCase());
        let references: Value[] | undefined;
        if (fk) {
          const pq = plugin.quoteIdent; const tbl = fk.to.schema ? `${pq(fk.to.schema)}.${pq(fk.to.table)}` : pq(fk.to.table);
          const parent = await collect(conn.execute({ sql: plugin.selectTop(tbl, 10000) }, sig()));
          const at = parent.columns.findIndex((x) => x.name.toLowerCase() === fk.to.columns[0]!.toLowerCase());
          references = at < 0 ? [] : parent.rows.map((r) => r[at]!);
          if (!references.length && !c.nullable) { void vscode.window.showErrorMessage(t("Table {0} has no rows yet; generate its data first (column {1} needs a parent).", fk.to.table, c.name)); return; }
        }
        if (c.primaryKey && kind === "integer") { const r = await collect(conn.execute({ sql: `SELECT MAX(${plugin.quoteIdent(c.name)}) FROM ${tb.schema ? plugin.quoteIdent(tb.schema) + "." : ""}${plugin.quoteIdent(tb.name)}` }, sig())); startAt = Number(r.rows[0]?.[0] ?? 0) + 1; }
        const unique = idx.some((i) => i.unique && !i.primary && i.table.toLowerCase() === tb.name.toLowerCase() && i.columns.length === 1 && i.columns[0]!.toLowerCase() === c.name.toLowerCase());
        cols.push({ name: c.name, kind, nullable: c.nullable, primaryKey: c.primaryKey, unique, nativeType: c.nativeType, ...(references ? { references } : {}) });
        mapping.push({ source: cols.length - 1, target: { name: c.name, kind, nullable: c.nullable } });
      }
      if (!(await confirmEnv(profile, t("insert {0} generated rows into {1}?", Number(count).toLocaleString(), tb.name)))) return;
      const ac = new AbortController();
      const res = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t("Generating {0}", tb.name), cancellable: true }, (progress, token) => {
        token.onCancellationRequested(() => ac.abort());
        return importRows({ conn, plugin, table: { ...(tb.schema ? { schema: tb.schema } : {}), name: tb.name }, mapping, rows: (function* () { yield* generateRows(cols, Number(count), { seed: Number(seed), locale: loc.v, startAt }); })() as unknown as AsyncIterable<unknown[]>, typed: true, batchRows: 1000, signal: ac.signal, onProgress: (p) => progress.report({ message: t("{0} rows", p.inserted.toLocaleString()) }) });
      });
      void vscode.window.showInformationMessage(t("Inserted {0} generated rows.", res.inserted.toLocaleString()));
      refresh();
    } catch (e) { void vscode.window.showErrorMessage(t("Generation failed (nothing was inserted): {0}", (e as Error).message)); }
  });

  function mgrSecrets() { return (mgr as unknown as { secrets: import("@rizomadb/core").SecretStore }).secrets; }
}
