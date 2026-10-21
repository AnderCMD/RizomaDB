import { describe, it, expect, afterEach } from "vitest";
import http from "node:http";
import net from "node:net";
import { AiDeclinedError, AiDisabledError, extractSql, isLocalEndpoint, planRequest, sendRequest, tablesMentioned, type AiConfig, type SchemaTable } from "./index.js";

const schema: SchemaTable[] = [
  { name: "customers", columns: [{ name: "id", type: "int", pk: true }, { name: "email", type: "text" }] },
  { name: "orders", columns: [{ name: "id", type: "int", pk: true }, { name: "customer_id", type: "int" }, { name: "total", type: "numeric" }] },
  { name: "audit_secrets", columns: [{ name: "token", type: "text" }] },
];
const fks = [{ from: "orders", to: "customers", columns: "customer_id", refColumns: "id" }];

const servers: http.Server[] = [];
afterEach(() => { servers.splice(0).forEach((s) => s.close()); });
async function mock(handler: (req: http.IncomingMessage, body: string) => { status?: number; json: unknown }) {
  const seen: { url: string; headers: http.IncomingHttpHeaders; body: string }[] = [];
  let connections = 0;
  const srv = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { seen.push({ url: req.url ?? "", headers: req.headers, body: b }); const r = handler(req, b); res.writeHead(r.status ?? 200, { "content-type": "application/json" }); res.end(JSON.stringify(r.json)); }); });
  srv.on("connection", () => connections++);
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
  servers.push(srv);
  return { url: `http://127.0.0.1:${(srv.address() as net.AddressInfo).port}`, seen, connections: () => connections };
}
const cfg = (over: Partial<AiConfig>): AiConfig => ({ enabled: true, provider: "openai-compatible", endpoint: "http://127.0.0.1:1", model: "m", ...over });

describe("request planning (nothing is sent)", () => {
  it("sends schema only for the tables the query uses, strips literals, and never includes data", () => {
    const p = planRequest({ task: { kind: "explain", sql: "SELECT c.email FROM customers c JOIN orders o ON o.customer_id = c.id WHERE c.email = 'ana@example.com' AND o.total > 1000" }, dialect: "postgres", schema, fks, cfg: { endpoint: "http://localhost:11434/v1" } });
    expect(p.includedTables.sort()).toEqual(["customers", "orders"]);
    expect(p.preview).toContain("TABLE customers (id int PK, email text)"); expect(p.preview).toContain("FK orders(customer_id) -> customers(id)");
    expect(p.preview).not.toMatch(/ana@example|1000|audit_secrets|token/); expect(p.remote).toBe(false);
    expect(JSON.stringify(p.messages)).toBe(JSON.stringify([{ role: "system", content: p.messages[0]!.content }, { role: "user", content: p.messages[1]!.content }]));
    expect(p.bytes).toBe(Buffer.byteLength(JSON.stringify(p.messages)));
  });
  it("honours excluded tables for text-to-SQL and flags remote endpoints", () => {
    const p = planRequest({ task: { kind: "text-to-sql", request: "orders per customer" }, dialect: "mysql", schema, cfg: { endpoint: "https://api.example.com" }, excludeTables: ["audit_secrets"] });
    expect(p.includedTables).toEqual(["customers", "orders"]); expect(p.preview).not.toContain("audit_secrets"); expect(p.remote).toBe(true);
    expect(planRequest({ task: { kind: "optimize", sql: "SELECT 1 FROM orders", plan: "Seq Scan on orders" }, dialect: "postgres", schema, cfg: { endpoint: "x" } }).preview).toContain("Seq Scan on orders");
    expect(planRequest({ task: { kind: "describe", tables: ["customers"] }, dialect: "postgres", schema, cfg: { endpoint: "x" } }).includedTables).toEqual(["customers"]);
  });
  it("classifies endpoints and extracts SQL", () => {
    for (const u of ["http://localhost:11434/v1", "http://127.0.0.1:8080", "http://[::1]:1234/v1", "http://llm.localhost"]) expect(isLocalEndpoint(u)).toBe(true);
    for (const u of ["https://api.openai.com/v1", "http://10.0.0.5:11434", "not a url"]) expect(isLocalEndpoint(u)).toBe(false);
    expect(extractSql("Here:\n```sql\nSELECT 1;\n```\nok")).toBe("SELECT 1;"); expect(extractSql("no code")).toBeUndefined();
    expect(tablesMentioned("select * from ORDERS", schema).map((t) => t.name)).toEqual(["orders"]);
  });
});

describe("sending", () => {
  const plan = () => planRequest({ task: { kind: "text-to-sql", request: "count orders" }, dialect: "postgres", schema, cfg: { endpoint: "http://127.0.0.1" } });

  it("is off by default: a disabled assistant opens no connection at all", async () => {
    const m = await mock(() => ({ json: {} }));
    await expect(sendRequest({ cfg: cfg({ enabled: false, endpoint: m.url }), plan: plan() })).rejects.toBeInstanceOf(AiDisabledError);
    expect(m.connections()).toBe(0); expect(m.seen).toHaveLength(0);
  });
  it("talks OpenAI-compatible (Ollama, LM Studio, OpenAI): bearer key only if configured, payload equals the preview", async () => {
    const m = await mock(() => ({ json: { model: "llama3", choices: [{ message: { content: "Use this:\n```sql\nSELECT count(*) FROM orders;\n```" } }] } }));
    const p = plan();
    const a = await sendRequest({ cfg: cfg({ endpoint: `${m.url}/v1`, apiKey: "sk-test" }), plan: p });
    expect(a.sql).toBe("SELECT count(*) FROM orders;"); expect(a.model).toBe("llama3");
    expect(m.seen[0]!.url).toBe("/v1/chat/completions"); expect(m.seen[0]!.headers.authorization).toBe("Bearer sk-test");
    const body = JSON.parse(m.seen[0]!.body) as { messages: unknown[]; model: string; stream: boolean };
    expect(body.messages).toEqual(p.messages); expect(body.stream).toBe(false);
    const m2 = await mock(() => ({ json: { choices: [{ message: { content: "ok" } }] } }));
    await sendRequest({ cfg: cfg({ endpoint: m2.url }), plan: p }); expect(m2.seen[0]!.headers.authorization).toBeUndefined();
  });
  it("talks Anthropic: key in x-api-key, system prompt separate", async () => {
    const m = await mock(() => ({ json: { content: [{ type: "text", text: "Answer" }], model: "claude-x" } }));
    const a = await sendRequest({ cfg: cfg({ provider: "anthropic", endpoint: m.url, apiKey: "k-1", model: "claude-x" }), plan: plan() });
    expect(a.text).toBe("Answer"); expect(m.seen[0]!.url).toBe("/v1/messages"); expect(m.seen[0]!.headers["x-api-key"]).toBe("k-1"); expect(m.seen[0]!.headers["anthropic-version"]).toBeTruthy();
    const body = JSON.parse(m.seen[0]!.body) as { system: string; messages: { role: string }[] };
    expect(body.system).toContain("database assistant"); expect(body.messages.map((x) => x.role)).toEqual(["user"]);
  });
  it("requires an explicit yes for remote endpoints and shows exactly what will be sent; a no sends nothing", async () => {
    const p = planRequest({ task: { kind: "text-to-sql", request: "x" }, dialect: "postgres", schema, cfg: { endpoint: "https://remote.example" } });
    expect(p.remote).toBe(true);
    let shown = "";
    await expect(sendRequest({ cfg: cfg({ endpoint: "https://remote.example" }), plan: p, confirm: async (pv) => { shown = pv; return false; } })).rejects.toBeInstanceOf(AiDeclinedError);
    expect(shown).toBe(p.preview);
    await expect(sendRequest({ cfg: cfg({ endpoint: "https://remote.example" }), plan: p })).rejects.toBeInstanceOf(AiDeclinedError);
  });
  it("reports provider errors, non-JSON answers, empty answers and timeouts clearly", async () => {
    const e1 = await mock(() => ({ status: 401, json: { error: { message: "bad key" } } }));
    await expect(sendRequest({ cfg: cfg({ endpoint: e1.url }), plan: plan() })).rejects.toThrow(/HTTP 401.*bad key/);
    const e2 = await mock(() => ({ json: { choices: [] } }));
    await expect(sendRequest({ cfg: cfg({ endpoint: e2.url }), plan: plan() })).rejects.toThrow(/empty answer/);
    const slow = http.createServer(() => {}); await new Promise<void>((r) => slow.listen(0, "127.0.0.1", () => r())); servers.push(slow);
    await expect(sendRequest({ cfg: cfg({ endpoint: `http://127.0.0.1:${(slow.address() as net.AddressInfo).port}`, timeoutMs: 300 }), plan: plan() })).rejects.toThrow(/in time/);
    const ac = new AbortController(); setTimeout(() => ac.abort(), 100);
    await expect(sendRequest({ cfg: cfg({ endpoint: `http://127.0.0.1:${(slow.address() as net.AddressInfo).port}` }), plan: plan(), signal: ac.signal })).rejects.toThrow();
  });
});
