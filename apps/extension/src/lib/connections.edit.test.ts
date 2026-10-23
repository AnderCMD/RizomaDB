import { describe, it, expect } from "vitest";
import { MemorySecretStore, defaultEffectivePolicy, mergePolicies, builtInPolicy } from "@rizomadb/core";
import { ConnectionManager, type Memento } from "./connections.js";

const memento = (): Memento => { const m = new Map<string, unknown>(); return { get: (k, d) => (m.has(k) ? (m.get(k) as never) : d), update: async (k, v) => { m.set(k, v); } }; };
const base = { driver: "postgres", readOnly: false, tags: ["engine:postgres"], secretKeys: [] as string[], values: { host: "h" } };

describe("switching a prod connection between read-only and editable", () => {
  it("starts read-only, can be made editable, and back", async () => {
    const mgr = new ConnectionManager(memento(), new MemorySecretStore(), {}, () => mergePolicies({ ...builtInPolicy, environments: { prod: { confirmWrites: true } } }), {});
    await mgr.add({ id: "p", name: "prod db", environment: "prod", ...base });
    expect(mgr.isReadOnly(mgr.get("p")!)).toBe(true);
    expect(await mgr.setEditable("p", true)).toBe(true);
    expect(mgr.isReadOnly(mgr.get("p")!)).toBe(false);
    await mgr.setEditable("p", false);
    expect(mgr.isReadOnly(mgr.get("p")!)).toBe(true);
  });
  it("cannot override a policy layer that forbids writes", async () => {
    const mgr = new ConnectionManager(memento(), new MemorySecretStore(), {}, () => defaultEffectivePolicy, {});
    await mgr.add({ id: "p", name: "prod db", environment: "prod", ...base });
    expect(mgr.policyLocked(mgr.get("p")!)).toBe(true);
    expect(await mgr.setEditable("p", true)).toBe(false);
    expect(mgr.isReadOnly(mgr.get("p")!)).toBe(true);
  });
  it("lets the user switch the prod default off", async () => {
    const mgr = new ConnectionManager(memento(), new MemorySecretStore(), {}, () => mergePolicies({ ...builtInPolicy, environments: {} }), {});
    await mgr.add({ id: "p", name: "prod db", environment: "prod", ...base });
    mgr.prodReadOnly = false;
    expect(mgr.isReadOnly(mgr.get("p")!)).toBe(false);
  });
  it("a dev connection toggles as before", async () => {
    const mgr = new ConnectionManager(memento(), new MemorySecretStore(), {}, () => defaultEffectivePolicy, {});
    await mgr.add({ id: "d", name: "dev db", environment: "dev", ...base });
    await mgr.setEditable("d", false);
    expect(mgr.isReadOnly(mgr.get("d")!)).toBe(true);
    await mgr.setEditable("d", true);
    expect(mgr.isReadOnly(mgr.get("d")!)).toBe(false);
  });
});

describe("editing a saved connection", () => {
  it("keeps the id, tags and read-only choice, replaces values and drops secrets no longer used", async () => {
    const secrets = new MemorySecretStore();
    const mgr = new ConnectionManager(memento(), secrets, {}, () => defaultEffectivePolicy, {});
    await mgr.add({ id: "c", name: "old", environment: "dev", driver: "postgres", readOnly: true, tags: ["engine:postgres"], secretKeys: ["password", "ssh.password"], values: { host: "a", password: "pw1", "ssh.password": "x" } });
    expect(await mgr.secretValues("c")).toEqual({ password: "pw1", "ssh.password": "x" });
    await mgr.replace("c", { name: "new", driver: "postgres", environment: "staging", secretKeys: ["password"], values: { host: "b", password: "pw2" } });
    const p = mgr.get("c")!;
    expect(p).toMatchObject({ name: "new", environment: "staging", readOnly: true, tags: ["engine:postgres"], options: { host: "b" }, secretKeys: ["password"] });
    expect(await mgr.secretValues("c")).toEqual({ password: "pw2" });
    expect(await secrets.get("rizomadb/c/ssh.password")).toBeUndefined();
    expect(mgr.list()).toHaveLength(1);
  });
  it("does not carry an unlock over to another environment", async () => {
    const mgr = new ConnectionManager(memento(), new MemorySecretStore(), {}, () => mergePolicies({ ...builtInPolicy, environments: {} }), {});
    await mgr.add({ id: "p", name: "n", environment: "prod", ...base });
    await mgr.setEditable("p", true);
    await mgr.replace("p", { name: "n", driver: "postgres", environment: "staging", secretKeys: [], values: { host: "h" } });
    await mgr.replace("p", { name: "n", driver: "postgres", environment: "prod", secretKeys: [], values: { host: "h" } });
    expect(mgr.isReadOnly(mgr.get("p")!)).toBe(true);
  });
});
