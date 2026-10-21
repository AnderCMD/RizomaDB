import * as vscode from "vscode";
import { complete, diagnose, formatSql, type CompletionKind } from "@rizomadb/sql";
import type { ConnectionManager } from "../lib/connections.js";
import { DIALECT_OF, type SchemaCache } from "../lib/schemaCache.js";

const KIND: Record<CompletionKind, vscode.CompletionItemKind> = {
  table: vscode.CompletionItemKind.Struct, view: vscode.CompletionItemKind.Interface, column: vscode.CompletionItemKind.Field, keyword: vscode.CompletionItemKind.Keyword,
  function: vscode.CompletionItemKind.Function, schema: vscode.CompletionItemKind.Module, alias: vscode.CompletionItemKind.Variable, join: vscode.CompletionItemKind.Snippet,
};

export function registerLanguage(ctx: vscode.ExtensionContext, mgr: ConnectionManager, cache: SchemaCache, docConn: (d: vscode.TextDocument) => string | undefined) {
  const dialectOf = (d: vscode.TextDocument) => {
    const p = mgr.get(docConn(d) ?? "");
    return { profile: p, dialect: p ? DIALECT_OF[p.driver] ?? "ansi" : "ansi" } as const;
  };

  ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: "sql" }, {
    async provideCompletionItems(doc, pos) {
      const { profile, dialect } = dialectOf(doc);
      const schema = profile ? await cache.get(profile.id).catch(() => undefined) : undefined;
      const { SchemaIndex } = await import("@rizomadb/sql");
      const res = complete(doc.getText(), doc.offsetAt(pos), schema ?? new SchemaIndex([]), dialect);
      const range = new vscode.Range(doc.positionAt(res.replaceStart), doc.positionAt(res.replaceEnd));
      return res.items.map((i, n) => {
        const it = new vscode.CompletionItem({ label: i.label, ...(i.detail ? { description: i.detail } : {}) }, KIND[i.kind]);
        it.insertText = i.insertText; it.range = range; it.sortText = i.sortText.padEnd(8, " ") + String(n).padStart(4, "0");
        it.filterText = i.label;
        return it;
      });
    },
  }, "."));

  const collection = vscode.languages.createDiagnosticCollection("rizomadb");
  const timers = new Map<string, NodeJS.Timeout>();
  const refresh = (doc: vscode.TextDocument) => {
    if (doc.languageId !== "sql") return;
    const { profile, dialect } = dialectOf(doc);
    const schema = profile ? cache.peek(profile.id) : undefined;
    if (profile && !schema) void cache.get(profile.id).then(() => refresh(doc), () => {});
    collection.set(doc.uri, diagnose(doc.getText(), dialect, schema).map((d) => {
      const x = new vscode.Diagnostic(new vscode.Range(doc.positionAt(d.start), doc.positionAt(d.end)), d.message,
        d.severity === "error" ? vscode.DiagnosticSeverity.Error : d.severity === "warning" ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information);
      x.code = d.code; x.source = "RizomaDB"; return x;
    }));
  };
  ctx.subscriptions.push(
    collection,
    vscode.workspace.onDidChangeTextDocument((e) => {
      const k = e.document.uri.toString(); clearTimeout(timers.get(k));
      timers.set(k, setTimeout(() => refresh(e.document), 300));
    }),
    vscode.workspace.onDidOpenTextDocument(refresh),
    vscode.workspace.onDidCloseTextDocument((d) => collection.delete(d.uri)),
    vscode.languages.registerDocumentFormattingEditProvider({ language: "sql" }, {
      provideDocumentFormattingEdits(doc) {
        const { dialect } = dialectOf(doc);
        const text = doc.getText();
        return [vscode.TextEdit.replace(new vscode.Range(doc.positionAt(0), doc.positionAt(text.length)), formatSql(text, dialect))];
      },
    }),
    vscode.languages.registerDocumentRangeFormattingEditProvider({ language: "sql" }, {
      provideDocumentRangeFormattingEdits(doc, range) {
        const { dialect } = dialectOf(doc);
        return [vscode.TextEdit.replace(range, formatSql(doc.getText(range), dialect))];
      },
    }),
  );
  return { refreshAll: () => vscode.workspace.textDocuments.forEach(refresh) };
}
