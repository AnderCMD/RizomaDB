import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { collect } from "@rizomadb/driver-api";
import { decide, type Policy } from "@rizomadb/core";
import { createScript, diffModels, migrationStatements, type ColumnM, type Dialect, type SchemaModel, type Statement, type TableM } from "@rizomadb/schema-tools";
import { DesignerToHost, type DesignTable } from "../designMessages.js";
import type { ConnectionManager } from "../lib/connections.js";

const TYPES: Record<string, string[]> = {
  sqlite: ["INTEGER", "TEXT", "REAL", "NUMERIC", "BLOB"],
  postgres: ["integer", "bigint", "smallint", "numeric(10,2)", "text", "character varying(255)", "boolean", "date", "timestamp", "timestamptz", "uuid", "jsonb", "bytea"],
  mysql: ["int", "bigint", "smallint", "decimal(10,2)", "varchar(255)", "text", "tinyint(1)", "date", "datetime", "json", "blob"],
  mssql: ["int", "bigint", "smallint", "decimal(10,2)", "nvarchar(255)", "nvarchar(max)", "bit", "date", "datetime2", "uniqueidentifier", "varbinary(max)"],
  oracle: ["NUMBER(10)", "NUMBER(19)", "NUMBER(10,2)", "VARCHAR2(255)", "CLOB", "DATE", "TIMESTAMP", "RAW(16)", "BLOB"],
};
// Engines where DDL participates in transactions (others commit each statement implicitly).
const TRANSACTIONAL_DDL = new Set(["postgres", "mssql", "sqlite"]);

const toTable = (d: DesignTable): TableM => ({
  name: d.name, columns: d.columns.map((c): ColumnM => ({ name: c.name, type: c.type, nullable: c.nullable && !d.primaryKey.includes(c.name), ...(c.default ? { default: c.default } : {}), ...(c.identity ? { identity: true } : {}) })),
  primaryKey: d.primaryKey, indexes: d.indexes, foreignKeys: d.foreignKeys.map((f) => ({ name: f.name, columns: f.columns, refTable: f.refTable, refColumns: f.refColumns })),
});

export function openDesigner(ctx: vscode.ExtensionContext, mgr: ConnectionManager, policy: () => Policy, profileId: string, current: SchemaModel, existingName?: string, onApplied?: () => void) {
  const profile = mgr.get(profileId)!, dialect = profile.driver as Dialect, t = vscode.l10n.t;
  const root = vscode.Uri.joinPath(ctx.extensionUri, "dist");
  const panel = vscode.window.createWebviewPanel("rizomadb.designer", existingName ? `Table: ${existingName}` : "New table", vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [root] });
  const nonce = randomBytes(16).toString("base64"), w = panel.webview;
  w.html = `<!doctype html><html lang="${vscode.env.language}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${w.asWebviewUri(vscode.Uri.joinPath(root, "webview.css"))}"><title>Designer</title></head>
<body><form class="designer" onsubmit="return false"><h1 id="heading"></h1>
<label>${t("Table name")} <input type="text" id="tname"></label>
<table><caption>${t("Columns")}</caption><thead><tr><th scope="col">${t("Name")}</th><th scope="col">${t("Type")}</th><th scope="col">NOT NULL</th><th scope="col">PK</th><th scope="col">${t("Default")}</th><th scope="col">${t("Auto-increment")}</th><th scope="col"><span class="sr-only">${t("Remove")}</span></th></tr></thead><tbody id="cols"></tbody></table><button type="button" id="add-col">${t("Add column")}</button>
<table><caption>${t("Indexes")}</caption><thead><tr><th scope="col">${t("Name")}</th><th scope="col">${t("Columns")}</th><th scope="col">${t("Unique")}</th><th scope="col"><span class="sr-only">${t("Remove")}</span></th></tr></thead><tbody id="idx"></tbody></table><button type="button" id="add-idx">${t("Add index")}</button>
<table><caption>${t("Foreign keys")}</caption><thead><tr><th scope="col">${t("Name")}</th><th scope="col">${t("Columns")}</th><th scope="col">${t("References")}</th><th scope="col">${t("Referenced columns")}</th><th scope="col"><span class="sr-only">${t("Remove")}</span></th></tr></thead><tbody id="fks"></tbody></table><button type="button" id="add-fk">${t("Add foreign key")}</button>
<datalist id="types"></datalist>
<div><button type="button" id="btn-preview">${t("Preview DDL")}</button> <button type="button" id="btn-apply">${t("Apply…")}</button> <span id="status"></span></div>
<div id="warn" role="status"></div><pre id="ddl" tabindex="0" aria-label="${t("Generated DDL")}"></pre></form>
<script nonce="${nonce}" src="${w.asWebviewUri(vscode.Uri.joinPath(root, "designer.js"))}"></script></body></html>`;

  const existing = existingName ? current.tables.find((x) => x.name.toLowerCase() === existingName.toLowerCase()) : undefined;
  const initial = existing ?? { name: "", columns: [{ name: "id", type: TYPES[dialect]![0]!, nullable: false }], primaryKey: ["id"], indexes: [], foreignKeys: [] } as TableM;
  void w.postMessage({ v: 1, type: "load", engine: dialect, types: TYPES[dialect] ?? [], existing: !!existing, table: { name: initial.name, columns: initial.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable, ...(c.default !== undefined ? { default: c.default } : {}), ...(c.identity ? { identity: true } : {}) })), primaryKey: initial.primaryKey, indexes: initial.indexes, foreignKeys: initial.foreignKeys.map((f) => ({ name: f.name, columns: f.columns, refTable: f.refTable, refColumns: f.refColumns })) } });

  const build = (d: DesignTable): Statement[] => {
    const desired = toTable(d);
    if (!/^[A-Za-z_][\w$ ]*$/.test(desired.name)) throw new Error(t("Invalid table name"));
    for (const c of desired.columns) if (!c.name) throw new Error(t("Every column needs a name and a type"));
    if (!desired.primaryKey.length) throw new Error(t("Define a primary key: rows without one cannot be edited safely."));
    if (existing) return migrationStatements(dialect, diffModels({ dialect, tables: [existing] }, { dialect, tables: [desired] }).changes);
    return createScript({ dialect, tables: [desired] }).map((sql) => ({ sql }));
  };

  w.onDidReceiveMessage(async (raw: unknown) => {
    const p = DesignerToHost.safeParse(raw); if (!p.success) return;
    const post = (m: unknown) => void w.postMessage(m);
    let stmts: Statement[];
    try { stmts = build(p.data.table); } catch (e) { post({ v: 1, type: "ddl", statements: [], error: (e as Error).message }); return; }
    if (p.data.type === "preview") { post({ v: 1, type: "ddl", statements: stmts }); return; }

    const runnable = stmts.filter((s) => !s.sql.startsWith("--") && !s.manual);
    if (!runnable.length) { post({ v: 1, type: "result", ok: true, message: t("Nothing to apply.") }); return; }
    for (const s of runnable) {
      const d = decide(s.sql, { environment: profile.environment, readOnly: mgr.isReadOnly(profile) }, policy());
      if (!d.allowed) { post({ v: 1, type: "result", ok: false, message: d.reason ?? t("Blocked by policy") }); return; }
    }
    const destructive = runnable.some((s) => s.destructive);
    const ok = await vscode.window.showWarningMessage(t("[{0}] {1}: apply {2} DDL statement(s)?", profile.environment.toUpperCase(), profile.name, runnable.length),
      { modal: true, detail: runnable.map((s) => `${s.destructive ? "⚠ " : ""}${s.sql}`).join("\n").slice(0, 1800) }, destructive ? t("Apply (destructive)") : t("Apply"));
    if (!ok) return;
    const conn = await mgr.connect(profileId);
    const sig = new AbortController().signal;
    const tx = TRANSACTIONAL_DDL.has(dialect) && conn.begin ? await conn.begin() : undefined;
    let n = 0;
    try {
      for (const s of runnable) { await collect((tx ?? conn).execute({ sql: s.sql }, sig)); n++; }
      await tx?.commit();
      post({ v: 1, type: "result", ok: true, message: t("Applied {0} statement(s).", n) });
      onApplied?.();
    } catch (e) {
      await tx?.rollback().catch(() => {});
      post({ v: 1, type: "result", ok: false, message: tx ? t("Failed, everything was rolled back: {0}", (e as Error).message) : t("Failed after {0} statement(s) (this engine commits DDL implicitly): {1}", n, (e as Error).message) });
    }
  });
}
