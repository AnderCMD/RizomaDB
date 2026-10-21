import { describe, it, expect } from "vitest";
import { parseMysqlPlan, parsePostgresPlan, parseSqlitePlan, slowNodes, explain, type Plan } from "./index.js";
import { sqliteDriver } from "@rizomadb/driver-sqlite";

const pg = [{ Plan: { "Node Type": "Hash Join", "Join Type": "Inner", "Hash Cond": "(o.customer_id = c.id)", "Plan Rows": 100, "Actual Rows": 90, "Actual Loops": 1, "Total Cost": 500, "Actual Total Time": 80, Plans: [
  { "Node Type": "Seq Scan", "Relation Name": "orders", "Plan Rows": 1000, "Actual Rows": 1000, "Actual Loops": 1, "Total Cost": 400, "Actual Total Time": 70, Filter: "(total > 5)" },
  { "Node Type": "Hash", "Plan Rows": 10, "Actual Rows": 10, "Actual Loops": 1, "Total Cost": 5, "Actual Total Time": 1, Plans: [{ "Node Type": "Index Scan", "Relation Name": "customers", "Index Name": "customers_pkey", "Plan Rows": 10, "Actual Rows": 10, "Actual Loops": 1, "Total Cost": 4, "Actual Total Time": 0.5 }] },
] }, "Execution Time": 81.2 }];

describe("plan parsing", () => {
  it("parses PostgreSQL JSON with costs, actual rows and timing", () => {
    const p = parsePostgresPlan(pg, true);
    expect(p.root[0]!.label).toBe("Hash Join");
    expect(p.root[0]!.children.map((c) => c.label)).toEqual(["Seq Scan on orders", "Hash"]);
    expect(p.root[0]!.children[0]).toMatchObject({ rows: 1000, actualRows: 1000, cost: 400, timeMs: 70 });
    expect(p.executionMs).toBe(81.2); expect(p.totalCost).toBe(500);
  });
  it("highlights nodes responsible for most of the time", () => {
    const slow = slowNodes(parsePostgresPlan(pg, true), 0.5);
    expect(slow.map((n) => n.label)).toEqual(["Seq Scan on orders"]);
  });
  it("parses MySQL JSON table accesses", () => {
    const p = parseMysqlPlan({ query_block: { cost_info: { query_cost: "2.40" }, table: { table_name: "t", access_type: "ALL", rows_examined_per_scan: 5, cost_info: { prefix_cost: "0.75" } } } });
    expect(p.root[0]).toMatchObject({ label: "ALL on t", rows: 5, cost: 0.75 }); expect(p.totalCost).toBe(2.4);
  });
  it("builds the SQLite tree from parent ids", () => {
    const p = parseSqlitePlan([{ id: 2, parent: 0, detail: "SCAN a" }, { id: 5, parent: 2, detail: "SEARCH b USING INDEX i" }]);
    expect(p.root).toHaveLength(1); expect(p.root[0]!.children[0]!.detail).toContain("SEARCH b");
  });
});

describe("live explain (SQLite)", () => {
  it("returns a plan tree for a real query without running it", async () => {
    const c = await sqliteDriver.connect({ path: ":memory:" }, { log() {} });
    const x = (sql: string) => c.execute({ sql }, new AbortController().signal);
    for await (const _ of x("CREATE TABLE a (id INTEGER PRIMARY KEY, v TEXT)")) void _;
    const plan: Plan = await explain(c, "sqlite", "SELECT * FROM a WHERE id = 1");
    expect(plan.root.length).toBeGreaterThan(0);
    expect(plan.raw).toMatch(/SEARCH|SCAN/);
    await c.close();
  });
});
