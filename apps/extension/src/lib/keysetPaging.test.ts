import { describe, it, expect } from "vitest";
import { keysetAfter, keyLiteral, keysetOrder, keysetStatement, keysetSupported, lastKey, withKeyset } from "./keysetPaging.js";

const k = (n: string) => ({ name: n, quoted: `"${n}"` });

describe("keyset paging statements", () => {
  it("only claims the engines that are tested", () => {
    expect(["sqlite", "postgres", "mysql", "mssql", "oracle", "clickhouse"].map(keysetSupported)).toEqual([true, true, true, true, true, false]);
  });
  it("writes a single key and a composite key without row-value comparison", () => {
    expect(keysetAfter([k("id")], [41])).toBe('"id" > 41');
    expect(keysetAfter([k("a"), k("b")], [1, "x"])).toBe(`(("a" > 1) OR ("a" = 1 AND "b" > 'x'))`);
    expect(keysetOrder([k("a"), k("b")])).toBe('"a", "b"');
  });
  it("quotes strings and refuses values it cannot write safely", () => {
    expect(keyLiteral("o'k")).toBe("'o''k'");
    expect(keyLiteral(9007199254740993n)).toBe("9007199254740993");
    for (const v of [null, true, new Date(0), new Uint8Array(1), { json: 1 }, "a\\b", "a\0b", NaN]) expect(keyLiteral(v as never)).toBeUndefined();
    expect(keysetAfter([k("id")], [null])).toBeUndefined();
    expect(keysetAfter([k("a"), k("b")], [1])).toBeUndefined();
  });
  it("keeps the user's filter and adds the key condition", () => {
    expect(withKeyset("age > 3 OR x = 1", '"id" > 5')).toBe('(age > 3 OR x = 1) AND "id" > 5');
    expect(withKeyset("  ", '"id" > 5')).toBe('"id" > 5');
  });
  it("finds the key of a row by column name", () => {
    expect(lastKey([k("b"), k("a")], [{ name: "a" }, { name: "b" }, { name: "c" }], [1, 2, 3])).toEqual([2, 1]);
    expect(lastKey([k("z")], [{ name: "a" }], [1])).toBeUndefined();
  });
  it("builds the whole next-page statement, or none when the key cannot be written", () => {
    const base = { driver: "mssql", quoted: "[t]", name: "t", where: "x > 1", keys: [{ name: "id", quoted: "[id]" }], limit: 50 };
    expect(keysetStatement({ ...base, last: [7] })).toBe("SELECT TOP 50 * FROM [t] WHERE (x > 1) AND [id] > 7 ORDER BY [id]");
    expect(keysetStatement({ ...base, driver: "oracle", last: ["a"] })).toBe("SELECT * FROM [t] WHERE (x > 1) AND [id] > 'a' ORDER BY [id] FETCH FIRST 50 ROWS ONLY");
    expect(keysetStatement({ ...base, last: [null] })).toBeUndefined();
  });
});
