import { describe, it, expect } from "vitest";
import { MemorySecretStore, defaultEffectivePolicy } from "@rizomadb/core";
import { ConnectionManager, type Memento } from "./connections.js";

const memento = (): Memento => { const m = new Map<string, unknown>(); return { get: (k, d) => (m.has(k) ? (m.get(k) as never) : d), update: async (k, v) => { m.set(k, v); } }; };

/** A driver whose connect() we release by hand, so the "connecting" state can be observed. */
async function setup() {
  let release!: () => void, closed = 0;
  const gate = new Promise<void>((r) => { release = r; });
  const conn = { serverInfo: { product: "x", version: "1" }, execute: async function* () { /* nothing */ }, quoteIdent: (s: string) => s, introspect: () => ({}), close: async () => { closed++; } };
  const plugin = { id: "fake", capabilities: {}, connectionSchema: { properties: {} }, connect: async () => { await gate; return conn; } };
  const mgr = new ConnectionManager(memento(), new MemorySecretStore(), { fake: async () => plugin } as never, () => defaultEffectivePolicy, {});
  await mgr.add({ id: "a", name: "A", environment: "dev", driver: "fake", readOnly: false, tags: [], secretKeys: [], values: {} });
  return { mgr, release, closed: () => closed };
}

describe("connection states", () => {
  it("goes disconnected → connecting → connected → disconnected", async () => {
    const { mgr, release } = await setup();
    expect(mgr.stateOf("a")).toBe("disconnected");
    const p = mgr.connect("a");
    await new Promise((r) => setTimeout(r, 0));
    expect(mgr.stateOf("a")).toBe("connecting");
    release(); await p; await new Promise((r) => setTimeout(r, 0));
    expect(mgr.stateOf("a")).toBe("connected");
    await mgr.disconnect("a");
    expect(mgr.stateOf("a")).toBe("disconnected");
  });
});

describe("closing idle connections", () => {
  it("closes one unused for longer than the limit and says why", async () => {
    const { mgr, release, closed } = await setup();
    release(); await mgr.connect("a"); await new Promise((r) => setTimeout(r, 0));
    mgr.setIdleMinutes(10);
    const events: string[] = []; mgr.onClosed((id, why) => events.push(`${id}:${why}`));
    await mgr.closeIdle(Date.now() + 5 * 60_000);
    expect(mgr.stateOf("a")).toBe("connected");
    await mgr.closeIdle(Date.now() + 11 * 60_000);
    expect(mgr.stateOf("a")).toBe("disconnected"); expect(closed()).toBe(1); expect(events).toEqual(["a:idle"]);
    mgr.setIdleMinutes(0);
  });
  it("never closes a connection that is running a statement", async () => {
    const { mgr, release } = await setup();
    release(); await mgr.connect("a"); await new Promise((r) => setTimeout(r, 0));
    mgr.setIdleMinutes(10); mgr.isBusy = () => true;
    await mgr.closeIdle(Date.now() + 60 * 60_000);
    expect(mgr.stateOf("a")).toBe("connected");
    mgr.setIdleMinutes(0);
  });
  it("does nothing when the limit is 0", async () => {
    const { mgr, release } = await setup();
    release(); await mgr.connect("a"); await new Promise((r) => setTimeout(r, 0));
    await mgr.closeIdle(Date.now() + 24 * 3600_000);
    expect(mgr.stateOf("a")).toBe("connected");
  });
});
