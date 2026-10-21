import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { collect } from "@rizomadb/driver-api";
import { decideEffective, type EffectivePolicy } from "@rizomadb/core";
import { Admin, MetricSampler, grantStatement, providers, snapshotToRecord, type Engine, type Table } from "@rizomadb/admin";
import type { ConnectionManager } from "../lib/connections.js";
import type { Node } from "./explorer.js";

const t = vscode.l10n.t;
const ENGINES = new Set(["postgres", "mysql", "mssql", "oracle"]);

interface Deps {
  ctx: vscode.ExtensionContext; mgr: ConnectionManager; policy: () => EffectivePolicy; pick: () => Promise<string | undefined>;
  reg: (id: string, fn: (...a: never[]) => unknown) => void;
  show: (title: string, table: Table) => void;
}

export function registerAdminCommands({ ctx, mgr, policy, pick, reg, show }: Deps) {
  const target = async (n?: Node) => {
    const id = n && "profile" in n ? n.profile.id : await pick(); if (!id) return undefined;
    const profile = mgr.get(id)!;
    if (!ENGINES.has(profile.driver)) { void vscode.window.showInformationMessage(t("The administration tools cover PostgreSQL, MySQL/MariaDB, SQL Server and Oracle.")); return undefined; }
    return { id, profile, admin: new Admin(await mgr.connect(id), profile.driver as Engine) };
  };
  const guarded = async (profile: NonNullable<ReturnType<ConnectionManager["get"]>>, statements: string[], what: string, note?: string) => {
    for (const s of statements) {
      const d = decideEffective(s, { environment: profile.environment, readOnly: mgr.isReadOnly(profile) }, policy());
      // administrative statements are never "reads"; a read-only connection or prod policy must stop them
      if (!d.allowed || mgr.isReadOnly(profile)) { void vscode.window.showErrorMessage(d.reason ?? t("This connection is read-only.")); return false; }
    }
    const ok = await vscode.window.showWarningMessage(t("[{0}] {1}: {2}", profile.environment.toUpperCase(), profile.name, what), { modal: true, detail: `${statements.join("\n")}${note ? `\n\n${note}` : ""}` }, t("Run"));
    return ok !== undefined;
  };
  const run = async (id: string, statements: string[]) => { const conn = await mgr.connect(id); for (const s of statements) await collect(conn.execute({ sql: s }, new AbortController().signal)); };

  const views: [string, string, (a: Admin) => Promise<Table>][] = [
    ["Sessions", "Sessions", (a) => a.sessions()], ["Blocking and locks", "Locks", (a) => a.locks()], ["Slowest queries", "Slow queries", (a) => a.slowQueries(50)],
    ["Table sizes and activity", "Table statistics", (a) => a.tableStats()], ["Unused indexes", "Unused indexes", (a) => a.unusedIndexes()], ["Server variables", "Variables", (a) => a.variables()], ["Roles and users", "Roles", (a) => a.roles()],
  ];

  reg("rizomadb.admin", async (n?: Node) => {
    const x = await target(n); if (!x) return;
    const pickV = await vscode.window.showQuickPick([...views.map(([label, , f], i) => ({ label: t(label), i, f })), { label: t("Live metrics"), i: -1, f: undefined }], { title: t("Administration: {0}", x.profile.name) }); if (!pickV) return;
    if (pickV.i === -1) { await vscode.commands.executeCommand("rizomadb.admin.metrics", n); return; }
    try { const table = await pickV.f!(x.admin); show(`${x.profile.name} — ${views[pickV.i]![1]}`, table); }
    catch (e) { void vscode.window.showErrorMessage(t("Could not read this information (it may need elevated privileges): {0}", (e as Error).message)); }
  });

  reg("rizomadb.admin.kill", async (n?: Node) => {
    const x = await target(n); if (!x) return;
    try {
      const s = await x.admin.sessions();
      const idc = s.columns.indexOf("id"), uc = s.columns.indexOf("user"), qc = s.columns.indexOf("query"), me = s.columns.indexOf("is_me");
      const pickS = await vscode.window.showQuickPick(s.rows.filter((r) => ![true, 1, "1", 1n].includes(r[me] as never)).map((r) => ({ label: `${String(r[idc])} · ${String(r[uc] ?? "")}`, description: String(r[qc] ?? "").replace(/\s+/g, " ").slice(0, 80), id: String(r[idc]) })), { title: t("Session to end (yours is hidden)") });
      if (!pickS) return;
      const hard = x.profile.driver === "mssql" ? true : (await vscode.window.showQuickPick([{ label: t("Cancel the running statement only"), h: false }, { label: t("Terminate the whole session"), h: true }], { title: t("How?") }))?.h;
      if (hard === undefined) return;
      const stmts = x.admin.killStatements(pickS.id, hard);
      if (await guarded(x.profile, stmts, t("end session {0}?", pickS.id))) { await run(x.id, stmts); void vscode.window.showInformationMessage(t("Done.")); }
    } catch (e) { void vscode.window.showErrorMessage(t("Failed: {0}", (e as Error).message)); }
  });

  reg("rizomadb.admin.setVariable", async (n?: Node) => {
    const x = await target(n); if (!x) return;
    try {
      const v = await x.admin.variables();
      const pickV = await vscode.window.showQuickPick(v.rows.map((r) => ({ label: String(r[0]), description: String(r[1] ?? "") })), { title: t("Server variable"), matchOnDescription: true }); if (!pickV) return;
      const val = await vscode.window.showInputBox({ title: t("New value for {0}", pickV.label), value: pickV.description, ignoreFocusOut: true }); if (val === undefined) return;
      const plan = x.admin.setVariableStatements(pickV.label, val);
      if (await guarded(x.profile, plan.statements, t("change server setting {0}?", pickV.label), plan.note)) { await run(x.id, plan.statements); void vscode.window.showInformationMessage(t("Setting changed.")); }
    } catch (e) { void vscode.window.showErrorMessage(t("Failed: {0}", (e as Error).message)); }
  });

  reg("rizomadb.admin.privileges", async (n?: Node) => {
    const x = await target(n); if (!x) return;
    try {
      const roles = await x.admin.roles();
      const pickR = await vscode.window.showQuickPick(roles.rows.map((r) => ({ label: String(r[0]), description: r.length > 1 ? String(r[1] ?? "") : "" })), { title: t("Role or user") }); if (!pickR) return;
      const role = x.profile.driver === "mysql" ? `${pickR.label}@${pickR.description || "%"}` : pickR.label;
      show(`${x.profile.name} — ${t("Effective privileges of {0}", pickR.label)}`, await x.admin.privileges(role));
    } catch (e) { void vscode.window.showErrorMessage(t("Failed: {0}", (e as Error).message)); }
  });

  reg("rizomadb.admin.grant", async (n?: Node) => {
    const x = await target(n); if (!x) return;
    const role = await vscode.window.showInputBox({ title: t("Role or user"), ignoreFocusOut: true }); if (!role) return;
    const action = await vscode.window.showQuickPick(["GRANT", "REVOKE"], { title: t("Action") }); if (!action) return;
    const priv = await vscode.window.showQuickPick(["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "EXECUTE", "ALL"], { title: t("Privilege") }); if (!priv) return;
    const obj = await vscode.window.showInputBox({ title: t("Object as schema.name (or just name)"), ignoreFocusOut: true }); if (!obj) return;
    try {
      const [a, b] = obj.includes(".") ? obj.split(".") : [undefined, obj];
      const sql = grantStatement(x.profile.driver as Engine, action as "GRANT" | "REVOKE", priv, { ...(a ? { schema: a } : {}), name: b! }, role);
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ language: "sql", content: `-- ${t("Review, then run with the editor connected to {0}", x.profile.name)}\n${sql};\n` }), { preview: false });
    } catch (e) { void vscode.window.showErrorMessage((e as Error).message); }
  });

  reg("rizomadb.admin.metrics", async (n?: Node) => {
    const x = await target(n); if (!x) return;
    const root = vscode.Uri.joinPath(ctx.extensionUri, "dist");
    const panel = vscode.window.createWebviewPanel("rizomadb.metrics", `Metrics: ${x.profile.name}`, vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [root] });
    const nonce = randomBytes(16).toString("base64"), w = panel.webview;
    w.html = `<!doctype html><html lang="${vscode.env.language}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${w.asWebviewUri(vscode.Uri.joinPath(root, "webview.css"))}"><title>Metrics</title></head>
<body><header><strong id="title"></strong></header><div id="charts"></div><div id="live" class="sr-only" aria-live="polite"></div>
<script nonce="${nonce}" src="${w.asWebviewUri(vscode.Uri.joinPath(root, "metrics.js"))}"></script></body></html>`;
    const defs = providers[x.profile.driver as Engine].metricDefs, sampler = new MetricSampler(defs);
    let busy = false;
    const tick = async () => {
      if (busy || !panel.visible) return; busy = true;
      try { const values = sampler.push(snapshotToRecord(await x.admin.metricsSnapshot())); void w.postMessage({ v: 1, type: "sample", title: x.profile.name, defs, values, t: Date.now() }); }
      catch { /* a transient error skips one sample */ } finally { busy = false; }
    };
    const timer = setInterval(() => void tick(), 2000);
    void tick();
    panel.onDidDispose(() => clearInterval(timer));
  });
}
