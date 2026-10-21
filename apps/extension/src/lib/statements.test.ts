import { describe, it, expect } from "vitest";
import { statementRanges } from "./statements.js";

const texts = (lang: string, src: string) => statementRanges(lang, src).map((s) => s.text);
const slice = (lang: string, src: string) => statementRanges(lang, src).map((s) => src.slice(s.start, s.end));

describe("statementRanges", () => {
  it("splits SQL on top-level semicolons", () => { expect(texts("sql", "SELECT 1;\nSELECT ';' ;\n-- note\nSELECT 3")).toEqual(["SELECT 1", "SELECT ';'", "-- note\nSELECT 3"]); });
  it("splits Cypher the same way, ignoring comments and strings", () => {
    expect(texts("rizomadb-cypher", "MATCH (n) RETURN n;\n// x;y\nMATCH (m {a: ';'}) RETURN m;")).toEqual(["MATCH (n) RETURN n", "// x;y\nMATCH (m {a: ';'}) RETURN m"]);
  });
  it("takes one Redis command per line and skips comments", () => { expect(texts("rizomadb-redis", "# keys\nGET a\n\nSET b 1")).toEqual(["GET a", "SET b 1"]); });
  it("takes blank-line separated blocks for Mongo and search consoles", () => {
    const src = "// all users\ndb.users.find({})\n\ndb.orders.aggregate([\n  { $match: {} }\n])\n\n// only a comment\n";
    expect(texts("rizomadb-mongo", src)).toEqual(["// all users\ndb.users.find({})", "db.orders.aggregate([\n  { $match: {} }\n])"]);
    expect(texts("rizomadb-es", "GET /_cluster/health\n\nPOST /idx/_search\n{ \"size\": 1 }")).toEqual(["GET /_cluster/health", "POST /idx/_search\n{ \"size\": 1 }"]);
  });
  it("gives offsets that point exactly at the text", () => {
    for (const lang of ["sql", "rizomadb-cypher", "rizomadb-redis", "rizomadb-mongo"]) {
      const src = lang === "sql" ? "  SELECT 1;  SELECT 2  " : lang === "rizomadb-cypher" ? " RETURN 1;\n RETURN 2 " : lang === "rizomadb-redis" ? "  GET a\n  GET b  " : "  db.a.find()\n\n  db.b.find()  ";
      expect(slice(lang, src)).toEqual(texts(lang, src));
    }
  });
  it("returns nothing for other languages and empty text", () => { expect(statementRanges("plaintext", "x")).toEqual([]); expect(statementRanges("sql", "  \n")).toEqual([]); });
});
