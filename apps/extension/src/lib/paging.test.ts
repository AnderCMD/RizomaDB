import { describe, it, expect } from "vitest";
import type { Connection, ExecuteRequest, ResultEvent, Value } from "@rizomadb/driver-api";
import { defaultEffectivePolicy } from "@rizomadb/core";
import { runStatement, type RunEvent } from "./runner.js";

/** A connection that streams `total` numbered rows in batches of 7 and honours maxRows like the drivers do. */
const fake = (total: number): Connection => ({
  serverInfo: { product: "fake", version: "1" },
  async *execute(req: ExecuteRequest): AsyncGenerator<ResultEvent> {
    yield { type: "columns", columns: [{ name: "n", nativeType: "int", kind: "integer" }] };
    const max = Math.min(total, req.maxRows ?? Infinity);
    for (let i = 0; i < max; i += 7) yield { type: "rows", rows: Array.from({ length: Math.min(7, max - i) }, (_, k): Value[] => [i + k + 1]) };
    yield { type: "done", rowCount: max, durationMs: 1 };
  },
} as unknown as Connection);

const page = async (total: number, skip: number, size: number) => {
  const events: RunEvent[] = [];
  const out = await runStatement({
    conn: fake(total), profile: { id: "x", name: "x", driver: "fake", environment: "dev", readOnly: false, options: {}, secretKeys: [], tags: [] }, sql: "SELECT n FROM t",
    signal: new AbortController().signal, policy: defaultEffectivePolicy, readOnly: false, maxRows: size, ...(skip ? { skip } : {}), confirmDestructive: true, confirm: async () => true, onEvent: (e) => events.push(e),
  });
  const rows = events.flatMap((e) => (e.type === "rows" ? e.rows.map((r) => r[0] as number) : []));
  const done = events.find((e) => e.type === "done") as Extract<RunEvent, { type: "done" }> | undefined;
  return { out, rows, done };
};

describe("paging by skipping rows (works on every engine)", () => {
  it("returns the first page and says there is more", async () => {
    const r = await page(25, 0, 10);
    expect(r.rows).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); expect(r.done).toMatchObject({ rowCount: 10, truncated: true });
  });
  it("continues exactly where the previous page stopped, across batch boundaries", async () => {
    const r = await page(25, 10, 10);
    expect(r.rows).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]); expect(r.done?.truncated).toBe(true);
  });
  it("ends without a next page when the rows run out", async () => {
    const r = await page(25, 20, 10);
    expect(r.rows).toEqual([21, 22, 23, 24, 25]); expect(r.done).toMatchObject({ rowCount: 5, truncated: false });
    expect((await page(20, 10, 10)).done?.truncated).toBe(false);
  });
  it("skipping past the end gives an empty page", async () => {
    const r = await page(5, 50, 10);
    expect(r.rows).toEqual([]); expect(r.done).toMatchObject({ rowCount: 0, truncated: false });
  });
  it("walks a whole result page by page without gaps or repeats", async () => {
    const all: number[] = []; let skip = 0;
    for (;;) { const r = await page(53, skip, 10); all.push(...r.rows); skip += r.rows.length; if (!r.done?.truncated) break; }
    expect(all).toEqual(Array.from({ length: 53 }, (_, i) => i + 1));
  });
});
