import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";

// Metadata only: importing this file must not load the database client library.
export const capabilities: Capabilities = {
  sql: true, transactions: true, savepoints: true, multiDatabase: false, schemas: true,
  routines: true, triggers: true, cancelQuery: true, streamingResults: true,
  explain: "text", ddlGeneration: true, rowEditing: "primaryKey",
  // Oracle has no session-level read-only mode: enforced by a driver-side statement guard.
  readOnlyEnforcement: "client",
  objectTypes: ["schema", "table", "view", "index", "column"],
};

export const quoteIdent = (n: string) => `"${n.replaceAll('"', '""')}"`;

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "oracle",
  displayName: "Oracle Database",
  family: "relational",
  capabilities,
  quoteIdent,
  selectTop: (t: string, n: number) => `SELECT * FROM ${t} FETCH FIRST ${n} ROWS ONLY`,
  placeholder: (i: number) => `:${i}`,
  connectionSchema: {
    type: "object", required: ["host", "service", "user"],
    properties: {
      host: { type: "string", title: "Host", default: "localhost" },
      port: { type: "number", title: "Port", default: 1521 },
      service: { type: "string", title: "Service name", description: "e.g. FREEPDB1" },
      user: { type: "string", title: "User" },
      password: { type: "string", title: "Password", secret: true },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
