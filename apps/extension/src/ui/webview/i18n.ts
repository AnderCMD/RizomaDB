/** Strings arrive from the host as JSON (already translated with vscode.l10n); unknown keys fall back to English. */
let table: Record<string, string> = {};
try { table = JSON.parse(document.getElementById("i18n")?.textContent ?? "{}") as Record<string, string>; } catch { /* English fallback */ }

export function tr(key: string, ...args: (string | number)[]): string {
  return (table[key] ?? key).replace(/\{(\d+)\}/g, (_, i: string) => String(args[Number(i)] ?? ""));
}
