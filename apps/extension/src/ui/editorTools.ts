import * as vscode from "vscode";
import { t } from "../i18n.js";
import { statementRanges } from "../lib/statements.js";
import { isQueryLanguage, QUERY_LANGUAGES } from "../lib/commandAt.js";

const cfg = () => vscode.workspace.getConfiguration("rizomadb");

/** The first line of a statement that is code, so a lens never sits on the comment above it. */
function codeLine(doc: vscode.TextDocument, start: number, end: number): number {
  const first = doc.positionAt(start).line, last = doc.positionAt(end).line;
  for (let l = first; l <= last; l++) { const x = doc.lineAt(l).text.trim(); if (x && !/^(--|\/\/|#)/.test(x)) return l; }
  return first;
}

/**
 * Run buttons inside the query editor: a lens above every statement (Run, Explain for SQL), a header lens with the
 * connection in use and Run all, and a highlight on the statement under the cursor.
 */
export function registerEditorTools(ctx: vscode.ExtensionContext, deps: { label: (doc: vscode.TextDocument) => string | undefined }) {
  const changed = new vscode.EventEmitter<void>();
  const provider: vscode.CodeLensProvider = {
    onDidChangeCodeLenses: changed.event,
    provideCodeLenses(doc) {
      if (!cfg().get<boolean>("editor.codeLens", true)) return [];
      const stmts = statementRanges(doc.languageId, doc.getText()).slice(0, 300);
      if (!stmts.length) return [];
      const uri = doc.uri.toString(), top = new vscode.Range(0, 0, 0, 0), out: vscode.CodeLens[] = [];
      out.push(new vscode.CodeLens(top, { title: `$(database) ${deps.label(doc) ?? t("Choose a connection")}`, command: "rizomadb.selectConnection", tooltip: t("Change the connection of this editor") }));
      if (stmts.length > 1) out.push(new vscode.CodeLens(top, { title: `$(run-all) ${t("Run all ({0})", stmts.length)}`, command: "rizomadb.runAll", arguments: [uri], tooltip: t("Run every statement in order; stops at the first error") }));
      for (const s of stmts) {
        const line = codeLine(doc, s.start, s.end), at = new vscode.Range(line, 0, line, 0);
        out.push(new vscode.CodeLens(at, { title: `$(play) ${t("Run")}`, command: "rizomadb.runAt", arguments: [uri, s.start], tooltip: t("Run this statement") }));
        if (doc.languageId === "sql") out.push(new vscode.CodeLens(at, { title: `$(graph) ${t("Explain")}`, command: "rizomadb.explainAt", arguments: [uri, s.start], tooltip: t("Show the execution plan of this statement") }));
      }
      return out;
    },
  };

  const deco = vscode.window.createTextEditorDecorationType({ backgroundColor: new vscode.ThemeColor("editor.rangeHighlightBackground"), borderRadius: "3px" });
  const paint = (ed: vscode.TextEditor | undefined) => {
    if (!ed) return;
    if (!isQueryLanguage(ed.document.languageId) || !cfg().get<boolean>("editor.highlightStatement", true) || !ed.selection.isEmpty) { ed.setDecorations(deco, []); return; }
    const off = ed.document.offsetAt(ed.selection.active);
    const s = statementRanges(ed.document.languageId, ed.document.getText()).find((x) => off >= x.start && off <= x.end + 1);
    ed.setDecorations(deco, s ? [new vscode.Range(ed.document.positionAt(s.start), ed.document.positionAt(s.end))] : []);
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const later = (ed?: vscode.TextEditor) => { clearTimeout(timer); timer = setTimeout(() => paint(ed ?? vscode.window.activeTextEditor), 120); };

  ctx.subscriptions.push(
    vscode.languages.registerCodeLensProvider([...QUERY_LANGUAGES].map((language) => ({ language })), provider),
    vscode.window.onDidChangeTextEditorSelection((e) => later(e.textEditor)),
    vscode.window.onDidChangeActiveTextEditor((e) => later(e)),
    vscode.workspace.onDidChangeTextDocument((e) => { if (vscode.window.activeTextEditor?.document === e.document) later(); }),
    vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration("rizomadb.editor")) { changed.fire(); later(); } }),
    deco, { dispose: () => clearTimeout(timer) },
  );
  later();
  return { refresh: () => changed.fire() };
}
