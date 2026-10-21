import * as vscode from "vscode";
import { readFileSync } from "node:fs";

/**
 * RizomaDB's own UI language. "auto" follows the VS Code display language (vscode.l10n); "en"/"es" override it for the
 * extension alone. Manifest strings (command titles, setting descriptions, view names) are fixed by VS Code and always follow it.
 */
export type UiLanguage = "auto" | "en" | "es";
let choice: UiLanguage = "auto";
let spanish: Record<string, string> = {};

/** Fills {n} placeholders; one without an argument stays as written, because webview templates are fetched without arguments and filled in later. */
const format = (m: string, args: unknown[]) => m.replace(/\{(\d+)\}/g, (whole, i: string) => (args[Number(i)] === undefined ? whole : String(args[Number(i)])));

export function t(message: string, ...args: (string | number | boolean)[]): string {
  if (choice === "es") return format(spanish[message] ?? message, args);
  if (choice === "en") return format(message, args);
  return vscode.l10n.t(message, ...args);
}

/** The language screens and strings use right now ("en", "es" or whatever VS Code reports). */
export const effectiveLanguage = (): string => (choice === "auto" ? vscode.env.language : choice);

export function initI18n(ctx: vscode.ExtensionContext): vscode.Disposable {
  const apply = () => {
    const v = vscode.workspace.getConfiguration("rizomadb").get<string>("language", "auto");
    choice = v === "en" || v === "es" ? v : "auto";
    if (choice === "es" && !Object.keys(spanish).length) {
      try { spanish = JSON.parse(readFileSync(vscode.Uri.joinPath(ctx.extensionUri, "l10n", "bundle.l10n.es.json").fsPath, "utf8")) as Record<string, string>; } catch { spanish = {}; }
    }
  };
  try { apply(); } catch { /* host without configuration API (tests): stay on VS Code's language */ }
  return vscode.workspace.onDidChangeConfiguration?.((e) => { if (e.affectsConfiguration("rizomadb.language")) apply(); }) ?? { dispose() {} };
}
