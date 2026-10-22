import { describe, it, expect } from "vitest";
import { columnStats } from "./stats.js";

describe("columnStats", () => {
  it("counts nulls and distinct values and ranks the most frequent", () => {
    const s = columnStats(["b", "a", "b", null, "c", "b", "a"], "text");
    expect(s).toMatchObject({ count: 7, nulls: 1, distinct: 3, min: "a", max: "c" });
    expect(s.top).toEqual([{ value: "b", count: 3 }, { value: "a", count: 2 }, { value: "c", count: 1 }]);
    expect(s.numeric).toBeUndefined();
  });
  it("summarises numbers and bins them", () => {
    const s = columnStats(["1", "2", "3", "4", "10", null, "x"], "integer", { buckets: 3 });
    expect(s.numeric).toMatchObject({ sum: 20, avg: 4, min: 1, max: 10 });
    expect(s.numeric!.histogram.map((b) => b.count)).toEqual([3, 1, 1]);
    expect(s.min).toBe("1"); expect(s.max).toBe("10");
  });
  it("handles an all-equal column and empty input", () => {
    expect(columnStats(["5", "5"], "float").numeric!.histogram).toEqual([{ from: 5, to: 5, count: 2 }]);
    expect(columnStats([], "text")).toEqual({ count: 0, nulls: 0, distinct: 0, top: [] });
    expect(columnStats([null, null], "integer")).toMatchObject({ count: 2, nulls: 2, distinct: 0 });
  });
  it("compares text lexicographically (ISO dates sort correctly)", () => {
    const s = columnStats(["2026-03-01", "2025-12-31", "2026-01-15"], "date");
    expect(s.min).toBe("2025-12-31"); expect(s.max).toBe("2026-03-01");
  });
});
