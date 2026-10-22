import { describe, it, expect } from "vitest";
import { parsePasted } from "./clipboard.js";

describe("parsePasted", () => {
  it("reads tab separated rows, with or without a trailing line break", () => {
    expect(parsePasted("a\tb\nc\td\n")).toEqual([["a", "b"], ["c", "d"]]);
    expect(parsePasted("a\tb\r\nc\td")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("keeps empty cells and a single value as one cell", () => {
    expect(parsePasted("a\t\tc")).toEqual([["a", "", "c"]]);
    expect(parsePasted("42")).toEqual([["42"]]);
    expect(parsePasted("")).toEqual([]);
  });
  it("understands spreadsheet quoting", () => {
    expect(parsePasted('"line1\nline2"\t"say ""hi"""\tplain\n')).toEqual([["line1\nline2", 'say "hi"', "plain"]]);
    expect(parsePasted('"a\tb"\tc')).toEqual([["a\tb", "c"]]);
  });
  it("does not treat a quote in the middle of a cell as quoting", () => {
    expect(parsePasted('5" pipe\tx')).toEqual([['5" pipe', "x"]]);
  });
});
