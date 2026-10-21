import * as vscode from "vscode";
import { parseNotebook, serializeNotebook, tableHtml } from "../lib/notebookFormat.js";
import { runStatement } from "../lib/runner.js";
import { splitScript } from "@rizomadb/sql";
import { formatValue } from "../lib/format.js";
import { DIALECT_OF } from "../lib/schemaCache.js";
import type { ConnectionManager } from "../lib/connections.js";
import type { Policy } from "@rizomadb/core";

const TYPE = "rizomadb-sql-notebook";
const t = vscode.l10n.t;

export function registerNotebooks(ctx: vscode.ExtensionContext, mgr: ConnectionManager, policy: () => Policy, cfg: () => vscode.WorkspaceConfiguration, pick: () => Promise<string | undefined>) {
  ctx.subscriptions.push(vscode.workspace.registerNotebookSerializer(TYPE, {
    deserializeNotebook(bytes) {
      const n = parseNotebook(new TextDecoder().decode(bytes));
      const data = new vscode.NotebookData(n.cells.map((c) => new vscode.NotebookCellData(c.kind === "sql" ? vscode.NotebookCellKind.Code : vscode.NotebookCellKind.Markup, c.source, c.kind === "sql" ? "sql" : "markdown")));
      data.metadata = { connection: n.connection };
      return data;
    },
    serializeNotebook(data) {
      const connection = (data.metadata as { connection?: string } | undefined)?.connection;
      return new TextEncoder().encode(serializeNotebook({ version: 1, ...(connection ? { connection } : {}), cells: data.cells.map((c) => ({ kind: c.kind === vscode.NotebookCellKind.Code ? "sql" : "markdown", source: c.value })) }));
    },
  }));

  const controller = vscode.notebooks.createNotebookController("rizomadb-sql", TYPE, "RizomaDB SQL");
  controller.supportedLanguages = ["sql"];
  controller.supportsExecutionOrder = true;
  let order = 0;
  controller.executeHandler = async (cells, nb, ctl) => {
    let id = (nb.metadata as { connection?: string }).connection;
    if (!id || !mgr.get(id)) {
      id = await pick();
      if (!id) return;
      const edit = new vscode.WorkspaceEdit();
      edit.set(nb.uri, [vscode.NotebookEdit.updateNotebookMetadata({ ...nb.metadata, connection: id })]);
      await vscode.workspace.applyEdit(edit);
    }
    const profile = mgr.get(id)!;
    for (const cell of cells) {
      const exec = ctl.createNotebookCellExecution(cell);
      exec.executionOrder = ++order; exec.start(Date.now());
      const ac = new AbortController();
      exec.token.onCancellationRequested(() => ac.abort());
      const outputs: vscode.NotebookCellOutput[] = [];
      let ok = true;
      try {
        const conn = await mgr.connect(id);
        for (const st of splitScript(cell.document.getText(), DIALECT_OF[profile.driver] ?? "ansi")) {
          let cols: string[] = [], truncated = false, errMsg: string | undefined, affected: number | undefined;
          const rows: (string | null)[][] = [];
          const out = await runStatement({
            conn, profile, sql: st.text, maxRows: cfg().get<number>("query.maxRows", 10000), signal: ac.signal, policy: policy(), readOnly: mgr.isReadOnly(profile),
            confirmDestructive: cfg().get<boolean>("security.confirmDestructive", true),
            confirm: async (reason) => (await vscode.window.showWarningMessage(t("[{0}] {1}: {2}", profile.environment.toUpperCase(), profile.name, reason), { modal: true, detail: st.text.slice(0, 500) }, t("Run anyway"))) === t("Run anyway"),
            onEvent: (e) => {
              if (e.type === "start") cols = e.columns.map((c) => c.name);
              else if (e.type === "rows") rows.push(...e.rows.slice(0, Math.max(0, 1000 - rows.length)).map((r) => r.map(formatValue)));
              else if (e.type === "done") { truncated = e.truncated; affected = e.affectedRows; }
              else errMsg = `${e.kind}: ${e.message}`;
            },
          });
          if (out.status !== "ok") { ok = false; outputs.push(new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.error(new Error(errMsg ?? out.error ?? out.status))])); break; }
          outputs.push(new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.text(cols.length ? tableHtml(cols, rows, `${out.rowCount} rows · ${Math.round(out.durationMs)} ms${truncated || out.rowCount > 1000 ? " · showing first 1000" : ""}`) : `<p>${affected ?? 0} rows affected · ${Math.round(out.durationMs)} ms</p>`, "text/html")]));
        }
      } catch (e) { ok = false; outputs.push(new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.error(e as Error)])); }
      await exec.replaceOutput(outputs);
      exec.end(ok, Date.now());
    }
  };
  ctx.subscriptions.push(controller);
}
