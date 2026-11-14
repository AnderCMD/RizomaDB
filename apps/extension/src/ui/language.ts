import * as vscode from "vscode";
import { complete, diagnose, formatSql, FORMAT_DEFAULTS, type CompletionKind, type FormatOptions } from "@rizomadb/sql";
import type { ConnectionManager } from "../lib/connections.js";
import { DIALECT_OF, type SchemaCache } from "../lib/schemaCache.js";
import { t } from "../i18n.js";

const KIND: Record<CompletionKind, vscode.CompletionItemKind> = {
  table: vscode.CompletionItemKind.Struct, view: vscode.CompletionItemKind.Interface, column: vscode.CompletionItemKind.Field, keyword: vscode.CompletionItemKind.Keyword,
  function: vscode.CompletionItemKind.Function, schema: vscode.CompletionItemKind.Module, alias: vscode.CompletionItemKind.Variable, join: vscode.CompletionItemKind.Snippet,
};

/** Past this many characters a file (a data dump, a generated script) is not analysed: parsing it on every keystroke would stall the extension host. */
export const MAX_ANALYSED_CHARS = 1_000_000;

const CASES = ["upper", "lower", "preserve"] as const;
const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);

/**
 * Formatting options for a document: indentation is the editor's own (VS Code passes the resolved `editor.tabSize` and
 * `editor.insertSpaces`, including `[sql]` overrides and detected indentation); the rest are `rizomadb.format.*`,
 * read for this document's folder and language so workspace and `[sql]` settings apply.
 */
export function formatOptions(doc: vscode.TextDocument, editor: vscode.FormattingOptions): FormatOptions {
  const c = vscode.workspace.getConfiguration("rizomadb.format", { uri: doc.uri, languageId: doc.languageId });
  const d = FORMAT_DEFAULTS;
  return {
    tabWidth: editor.tabSize, useTabs: !editor.insertSpaces,
    keywordCase: pick(c.get("keywordCase"), CASES, d.keywordCase),
    dataTypeCase: pick(c.get("dataTypeCase"), CASES, d.dataTypeCase),
    functionCase: pick(c.get("functionCase"), CASES, d.functionCase),
    indentStyle: pick(c.get("indentStyle"), ["standard", "tabularLeft", "tabularRight"] as const, d.indentStyle),
    logicalOperatorNewline: pick(c.get("logicalOperatorNewline"), ["before", "after"] as const, d.logicalOperatorNewline),
    expressionWidth: c.get<number>("expressionWidth", d.expressionWidth),
    linesBetweenQueries: c.get<number>("linesBetweenQueries", d.linesBetweenQueries),
    denseOperators: c.get<boolean>("denseOperators", d.denseOperators) === true,
    newlineBeforeSemicolon: c.get<boolean>("newlineBeforeSemicolon", d.newlineBeforeSemicolon) === true,
  };
}

const tooBig = () => void vscode.window.showWarningMessage(t("This SQL is larger than 1 MB, so it was not formatted: formatting it would stall VS Code. Select a part of it and format the selection."));

export function registerLanguage(ctx: vscode.ExtensionContext, mgr: ConnectionManager, cache: SchemaCache, docConn: (d: vscode.TextDocument) => string | undefined) {
  const dialectOf = (d: vscode.TextDocument) => {
    const p = mgr.get(docConn(d) ?? "");
    return { profile: p, dialect: p ? DIALECT_OF[p.driver] ?? "ansi" : "ansi" } as const;
  };

  ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: "sql" }, {
    async provideCompletionItems(doc, pos) {
      if (doc.getText().length > MAX_ANALYSED_CHARS) return [];
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
    if (doc.getText().length > MAX_ANALYSED_CHARS) { collection.delete(doc.uri); return; }
    const { profile, dialect } = dialectOf(doc);
    const schema = profile ? cache.peek(profile.id) : undefined;
    // Diagnostics never open a connection by themselves (restoring editors at startup used to connect and read the whole schema of every bound one): they use the schema once a connection is open.
    if (profile && !schema && mgr.isConnected(profile.id)) void cache.get(profile.id).then(() => refresh(doc), () => {});
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
      provideDocumentFormattingEdits(doc, options) {
        const { dialect } = dialectOf(doc);
        const text = doc.getText();
        if (text.length > MAX_ANALYSED_CHARS) { tooBig(); return []; }
        const out = formatSql(text, dialect, formatOptions(doc, options));
        return out === text ? [] : [vscode.TextEdit.replace(new vscode.Range(doc.positionAt(0), doc.positionAt(text.length)), out)];
      },
    }),
    vscode.languages.registerDocumentRangeFormattingEditProvider({ language: "sql" }, {
      provideDocumentRangeFormattingEdits(doc, range, options) {
        const { dialect } = dialectOf(doc);
        // From the start of the first line, so the selection keeps the indentation it sits at.
        const full = range.start.character > 0 && !doc.lineAt(range.start.line).text.slice(0, range.start.character).trim() ? range.with(range.start.with(undefined, 0)) : range;
        const text = doc.getText(full);
        if (text.length > MAX_ANALYSED_CHARS) { tooBig(); return []; }
        const out = formatSql(text, dialect, formatOptions(doc, options));
        return out === text ? [] : [vscode.TextEdit.replace(full, out)];
      },
    }),
  );
  return { refreshAll: () => vscode.workspace.textDocuments.forEach(refresh) };
}
