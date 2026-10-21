import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import type { JsonSchemaProp } from "@rizomadb/driver-api";
import type { ConnectionManager } from "../lib/connections.js";
import { t } from "../i18n.js";
import { fieldText } from "../lib/fieldText.js";
import { friendly } from "./driverMessages.js";


/** Builds the connection form from the driver's connectionSchema, as input prompts. */
export async function newConnectionWizard(mgr: ConnectionManager): Promise<string | undefined> {
  const driverPick = await vscode.window.showQuickPick(
    await Promise.all(mgr.driverIds().map(async (id) => { const d = await mgr.loadDriver(id); return { label: d.displayName, description: d.family === "relational" ? t("Relational") : d.family === "document" ? t("Document and cloud NoSQL") : d.family === "keyvalue" ? t("Key-value") : d.family, id }; })),
    { title: t("New connection: engine"), ignoreFocusOut: true });
  if (!driverPick) return;
  const driver = await mgr.loadDriver(driverPick.id);

  const name = await vscode.window.showInputBox({ title: t("Connection name"), value: driverPick.label, ignoreFocusOut: true, validateInput: (v) => (v.trim() ? undefined : t("Required")) });
  if (!name) return;
  const env = await vscode.window.showQuickPick(
    [{ label: "dev" }, { label: "staging" }, { label: "prod", description: t("read-only by default") }],
    { title: t("Environment"), ignoreFocusOut: true });
  if (!env) return;

  const values: Record<string, unknown> = {};
  const secretKeys: string[] = [];
  for (const [key, prop] of Object.entries(driver.connectionSchema.properties) as [string, JsonSchemaProp][]) {
    if (key === "readOnly") continue;
    const required = driver.connectionSchema.required?.includes(key) ?? false;
    if (prop.type === "boolean") {
      const pick = await vscode.window.showQuickPick([{ label: t("Yes"), v: true }, { label: t("No"), v: false }], {
        title: fieldText(prop.title), placeHolder: prop.description ? fieldText(prop.description) : undefined, ignoreFocusOut: true });
      if (!pick) return;
      values[key] = pick.v;
      if (key === "ssl" && pick.v === false) {
        const ok = await vscode.window.showWarningMessage(t("TLS is disabled: traffic and credentials are sent unencrypted."), { modal: true }, t("Continue without TLS"));
        if (!ok) return;
      }
      if (key === "sslVerify" && pick.v === false) {
        const ok = await vscode.window.showWarningMessage(t("Certificate verification is disabled: the server identity will not be checked."), { modal: true }, t("Continue anyway"));
        if (!ok) return;
      }
      continue;
    }
    const v = await vscode.window.showInputBox({
      title: fieldText(prop.title), prompt: prop.description ? fieldText(prop.description) : undefined, value: prop.default !== undefined ? String(prop.default) : "",
      password: !!prop.secret, ignoreFocusOut: true,
      validateInput: (x) => (required && !x.trim() ? t("Required") : prop.type === "number" && x && Number.isNaN(Number(x)) ? t("Must be a number") : undefined),
    });
    if (v === undefined) return;
    if (v === "" && !required) continue;
    values[key] = prop.type === "number" ? Number(v) : v;
    if (prop.secret) secretKeys.push(key);
  }

  if (driver.capabilities.sql || driver.family !== "relational") {
    const via = await vscode.window.showQuickPick([{ label: t("No"), v: "none" }, { label: t("Yes, via an SSH tunnel"), v: "ssh" }, { label: t("Yes, via an HTTP proxy"), v: "http" }, { label: t("Yes, via a SOCKS5 proxy"), v: "socks5" }], { title: t("Connect through SSH or a proxy?"), ignoreFocusOut: true });
    if (!via) return;
    const useSsh = { v: via.v === "ssh" };
    const ask = async (title: string, value = "", password = false, required = true) =>
      vscode.window.showInputBox({ title, value, password, ignoreFocusOut: true, validateInput: (x) => (required && !x.trim() ? t("Required") : undefined) });
    if (via.v === "http" || via.v === "socks5") {
      const host = await ask(t("Proxy host")); if (!host) return;
      const port = await ask(t("Proxy port"), via.v === "http" ? "3128" : "1080"); if (!port) return;
      const user = await ask(t("Proxy user (leave empty if none)"), "", false, false); if (user === undefined) return;
      values["proxy.type"] = via.v; values["proxy.host"] = host; values["proxy.port"] = Number(port);
      if (user) {
        values["proxy.username"] = user;
        const pw = await ask(t("Proxy password"), "", true, false); if (pw === undefined) return;
        if (pw) { values["proxy.password"] = pw; secretKeys.push("proxy.password"); }
      }
    }
    if (useSsh.v) {
      const host = await ask(t("SSH host")); if (!host) return;
      const port = await ask(t("SSH port"), "22"); if (!port) return;
      const user = await ask(t("SSH user")); if (!user) return;
      const method = await vscode.window.showQuickPick([{ label: t("Private key file"), k: "key" }, { label: t("Password"), k: "pw" }], { title: t("SSH authentication"), ignoreFocusOut: true });
      if (!method) return;
      values["ssh.host"] = host; values["ssh.port"] = Number(port); values["ssh.username"] = user;
      if (method.k === "pw") { const pw = await ask(t("SSH password"), "", true); if (pw === undefined) return; values["ssh.password"] = pw; secretKeys.push("ssh.password"); }
      else {
        const key = await ask(t("Path to private key"), "~/.ssh/id_ed25519"); if (!key) return;
        values["ssh.keyPath"] = key.replace(/^~/, process.env.HOME ?? "~");
        const pass = await ask(t("Key passphrase (leave empty if none)"), "", true, false);
        if (pass) { values["ssh.passphrase"] = pass; secretKeys.push("ssh.passphrase"); }
      }
    }
  }

  const id = randomUUID();
  await mgr.add({ id, name: name.trim(), driver: driverPick.id, environment: env.label, readOnly: false, tags: [], secretKeys, values });
  try {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t("Testing connection…") }, async () => {
      const c = await mgr.connect(id); await c.ping();
    });
    void vscode.window.showInformationMessage(t("Connected to {0}.", name));
  } catch (e) {
    await mgr.disconnect(id);
    const act = await vscode.window.showErrorMessage(t("Could not connect: {0}", friendly((e as Error).message)), t("Keep connection"), t("Delete"));
    if (act !== t("Keep connection")) await mgr.remove(id);
    return act === t("Keep connection") ? id : undefined;
  }
  return id;
}
