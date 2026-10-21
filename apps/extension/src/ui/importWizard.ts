import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ConnectionManager } from "../lib/connections.js";
import { parseConnectionUri, parseDBeaver, parseMyCnf, parsePgpass, parseSqlTools, type ImportedConnection } from "../lib/importers.js";
import { t } from "../i18n.js";
import { NOTE_DBEAVER, NOTE_MONGO_URI, NOTE_SSLMODE } from "../lib/importers.js";
import { friendly } from "./driverMessages.js";

/** The importers write their notes in English; shown translated. */
const NOTES: Record<string, () => string> = {
  [NOTE_MONGO_URI]: () => t("The connection string is stored as a secret because it may contain credentials."),
  [NOTE_SSLMODE]: () => t("sslmode=require only encrypts here: certificates are verified. Turn off “Verify server certificate” if the server uses a private CA you cannot add."),
  [NOTE_DBEAVER]: () => t("DBeaver keeps user names and passwords in an encrypted file; they were not imported. Enter them when you first connect."),
};
const note = (n: string) => NOTES[n]?.() ?? n;


/** Migration assistant: previews what it found, imports without secrets unless the user explicitly agrees. */
export function registerImportWizard(mgr: ConnectionManager, reg: (id: string, fn: (...a: never[]) => unknown) => void, refresh: () => void) {
  reg("rizomadb.importConnections", async () => {
    const src = await vscode.window.showQuickPick([
      { label: t("A connection string (URI)"), k: "uri" }, { label: t("PostgreSQL ~/.pgpass"), k: "pgpass" }, { label: t("MySQL ~/.my.cnf"), k: "mycnf" },
      { label: t("DBeaver data-sources.json"), k: "dbeaver", description: t("usually in <workspace>/.dbeaver/") }, { label: t("SQLTools (VS Code settings.json)"), k: "sqltools" },
    ], { title: t("Import connections from…") });
    if (!src) return;
    let found: ImportedConnection[] = [];
    try {
      const pickFile = async (def?: string) => { const f = await vscode.window.showOpenDialog({ canSelectMany: false, ...(def ? { defaultUri: vscode.Uri.file(def) } : {}) }); return f?.[0]?.fsPath; };
      if (src.k === "uri") { const u = await vscode.window.showInputBox({ title: t("Connection string"), prompt: t("For example postgres://user@host:5432/db"), ignoreFocusOut: true, password: true }); if (!u) return; found = [parseConnectionUri(u)]; }
      else if (src.k === "pgpass") { const f = await pickFile(join(homedir(), ".pgpass")); if (!f) return; found = parsePgpass(await readFile(f, "utf8")); }
      else if (src.k === "mycnf") { const f = await pickFile(join(homedir(), ".my.cnf")); if (!f) return; found = parseMyCnf(await readFile(f, "utf8")); }
      else if (src.k === "dbeaver") { const f = await pickFile(); if (!f) return; found = parseDBeaver(JSON.parse(await readFile(f, "utf8"))); }
      else { const f = await pickFile(); if (!f) return; found = parseSqlTools(await readFile(f, "utf8")); }
    } catch (e) { void vscode.window.showErrorMessage(t("Could not read the source: {0}", friendly((e as Error).message))); return; }
    if (!found.length) { void vscode.window.showInformationMessage(t("No supported connections were found.")); return; }
    const chosen = await vscode.window.showQuickPick(found.map((c, i) => ({ label: c.name, description: `${c.driver}${c.options.host ? ` · ${String(c.options.host)}` : ""}${Object.keys(c.secrets).length ? " · " + t("has a password") : ""}`, detail: c.notes.map(note).join(" "), picked: true, i })), { canPickMany: true, title: t("{0} connection(s) found: choose what to import", found.length) });
    if (!chosen?.length) return;
    const withSecrets = found.filter((_, i) => chosen.some((c) => c.i === i)).some((c) => Object.keys(c.secrets).length);
    let keepSecrets = false;
    if (withSecrets) {
      const a = await vscode.window.showQuickPick([{ label: t("Import without passwords (recommended)"), v: false }, { label: t("Also store the passwords in secure storage"), v: true }], { title: t("The source contains passwords") });
      if (!a) return; keepSecrets = a.v;
    }
    const env = await vscode.window.showQuickPick([{ label: "dev" }, { label: "staging" }, { label: "prod", description: t("read-only by default") }], { title: t("Environment for the imported connections") });
    if (!env) return;
    for (const c of chosen.map((x) => found[x.i]!)) {
      const secrets = keepSecrets ? c.secrets : {};
      await mgr.add({ id: randomUUID(), name: c.name, driver: c.driver, environment: env.label, readOnly: false, tags: ["imported"], secretKeys: Object.keys(secrets), values: { ...c.options, ...secrets } });
    }
    refresh();
    void vscode.window.showInformationMessage(t("Imported {0} connection(s). {1}", chosen.length, keepSecrets ? "" : t("Passwords were left out: you will be asked when you first connect.")));
  });
}
