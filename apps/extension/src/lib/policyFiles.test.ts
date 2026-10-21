import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decideEffective } from "@rizomadb/core";
import { loadPolicy } from "./policyFiles.js";
import { findSecrets, loadCatalog } from "./catalog.js";

const dir = () => mkdtempSync(join(tmpdir(), "rz-pol-"));
const w = (d: string, n: string, c: string) => { const p = join(d, n); writeFileSync(p, c); return p; };
const writeSql = "UPDATE t SET a = 1 WHERE id = 1";

describe("policy loading", () => {
  it("layers project and user files; the stricter always wins", async () => {
    const d = dir();
    const project = w(d, "project.json", JSON.stringify({ version: 1, environments: { dev: { deny: ["drop"] }, qa: { readOnly: true } } }));
    const user = w(d, "user.json", JSON.stringify({ version: 1, environments: { dev: { deny: ["truncate"] }, qa: { readOnly: false } } }));
    const { policy, errors, loaded } = await loadPolicy({ builtinProdReadOnly: true, files: [{ label: "project", path: project }, { label: "user", path: user }] });
    expect(errors).toEqual([]); expect(loaded).toEqual(["project", "user"]);
    const dec = (sql: string, env: string) => decideEffective(sql, { environment: env, readOnly: false }, policy);
    expect(dec("DROP TABLE t", "dev").allowed).toBe(false); expect(dec("TRUNCATE t", "dev").allowed).toBe(false);
    expect(dec(writeSql, "qa").allowed).toBe(false);          // the user file cannot relax the project file
    expect(dec(writeSql, "prod").allowed).toBe(false);        // built-in default
  });
  it("lets a user turn off the built-in prod default, but not a project's prod rule", async () => {
    const d = dir();
    const off = await loadPolicy({ builtinProdReadOnly: false, files: [] });
    expect(decideEffective(writeSql, { environment: "prod", readOnly: false }, off.policy).allowed).toBe(true);
    const project = w(d, "p.json", JSON.stringify({ version: 1, environments: { prod: { readOnly: true } } }));
    const on = await loadPolicy({ builtinProdReadOnly: false, files: [{ label: "project", path: project }] });
    expect(decideEffective(writeSql, { environment: "prod", readOnly: false }, on.policy).allowed).toBe(false);
  });
  it("fails closed when a policy file is broken, and reports why", async () => {
    const d = dir();
    const bad = w(d, "bad.json", "{ not json");
    const { policy, errors } = await loadPolicy({ builtinProdReadOnly: false, files: [{ label: "project", path: bad }], inline: [{ label: "team", value: { version: 7 } }] });
    expect(errors).toHaveLength(2); expect(errors[0]).toMatch(/not valid JSON/);
    expect(decideEffective(writeSql, { environment: "dev", readOnly: false }, policy).allowed).toBe(false);
    expect(decideEffective("SELECT 1", { environment: "dev", readOnly: false }, policy).allowed).toBe(true);
  });
  it("ignores missing files silently and empty inline layers", async () => {
    const { errors, loaded } = await loadPolicy({ builtinProdReadOnly: true, files: [{ label: "project", path: "/nonexistent/policy.json" }], inline: [{ label: "team", value: {} }] });
    expect(errors).toEqual([]); expect(loaded).toEqual([]);
  });
});

describe("shared connection catalog", () => {
  const entry = (o: object) => ({ id: "c1", name: "Shared", driver: "postgres", environment: "staging", options: { host: "db", port: 5432 }, secretKeys: ["password"], ...o });
  it("loads secret-free entries, layers later files over earlier ones, and tags the source", async () => {
    const d = dir();
    const team = w(d, "team.json", JSON.stringify({ version: 1, connections: [entry({}), entry({ id: "c2", name: "Other" })] }));
    const proj = w(d, "proj.json", JSON.stringify({ version: 1, connections: [entry({ name: "Shared (project)" })] }));
    const r = await loadCatalog([{ source: "team", path: team }, { source: "project", path: proj }]);
    expect(r.errors).toEqual([]); expect(r.connections.map((c) => [c.id, c.name, c.source])).toEqual([["c1", "Shared (project)", "project"], ["c2", "Other", "team"]]);
  });
  it("refuses entries that contain secrets and says how to fix them", async () => {
    const d = dir();
    const f = w(d, "c.json", JSON.stringify({ version: 1, connections: [entry({ options: { host: "h", password: "hunter2" } }), entry({ id: "u", options: { url: "postgres://u:pw@h/db" } }), entry({ id: "ok" })] }));
    const r = await loadCatalog([{ source: "project", path: f }]);
    expect(r.connections.map((c) => c.id)).toEqual(["ok"]); expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toMatch(/secret values in plain text \(password\)/); expect(r.errors.join()).not.toContain("hunter2");
    expect(findSecrets(entry({ options: { host: "h", token: "" } }) as never)).toEqual([]);
  });
  it("reports malformed catalogs with the offending path", async () => {
    const d = dir();
    const f = w(d, "c.json", JSON.stringify({ version: 1, connections: [{ id: "x" }] }));
    const r = await loadCatalog([{ source: "project", path: f }]);
    expect(r.connections).toEqual([]); expect(r.errors[0]).toMatch(/connections\.0\.name/);
  });
});
