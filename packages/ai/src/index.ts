import http from "node:http";
import https from "node:https";
import { stripLiterals } from "@rizomadb/core";

export class AiDisabledError extends Error { constructor() { super("AI assistance is turned off. Enable rizomadb.ai.enabled to use it."); this.name = "AiDisabledError"; } }
export class AiDeclinedError extends Error { constructor() { super("Nothing was sent: the request was not confirmed."); this.name = "AiDeclinedError"; } }

export interface AiConfig {
  enabled: boolean;
  provider: "openai-compatible" | "anthropic";
  /** openai-compatible: base URL such as http://localhost:11434/v1 ; anthropic: https://api.anthropic.com */
  endpoint: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface SchemaTable { name: string; columns: { name: string; type: string; pk?: boolean; nullable?: boolean }[] }
export interface SchemaFk { from: string; to: string; columns: string; refColumns: string }

export function isLocalEndpoint(endpoint: string): boolean {
  try { const h = new URL(endpoint).hostname.replace(/^\[|\]$/g, ""); return h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".localhost"); } catch { return false; }
}

export type Task =
  | { kind: "explain"; sql: string }
  | { kind: "optimize"; sql: string; plan?: string }
  | { kind: "text-to-sql"; request: string }
  | { kind: "describe"; tables: string[] };

export interface Message { role: "system" | "user"; content: string }
export interface Plan {
  messages: Message[];
  /** Exactly what will leave the machine, for display before sending. */
  preview: string;
  bytes: number;
  remote: boolean;
  includedTables: string[];
}

/** Tables whose names appear as identifiers in the SQL (conservative: shows more rather than less to the user). */
export function tablesMentioned(sql: string, tables: SchemaTable[]): SchemaTable[] {
  const ids = new Set((sql.replace(/'(?:[^']|'')*'/g, " ").match(/[A-Za-z_][A-Za-z0-9_$]*/g) ?? []).map((x) => x.toLowerCase()));
  return tables.filter((t) => ids.has(t.name.toLowerCase()));
}

export function renderSchema(tables: SchemaTable[], fks: SchemaFk[] = []): string {
  const names = new Set(tables.map((t) => t.name.toLowerCase()));
  const lines = tables.map((t) => `TABLE ${t.name} (${t.columns.map((c) => `${c.name} ${c.type}${c.pk ? " PK" : ""}${c.nullable === false ? " NOT NULL" : ""}`).join(", ")})`);
  const rel = fks.filter((f) => names.has(f.from.toLowerCase()) && names.has(f.to.toLowerCase())).map((f) => `FK ${f.from}(${f.columns}) -> ${f.to}(${f.refColumns})`);
  return [...lines, ...rel].join("\n");
}

export interface PlanInput { task: Task; dialect: string; schema: SchemaTable[]; fks?: SchemaFk[]; cfg: Pick<AiConfig, "endpoint">; /** default true: literals in the user's SQL become ? */ redactLiterals?: boolean; /** names the user excluded */ excludeTables?: string[] }

const SYSTEM = (dialect: string) => `You are a careful database assistant for ${dialect}. You only see the schema (table and column names and types), never the data. Answer concisely. When you write SQL, give it in one fenced code block and prefer read-only statements.`;

/** Builds the request without sending anything. The preview is the serialized messages, byte for byte. */
export function planRequest(i: PlanInput): Plan {
  const exclude = new Set((i.excludeTables ?? []).map((t) => t.toLowerCase()));
  const usable = i.schema.filter((t) => !exclude.has(t.name.toLowerCase()));
  const redact = (s: string) => (i.redactLiterals === false ? s : stripLiterals(s));
  let included: SchemaTable[]; let user: string;
  const t = i.task;
  if (t.kind === "explain") { included = tablesMentioned(t.sql, usable); user = `Explain what this query does, step by step, and point out anything risky or slow.\n\nQuery:\n${redact(t.sql)}\n\nSchema of the tables it uses:\n${renderSchema(included, i.fks)}`; }
  else if (t.kind === "optimize") { included = tablesMentioned(t.sql, usable); user = `Suggest how to make this query faster. Explain the reasoning and give a rewritten query and any useful index (as a suggestion only).\n\nQuery:\n${redact(t.sql)}\n${t.plan ? `\nExecution plan:\n${t.plan.slice(0, 20000)}\n` : ""}\nSchema of the tables it uses:\n${renderSchema(included, i.fks)}`; }
  else if (t.kind === "text-to-sql") { included = usable; user = `Write one ${i.dialect} query for this request.\n\nRequest: ${t.request}\n\nSchema:\n${renderSchema(included, i.fks)}`; }
  else { const want = new Set(t.tables.map((x) => x.toLowerCase())); included = usable.filter((x) => want.has(x.name.toLowerCase())); user = `Write a one-sentence description for each table and each column below, based only on the names and types. Reply as a Markdown list.\n\n${renderSchema(included, i.fks)}`; }
  const messages: Message[] = [{ role: "system", content: SYSTEM(i.dialect) }, { role: "user", content: user }];
  const preview = messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n");
  return { messages, preview, bytes: Buffer.byteLength(JSON.stringify(messages)), remote: !isLocalEndpoint(i.cfg.endpoint), includedTables: included.map((x) => x.name) };
}

function post(urlStr: string, headers: Record<string, string>, body: unknown, timeoutMs: number, signal?: AbortSignal): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === "https:" ? https : http;
    const payload = JSON.stringify(body);
    const req = lib.request({ hostname: u.hostname.replace(/^\[|\]$/g, ""), port: u.port || undefined, path: u.pathname + u.search, method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload), ...headers }, timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", (c: Buffer) => { size += c.length; if (size > 2_000_000) { req.destroy(new Error("The response was too large")); return; } chunks.push(c); });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("The model did not answer in time")));
    req.on("error", reject);
    signal?.addEventListener("abort", () => req.destroy(Object.assign(new Error("Cancelled"), { name: "AbortError" })), { once: true });
    req.end(payload);
  });
}

export interface Answer { text: string; sql?: string; model?: string }
export const extractSql = (text: string) => /```(?:sql|SQL)?\s*\n([\s\S]*?)```/.exec(text)?.[1]?.trim();

export interface SendOptions { cfg: AiConfig; plan: Plan; /** Called for remote endpoints with exactly the text that will be sent; return true to go ahead. */ confirm?: (preview: string, endpoint: string) => Promise<boolean>; signal?: AbortSignal }

/** The only function that touches the network. Off unless enabled; remote endpoints need an explicit yes for each request. */
export async function sendRequest(o: SendOptions): Promise<Answer> {
  if (!o.cfg.enabled) throw new AiDisabledError();
  if (o.plan.remote && !(await o.confirm?.(o.plan.preview, o.cfg.endpoint))) throw new AiDeclinedError();
  const timeout = o.cfg.timeoutMs ?? 60_000;
  const system = o.plan.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const rest = o.plan.messages.filter((m) => m.role !== "system");
  let res: { status: number; text: string };
  if (o.cfg.provider === "anthropic") {
    res = await post(`${o.cfg.endpoint.replace(/\/$/, "")}/v1/messages`, { "x-api-key": o.cfg.apiKey ?? "", "anthropic-version": "2023-06-01" }, { model: o.cfg.model, max_tokens: 2048, system, messages: rest }, timeout, o.signal);
  } else {
    res = await post(`${o.cfg.endpoint.replace(/\/$/, "")}/chat/completions`, o.cfg.apiKey ? { authorization: `Bearer ${o.cfg.apiKey}` } : {}, { model: o.cfg.model, messages: o.plan.messages, stream: false, temperature: 0.2 }, timeout, o.signal);
  }
  let json: Record<string, unknown>;
  try { json = JSON.parse(res.text) as Record<string, unknown>; } catch { throw new Error(`The model endpoint returned something that is not JSON (HTTP ${res.status}).`); }
  if (res.status >= 400) throw new Error(`The model endpoint refused the request (HTTP ${res.status}): ${String((json.error as { message?: string } | undefined)?.message ?? res.text.slice(0, 200))}`);
  const text = o.cfg.provider === "anthropic"
    ? ((json.content as { type: string; text?: string }[] | undefined) ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n")
    : String(((json.choices as { message?: { content?: string } }[] | undefined) ?? [])[0]?.message?.content ?? "");
  if (!text) throw new Error("The model returned an empty answer.");
  const sql = extractSql(text);
  return { text, ...(sql ? { sql } : {}), ...(typeof json.model === "string" ? { model: json.model } : {}) };
}
