import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";
import { assessTrino } from "./readonly.js";

// Metadata only: importing this file must not load any HTTP client code.
export const capabilities: Capabilities = {
  sql: true, transactions: false, savepoints: false, multiDatabase: true, schemas: true, routines: false, triggers: false,
  cancelQuery: true, streamingResults: true, explain: "text", ddlGeneration: false, rowEditing: "none",
  // Trino has no read-only session: the driver classifies statements. For a server-side guarantee use access control rules.
  readOnlyEnforcement: "client",
  objectTypes: ["schema", "table", "view", "column"],
};

export const quoteIdent = (n: string) => `"${n.replace(/"/g, '""')}"`;

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "trino",
  displayName: "Trino",
  family: "relational",
  capabilities,
  quoteIdent,
  placeholder: () => "?",
  selectTop: (table: string, n: number) => `SELECT * FROM ${table} LIMIT ${Math.max(1, Math.floor(n))}`,
  assess: assessTrino,
  connectionSchema: {
    type: "object", required: ["host", "user", "catalog"],
    properties: {
      host: { type: "string", title: "Coordinator host", default: "localhost" },
      port: { type: "number", title: "Port", default: 8080 },
      user: { type: "string", title: "User" },
      password: { type: "string", title: "Password (requires TLS)", secret: true },
      catalog: { type: "string", title: "Catalog", description: "The catalog whose schemas and tables the explorer shows" },
      schema: { type: "string", title: "Default schema" },
      ssl: { type: "boolean", title: "Use TLS (https)", default: false },
      sslVerify: { type: "boolean", title: "Verify server certificate", default: true },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
