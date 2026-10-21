import { describe, it, expect, vi } from "vitest";
vi.mock("vscode", () => ({ l10n: { t: (s: string) => s } }));
import { envReferences } from "./mcpProvider.js";

describe("MCP provider", () => {
  it("finds env references once each", () => {
    expect(envReferences('{"password":"${env:PG_PASS}","x":"${env:PG_PASS}","y":"${env:OTHER_1}","z":"${file:nope}"}')).toEqual(["PG_PASS", "OTHER_1"]);
  });
});
