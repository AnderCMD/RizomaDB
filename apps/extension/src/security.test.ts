import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : []; });
const files = walk(root);
const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => f.slice(root.length + 1);

describe("webview hardening (every panel the extension can open)", () => {
  const panels = files.filter((f) => /createWebviewPanel/.test(read(f)));
  it("finds the panels", () => { expect(panels.map(rel).sort()).toEqual(expect.arrayContaining(["ui/adminCommands.ts", "ui/designerPanel.ts", "ui/erPanel.ts", "ui/planPanel.ts", "ui/resultsPanel.ts"])); });
  for (const f of panels) {
    it(`${rel(f)}: strict CSP, nonce scripts, minimal resource roots`, () => {
      const s = read(f);
      expect(s).toContain("Content-Security-Policy");
      expect(s).toContain("default-src 'none'");
      expect(s).toMatch(/script-src 'nonce-\$\{nonce\}'/);
      expect(s).not.toMatch(/unsafe-inline|unsafe-eval|script-src[^"]*https?:/);
      expect(s).toMatch(/localResourceRoots: \[root\]/);
      expect(s).toMatch(/randomBytes\(16\)/);
    });
  }
  it("every message from a webview is validated before use", () => {
    for (const f of panels) {
      const s = read(f);
      if (!/onDidReceiveMessage/.test(s)) continue;
      expect(s, rel(f)).toMatch(/safeParse\(/);
    }
  });
});

describe("webview scripts never build HTML from data", () => {
  const scripts = files.filter((f) => f.includes("/ui/webview/") && f.endsWith(".ts"));
  it("has scripts to check", () => { expect(scripts.length).toBeGreaterThanOrEqual(5); });
  for (const f of scripts) {
    it(`${rel(f)}: no innerHTML / eval / document.write`, () => {
      const s = read(f).replace(/\/\/.*$/gm, "");
      expect(s).not.toMatch(/\.innerHTML\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(|outerHTML\s*=/);
    });
  }
});

describe("host code", () => {
  it("never uses eval, Function(), or shell-interpreted commands", () => {
    for (const f of files) {
      const s = read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(s, rel(f)).not.toMatch(/\beval\(|new Function\(|child_process["']?\)?\.exec\(|\bshell:\s*true/);
    }
  });
  it("does not put secrets into extension settings", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { contributes: { configuration: { properties: Record<string, unknown> } } };
    for (const k of Object.keys(pkg.contributes.configuration.properties)) expect(k).not.toMatch(/password|secret|token|apikey/i);
  });
  it("declares limited support in untrusted workspaces", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { capabilities: { untrustedWorkspaces: { supported: string } } };
    expect(pkg.capabilities.untrustedWorkspaces.supported).toBe("limited");
  });
  it("loads project policy and catalogs only in trusted workspaces", () => {
    const s = read(join(root, "extension.ts"));
    expect(s).toContain("vscode.workspace.isTrusted ? folders.map((f) => ({ label: `project");
    expect(s).toContain("vscode.workspace.isTrusted ? folders.map((f) => ({ source: `project");
  });
});
