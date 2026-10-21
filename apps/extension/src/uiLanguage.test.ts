import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";

let configured = "auto";
vi.mock("vscode", () => ({
  l10n: { t: (m: string, ...a: unknown[]) => `vscode:${m.replace(/\{(\d+)\}/g, (_, i: string) => String(a[Number(i)]))}` },
  env: { language: "fr" },
  workspace: { getConfiguration: () => ({ get: () => configured }), onDidChangeConfiguration: () => ({ dispose() {} }) },
  Uri: { joinPath: (_b: unknown, ...p: string[]) => ({ fsPath: join(process.cwd(), ...p) }) },
}));

const ctx = { extensionUri: {} } as never;
beforeEach(() => { vi.resetModules(); });

describe("extension language override", () => {
  it("follows VS Code when set to auto", async () => {
    configured = "auto";
    const m = await import("./i18n.js"); m.initI18n(ctx);
    expect(m.t("Saved {0}", "x")).toBe("vscode:Saved x"); expect(m.effectiveLanguage()).toBe("fr");
  });
  it("forces Spanish from the bundled translations", async () => {
    configured = "es";
    const m = await import("./i18n.js"); m.initI18n(ctx);
    expect(m.t("Saved {0}", "x")).toBe("x guardado"); expect(m.effectiveLanguage()).toBe("es");
  });
  it("keeps placeholders that have no argument yet (webview templates)", async () => {
    configured = "es";
    const m = await import("./i18n.js"); m.initI18n(ctx);
    expect(m.t("{0} rows")).toBe("{0} filas"); expect(m.t("{0} of {1} rows", 3)).toBe("3 de {1} filas");
  });
  it("forces English, formatting the source string", async () => {
    configured = "en";
    const m = await import("./i18n.js"); m.initI18n(ctx);
    expect(m.t("Saved {0}", "x")).toBe("Saved x"); expect(m.effectiveLanguage()).toBe("en");
  });
});
