import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collect } from "@rizomadb/driver-api";
import { AuditLog, builtInPolicy, guardConnection, mergePolicies } from "@rizomadb/core";
import { sqliteDriver } from "@rizomadb/driver-sqlite";
import { checkAgentQuery, createMcpServer, defaultRule, type McpConnection } from "./index.js";

const dir = mkdtempSync(join(tmpdir(), "rz-mcp-"));
const dbFile = join(dir, "shop.db");

async function seed() {
  const c = await sqliteDriver.connect({ path: dbFile }, { log() {} });
  const x = (sql: string) => collect(c.execute({ sql }, new AbortController().signal));
  await x("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price NUMERIC)");
  await x("CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, email TEXT)");
  await x("CREATE TABLE secrets (id INTEGER PRIMARY KEY, token TEXT)");
  await x("INSERT INTO products VALUES (1,'Lamp',10.5),(2,'Desk',99),(3,'Chair',45)");
  await x("INSERT INTO customers VALUES (1,'Ada','ada@example.com'),(2,'Linus','linus@example.com')");
  await x("INSERT INTO secrets VALUES (1,'sk-live-123')");
  await c.close();
}
await seed();

const rule = { ...defaultRule(), allowTables: ["products", "customers"], maxRows: 2, maskColumns: [{ column: "email", rule: "redact" as const }] };
function server() {
  const audit = new AuditLog({ file: join(dir, `audit-${Math.random()}.jsonl`) });
  const conn: McpConnection = { id: "shop", dialect: "sqlite", rule, async open() {
    const raw = await sqliteDriver.connect({ path: dbFile, readOnly: true }, { log() {} });
    return guardConnection(raw, { plugin: sqliteDriver, connectionId: "shop", connectionName: "shop", environment: "mcp", readOnly: () => true, policy: () => mergePolicies(builtInPolicy), audit });
  } };
  return { s: createMcpServer({ connections: [conn], audit }), audit };
}
const call = async (s: ReturnType<typeof server>["s"], name: string, args: object) => {
  const r = (await s.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })) as { result: { content: { text: string }[]; isError?: boolean } };
  return { text: r.result.content[0]!.text, isError: !!r.result.isError };
};

describe("guardrails", () => {
  const all = ["products", "customers", "secrets"];
  const ok = (sql: string) => checkAgentQuery(sql, "sqlite", rule, all);
  it("allows plain reads over allowed tables", () => {
    expect(ok("SELECT * FROM products").ok).toBe(true);
    expect(ok("WITH x AS (SELECT * FROM products) SELECT * FROM x JOIN customers c ON 1=1;").ok).toBe(true);
    expect(ok("SELECT 'DROP TABLE secrets' AS note FROM products").ok).toBe(true); // inside a string literal: data
  });
  it("refuses writes, multiple statements, other tables, dangerous functions and side channels", () => {
    for (const sql of ["DELETE FROM products", "SELECT * FROM products; DROP TABLE products", "SELECT * FROM secrets", "SELECT token FROM \"secrets\"", "SELECT * FROM products p, [secrets] s",
      "SELECT pg_read_file('/etc/passwd')", "SELECT load_extension('x')", "SELECT * FROM products INTO OUTFILE '/tmp/x'", "SELECT pg_sleep(100)", "SELECT nextval('s')", "PRAGMA table_info(secrets)", "ATTACH 'x' AS y", "INSERT INTO products VALUES (9,'x',1)", "SELECT * FROM read_csv('/etc/passwd')", ""])
      expect(ok(sql).ok, sql).toBe(false);
    expect(checkAgentQuery("SELECT 1", "sqlite", { ...rule, allowTables: [] }, all).reason).toMatch(/No tables/);
  });
});

describe("MCP protocol", () => {
  it("initializes, lists tools and answers pings; notifications get no response", async () => {
    const { s } = server();
    const init = (await s.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } })) as { result: { protocolVersion: string; capabilities: object } };
    expect(init.result.protocolVersion).toBe("2025-03-26"); expect(init.result.capabilities).toEqual({ tools: {} });
    expect(await s.handle({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeUndefined();
    const list = (await s.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" })) as { result: { tools: { name: string }[] } };
    expect(list.result.tools.map((t) => t.name)).toEqual(["list_connections", "get_schema", "run_query"]);
    expect(await s.handle({ jsonrpc: "2.0", id: 3, method: "ping" })).toMatchObject({ result: {} });
    expect(await s.handle({ jsonrpc: "2.0", id: 4, method: "nope" })).toMatchObject({ error: { code: -32601 } });
    expect(await s.handle("garbage")).toMatchObject({ error: { code: -32600 } });
    await s.close();
  });
  it("never throws on arbitrary JSON input (fuzz)", async () => {
    const { s } = server();
    const any = fc.oneof(fc.string(), fc.integer(), fc.constant(null), fc.array(fc.string(), { maxLength: 3 }), fc.dictionary(fc.string({ maxLength: 8 }), fc.oneof(fc.string({ maxLength: 20 }), fc.integer(), fc.constant(null)), { maxKeys: 5 }));
    await fc.assert(fc.asyncProperty(any, fc.constantFrom("tools/call", "tools/list", "initialize", "x"), any, async (id, method, params) => {
      const r = await s.handle({ jsonrpc: "2.0", id: id as never, method, params: params as never });
      expect(r === undefined || typeof r === "object").toBe(true);
    }), { numRuns: 300 });
    await s.close();
  });
});

describe("tools", () => {
  it("exposes only allowed tables in the schema, without data", async () => {
    const { s } = server();
    const r = await call(s, "get_schema", { connection: "shop" });
    const j = JSON.parse(r.text) as { table: string; columns: { name: string }[] }[];
    expect(j.map((t) => t.table).sort()).toEqual(["customers", "products"]); expect(r.text).not.toMatch(/Lamp|sk-live/); expect(r.text).not.toContain("secrets");
    expect(JSON.parse((await call(s, "list_connections", {})).text)[0]).toMatchObject({ id: "shop", allowedTables: ["products", "customers"], maxRows: 2 });
    await s.close();
  });
  it("runs read-only queries with row limit, masking and truncation notice", async () => {
    const { s } = server();
    const r = await call(s, "run_query", { connection: "shop", sql: "SELECT id, name, price FROM products ORDER BY id" });
    const j = JSON.parse(r.text) as { rows: unknown[][]; truncated: boolean };
    expect(r.isError).toBe(false); expect(j.rows).toHaveLength(2); expect(j.truncated).toBe(true);
    const m = JSON.parse((await call(s, "run_query", { connection: "shop", sql: "SELECT name, email FROM customers ORDER BY id" })).text) as { rows: string[][] };
    expect(m.rows[0]).toEqual(["Ada", "***"]); expect(JSON.stringify(m)).not.toContain("example.com");
    expect(JSON.parse((await call(s, "run_query", { connection: "shop", sql: "SELECT id FROM products", max_rows: 1 })).text).rows).toHaveLength(1);
    await s.close();
  });
  it("refuses forbidden queries, explains why, and audits both outcomes", async () => {
    const { s, audit } = server();
    for (const sql of ["SELECT * FROM secrets", "UPDATE products SET price = 0", "SELECT 1; SELECT 2"]) { const r = await call(s, "run_query", { connection: "shop", sql }); expect(r.isError, sql).toBe(true); expect(r.text).toMatch(/^Refused:/); }
    expect((await call(s, "run_query", { connection: "nope", sql: "SELECT 1" })).isError).toBe(true);
    await call(s, "run_query", { connection: "shop", sql: "SELECT id FROM products" });
    await audit.flush();
    const log = await audit.read({});
    expect(log.filter((e) => e.status === "blocked").length).toBe(3); expect(log.some((e) => e.status === "ok")).toBe(true);
    expect(log.every((e) => e.environment === "mcp")).toBe(true);
    // data written to the real database is untouched
    const c = await sqliteDriver.connect({ path: dbFile }, { log() {} });
    expect((await collect(c.execute({ sql: "SELECT price FROM products WHERE id = 1" }, new AbortController().signal))).rows[0]![0]).toBe(10.5);
    await c.close(); await s.close();
  });
});

describe("stdio server (standalone process)", () => {
  it("serves the protocol over stdin/stdout using a config file and env-based secrets", async () => {
    const out = join(dir, "mcp-bin.cjs");
    await build({ entryPoints: [join(process.cwd(), "src/bin.ts")], outfile: out, bundle: true, platform: "node", format: "cjs", external: ["pg-native", "oracledb"], logLevel: "silent", banner: { js: "" } });
    const cfg = join(dir, "mcp.json");
    writeFileSync(cfg, JSON.stringify({ version: 1, audit: "stdio-audit.jsonl", connections: [{ id: "shop", driver: "sqlite", options: { path: "${env:SHOP_DB}" }, allowTables: ["products"], maxRows: 5 }] }));
    const child = spawn(process.execPath, [out, "--config", cfg], { env: { ...process.env, SHOP_DB: dbFile }, stdio: ["pipe", "pipe", "pipe"] });
    const lines: string[] = []; let err = "";
    child.stdout.on("data", (d) => lines.push(...String(d).split("\n").filter(Boolean))); child.stderr.on("data", (d) => { err += d; });
    const send = (o: object) => child.stdin.write(JSON.stringify(o) + "\n");
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "run_query", arguments: { connection: "shop", sql: "SELECT name FROM products ORDER BY id" } } });
    send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "run_query", arguments: { connection: "shop", sql: "SELECT * FROM secrets" } } });
    child.stdin.write("{ not json\n");
    child.stdin.end();
    await new Promise<void>((res) => child.on("close", () => res()));
    expect(err).toBe("");
    const msgs = lines.map((l) => JSON.parse(l) as { id: number | null; result?: { content?: { text: string }[]; isError?: boolean }; error?: { code: number } });
    expect(msgs.find((m) => m.id === 1)!.result).toBeTruthy();
    expect(JSON.parse(msgs.find((m) => m.id === 2)!.result!.content![0]!.text).rows).toEqual([["Lamp"], ["Desk"], ["Chair"]]);
    expect(msgs.find((m) => m.id === 3)!.result!.isError).toBe(true);
    expect(msgs.some((m) => m.error?.code === -32700)).toBe(true);
    expect(readFileSync(join(dir, "stdio-audit.jsonl"), "utf8")).toContain("blocked");
  }, 60_000);
});
