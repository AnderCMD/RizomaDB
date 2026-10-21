import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { splitScript, tokenize, type Dialect } from "./index.js";

const dialects: Dialect[] = ["ansi", "postgres", "mysql", "sqlite", "mssql", "oracle"];
const alphabet = fc.constantFrom("a", "Z", "é", "🌱", "1", ".", " ", "\n", "\t", "'", "\"", "`", "[", "]", "(", ")", ";", "-", "--", "/*", "*/", "$", "$$", ":", "@", "?", "\\", "/", "go", "GO", "begin", "end", "DELIMITER", ",", "=", "<>", "#", "N'", "E'");
const sqlish = fc.array(alphabet, { maxLength: 60 }).map((a) => a.join(""));

describe("tokenizer properties", () => {
  it("is lossless and contiguous for any input in every dialect", () => {
    fc.assert(fc.property(fc.string({ maxLength: 200 }), fc.constantFrom(...dialects), (s, d) => {
      const toks = tokenize(s, d);
      expect(toks.map((t) => t.text).join("")).toBe(s);
      let pos = 0; for (const t of toks) { expect(t.start).toBe(pos); pos = t.end; }
    }), { numRuns: 500 });
    fc.assert(fc.property(sqlish, fc.constantFrom(...dialects), (s, d) => {
      expect(tokenize(s, d).map((t) => t.text).join("")).toBe(s);
    }), { numRuns: 2000 });
  });
});

describe("splitter properties", () => {
  it("never throws, offsets index the source, statements are non-empty and ordered", () => {
    fc.assert(fc.property(sqlish, fc.constantFrom(...dialects), (s, d) => {
      const st = splitScript(s, d);
      let prev = 0;
      for (const x of st) {
        expect(x.text.length).toBeGreaterThan(0);
        expect(s.slice(x.start, x.end)).toBe(x.text);
        expect(x.start).toBeGreaterThanOrEqual(prev); prev = x.end;
      }
    }), { numRuns: 3000 });
  });
  it("splitting at ';' recovers the pieces when no quoting/comment chars are present", () => {
    fc.assert(fc.property(fc.array(fc.stringMatching(/^[a-z0-9 ,=]{1,12}$/), { minLength: 1, maxLength: 6 }), (parts) => {
      const stmts = parts.map((p) => `select ${p.trim() || "1"}`);
      expect(splitScript(stmts.join(";\n"), "postgres").map((s) => s.text)).toEqual(stmts);
    }));
  });
});

describe("dialect splitting", () => {
  it("ignores ; in strings, identifiers and comments; handles doubled quotes", () => {
    expect(splitScript(`select 'a;b'; select "c;d"; -- x;y\n select 1 /* ; */`, "ansi").map((s) => s.text)).toEqual([`select 'a;b'`, `select "c;d"`, "-- x;y\n select 1 /* ; */"]);
    expect(splitScript("select 'it''s;'; select 2", "postgres").map((s) => s.text)).toEqual(["select 'it''s;'", "select 2"]);
  });
  it("postgres dollar quotes and E-strings; nested block comments", () => {
    expect(splitScript("do $$ begin perform 1; end $$; select E'a\\';b'; /* a /* b ; */ c ; */ select 3", "postgres").map((s) => s.text))
      .toEqual(["do $$ begin perform 1; end $$", "select E'a\\';b'", "/* a /* b ; */ c ; */ select 3"]);
  });
  it("mysql backslash escapes, backticks, # comments and DELIMITER", () => {
    expect(splitScript("select 'a\\';b'; select `x;y`; # c;d\nselect 3", "mysql").map((s) => s.text)).toEqual(["select 'a\\';b'", "select `x;y`", "# c;d\nselect 3"]);
    const script = "DELIMITER $$\ncreate procedure p() begin select 1; select 2; end$$\nDELIMITER ;\nselect 9;";
    expect(splitScript(script, "mysql").map((s) => s.text)).toEqual(["create procedure p() begin select 1; select 2; end", "select 9"]);
  });
  it("mssql GO batches, bracket identifiers, BEGIN..END blocks", () => {
    const script = "select 1\nGO\nif 1=1 begin select 2; select 3; end\ngo 2\nselect [a;b] ; begin tran; commit";
    expect(splitScript(script, "mssql").map((s) => s.text)).toEqual(["select 1", "if 1=1 begin select 2; select 3; end", "select [a;b]", "begin tran", "commit"]);
  });
  it("oracle PL/SQL blocks end at a '/' line; plain SQL ends at ';'", () => {
    const script = "select 1 from dual;\nbegin\n  null;\n  null;\nend;\n/\ncreate or replace procedure p as begin null; end;\n/\nselect 2 from dual;";
    expect(splitScript(script, "oracle").map((s) => s.text)).toEqual(["select 1 from dual", "begin\n  null;\n  null;\nend;", "create or replace procedure p as begin null; end;", "select 2 from dual"]);
  });
  it("tokenizes parameters per dialect", () => {
    const kinds = (s: string, d: Dialect) => tokenize(s, d).filter((t) => t.type === "param").map((t) => t.text);
    expect(kinds("select $1, $2 where a = :x", "postgres")).toEqual(["$1", "$2", ":x"]);
    expect(kinds("select @a, @@version", "mssql")).toEqual(["@a", "@@version"]);
    expect(kinds("where a = ? and b = :name", "oracle")).toEqual(["?", ":name"]);
    expect(kinds("select a::int", "postgres")).toEqual([]);
  });
});
