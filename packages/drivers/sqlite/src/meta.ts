import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";

// Metadata only: importing this file must not load the database client library.
export const capabilities: Capabilities = {
  sql: true, transactions: true, savepoints: true, multiDatabase: false, schemas: false,
  routines: false, triggers: true,
  // node:sqlite is synchronous: a running statement cannot be interrupted until
  // the driver runs in a worker (planned). Reported honestly here.
  cancelQuery: false,
  streamingResults: true, explain: "text", ddlGeneration: true,
  rowEditing: "primaryKey", readOnlyEnforcement: "server",
  objectTypes: ["table", "view", "index", "column"],
};

export const quoteIdent = (n: string) => `"${n.replaceAll('"', '""')}"`;

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "sqlite",
  displayName: "SQLite",
  family: "relational",
  capabilities,
  quoteIdent,
  selectTop: (t: string, n: number) => `SELECT * FROM ${t} LIMIT ${n}`,
  placeholder: () => "?",
  connectionSchema: {
    type: "object", required: ["path"],
    properties: {
      path: { type: "string", title: "Database file", description: "File path, or :memory:" },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
