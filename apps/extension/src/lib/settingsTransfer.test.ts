import { describe, it, expect } from "vitest";
import { buildExport, parseImport, validSetting } from "./settingsTransfer.js";

const specs = {
  "rizomadb.query.pageSize": { type: "number", minimum: 1 },
  "rizomadb.language": { type: "string", enum: ["auto", "en", "es"] },
  "rizomadb.history.enabled": { type: "boolean" },
  "rizomadb.environments": { type: "array" },
};

describe("settings export and import", () => {
  it("round-trips what was exported", () => {
    const values = { "rizomadb.language": "es", "rizomadb.query.pageSize": 100, "rizomadb.environments": [{ name: "qa", protection: "confirm" }] };
    expect(parseImport(JSON.stringify(buildExport(values)), specs)).toEqual({ accepted: values, rejected: [] });
  });
  it("rejects unknown keys, wrong types and out-of-range values one by one", () => {
    const text = JSON.stringify(buildExport({ "editor.fontSize": 30, "rizomadb.query.pageSize": 0, "rizomadb.language": "xx", "rizomadb.history.enabled": "yes", "rizomadb.environments": {} }));
    const r = parseImport(text, specs);
    expect(r.accepted).toEqual({});
    expect(r.rejected.sort()).toEqual(["editor.fontSize", "rizomadb.environments", "rizomadb.history.enabled", "rizomadb.language", "rizomadb.query.pageSize"]);
  });
  it("refuses files that are not a settings export", () => {
    expect(() => parseImport("{nope", specs)).toThrow("not-json");
    expect(() => parseImport(JSON.stringify({ settings: {} }), specs)).toThrow("not-settings");
    expect(() => parseImport("[]", specs)).toThrow("not-settings");
    expect(() => parseImport(JSON.stringify({ format: "rizomadb-settings", settings: [] }), specs)).toThrow("not-settings");
  });
  it("validates integers and string length", () => {
    expect(validSetting({ type: "integer" }, 1.5)).toBe(false);
    expect(validSetting({ type: "string" }, "x".repeat(2001))).toBe(false);
    expect(validSetting({ type: "number" }, Number.NaN)).toBe(false);
  });
});
