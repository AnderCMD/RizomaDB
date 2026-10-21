import { describe, it, expect } from "vitest";
import { commandAt, isQueryLanguage } from "./commandAt.js";

describe("Cypher statement at cursor", () => {
  const text = "MATCH (n) RETURN n;\n\n// c; not a split\nMATCH (m {s: 'a;b'})\nRETURN m;\n";
  it("is a query language", () => expect(isQueryLanguage("rizomadb-cypher")).toBe(true));
  it("picks the statement under the cursor, ignoring semicolons in strings and comments", () => {
    expect(commandAt("rizomadb-cypher", text, 3)).toBe("MATCH (n) RETURN n");
    expect(commandAt("rizomadb-cypher", text, text.indexOf("RETURN m"))).toContain("'a;b'");
    expect(commandAt("rizomadb-cypher", text, text.indexOf("RETURN m"))).toContain("RETURN m");
  });
  it("falls back to the previous statement after the last terminator and returns nothing for empty text", () => {
    expect(commandAt("rizomadb-cypher", "RETURN 1;\n", 10)).toBe("RETURN 1");
    expect(commandAt("rizomadb-cypher", "  \n", 1)).toBeUndefined();
  });
});
