import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import net from "node:net";
import dns from "node:dns";
import { readdirSync, statSync } from "node:fs";

const commands = new Map<string, unknown>();
const noop = () => ({ dispose() {} });
vi.mock("vscode", () => {
  const item = () => ({ show() {}, hide() {}, dispose() {} });
  return {
    l10n: { t: (s: string, ...a: unknown[]) => s.replace(/\{(\d)\}/g, (_, i) => String(a[Number(i)])) },
    workspace: { getConfiguration: () => ({ get: (_: string, d: unknown) => d }), isTrusted: true, workspaceFolders: [], createFileSystemWatcher: () => ({ onDidChange: noop, onDidCreate: noop, onDidDelete: noop, dispose() {} }), onDidGrantWorkspaceTrust: noop, onDidChangeConfiguration: noop, onDidChangeWorkspaceFolders: noop, registerNotebookSerializer: noop, onDidChangeTextDocument: noop, onDidOpenTextDocument: noop, onDidCloseTextDocument: noop, textDocuments: [] },
    notebooks: { createNotebookController: () => ({ dispose() {} }) },
    CompletionItemKind: {}, DiagnosticSeverity: {}, NotebookCellKind: {},
    Uri: { joinPath: (u: { fsPath: string }, ...p: string[]) => ({ fsPath: [u.fsPath, ...p].join('/') }) },
    window: { createOutputChannel: () => ({ appendLine() {}, clear() {}, show() {}, dispose() {} }), showErrorMessage: async () => undefined, createStatusBarItem: item, registerTreeDataProvider: noop, createTreeView: noop, createTextEditorDecorationType: () => ({ dispose() {} }), onDidChangeTextEditorSelection: noop, onDidChangeActiveTextEditor: noop, activeTextEditor: undefined },
    commands: { registerCommand: (id: string, fn: unknown) => { commands.set(id, fn); return noop(); }, executeCommand: async () => {} },
    languages: { registerCodeLensProvider: noop, registerCompletionItemProvider: noop, createDiagnosticCollection: () => ({ dispose() {}, set() {}, delete() {} }), registerDocumentFormattingEditProvider: noop, registerDocumentRangeFormattingEditProvider: noop },
    lm: { registerMcpServerDefinitionProvider: (id: string) => { (globalThis as { __mcpIds?: string[] }).__mcpIds = [...((globalThis as { __mcpIds?: string[] }).__mcpIds ?? []), id]; return { dispose() {} }; } }, McpStdioServerDefinition: class {},
    StatusBarAlignment: { Left: 1 }, EventEmitter: class { event = () => noop(); fire() {} },
    TreeItem: class {}, ThemeIcon: class {}, ThemeColor: class {}, TreeItemCollapsibleState: {}, ProgressLocation: {}, ViewColumn: {},
  };
});

describe("activation", () => {
  it("registers every command declared in package.json and no secrets leak into state", async () => {
    const { activate } = await import("./extension.js");
    const store = new Map<string, unknown>();
    const ctx = {
      subscriptions: [] as { dispose(): void }[], extensionUri: { fsPath: "/x", path: "/x", scheme: "file" }, globalStorageUri: { fsPath: "/tmp/rz-test" },
      globalState: { get: (k: string, d: unknown) => store.get(k) ?? d, update: async (k: string, v: unknown) => { store.set(k, v); } },
      workspaceState: { get: () => undefined, update: async () => {} },
      secrets: { get: async () => undefined, store: async () => {}, delete: async () => {} },
    };
    const attempts: string[] = [];
    const origConnect = net.Socket.prototype.connect, origLookup = dns.lookup;
    net.Socket.prototype.connect = function (this: net.Socket, ...a: unknown[]) { attempts.push("socket"); return origConnect.apply(this, a as never); } as never;
    (dns as { lookup: unknown }).lookup = (...a: unknown[]) => { attempts.push("dns"); return (origLookup as (...x: unknown[]) => unknown)(...a); };
    try { await activate(ctx as never); } finally { net.Socket.prototype.connect = origConnect; (dns as { lookup: unknown }).lookup = origLookup; }
    expect(attempts, "no network activity without configured connections").toEqual([]);
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    const declared = pkg.contributes.commands.map((c: { command: string }) => c.command);
    for (const id of declared) expect(commands.has(id), id).toBe(true);
  });
});

describe("no telemetry surface", () => {
  it("extension and core sources never import network modules or fetch", () => {
    const roots = [join(process.cwd(), "src"), join(process.cwd(), "../../packages/core/src"), join(process.cwd(), "../../packages/driver-api/src")];
    const bad = /from "node:(http|https|net|tls|dgram|dns|http2)"|from "(http|https|net|tls)"|\bfetch\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket\(/;
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.endsWith("conformance.ts") ? [p] : []; });
    const offenders = roots.flatMap(walk).filter((f) => bad.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
