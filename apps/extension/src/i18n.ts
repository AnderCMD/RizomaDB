import * as vscode from "vscode";
import { readFileSync } from "node:fs";

/**
 * RizomaDB's own UI language. "auto" follows the VS Code display language (vscode.l10n); the others override it for the
 * extension alone. Manifest strings (command titles, setting descriptions, view names) are fixed by VS Code and always follow it.
 */
export const UI_LANGUAGES = ["auto", "en", "es", "pt", "fr"] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];
/** The bundle file of each override language (named by the VS Code locale id, so "auto" finds the same files). */
export const BUNDLE_OF: Record<Exclude<UiLanguage, "auto" | "en">, string> = { es: "bundle.l10n.es.json", pt: "bundle.l10n.pt-br.json", fr: "bundle.l10n.fr.json" };
let choice: UiLanguage = "auto";
let bundle: Record<string, string> = {};
let loaded: UiLanguage | undefined;

/** Fills {n} placeholders; one without an argument stays as written, because webview templates are fetched without arguments and filled in later. */
const format = (m: string, args: unknown[]) => m.replace(/\{(\d+)\}/g, (whole, i: string) => (args[Number(i)] === undefined ? whole : String(args[Number(i)])));

export function t(message: string, ...args: (string | number | boolean)[]): string {
  if (choice === "auto") return vscode.l10n.t(message, ...args);
  return format(choice === "en" ? message : bundle[message] ?? message, args);
}

/** The language screens and strings use right now ("en", "es" or whatever VS Code reports). */
export const effectiveLanguage = (): string => (choice === "auto" ? vscode.env.language : choice);

export function initI18n(ctx: vscode.ExtensionContext): vscode.Disposable {
  const apply = () => {
    const v = vscode.workspace.getConfiguration("rizomadb").get<string>("language", "auto");
    choice = (UI_LANGUAGES as readonly string[]).includes(v ?? "") ? (v as UiLanguage) : "auto";
    if (choice !== "auto" && choice !== "en" && loaded !== choice) {
      try { bundle = JSON.parse(readFileSync(vscode.Uri.joinPath(ctx.extensionUri, "l10n", BUNDLE_OF[choice]).fsPath, "utf8")) as Record<string, string>; loaded = choice; } catch { bundle = {}; loaded = undefined; }
    }
  };
  try { apply(); } catch { /* host without configuration API (tests): stay on VS Code's language */ }
  return vscode.workspace.onDidChangeConfiguration?.((e) => { if (e.affectsConfiguration("rizomadb.language")) apply(); }) ?? { dispose() {} };
}
