import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";

// Metadata only: importing this file must not load the database client library.
export const capabilities: Capabilities = {
  sql: true, transactions: true, savepoints: true, multiDatabase: true, schemas: true,
  routines: true, triggers: true, cancelQuery: true, streamingResults: true,
  explain: "text", ddlGeneration: true, rowEditing: "primaryKey",
  // SQL Server has no session-level read-only mode: enforced by the driver (statement guard).
  readOnlyEnforcement: "client",
  objectTypes: ["database", "schema", "table", "view", "index", "column"],
};

export const quoteIdent = (n: string) => `[${n.replaceAll("]", "]]")}]`;

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "mssql",
  displayName: "SQL Server",
  family: "relational",
  capabilities,
  quoteIdent,
  selectTop: (t: string, n: number) => `SELECT TOP (${n}) * FROM ${t}`,
  placeholder: (i: number) => `@p${i}`,
  connectionSchema: {
    type: "object", required: ["host", "user"],
    properties: {
      host: { type: "string", title: "Host", default: "localhost" },
      port: { type: "number", title: "Port", default: 1433 },
      database: { type: "string", title: "Database" },
      user: { type: "string", title: "User" },
      password: { type: "string", title: "Password", secret: true },
      ssl: { type: "boolean", title: "Encrypt (TLS)", default: true },
      sslVerify: { type: "boolean", title: "Verify server certificate", default: true },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
