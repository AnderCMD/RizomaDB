import { describe, it, expect } from "vitest";
import { collect } from "@rizomadb/driver-api";
import { sqliteDriver } from "@rizomadb/driver-sqlite";
import { defaultEffectivePolicy } from "@rizomadb/core";
import { runStatement, type RunEvent } from "./runner.js";
import { buildTableQuery } from "./tableQuery.js";

/** The filter box and "Load more" against a real engine: the statements the UI builds must run, filter, order and page. */
describe("table filter and paging on SQLite", () => {
  const profile = { id: "c", name: "mem", driver: "sqlite", environment: "dev", readOnly: false, options: {}, secretKeys: [], tags: [] };
  const page = async (conn: Awaited<ReturnType<typeof sqliteDriver.connect>>, sql: string, skip: number, size: number) => {
    const events: RunEvent[] = [];
    await runStatement({ conn, profile, sql, signal: new AbortController().signal, policy: defaultEffectivePolicy, readOnly: false, maxRows: size, ...(skip ? { skip } : {}), confirmDestructive: true, confirm: async () => true, onEvent: (e) => events.push(e) });
    return { ids: events.flatMap((e) => (e.type === "rows" ? e.rows.map((r) => Number(r[0])) : [])), more: (events.find((e) => e.type === "done") as Extract<RunEvent, { type: "done" }>).truncated };
  };

  it("filters, orders and pages through a table the way the grid does", async () => {
    const conn = await sqliteDriver.connect({ path: ":memory:" }, { log() {} });
    await collect(conn.execute({ sql: "CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)" }, new AbortController().signal));
    for (let i = 1; i <= 25; i++) await collect(conn.execute({ sql: `INSERT INTO people VALUES (${i}, 'p${i}', ${20 + (i % 10)})` }, new AbortController().signal));
    const base = { driver: "sqlite", quoted: conn.quoteIdent("people"), name: "people", limit: 100000 };

    const all = buildTableQuery({ ...base, where: "", order: "" });
    expect((await page(conn, all, 0, 10)).ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect((await page(conn, all, 10, 10)).ids).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    const last = await page(conn, all, 20, 10); expect(last.ids).toEqual([21, 22, 23, 24, 25]); expect(last.more).toBe(false);

    const filtered = buildTableQuery({ ...base, where: "age >= 28", order: "id DESC" });
    const first = await page(conn, filtered, 0, 3);
    expect(first.ids).toEqual([19, 18, 9]); expect(first.more).toBe(true);
    const rest = await page(conn, filtered, 3, 3);
    expect(rest.ids).toEqual([8]); expect(rest.more).toBe(false);
    await conn.close();
  });
});
