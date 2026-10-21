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

import { TableSession, parseInput, InputError } from "./tableSession.js";
describe("TableSession", () => {
  const target = { table: "t", columns: [
    { name: "id", nativeType: "int", nullable: false, primaryKey: true },
    { name: "name", nativeType: "text", nullable: false, primaryKey: false },
  ] };
  const cols = [{ name: "id", nativeType: "int", kind: "integer" as const }, { name: "name", nativeType: "text", kind: "text" as const }];
  it("parses typed input and rejects bad values", () => {
    expect(parseInput("integer", "42")).toBe(42);
    expect(parseInput("integer", "9223372036854775807")).toBe(9223372036854775807n);
    expect(parseInput("decimal", "1.50")).toBe("1.50");
    expect(parseInput("json", '{"a":1}')).toEqual({ json: { a: 1 } });
    expect(parseInput("text", null)).toBeNull();
    expect(() => parseInput("integer", "4x")).toThrow(InputError);
    expect(() => parseInput("binary", "ab")).toThrow(InputError);
  });
  it("maps grid edits, inserts and deletes into a view and changes", () => {
    const s = new TableSession(target, cols, [[1, "a"], [2, "b"]]);
    s.edit(0, 1, "A"); s.toggleDelete(1); s.insertRow(); s.edit(2, 0, "3"); s.edit(2, 1, "c");
    const v = s.view();
    expect(v).toMatchObject({ count: 3, deletes: [1], sets: [{ row: 0, col: 1, text: "A" }], inserts: [["3", "c"]], canUndo: true, canRedo: false });
    expect(s.pending.toChanges().map((c) => c.kind).sort()).toEqual(["delete", "insert", "update"]);
    expect(() => s.edit(0, 0, "x")).toThrow(InputError);
  });
});

describe("ssh tunnel integration in ConnectionManager", () => {
  it("rewrites host/port to the tunnel, hides ssh.* from the driver, and closes the tunnel on disconnect", async () => {
    let seen: Record<string, unknown> = {}; let closed = false;
    const fake = { id: "fake", displayName: "f", family: "relational", capabilities: {}, connectionSchema: { type: "object", properties: { port: { type: "number", title: "p", default: 5432 } } },
      quoteIdent: (x: string) => x, placeholder: () => "?", selectTop: () => "",
      connect: async (cfg: Record<string, unknown>) => { seen = { ...cfg }; return { serverInfo: { product: "f", version: "1" }, close: async () => {}, ping: async () => {} }; } };
    const mgr = new ConnectionManager(memento(), new MemorySecretStore(), { fake: async () => fake as never }, () => defaultPolicy, {},
      async (ssh, target) => { expect(ssh).toMatchObject({ host: "bastion", username: "u", password: "pw" }); expect(target).toEqual({ host: "db.internal", port: 5432 }); return { localPort: 40001, close: async () => { closed = true; } }; });
    await mgr.add({ id: "s", name: "s", driver: "fake", environment: "dev", readOnly: false, tags: [], secretKeys: ["ssh.password"],
      values: { host: "db.internal", "ssh.host": "bastion", "ssh.port": 22, "ssh.username": "u", "ssh.password": "pw" } });
    await mgr.connect("s");
    expect(seen).toMatchObject({ host: "127.0.0.1", port: 40001 });
    expect(Object.keys(seen).some((k) => k.startsWith("ssh."))).toBe(false);
    await mgr.disconnect("s");
    expect(closed).toBe(true);
  });
});
