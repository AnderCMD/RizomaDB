#!/usr/bin/env node
import { createMcpServer, serveStdio } from "./server.js";
import { loadMcpConfig } from "./config.js";

async function main() {
  const i = process.argv.indexOf("--config");
  const file = i >= 0 ? process.argv[i + 1] : process.env.RIZOMADB_MCP_CONFIG;
  if (!file) { process.stderr.write("Usage: rizomadb-mcp --config <path to mcp.json>\n"); process.exit(2); }
  const cfg = await loadMcpConfig(file);
  await serveStdio(createMcpServer({ connections: cfg.connections, audit: cfg.audit }), process.stdin, process.stdout);
  await cfg.close();
}
main().catch((e: unknown) => { process.stderr.write(`rizomadb-mcp: ${(e as Error).message}\n`); process.exit(1); });
