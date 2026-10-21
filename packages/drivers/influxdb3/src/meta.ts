import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";

// Metadata only: importing this file must not load any HTTP client code.
export const capabilities: Capabilities = {
  sql: true, transactions: false, savepoints: false, multiDatabase: true, schemas: false, routines: false, triggers: false,
  cancelQuery: true, streamingResults: true, explain: "text", ddlGeneration: false, rowEditing: "none",
  // The query endpoint (SQL, DataFusion) cannot modify data: writes go through a separate line-protocol endpoint this driver never calls.
  readOnlyEnforcement: "server",
  objectTypes: ["database", "table", "column"],
};

export const quoteIdent = (n: string) => `"${n.replace(/"/g, '""')}"`;

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "influxdb3",
  displayName: "InfluxDB 3",
  family: "timeseries",
  capabilities,
  quoteIdent,
  placeholder: (i: number) => `$p${i}`,
  selectTop: (table: string, n: number) => `SELECT * FROM ${table} ORDER BY time DESC LIMIT ${Math.max(1, Math.floor(n))}`,
  connectionSchema: {
    type: "object", required: ["host", "database"],
    properties: {
      host: { type: "string", title: "Host", default: "localhost" },
      port: { type: "number", title: "Port", default: 8181 },
      database: { type: "string", title: "Database" },
      token: { type: "string", title: "API token (empty when the server runs without auth)", secret: true },
      ssl: { type: "boolean", title: "Use TLS (https)", default: false },
      sslVerify: { type: "boolean", title: "Verify server certificate", default: true },
    },
  },
};
