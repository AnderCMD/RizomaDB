import { describe, it, expect } from "vitest";
import { onlyComments, splitStatements } from "./splitter.js";
import { cachedStatementRanges, statementRanges } from "./statements.js";

const texts = (sql: string, max?: number) => splitStatements(sql, max ? { maxStatements: max } : {}).map((s) => s.text);

describe("onlyComments", () => {
  it.each([
    ["-- a", true], ["/* a */", true], ["-- a\n-- b", true], ["/* a */ /* b */\n-- c", true], ["/* a\nb\nc */", true],
    ["/* a */ SELECT 1", false], ["-- a\nSELECT 1", false], ["/* unclosed", false], ["/* a */ /* unclosed", false], ["SELECT 1", false], ["", false], ["   \n", false],
  ])("%j -> %s", (t, want) => { expect(onlyComments(t)).toBe(want); });
  it("uses // as the line marker for Cypher", () => { expect(onlyComments("// a\n/* b */", "//")).toBe(true); expect(onlyComments("-- a", "//")).toBe(false); });
});

describe("splitStatements comment handling", () => {
  it("splits several plain statements", () => { expect(texts("SELECT 1; SELECT 2;\nSELECT 3")).toEqual(["SELECT 1", "SELECT 2", "SELECT 3"]); });
  it("drops fragments that are only comments, in every form", () => {
    expect(texts("-- a\n;/* b */;-- c\n/* d */ -- e\n;SELECT 1")).toEqual(["SELECT 1"]);
    expect(texts("/* a */\n/* b */\n/* c */\n;SELECT 2")).toEqual(["SELECT 2"]);
    expect(texts(`/* ${"line\n".repeat(5000)} */;SELECT 3`)).toEqual(["SELECT 3"]);
  });
  it("keeps a statement that starts with comments but ends with code or an unclosed comment", () => {
    expect(texts("-- a\nSELECT 1")).toEqual(["-- a\nSELECT 1"]);
    expect(texts("/* a */ /* b */ x")).toEqual(["/* a */ /* b */ x"]);
    expect(texts("/* a */ /* open")).toEqual(["/* a */ /* open"]);
  });
  it("does not treat comment markers inside strings, quoted identifiers or dollar quotes as comments or separators", () => {
    expect(texts("SELECT '--', '/*', '*/', ';'; SELECT 2")).toEqual(["SELECT '--', '/*', '*/', ';'", "SELECT 2"]);
    expect(texts('SELECT "a;--b" FROM `c;/*d`; SELECT 2')).toEqual(['SELECT "a;--b" FROM `c;/*d`', "SELECT 2"]);
    expect(texts("SELECT $$ -- ; /* $$; SELECT $t$ */ ; $t$")).toEqual(["SELECT $$ -- ; /* $$", "SELECT $t$ */ ; $t$"]);
  });
  it("is not exponential on a run of block comments followed by code (the old regex needed minutes for 40)", () => {
    for (const n of [40, 200, 20000]) {
      const sql = `${"/* a */ ".repeat(n)}SELECT 1`;
      const t0 = performance.now();
      expect(texts(sql)).toEqual([sql]);
      expect(performance.now() - t0).toBeLessThan(2000);
    }
  });
  it("stays fast on other adversarial shapes", () => {
    const t0 = performance.now();
    for (const sql of ["-- " + " ".repeat(200_000) + "x", "-- c\n".repeat(50_000) + "x", "/*".repeat(50_000), "$".repeat(100_000), "/* a */ ".repeat(50_000) + "SELECT 1;".repeat(1000)]) splitStatements(sql);
    expect(performance.now() - t0).toBeLessThan(3000);
  });
  it("handles a large SQL file and keeps offsets exact", () => {
    const sql = Array.from({ length: 20_000 }, (_, i) => `/* h${i} */ -- n\nSELECT ${i}, 'x;--';`).join("\n");
    const out = splitStatements(sql);
    expect(out).toHaveLength(20_000);
    expect(sql.slice(out[19_999]!.start, out[19_999]!.end)).toBe(out[19_999]!.text);
  });
});

describe("maxStatements", () => {
  const sql = Array.from({ length: 1000 }, (_, i) => `SELECT ${i};`).join("\n");
  it("returns exactly the first N statements, same as slicing the full result", () => {
    expect(splitStatements(sql, { maxStatements: 300 })).toEqual(splitStatements(sql).slice(0, 300));
    expect(texts(sql, 1)).toEqual(["SELECT 0"]);
    expect(splitStatements("SELECT 1", { maxStatements: 5 })).toHaveLength(1);
  });
  it("stops scanning early: far cheaper than a full parse of a large document (relative, best of 5)", () => {
    const big = "SELECT 1, 'a;b'; -- c\n".repeat(200_000);
    const best = (f: () => unknown) => { let m = Infinity; for (let i = 0; i < 5; i++) { const t = performance.now(); f(); m = Math.min(m, performance.now() - t); } return m; };
    expect(splitStatements(big, { maxStatements: 3 })).toHaveLength(3);
    const early = best(() => splitStatements(big, { maxStatements: 3 })), full = best(() => splitStatements(big));
    expect(early * 20).toBeLessThan(full);
  });
  it("applies to Cypher through statementRanges and leaves the default unlimited", () => {
    const cy = Array.from({ length: 50 }, (_, i) => `RETURN ${i};`).join("\n");
    expect(statementRanges("rizomadb-cypher", cy, { maxStatements: 7 })).toHaveLength(7);
    expect(statementRanges("rizomadb-cypher", cy)).toHaveLength(50);
    expect(statementRanges("sql", sql)).toHaveLength(1000);
  });
  it("Cypher comment-only fragments no longer backtrack", () => {
    const q = `${"/* a */ ".repeat(40)}RETURN 1`;
    expect(statementRanges("rizomadb-cypher", q).map((s) => s.text)).toEqual([q]);
  });
});

describe("cachedStatementRanges", () => {
  const fake = (text: string, languageId = "sql") => { const d = { version: 1, languageId, calls: 0, text, getText() { d.calls++; return d.text; } }; return d; };
  it("parses an unchanged document once, however often the cursor moves", () => {
    const d = fake("SELECT 1; SELECT 2");
    for (let i = 0; i < 50; i++) cachedStatementRanges(d);
    cachedStatementRanges(d, { maxStatements: 300 });
    expect(d.calls).toBe(1);
  });
  it("recomputes after an edit (new version) and after a language change", () => {
    const d = fake("SELECT 1");
    expect(cachedStatementRanges(d)).toHaveLength(1);
    d.text = "SELECT 1; SELECT 2"; d.version = 2;
    expect(cachedStatementRanges(d)).toHaveLength(2);
    d.languageId = "rizomadb-redis"; d.text = "GET a\nGET b\nGET c";
    expect(cachedStatementRanges(d)).toHaveLength(3);
    expect(d.calls).toBe(3);
  });
  it("serves a smaller limit from a complete parse, and re-parses for a larger limit after an early stop", () => {
    const d = fake(Array.from({ length: 20 }, (_, i) => `SELECT ${i};`).join(" "));
    expect(cachedStatementRanges(d, { maxStatements: 5 })).toHaveLength(5);
    expect(cachedStatementRanges(d, { maxStatements: 3 })).toHaveLength(3);
    expect(d.calls).toBe(1);
    expect(cachedStatementRanges(d)).toHaveLength(20);
    expect(d.calls).toBe(2);
    expect(cachedStatementRanges(d, { maxStatements: 5 })).toHaveLength(5);
    expect(d.calls).toBe(2);
  });
  it("keeps separate entries per document", () => {
    const a = fake("SELECT 1"), b = fake("SELECT 1; SELECT 2");
    expect(cachedStatementRanges(a)).toHaveLength(1); expect(cachedStatementRanges(b)).toHaveLength(2); expect(cachedStatementRanges(a)).toHaveLength(1);
  });
});
