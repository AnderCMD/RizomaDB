import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";

// Metadata only: importing this file must not load the ClickHouse client library.
export const capabilities: Capabilities = {
  sql: true, transactions: false, savepoints: false, multiDatabase: true, schemas: true, routines: false, triggers: false,
  cancelQuery: true, streamingResults: true, explain: "text", ddlGeneration: false,
  // ClickHouse is analytical: UPDATE/DELETE are asynchronous mutations, so rows are not editable in the grid.
  rowEditing: "none",
  // `readonly=2` is enforced by the server for every query of the connection.
  readOnlyEnforcement: "server",
  objectTypes: ["database", "table", "view", "column"],
};

export const quoteIdent = (n: string) => `\`${n.replaceAll("\\", "\\\\").replaceAll("`", "\\`")}\``;

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "clickhouse",
  displayName: "ClickHouse",
  family: "relational",
  capabilities,
  quoteIdent,
  placeholder: (i: number) => `{p${i}:String}`,
  selectTop: (t: string, n: number) => `SELECT * FROM ${t} LIMIT ${n}`,
  connectionSchema: {
    type: "object", required: ["host"],
    properties: {
      host: { type: "string", title: "Host", default: "localhost" },
      port: { type: "number", title: "HTTP port", default: 8123, description: "8443 for TLS" },
      database: { type: "string", title: "Database", default: "default" },
      user: { type: "string", title: "User", default: "default" },
      password: { type: "string", title: "Password", secret: true },
      ssl: { type: "boolean", title: "Use TLS (https)", default: true },
      sslVerify: { type: "boolean", title: "Verify server certificate", default: true },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
