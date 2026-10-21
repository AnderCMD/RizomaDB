import { z } from "zod";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { AuditLog, builtInPolicy, expandVariables, guardConnection, mergePolicies } from "@rizomadb/core";
import type { Connection, DriverPlugin } from "@rizomadb/driver-api";
import type { Dialect } from "@rizomadb/sql";
import { defaultRule } from "./guardrails.js";
import type { McpConnection } from "./server.js";

const Mask = z.object({ column: z.string(), rule: z.enum(["redact", "nullify", "hash", "last4"]) });
export const McpConfig = z.object({
  version: z.literal(1),
  audit: z.string().optional(),
  connections: z.array(z.object({
    id: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/), description: z.string().optional(), driver: z.enum(["sqlite", "postgres", "mysql", "mssql", "oracle"]),
    options: z.record(z.string(), z.unknown()),
    allowTables: z.array(z.string()).min(1, "list at least one table the agent may read"),
    maxRows: z.number().int().min(1).max(10_000).optional(), timeoutSeconds: z.number().int().min(1).max(300).optional(),
    maskColumns: z.array(Mask).optional(),
  })).min(1),
});
export type McpConfig = z.infer<typeof McpConfig>;

const loaders: Record<string, () => Promise<DriverPlugin>> = {
  sqlite: async () => (await import("@rizomadb/driver-sqlite")).sqliteDriver,
  postgres: async () => (await import("@rizomadb/driver-postgres")).postgresDriver,
  mysql: async () => (await import("@rizomadb/driver-mysql")).mysqlDriver,
  mssql: async () => (await import("@rizomadb/driver-mssql")).mssqlDriver,
  oracle: async () => (await import("@rizomadb/driver-oracle")).oracleDriver,
};

/** Turns a config file into guarded, read-only connections. Secrets come only from `${env:NAME}` references. */
export async function loadMcpConfig(file: string, env: Record<string, string | undefined> = process.env): Promise<{ connections: McpConnection[]; audit: AuditLog; close(): Promise<void> }> {
  const cfg = McpConfig.parse(JSON.parse(await readFile(file, "utf8")));
  const base = dirname(resolve(file));
  const audit = new AuditLog({ file: resolve(base, cfg.audit ?? "mcp-audit.jsonl") });
  const policy = mergePolicies(builtInPolicy, { version: 1, environments: {}, defaults: { readOnly: true }, disable: [], maskColumns: [] });
  const opened: Connection[] = [];
  const connections = cfg.connections.map((c): McpConnection => ({
    id: c.id, ...(c.description ? { description: c.description } : {}), dialect: (c.driver === "sqlite" ? "sqlite" : c.driver) as Dialect,
    rule: { ...defaultRule(), allowTables: c.allowTables, ...(c.maxRows ? { maxRows: c.maxRows } : {}), ...(c.timeoutSeconds ? { timeoutSeconds: c.timeoutSeconds } : {}), ...(c.maskColumns ? { maskColumns: c.maskColumns } : {}) },
    async open() {
      const plugin = await loaders[c.driver]!();
      const options = expandVariables(c.options, env) as Record<string, unknown>;
      const raw = await plugin.connect({ ...options, readOnly: true }, { log() {} });
      const g = guardConnection(raw, { plugin, connectionId: c.id, connectionName: c.id, environment: "mcp", readOnly: () => true, policy: () => policy, audit });
      opened.push(g);
      return g;
    },
  }));
  return { connections, audit, close: async () => { for (const c of opened) await c.close().catch(() => {}); } };
}
