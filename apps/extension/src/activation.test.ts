import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const commands = new Map<string, unknown>();
const noop = () => ({ dispose() {} });
vi.mock("vscode", () => {
  const item = () => ({ show() {}, hide() {}, dispose() {} });
  return {
    l10n: { t: (s: string, ...a: unknown[]) => s.replace(/\{(\d)\}/g, (_, i) => String(a[Number(i)])) },
    workspace: { getConfiguration: () => ({ get: (_: string, d: unknown) => d }) },
    window: { createStatusBarItem: item, registerTreeDataProvider: noop, onDidChangeActiveTextEditor: noop, activeTextEditor: undefined },
    commands: { registerCommand: (id: string, fn: unknown) => { commands.set(id, fn); return noop(); }, executeCommand: async () => {} },
    languages: { registerCodeLensProvider: noop },
    StatusBarAlignment: { Left: 1 }, EventEmitter: class { event = () => noop(); fire() {} },
    TreeItem: class {}, ThemeIcon: class {}, ThemeColor: class {}, TreeItemCollapsibleState: {}, ProgressLocation: {}, ViewColumn: {},
  };
});

describe("activation", () => {
  it("registers every command declared in package.json and no secrets leak into state", async () => {
    const { activate } = await import("./extension.js");
    const store = new Map<string, unknown>();
    const ctx = {
      subscriptions: [] as { dispose(): void }[], extensionUri: {}, globalStorageUri: { fsPath: "/tmp/rz-test" },
      globalState: { get: (k: string, d: unknown) => store.get(k) ?? d, update: async (k: string, v: unknown) => { store.set(k, v); } },
      workspaceState: { get: () => undefined, update: async () => {} },
      secrets: { get: async () => undefined, store: async () => {}, delete: async () => {} },
    };
    await activate(ctx as never);
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    const declared = pkg.contributes.commands.map((c: { command: string }) => c.command);
    for (const id of declared) expect(commands.has(id), id).toBe(true);
  });
});
