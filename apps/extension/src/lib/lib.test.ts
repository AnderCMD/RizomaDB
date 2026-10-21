import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemorySecretStore, defaultPolicy } from "@rizomadb/core";
import { sqliteDriver } from "@rizomadb/driver-sqlite";
import { collect } from "@rizomadb/driver-api";
import { splitStatements, statementAt } from "./splitter.js";
import { formatValue } from "./format.js";
import { History } from "./history.js";
import { ConnectionManager, type Memento } from "./connections.js";
import { runStatement, type RunEvent } from "./runner.js";

const memento = (): Memento => { const m = new Map<string, unknown>(); return { get: (k, d) => (m.has(k) ? (m.get(k) as never) : d), update: async (k, v) => { m.set(k, v); } }; };

describe("splitter", () => {
  it("ignores semicolons in strings, comments and dollar quotes", () => {
    const sql = "SELECT 'a;b'; -- x;y\nSELECT \"c;d\"; /* ;; */ SELECT $$ ; $$; SELECT $tag$ ; $tag$";
    expect(splitStatements(sql).map((s) => s.text)).toEqual(["SELECT 'a;b'", "-- x;y\nSELECT \"c;d\"", "/* ;; */ SELECT $$ ; $$", "SELECT $tag$ ; $tag$"]);
  });
  it("handles doubled quotes and trailing statement without semicolon", () => {
    expect(splitStatements("SELECT 'it''s;'; SELECT 2").map((s) => s.text)).toEqual(["SELECT 'it''s;'", "SELECT 2"]);
  });
  it("drops comment-only chunks and finds the statement at a cursor", () => {
    expect(splitStatements("-- nothing\n;")).toEqual([]);
    const sql = "SELECT 1;\nSELECT 2;";
    expect(statementAt(sql, 12)?.text).toBe("SELECT 2");
    expect(statementAt(sql, 3)?.text).toBe("SELECT 1");
  });
  it("never throws on odd input (unterminated quotes/comments)", () => {
    for (const s of ["'", "\"", "/*", "$$", "$a", "--", ";;;", "`x"]) expect(() => splitStatements(s)).not.toThrow();
  });
});

describe("formatValue", () => {
  it("serializes every normalized type to string|null", () => {
    expect(formatValue(null)).toBeNull();
    expect(formatValue(10n ** 20n)).toBe("100000000000000000000");
    expect(formatValue(new Date("2020-01-02T03:04:05Z"))).toBe("2020-01-02T03:04:05.000Z");
    expect(formatValue(new Uint8Array([1, 255]))).toBe("\\x01ff");
    expect(formatValue({ json: { a: 1n } })).toBe('{"a":"1"}');
    expect(formatValue("x".repeat(20000))!.length).toBeLessThan(10_100);
  });
});

describe("history", () => {
  it("redacts secrets on disk, searches, and prunes", async () => {
    const f = join(mkdtempSync(join(tmpdir(), "rz-")), "h.jsonl");
    let now = new Date("2026-01-01T00:00:00Z");
    const h = new History(f, () => now);
    await h.add({ connectionId: "c", connectionName: "n", environment: "dev", sql: "ALTER USER x PASSWORD='hunter2'", durationMs: 1, rowCount: 0, status: "error", error: "bad password=hunter2" });
    expect(readFileSync(f, "utf8")).not.toContain("hunter2");
    now = new Date("2026-06-01T00:00:00Z");
    await h.add({ connectionId: "c", connectionName: "n", environment: "dev", sql: "select 1", durationMs: 1, rowCount: 1, status: "ok" });
    expect((await h.list({ search: "SELECT" })).map((e) => e.sql)).toEqual(["select 1"]);
    await h.prune(90);
    expect(await h.list()).toHaveLength(1);
  });
});

describe("connections + runner (SQLite)", () => {
  const setup = async (env: "dev" | "prod" = "dev") => {
    const mgr = new ConnectionManager(memento(), new MemorySecretStore(), { sqlite: async () => sqliteDriver }, () => defaultPolicy, {});
    await mgr.add({ id: "c1", name: "mem", driver: "sqlite", environment: env, readOnly: false, tags: [], secretKeys: [], values: { path: ":memory:" } });
    return mgr;
  };
  const run = async (mgr: ConnectionManager, sql: string, extra: Partial<Parameters<typeof runStatement>[0]> = {}) => {
    const events: RunEvent[] = [];
    const profile = mgr.get("c1")!;
    const outcome = await runStatement({
      conn: await mgr.connect("c1"), profile, sql, maxRows: 100, signal: new AbortController().signal, policy: defaultPolicy,
      readOnly: mgr.isReadOnly(profile), confirmDestructive: true, confirm: async () => true, onEvent: (e) => events.push(e), ...extra,
    });
    return { outcome, events };
  };

  it("runs queries and streams events", async () => {
    const mgr = await setup();
    await run(mgr, "CREATE TABLE t(a INTEGER)");
    await run(mgr, "INSERT INTO t VALUES (1),(2),(3)");
    const { outcome, events } = await run(mgr, "SELECT * FROM t");
    expect(outcome).toMatchObject({ status: "ok", rowCount: 3 });
    expect(events.map((e) => e.type)).toEqual(["start", "rows", "done"]);
    await mgr.disposeAll();
  });

  it("truncates at maxRows and flags it", async () => {
    const mgr = await setup();
    const { events, outcome } = await run(mgr, "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<50) SELECT i FROM n", { maxRows: 10 });
    expect(outcome.rowCount).toBe(10);
    expect(events.at(-1)).toMatchObject({ type: "done", truncated: true });
    await mgr.disposeAll();
  });

  it("blocks writes on prod (policy) and never reaches the driver", async () => {
    const mgr = await setup("prod");
    const { outcome } = await run(mgr, "CREATE TABLE x(a)");
    expect(outcome.status).toBe("blocked");
    expect(mgr.isReadOnly(mgr.get("c1")!)).toBe(true);
    await mgr.disposeAll();
  });

  it("asks for confirmation on destructive statements and honors a refusal", async () => {
    const mgr = await setup();
    await run(mgr, "CREATE TABLE t(a)");
    const { outcome } = await run(mgr, "DELETE FROM t", { confirm: async () => false });
    expect(outcome.status).toBe("cancelled");
    await mgr.disposeAll();
  });

  it("reports typed syntax errors", async () => {
    const mgr = await setup();
    const { outcome, events } = await run(mgr, "SELEC 1");
    expect(outcome.status).toBe("error");
    expect(events.at(-1)).toMatchObject({ type: "error", kind: "syntax" });
    await mgr.disposeAll();
  });

  it("stores no secret values in profiles", async () => {
    const state = memento(); const secrets = new MemorySecretStore();
    const mgr = new ConnectionManager(state, secrets, {}, () => defaultPolicy, {});
    await mgr.add({ id: "p", name: "pg", driver: "postgres", environment: "dev", readOnly: false, tags: [], secretKeys: ["password"], values: { host: "h", password: "topsecret" } });
    expect(JSON.stringify(state.get("rizomadb.profiles", []))).not.toContain("topsecret");
    expect(await secrets.get("rizomadb/p/password")).toBe("topsecret");
    await mgr.remove("p");
    expect(await secrets.get("rizomadb/p/password")).toBeUndefined();
  });
});
void collect;
