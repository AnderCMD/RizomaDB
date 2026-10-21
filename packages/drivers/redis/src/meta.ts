import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";
import { assessRedis } from "./parser.js";

// Metadata only: importing this file must not load the Redis client library.
export const capabilities: Capabilities = {
  sql: false, transactions: false, savepoints: false, multiDatabase: true, schemas: true, routines: false, triggers: false,
  cancelQuery: true, streamingResults: true, explain: "none", ddlGeneration: false, rowEditing: "key",
  // Redis has no per-connection read-only mode: the driver rejects write commands. For a server-side guarantee use an ACL user with +@read.
  readOnlyEnforcement: "client",
  objectTypes: ["database", "table"],
};

export const quoteIdent = (n: string) => JSON.stringify(n);

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "redis",
  displayName: "Redis / Valkey",
  family: "keyvalue",
  language: "redis",
  capabilities,
  quoteIdent,
  placeholder: () => "?",
  selectTop: (key: string) => `OPEN ${key}`,
  openCommand: (ref, limit) => `OPEN ${/^[\w:.\-/]+$/.test(ref.name) ? ref.name : JSON.stringify(ref.name)} ${limit}`,
  assess: assessRedis,
  connectionSchema: {
    type: "object", required: ["host"],
    properties: {
      host: { type: "string", title: "Host", default: "localhost" },
      port: { type: "number", title: "Port", default: 6379 },
      user: { type: "string", title: "ACL user (optional)" },
      password: { type: "string", title: "Password", secret: true },
      database: { type: "number", title: "Database number", default: 0 },
      ssl: { type: "boolean", title: "Use TLS", default: true },
      sslVerify: { type: "boolean", title: "Verify server certificate", default: true },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
