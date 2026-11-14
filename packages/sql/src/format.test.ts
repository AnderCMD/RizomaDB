import { describe, it, expect } from "vitest";
import { formatSql } from "./index.js";

describe("formatSql options", () => {
  it("keeps the output it always had by default", () => {
    expect(formatSql("select a from t where x=1", "postgres")).toBe("SELECT\n  a\nFROM\n  t\nWHERE\n  x = 1");
  });
  it("follows the editor's indentation: tab size and tabs", () => {
    expect(formatSql("select a from t", "postgres", { tabWidth: 4 })).toBe("SELECT\n    a\nFROM\n    t");
    expect(formatSql("select a from t", "postgres", { useTabs: true })).toBe("SELECT\n\ta\nFROM\n\tt");
  });
  it("applies letter case per kind of word", () => {
    const out = formatSql("SELECT count(x)::INTEGER FROM t", "postgres", { keywordCase: "lower", functionCase: "upper", dataTypeCase: "lower" });
    expect(out).toContain("select");
    expect(out).toContain("COUNT(x)::integer");
    expect(formatSql("SeLeCt 1", "postgres", { keywordCase: "preserve" })).toBe("SeLeCt\n  1");
  });
  it("supports the layout options", () => {
    expect(formatSql("select a from t where x=1 and y=2", "postgres", { logicalOperatorNewline: "after" })).toContain("x = 1 AND\n  y = 2");
    expect(formatSql("select a from t where x=1", "postgres", { denseOperators: true })).toContain("x=1");
    expect(formatSql("select 1; select 2", "postgres", { linesBetweenQueries: 2, newlineBeforeSemicolon: true })).toBe("SELECT\n  1\n;\n\n\nSELECT\n  2");
    expect(formatSql("select a, b from t", "postgres", { indentStyle: "tabularLeft" })).toBe("SELECT    a,\n          b\nFROM      t");
  });
  it("clamps out-of-range numbers instead of failing", () => {
    expect(formatSql("select 1", "postgres", { tabWidth: 0 })).toBe("SELECT\n 1");
    expect(formatSql("select 1", "postgres", { tabWidth: Number.NaN })).toBe("SELECT\n  1");
  });
  it("keeps the selection's own indentation and trailing line break, but never changes a multi-line string", () => {
    expect(formatSql("    select a from t\n", "postgres")).toBe("    SELECT\n      a\n    FROM\n      t\n");
    const out = formatSql("  select 'x\ny' as s from t", "postgres");
    expect(out).toContain("'x\ny'");
    expect(out.startsWith("  SELECT")).toBe(true);
  });
  it("returns the input untouched when it cannot be parsed or is empty", () => {
    expect(formatSql("   \n", "postgres")).toBe("   \n");
  });
});
