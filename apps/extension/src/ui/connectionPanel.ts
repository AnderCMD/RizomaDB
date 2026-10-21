import * as vscode from "vscode";
import { randomBytes, randomUUID } from "node:crypto";
import type { JsonSchemaProp } from "@rizomadb/driver-api";
import type { ConnectionManager } from "../lib/connections.js";
import { ENGINES, type Engine } from "../engineCatalog.js";
import { ENGINE_LOGOS } from "../engineLogos.js";
import { engineOf as engineOfProfile } from "./explorer.js";
import { BUILTIN_ENVIRONMENTS, customEnvironments } from "../lib/environments.js";
import { databaseOf } from "../lib/connectionInfo.js";
import { ConnectToHost, type ConnectForm } from "../connectMessages.js";
import { i18nBlock } from "./webviewStrings.js";
import { fieldText } from "../lib/fieldText.js";
import { t, effectiveLanguage } from "../i18n.js";
import { friendly } from "./driverMessages.js";

let current: vscode.WebviewPanel | undefined;

class FieldError extends Error { constructor(message: string, readonly field?: string) { super(message); } }

/** Opens (or focuses) the one-screen "New connection" editor: engine logos first, then the form for the chosen engine. */
export function openConnectionScreen(ctx: vscode.ExtensionContext, mgr: ConnectionManager, active: { get: () => string | undefined; onChange: vscode.Event<void> }) {
  if (current) { current.reveal(); return; }
  const root = vscode.Uri.joinPath(ctx.extensionUri, "dist");
  const panel = vscode.window.createWebviewPanel("rizomadb.connect", t("New connection"), vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [root] });
  current = panel;
  panel.onDidDispose(() => { current = undefined; });
  panel.iconPath = vscode.Uri.joinPath(ctx.extensionUri, "media", "icon.png");
  const nonce = randomBytes(16).toString("base64"), w = panel.webview;
  w.html = `<!doctype html><html lang="${effectiveLanguage()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${w.asWebviewUri(vscode.Uri.joinPath(root, "webview.css"))}"><title>${t("New connection")}</title></head>
<body><main id="app"></main>${i18nBlock()}<script nonce="${nonce}" src="${w.asWebviewUri(vscode.Uri.joinPath(root, "connect.js"))}"></script></body></html>`;

  const post = (m: unknown) => void w.postMessage(m);
  const available = () => ENGINES.filter((e) => mgr.driverIds().includes(e.driver));
  const engineOf = (key: string) => available().find((e) => e.key === key);

  const sendConnections = () => post({
    v: 1, type: "connections", items: mgr.list().map((p) => {
      const o = p.options as Record<string, unknown>;
      const target = typeof o["path"] === "string" ? o["path"] : typeof o["host"] === "string" ? `${o["host"]}${o["port"] ? `:${String(o["port"])}` : ""}` : "";
      return { id: p.id, name: p.name, engine: engineOfProfile(p)?.key ?? p.driver, environment: p.environment, readOnly: mgr.isReadOnly(p), connected: mgr.isConnected(p.id), shared: mgr.isShared(p.id), target, active: active.get() === p.id, database: databaseOf(p) };
    }),
  });
  const sub = mgr.onChange(sendConnections), sub2 = active.onChange(sendConnections);
  panel.onDidDispose(() => { sub.dispose(); sub2.dispose(); });

  w.onDidReceiveMessage(async (raw: unknown) => {
    const p = ConnectToHost.safeParse(raw); if (!p.success) return;
    const msg = p.data;
    if (msg.type === "ready") {
      sendConnections();
      post({ v: 1, type: "engines", engines: available().map(({ key, name, family, color, fg, mark, experimental }) => ({ key, name, family, color, fg, mark, ...(experimental ? { experimental } : {}), ...(ENGINE_LOGOS[key] ? { logo: ENGINE_LOGOS[key] } : {}) })) });
      return;
    }
    if (msg.type === "conn") {
      const profile = mgr.get(msg.id); if (!profile) return;
      const node = { kind: "connection", profile };
      try {
        if (msg.action === "connect") await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: t("Connecting…") }, async () => { const c = await mgr.connect(profile.id); await c.ping(); });
        else if (msg.action === "disconnect") await mgr.disconnect(profile.id);
        else if (msg.action === "query") await vscode.commands.executeCommand("rizomadb.newQuery", node);
        else if (msg.action === "readonly") await vscode.commands.executeCommand("rizomadb.toggleReadOnly", node);
        else await vscode.commands.executeCommand("rizomadb.deleteConnection", node);
      } catch (e) { void vscode.window.showErrorMessage(t("Could not connect: {0}", friendly((e as Error).message))); }
      sendConnections();
      return;
    }
    if (msg.type === "pick") {
      const engine = engineOf(msg.key); if (!engine) return;
      const driver = await mgr.loadDriver(engine.driver);
      const props = Object.entries(driver.connectionSchema.properties) as [string, JsonSchemaProp][];
      const fields = props.filter(([k]) => k !== "readOnly").map(([key, prop]) => {
        const preset = engine.defaults?.[key] ?? prop.default;  // each engine presets its usual local host, port and user; fields the engine does not need stay empty and optional
        return {
          key, title: fieldText(prop.title), ...(prop.description ? { description: fieldText(prop.description) } : {}),
          kind: prop.type === "boolean" ? "boolean" as const : prop.type === "number" ? "number" as const : "text" as const,
          required: driver.connectionSchema.required?.includes(key) ?? false, secret: !!prop.secret,
          value: prop.type === "boolean" ? preset === true : preset === undefined ? "" : String(preset),
        };
      });
      post({ v: 1, type: "form", key: engine.key, fields, tunnel: props.some(([k]) => k === "host"), defaultName: engine.name, environments: [...BUILTIN_ENVIRONMENTS, ...customEnvironments(vscode.workspace.getConfiguration("rizomadb").get("environments")).map((x) => x.name)] });
      return;
    }

    const action = msg.type, form = msg.form;
    const reply = (ok: boolean, message: string, extra: { field?: string; canForce?: boolean } = {}) => post({ v: 1, type: "result", action, ok, message, ...extra });
    try {
      const engine = engineOf(form.key); if (!engine) throw new FieldError(t("Unknown engine"));
      const input = await buildProfile(mgr, engine, form);
      // Traffic to this machine never leaves it, so a missing TLS layer is not worth a warning unless a tunnel or proxy is in the way.
      const local = form.via === "none" && /^(localhost|127\.\d+\.\d+\.\d+|::1|\[::1\])$/i.test(String(input.values["host"] ?? ""));
      if (!local && input.values["ssl"] === false && !(await vscode.window.showWarningMessage(t("TLS is disabled: traffic and credentials are sent unencrypted."), { modal: true }, t("Continue without TLS")))) return reply(false, t("Cancelled."));
      if (!local && input.values["sslVerify"] === false && !(await vscode.window.showWarningMessage(t("Certificate verification is disabled: the server identity will not be checked."), { modal: true }, t("Continue anyway")))) return reply(false, t("Cancelled."));

      // A new environment name is remembered in the settings, with the protection chosen in the form.
      const cfgEnv = vscode.workspace.getConfiguration("rizomadb");
      const known = new Set<string>([...BUILTIN_ENVIRONMENTS, ...customEnvironments(cfgEnv.get("environments")).map((x) => x.name)]);
      if (!known.has(form.environment) && action === "save") {
        const list = (cfgEnv.get<unknown[]>("environments") ?? []).slice();
        list.push({ name: form.environment, protection: form.newEnvProtection ?? "confirm" });
        await cfgEnv.update("environments", list, vscode.ConfigurationTarget.Global);
      }
      const id = randomUUID();
      await mgr.add({ id, ...input });
      const probe = () => vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t("Testing connection…") }, async () => { const c = await mgr.connect(id); await c.ping(); });
      if (action === "test" || !form.force) {
        try { await probe(); }
        catch (e) {
          await mgr.remove(id);
          return reply(false, t("Could not connect: {0}", friendly((e as Error).message)), action === "save" ? { canForce: true } : {});
        }
        if (action === "test") { await mgr.remove(id); return reply(true, t("Connection successful.")); }
      }
      reply(true, form.force ? t("Saved {0} without connecting.", input.name) : t("Saved and connected to {0}.", input.name));
    } catch (e) {
      reply(false, (e as Error).message, e instanceof FieldError && e.field ? { field: e.field } : {});
    }
  });
}

/** Validates the form against the driver's schema and shapes it like the quick-pick wizard does. */
async function buildProfile(mgr: ConnectionManager, engine: Engine, form: ConnectForm) {
  const driver = await mgr.loadDriver(engine.driver);
  const name = form.name.trim() || engine.name;
  const values: Record<string, unknown> = {};
  const secretKeys: string[] = [];
  for (const [key, prop] of Object.entries(driver.connectionSchema.properties) as [string, JsonSchemaProp][]) {
    if (key === "readOnly") continue;
    const raw = form.values[key];
    const required = driver.connectionSchema.required?.includes(key) ?? false;
    if (prop.type === "boolean") { values[key] = raw === true; continue; }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) { if (required) throw new FieldError(t("{0} is required.", fieldText(prop.title)), key); continue; }
    if (prop.type === "number") {
      if (Number.isNaN(Number(text))) throw new FieldError(t("{0} must be a number.", fieldText(prop.title)), key);
      values[key] = Number(text);
    } else values[key] = typeof raw === "string" && prop.secret ? raw : text;
    if (prop.secret) secretKeys.push(key);
  }
  const net = (k: string) => (form.net[k] ?? "").trim();
  const need = (k: string, label: string) => { if (!net(k)) throw new FieldError(t("{0} is required.", label), `net.${k}`); return net(k); };
  const port = (k: string, label: string) => { const v = need(k, label); if (!/^\d+$/.test(v) || Number(v) > 65535) throw new FieldError(t("{0} must be a number.", label), `net.${k}`); return Number(v); };
  if (form.via === "http" || form.via === "socks5") {
    values["proxy.type"] = form.via; values["proxy.host"] = need("proxyHost", t("Proxy host")); values["proxy.port"] = port("proxyPort", t("Proxy port"));
    if (net("proxyUser")) {
      values["proxy.username"] = net("proxyUser");
      if (form.net["proxyPassword"]) { values["proxy.password"] = form.net["proxyPassword"]; secretKeys.push("proxy.password"); }
    }
  } else if (form.via === "ssh") {
    values["ssh.host"] = need("sshHost", t("SSH host")); values["ssh.port"] = port("sshPort", t("SSH port")); values["ssh.username"] = need("sshUser", t("SSH user"));
    if (net("sshAuth") === "pw") {
      if (!form.net["sshPassword"]) throw new FieldError(t("{0} is required.", t("SSH password")), "net.sshPassword");
      values["ssh.password"] = form.net["sshPassword"]; secretKeys.push("ssh.password");
    } else {
      values["ssh.keyPath"] = need("sshKeyPath", t("Path to private key")).replace(/^~/, process.env.HOME ?? "~");
      if (form.net["sshPassphrase"]) { values["ssh.passphrase"] = form.net["sshPassphrase"]; secretKeys.push("ssh.passphrase"); }
    }
  }
  return { name, driver: engine.driver, environment: form.environment, readOnly: false, tags: [`engine:${engine.key}`], secretKeys, values };
}
