import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collect, DriverError, type Connection } from "@rizomadb/driver-api";
import { sqliteDriver } from "@rizomadb/driver-sqlite";
import { AuditLog, builtInPolicy, decideEffective, featureEnabled, guardConnection, mergePolicies, parsePolicy, statementKind, stripLiterals, type PolicyFile } from "./index.js";

const sig = () => new AbortController().signal;
const layer = (o: Partial<PolicyFile>): PolicyFile => ({ version: 1, environments: {}, disable: [], maskColumns: [], ...o });
const dec = (sql: string, env: string, p = mergePolicies(builtInPolicy), readOnly = false) => decideEffective(sql, { environment: env, readOnly }, p);

describe("policy file", () => {
  it("validates strictly and reports where it is wrong", () => {
    expect(() => parsePolicy("not json")).toThrow(/not valid JSON/);
    expect(() => parsePolicy('{"version":2}')).toThrow(/version/);
    expect(() => parsePolicy('{"version":1,"environments":{"prod":{"deny":["frobnicate"]}}}')).toThrow(/environments\.prod\.deny/);
    expect(parsePolicy('{"version":1,"environments":{"prod":{"readOnly":true,"maxRows":100}},"disable":["ai"]}').disable).toEqual(["ai"]);
  });
});

describe("effective policy", () => {
  it("built-in defaults: prod is read-only, staging asks before writes", () => {
    expect(dec("SELECT 1", "prod")).toMatchObject({ allowed: true, needsConfirmation: false });
    expect(dec("UPDATE t SET a = 1 WHERE id = 1", "prod")).toMatchObject({ allowed: false });
    expect(dec("UPDATE t SET a = 1 WHERE id = 1", "staging")).toMatchObject({ allowed: true, needsConfirmation: true });
    expect(dec("DELETE FROM t", "dev")).toMatchObject({ allowed: true, needsConfirmation: true });
    expect(dec("UPDATE t SET a = 1 WHERE id = 1", "dev")).toMatchObject({ allowed: true, needsConfirmation: false });
    expect(dec("DROP TABLE t", "dev", mergePolicies(builtInPolicy), true).allowed).toBe(false);
  });
  it("deny/allow lists, approval, row and time limits", () => {
    const p = mergePolicies(layer({ environments: { dev: { deny: ["drop", "truncate"], maxRows: 50, timeoutSeconds: 5 }, qa: { allow: ["select", "insert"], requireApproval: true } } }));
    expect(dec("DROP TABLE t", "dev", p).allowed).toBe(false); expect(dec("select * from t", "dev", p)).toMatchObject({ allowed: true, maxRows: 50, timeoutSeconds: 5 });
    expect(dec("UPDATE t SET a = 1 WHERE id = 1", "qa", p).reason).toMatch(/Only SELECT, INSERT/);
    expect(dec("INSERT INTO t VALUES (1)", "qa", p)).toMatchObject({ allowed: true, needsConfirmation: true, needsApproval: true });
    expect(statementKind("WITH x AS (SELECT 1) DELETE FROM t USING x")).toBe("delete"); expect(statementKind("/* c */ SHOW TABLES")).toBe("select");
  });
  it("a lower layer can never relax a stricter one (property: merge is order-independent and monotone)", () => {
    const rule = fc.record({ readOnly: fc.option(fc.boolean(), { nil: undefined }), maxRows: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }), deny: fc.option(fc.subarray(["insert", "update", "delete", "drop"] as const), { nil: undefined }), requireApproval: fc.option(fc.boolean(), { nil: undefined }) }).map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)));
    const sqls = ["SELECT 1", "INSERT INTO t VALUES (1)", "UPDATE t SET a = 1 WHERE id = 1", "DELETE FROM t WHERE id = 1", "DROP TABLE t", "TRUNCATE t"];
    fc.assert(fc.property(rule, rule, fc.constantFrom(...sqls), (a, b, sql) => {
      const A = layer({ environments: { prod: a } }), B = layer({ environments: { prod: b } });
      const ab = decideEffective(sql, { environment: "prod", readOnly: false }, mergePolicies(A, B)), ba = decideEffective(sql, { environment: "prod", readOnly: false }, mergePolicies(B, A));
      expect(ab.allowed).toBe(ba.allowed);
      for (const L of [A, B]) { const alone = decideEffective(sql, { environment: "prod", readOnly: false }, mergePolicies(L)); if (!alone.allowed) expect(ab.allowed).toBe(false); }
    }), { numRuns: 1000 });
  });
  it("feature switches and non-SQL classification", () => {
    const p = mergePolicies(layer({ disable: ["ai"] }), layer({ disable: ["export"] }));
    expect(featureEnabled(p, "ai")).toBe(false); expect(featureEnabled(p, "export")).toBe(false); expect(featureEnabled(p, "import")).toBe(true);
    const redis = (cmd: string) => ({ risk: /^(GET|SCAN)/i.test(cmd) ? "none" as const : "write" as const, reasons: ["x"] });
    expect(decideEffective("SET k v", { environment: "prod", readOnly: false }, mergePolicies(builtInPolicy), redis).allowed).toBe(false);
    expect(decideEffective("GET k", { environment: "prod", readOnly: false }, mergePolicies(builtInPolicy), redis).allowed).toBe(true);
  });
});

describe("audit log", () => {
  it("records statements without literals, rotates by size, keeps a bounded history, and filters when read", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rz-audit-")); const file = join(dir, "audit.jsonl");
    let t = 0; const log = new AuditLog({ file, maxBytes: 600, keepFiles: 2, user: () => "ana", now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, t++)) });
    await log.record({ connectionId: "c", connection: "main", environment: "prod", engine: "postgres", kind: "SELECT", statement: "SELECT * FROM users WHERE email = 'ana@example.com' AND id = 42", status: "ok", rows: 1 });
    await log.flush();
    expect(readFileSync(file, "utf8")).not.toMatch(/ana@example|42/); expect(readFileSync(file, "utf8")).toContain("email = '?' AND id = ?");
    for (let i = 0; i < 12; i++) { void log.record({ connectionId: "c", connection: "main", environment: "prod", engine: "postgres", kind: "UPDATE", statement: `UPDATE t SET a = ${i}`, status: i % 4 === 0 ? "blocked" : "ok" }); await log.flush(); }
    const files = readdirSync(dir); expect(files.filter((f) => f.startsWith("audit-")).length).toBeLessThanOrEqual(2); expect(files).toContain("audit.jsonl");
    const blocked = await log.read({ status: "blocked" }); expect(blocked.length).toBeGreaterThan(0); expect(blocked.every((e) => e.status === "blocked" && e.user === "ana")).toBe(true);
    expect(stripLiterals("a = 'x''y' AND b = 0xFF AND c = 3.5")).toBe("a = '?' AND b = ? AND c = ?");
    const full = new AuditLog({ file: join(dir, "full.jsonl"), includeValues: true });
    await full.record({ connectionId: "c", connection: "m", environment: "dev", engine: "x", kind: "SELECT", statement: "SELECT 'keep'", status: "ok" });
    await full.flush();
    expect(readFileSync(join(dir, "full.jsonl"), "utf8")).toContain("keep");
  });
});

describe("guarded connection", () => {
  async function setup(env: string, opts: { readOnly?: boolean; approve?: boolean; policy?: PolicyFile[] } = {}) {
    const raw = await sqliteDriver.connect({ path: ":memory:" }, { log() {} });
    await collect(raw.execute({ sql: "CREATE TABLE t (id INTEGER PRIMARY KEY, a INTEGER)" }, sig()));
    await collect(raw.execute({ sql: "INSERT INTO t VALUES (1, 1), (2, 2), (3, 3)" }, sig()));
    const dir = mkdtempSync(join(tmpdir(), "rz-g-")); const audit = new AuditLog({ file: join(dir, "a.jsonl") });
    const g = guardConnection(raw, { plugin: sqliteDriver, connectionId: "c1", connectionName: "main", environment: env, readOnly: () => !!opts.readOnly, policy: () => mergePolicies(builtInPolicy, ...(opts.policy ?? [])), audit, approve: async () => !!opts.approve });
    return { raw, g, audit };
  }
  const run = (c: Connection, sql: string) => collect(c.execute({ sql }, sig()));

  it("blocks every kind of write on prod through execute and transactions, and still reads", async () => {
    const { g, raw, audit } = await setup("prod");
    for (const sql of ["INSERT INTO t VALUES (9, 9)", "UPDATE t SET a = 0 WHERE id = 1", "DELETE FROM t", "DROP TABLE t", "CREATE TABLE x (a)", "ALTER TABLE t ADD b INTEGER"]) {
      await expect(run(g, sql), sql).rejects.toMatchObject({ kind: "permission" });
      const tx = await g.begin!();
      await expect(collect(tx.execute({ sql }, sig())), `tx ${sql}`).rejects.toBeInstanceOf(DriverError); await tx.rollback();
    }
    expect((await run(g, "SELECT COUNT(*) FROM t")).rows[0]![0]).toBe(3);
    expect((await run(raw, "SELECT COUNT(*) FROM t")).rows[0]![0]).toBe(3);
    await audit.flush();
    const log = await audit.read({}); expect(log.filter((e) => e.status === "blocked").length).toBe(12); expect(log.some((e) => e.status === "ok" && e.kind === "SELECT")).toBe(true);
  });
  it("applies row caps and honors read-only toggled at runtime", async () => {
    const { g } = await setup("dev", { policy: [layer({ environments: { dev: { maxRows: 2 } } })] });
    expect((await run(g, "SELECT * FROM t")).rows).toHaveLength(2);
    let ro = false;
    const raw = await sqliteDriver.connect({ path: ":memory:" }, { log() {} });
    const g2 = guardConnection(raw, { plugin: sqliteDriver, connectionId: "c", connectionName: "n", environment: "dev", readOnly: () => ro, policy: () => mergePolicies(builtInPolicy) });
    await run(g2, "CREATE TABLE z (a)"); ro = true;
    await expect(run(g2, "INSERT INTO z VALUES (1)")).rejects.toMatchObject({ kind: "permission" });
  });
  it("requires approval where the policy says so", async () => {
    const pol = [layer({ environments: { dev: { requireApproval: true } } })];
    const denied = await setup("dev", { policy: pol, approve: false });
    await expect(run(denied.g, "UPDATE t SET a = 5 WHERE id = 1")).rejects.toMatchObject({ kind: "permission", message: expect.stringMatching(/approval/) });
    const ok = await setup("dev", { policy: pol, approve: true });
    await run(ok.g, "UPDATE t SET a = 5 WHERE id = 1"); expect((await run(ok.g, "SELECT a FROM t WHERE id = 1")).rows[0]![0]).toBe(5);
  });
  it("enforces time limits from policy", async () => {
    const { g } = await setup("dev", { policy: [layer({ environments: { dev: { timeoutSeconds: 1 } } })] });
    expect((await run(g, "SELECT 1")).rows[0]![0]).toBe(1);
  });
});

describe("secret scrubbing", () => {
  it("removes passwords and connection strings from driver errors before the UI or the audit trail see them", async () => {
    const leaky: Connection = {
      serverInfo: { product: "x", version: "1" }, quoteIdent: (n) => n, introspect: () => ({ listSchemas: async () => [], listTables: async () => [], describeTable: async () => ({ name: "t", kind: "table" }) }),
      ping: async () => {}, close: async () => {},
      // eslint-disable-next-line require-yield
      async *execute() { throw new DriverError("connection", "could not connect to postgres://app:hunter2@db.internal/prod (password=hunter2, token S3CR3T-TOKEN)"); },
    };
    const dir = mkdtempSync(join(tmpdir(), "rz-scrub-")); const audit = new AuditLog({ file: join(dir, "a.jsonl") });
    const { redactString } = await import("./redact.js");
    const g = guardConnection(leaky, { plugin: sqliteDriver, connectionId: "c", connectionName: "n", environment: "dev", readOnly: () => false, policy: () => mergePolicies(builtInPolicy), audit, redact: (s) => redactString(s, ["S3CR3T-TOKEN"]) });
    const err = await collect(g.execute({ sql: "SELECT 1" }, sig())).catch((e: unknown) => e) as DriverError;
    expect(err).toBeInstanceOf(DriverError); expect(err.kind).toBe("connection");
    expect(err.message).not.toMatch(/hunter2|S3CR3T/); expect(err.cause).toBeUndefined();
    await audit.flush();
    expect(readFileSync(join(dir, "a.jsonl"), "utf8")).not.toMatch(/hunter2|S3CR3T/);
  });
});
