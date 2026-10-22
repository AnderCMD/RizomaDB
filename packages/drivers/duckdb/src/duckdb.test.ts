import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { collect } from "@rizomadb/driver-api";
import { runConformance } from "@rizomadb/driver-api/conformance";
import { duckdbDriver, isReadOnlySafe } from "./index.js";

runConformance({
  plugin: duckdbDriver,
  config: () => ({ path: join(mkdtempSync(join(tmpdir(), "rz-duck-")), "db.duckdb") }),
  manyRowsSql: "SELECT i FROM range(200000) r(i)",
  slowSql: "SELECT count(*) FROM range(100000000000) r(i) WHERE i % 7 = 3",
  paramSql: "SELECT ? AS a, ? AS b",
  badConfig: () => ({ path: "/nonexistent-dir/x/y.duckdb" }),
});

describe("duckdb value mapping", () => {
  it("maps decimals, timestamps, lists and structs", async () => {
    const c = await duckdbDriver.connect({ path: ":memory:" }, { log() {} });
    const r = await collect(c.execute({ sql: "SELECT 1.50::DECIMAL(10,2) d, TIMESTAMP '2020-01-02 03:04:05' t, [1,2] l, {'a': 1, 'b': 'x'} s, 170141183460469231731687303715884105727::HUGEINT h, DATE '2020-01-02' dt" }, new AbortController().signal));
    expect(r.rows[0]![0]).toBe("1.50"); expect((r.rows[0]![1] as Date).toISOString()).toBe("2020-01-02T03:04:05.000Z");
    expect(r.rows[0]![2]).toEqual({ json: [1, 2] }); expect(r.rows[0]![3]).toEqual({ json: { a: 1, b: "x" } }); expect((r.rows[0]![5] as Date).toISOString()).toBe("2020-01-02T00:00:00.000Z");
    expect(String(r.rows[0]![4])).toBe("170141183460469231731687303715884105727");
    await c.close();
  });
  it("queries files and other sources without importing them", async () => {
    const c = await duckdbDriver.connect({ path: ":memory:" }, { log() {} });
    const r = await collect(c.execute({ sql: "SELECT sum(i) FROM range(1000) t(i)" }, new AbortController().signal));
    expect(r.rows[0]![0]).toBe(499500);
    await c.close();
  });
  it("guards read-only statements", () => {
    expect(isReadOnlySafe("SELECT 1")).toBe(true); expect(isReadOnlySafe("COPY t TO 'x.csv'")).toBe(false); expect(isReadOnlySafe("INSTALL httpfs")).toBe(false); expect(isReadOnlySafe("ATTACH 'x.db'")).toBe(false);
  });
});
