import * as vscode from "vscode";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const t = vscode.l10n.t;

// The MCP provider API arrived in VS Code 1.101 and is absent from the 1.100 typings this extension builds against.
interface StdioDefinition { label: string; command: string; args: string[]; env: Record<string, string | null>; version?: string }
interface Api {
  lm?: { registerMcpServerDefinitionProvider?(id: string, p: {
    onDidChangeMcpServerDefinitions: vscode.Event<void>;
    provideMcpServerDefinitions(): Promise<StdioDefinition[]>;
    resolveMcpServerDefinition(d: StdioDefinition): Promise<StdioDefinition | undefined>;
  }): vscode.Disposable };
  McpStdioServerDefinition?: new (label: string, command: string, args?: string[], env?: Record<string, string | number | null>, version?: string) => StdioDefinition;
}

/** Variables the config reads from the environment (`${env:NAME}`), so the password can be asked for instead of exported by hand. */
export function envReferences(configText: string): string[] {
  return [...new Set([...configText.matchAll(/\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]!))];
}

/**
 * Offers the read-only MCP server to VS Code's own MCP client. Opt-in twice: the setting `rizomadb.mcp.autoRegister` and a
 * `.rizomadb/mcp.json` the user generated. Passwords are asked when the server starts and live only in that process's environment.
 */
export function registerMcpProvider(ctx: vscode.ExtensionContext): void {
  const api = vscode as unknown as Api;
  if (!api.lm?.registerMcpServerDefinitionProvider || !api.McpStdioServerDefinition) return; // older VS Code, or a fork without the API
  const Def = api.McpStdioServerDefinition;
  const changed = new vscode.EventEmitter<void>();
  const enabled = () => vscode.workspace.getConfiguration("rizomadb").get<boolean>("mcp.autoRegister", false);
  const server = vscode.Uri.joinPath(ctx.extensionUri, "dist", "mcp-server.cjs").fsPath;
  const configs = async () => {
    const out: { file: string; label: string; text: string }[] = [];
    for (const f of vscode.workspace.workspaceFolders ?? []) {
      const file = join(f.uri.fsPath, ".rizomadb", "mcp.json");
      try { out.push({ file, label: `RizomaDB (${f.name}, read-only)`, text: await readFile(file, "utf8") }); } catch { /* no config in this folder */ }
    }
    return out;
  };
  ctx.subscriptions.push(
    changed,
    vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration("rizomadb.mcp.autoRegister")) changed.fire(); }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => changed.fire()),
    api.lm.registerMcpServerDefinitionProvider("rizomadb.mcp", {
      onDidChangeMcpServerDefinitions: changed.event,
      provideMcpServerDefinitions: async () => (enabled() ? (await configs()).map((c) => new Def(c.label, process.execPath, [server, "--config", c.file], {}, "1")) : []),
      async resolveMcpServerDefinition(d) {
        const cfg = (await configs()).find((c) => d.args.includes(c.file));
        if (!cfg) return undefined;
        const env: Record<string, string> = {};
        for (const name of envReferences(cfg.text)) {
          if (process.env[name]) continue;
          const v = await vscode.window.showInputBox({ title: t("RizomaDB MCP server"), prompt: t("Password for {0} (use a read-only database account; it is kept only in the server process)", name), password: true, ignoreFocusOut: true });
          if (v === undefined) return undefined; // user declined: do not start the server
          env[name] = v;
        }
        d.env = { ...d.env, ...env };
        return d;
      },
    }),
  );
}
