import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";

// Metadata only: importing this file must not load the DuckDB native bindings.
export const capabilities: Capabilities = {
  sql: true, transactions: true, savepoints: false, multiDatabase: false, schemas: true, routines: false, triggers: false,
  cancelQuery: true, streamingResults: true, explain: "text", ddlGeneration: true, rowEditing: "primaryKey",
  // DuckDB has no read-only session for a writable database: the driver rejects non-read statements.
  readOnlyEnforcement: "client",
  objectTypes: ["schema", "table", "view", "index", "column"],
};

export const quoteIdent = (n: string) => `"${n.replaceAll('"', '""')}"`;

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "duckdb",
  displayName: "DuckDB",
  family: "relational",
  capabilities,
  quoteIdent,
  placeholder: () => "?",
  selectTop: (t: string, n: number) => `SELECT * FROM ${t} LIMIT ${n}`,
  connectionSchema: {
    type: "object", required: ["path"],
    properties: {
      path: { type: "string", title: "Database file", description: "File path, or :memory:" },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
