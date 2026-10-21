import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import type { JsonSchemaProp } from "@rizomadb/driver-api";
import type { ConnectionManager } from "../lib/connections.js";

const t = vscode.l10n.t;

/** Builds the connection form from the driver's connectionSchema, as input prompts. */
export async function newConnectionWizard(mgr: ConnectionManager): Promise<string | undefined> {
  const driverPick = await vscode.window.showQuickPick(
    await Promise.all(mgr.driverIds().map(async (id) => { const d = await mgr.loadDriver(id); return { label: d.displayName, description: d.family, id }; })),
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
        title: prop.title, placeHolder: prop.description, ignoreFocusOut: true });
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
      title: prop.title, prompt: prop.description, value: prop.default !== undefined ? String(prop.default) : "",
      password: !!prop.secret, ignoreFocusOut: true,
      validateInput: (x) => (required && !x.trim() ? t("Required") : prop.type === "number" && x && Number.isNaN(Number(x)) ? t("Must be a number") : undefined),
    });
    if (v === undefined) return;
    if (v === "" && !required) continue;
    values[key] = prop.type === "number" ? Number(v) : v;
    if (prop.secret) secretKeys.push(key);
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
    const act = await vscode.window.showErrorMessage(t("Could not connect: {0}", (e as Error).message), t("Keep connection"), t("Delete"));
    if (act !== t("Keep connection")) await mgr.remove(id);
    return act === t("Keep connection") ? id : undefined;
  }
  return id;
}
