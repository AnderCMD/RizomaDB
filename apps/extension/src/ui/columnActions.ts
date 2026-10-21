import * as vscode from "vscode";
import { collect } from "@rizomadb/driver-api";
import { decideEffective, type EffectivePolicy } from "@rizomadb/core";
import { buildModel, columnStatements, type ColumnOp, type Dialect } from "@rizomadb/schema-tools";
import { t } from "../i18n.js";
import { TRANSACTIONAL_DDL } from "./designerPanel.js";
import type { ConnectionManager } from "../lib/connections.js";
import { friendly } from "./driverMessages.js";

export type ColumnAction = "rename" | "type" | "nullable" | "default" | "drop" | "add";
const DEFAULT_TYPE: Record<string, string> = { sqlite: "TEXT", postgres: "text", mysql: "varchar(255)", mssql: "nvarchar(255)", oracle: "VARCHAR2(255)" };

/** Edits one column of the table behind the results grid: asks for the new value, shows the DDL for confirmation, applies it, returns true when it ran. */
export async function runColumnAction(
  d: { mgr: ConnectionManager; profileId: string; policy: () => EffectivePolicy; afterApply: () => Promise<void> },
  ref: { schema?: string; name: string }, action: ColumnAction, column: string,
): Promise<boolean> {
  const profile = d.mgr.get(d.profileId); if (!profile) return false;
  const dialect = profile.driver as Dialect;
  const conn = await d.mgr.connect(d.profileId);
  const info = await conn.introspect().describeTable({ name: ref.name, ...(ref.schema ? { schema: ref.schema } : {}) });
  const table = buildModel(dialect, [{ ...info, ...(ref.schema ? { schema: ref.schema } : {}) }]).tables[0];
  if (!table) throw new Error(t("Could not read the table definition."));
  const current = table.columns.find((c) => c.name.toLowerCase() === column.toLowerCase());
  const ask = (title: string, value: string, required: boolean) => vscode.window.showInputBox({ title, value, ignoreFocusOut: true, validateInput: (v) => (required && !v.trim() ? t("Required") : undefined) });

  let op: ColumnOp;
  if (action === "add") {
    const name = await ask(t("New column name"), "", true); if (name === undefined) return false;
    const type = await ask(t("Column type"), DEFAULT_TYPE[dialect] ?? "text", true); if (type === undefined) return false;
    op = { op: "add", column: { name: name.trim(), type: type.trim(), nullable: true } };
  } else {
    if (!current) throw new Error(t("Unknown column: {0}", column));
    if (action === "rename") { const to = await ask(t("Rename column {0}", current.name), current.name, true); if (to === undefined || to.trim() === current.name) return false; op = { op: "rename", column: current.name, to: to.trim() }; }
    else if (action === "type") { const type = await ask(t("Change type of {0}", current.name), current.type, true); if (type === undefined || type.trim() === current.type) return false; op = { op: "type", column: current.name, type: type.trim() }; }
    else if (action === "default") { const v = await ask(t("Default for {0} (leave empty to remove)", current.name), current.default ?? "", false); if (v === undefined) return false; op = { op: "default", column: current.name, ...(v.trim() ? { default: v.trim() } : {}) }; }
    else if (action === "nullable") op = { op: "nullable", column: current.name, nullable: !current.nullable };
    else op = { op: "drop", column: current.name };
  }

  const stmts = columnStatements(dialect, table, op);
  const manual = stmts.find((s) => s.manual);
  if (manual) { void vscode.window.showWarningMessage(t("This change needs a manual step: {0}", manual.manual ?? "")); return false; }
  const runnable = stmts.filter((s) => !s.sql.startsWith("--"));
  if (!runnable.length) { void vscode.window.showInformationMessage(t("Nothing to apply.")); return false; }
  for (const s of runnable) {
    const decision = decideEffective(s.sql, { environment: profile.environment, readOnly: d.mgr.isReadOnly(profile) }, d.policy());
    if (!decision.allowed) { void vscode.window.showErrorMessage(decision.reason ? friendly(decision.reason) : t("Blocked by policy")); return false; }
  }
  const destructive = runnable.some((s) => s.destructive);
  const ok = await vscode.window.showWarningMessage(t("[{0}] {1}: apply {2} DDL statement(s)?", profile.environment.toUpperCase(), profile.name, runnable.length),
    { modal: true, detail: runnable.map((s) => `${s.destructive ? "⚠ " : ""}${s.sql}`).join("\n").slice(0, 1800) }, destructive ? t("Apply (destructive)") : t("Apply"));
  if (!ok) return false;

  const sig = new AbortController().signal;
  const tx = TRANSACTIONAL_DDL.has(dialect) && conn.begin ? await conn.begin() : undefined;
  let done = 0;
  try {
    for (const s of runnable) { await collect((tx ?? conn).execute({ sql: s.sql }, sig)); done++; }
    await tx?.commit();
  } catch (e) {
    await tx?.rollback().catch(() => {});
    void vscode.window.showErrorMessage(tx ? t("Failed, everything was rolled back: {0}", friendly((e as Error).message)) : t("Failed after {0} statement(s) (this engine commits DDL implicitly): {1}", done, (e as Error).message));
    return false;
  }
  await d.afterApply();
  void vscode.window.showInformationMessage(t("Applied {0} statement(s).", runnable.length));
  return true;
}
