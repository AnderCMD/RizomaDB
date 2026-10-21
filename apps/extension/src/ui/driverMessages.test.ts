import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";

let configured = "es";
vi.mock("vscode", () => ({
  l10n: { t: (m: string, ...a: unknown[]) => m.replace(/\{(\d+)\}/g, (_, i: string) => String(a[Number(i)])) },
  env: { language: "en" },
  workspace: { getConfiguration: () => ({ get: () => configured }), onDidChangeConfiguration: () => ({ dispose() {} }) },
  Uri: { joinPath: (_b: unknown, ...p: string[]) => ({ fsPath: join(process.cwd(), ...p) }) },
}));
beforeEach(() => { vi.resetModules(); });
const load = async () => { const i = await import("../i18n.js"); i.initI18n({ extensionUri: {} } as never); return import("./driverMessages.js"); };

describe("friendly messages", () => {
  it("translates what RizomaDB writes, with its parameters", async () => {
    const { friendly } = await load();
    expect(friendly("Query cancelled")).toBe("Consulta cancelada");
    expect(friendly("Environment 'qa' is read-only by policy")).toBe("El entorno «qa» es de solo lectura por política");
    expect(friendly('"abc" is not an integer')).toBe("«abc» no es un entero");
    expect(friendly("Column age is NOT NULL.")).toBe("La columna age es NOT NULL.");
  });
  it("leaves the database server's own text alone", async () => {
    const { friendly } = await load();
    expect(friendly('relation "x" does not exist')).toBe('relation "x" does not exist');
  });
  it("translates each risk reason of a joined list", async () => {
    const { friendlyReasons } = await load();
    expect(friendlyReasons("DROP/TRUNCATE removes objects or all rows; UPDATE/DELETE without WHERE affects every row")).toBe("DROP/TRUNCATE elimina objetos o todas las filas; UPDATE/DELETE sin WHERE afecta a todas las filas");
  });
  it("does nothing in English", async () => {
    configured = "en";
    const { friendly } = await load();
    expect(friendly("Query cancelled")).toBe("Query cancelled"); configured = "es";
  });
});
