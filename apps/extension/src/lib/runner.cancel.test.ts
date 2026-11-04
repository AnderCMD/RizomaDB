import { describe, it, expect } from "vitest";
import type { Connection, ResultEvent } from "@rizomadb/driver-api";
import { defaultEffectivePolicy } from "@rizomadb/core";
import { runStatement, type RunEvent } from "./runner.js";

/** A driver that never looks at the abort signal and never answers: the case that used to lock every run button. */
const deaf = {
  serverInfo: { product: "fake", version: "1" },
  async *execute(): AsyncGenerator<ResultEvent> { await new Promise(() => {}); yield { type: "done", rowCount: 0, durationMs: 0 }; },
} as unknown as Connection;

describe("cancelling a statement", () => {
  it("returns control even when the driver ignores the abort signal, and reports the connection as stuck", async () => {
    const ac = new AbortController(), events: RunEvent[] = [];
    const run = runStatement({
      conn: deaf, profile: { id: "x", name: "x", driver: "fake", environment: "dev", readOnly: false, options: {}, secretKeys: [], tags: [] }, sql: "SELECT 1",
      signal: ac.signal, policy: defaultEffectivePolicy, readOnly: false, maxRows: 10, confirmDestructive: true, confirm: async () => true, onEvent: (e) => events.push(e),
    });
    setTimeout(() => ac.abort(), 20);
    const out = await run;
    expect(out).toMatchObject({ status: "cancelled", stuck: true });
    expect(events.some((e) => e.type === "error")).toBe(true);
  }, 10000);
  it("times out the same way when a timeout is set", async () => {
    const out = await runStatement({
      conn: deaf, profile: { id: "x", name: "x", driver: "fake", environment: "dev", readOnly: false, options: {}, secretKeys: [], tags: [] }, sql: "SELECT 1",
      signal: new AbortController().signal, policy: defaultEffectivePolicy, readOnly: false, maxRows: 10, timeoutMs: 30, confirmDestructive: true, confirm: async () => true, onEvent: () => {},
    });
    expect(out).toMatchObject({ status: "error", error: "Query timed out", stuck: true });
  }, 10000);
});
