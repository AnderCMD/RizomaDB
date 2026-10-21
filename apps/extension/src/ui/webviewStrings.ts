import * as vscode from "vscode";

const t = vscode.l10n.t;

/** Every string a webview script shows. Spelled out with explicit calls so the extraction test and translators can find them. */
export function webviewStrings(): Record<string, string> {
  return {
    "Running…": t("Running…"), "{0} rows…": t("{0} rows…"), "{0} rows affected": t("{0} rows affected"), "{0} rows": t("{0} rows"), "{0} ms": t("{0} ms"),
    "truncated at the row limit (rizomadb.query.maxRows)": t("truncated at the row limit (rizomadb.query.maxRows)"), "Failed": t("Failed"), "Error: {0}": t("Error: {0}"),
    "No pending changes": t("No pending changes"), "{0} pending change(s)": t("{0} pending change(s)"), "marked for deletion": t("marked for deletion"), "pending change": t("pending change"),
    "{0}, row {1}: {2}": t("{0}, row {1}: {2}"), "Edit {0}, row {1}": t("Edit {0}, row {1}"),
    "total cost {0}": t("total cost {0}"), "execution {0} ms": t("execution {0} ms"), "cost {0}": t("cost {0}"), "est. rows {0}": t("est. rows {0}"), "actual rows {0}": t("actual rows {0}"), "{0} — slow": t("{0} — slow"),
    "Edit table {0} ({1})": t("Edit table {0} ({1})"), "New table ({0})": t("New table ({0})"), "Remove column": t("Remove column"), "Remove index": t("Remove index"), "Remove foreign key": t("Remove foreign key"),
    "Column name": t("Column name"), "Default (SQL expression)": t("Default (SQL expression)"), "Primary key": t("Primary key"), "Auto-increment": t("Auto-increment"), "No changes": t("No changes"),
    "This change is destructive and cannot be undone automatically.": t("This change is destructive and cannot be undone automatically."),
    "Index name": t("Index name"), "Index columns, comma separated": t("Index columns, comma separated"), "Constraint name": t("Constraint name"), "Referenced table": t("Referenced table"),
    "{0} over time": t("{0} over time"), "{0} tables, {1} relationships": t("{0} tables, {1} relationships"), "Table with {0} columns. Press Enter to highlight its relations.": t("Table with {0} columns. Press Enter to highlight its relations."),
    "{0} and its relations highlighted": t("{0} and its relations highlighted"), "Selection cleared": t("Selection cleared"),
  };
}

/** `<script type="application/json">` data block: never executed, so it does not need the nonce. */
export const i18nBlock = () => `<script type="application/json" id="i18n">${JSON.stringify(webviewStrings()).replace(/</g, "\\u003c")}</script>`;
