import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";

// Metadata only: importing this file must not load the database client library.
export const capabilities: Capabilities = {
  sql: true, transactions: true, savepoints: true, multiDatabase: true, schemas: true,
  routines: true, triggers: true, cancelQuery: true, streamingResults: true,
  explain: "json", ddlGeneration: true, rowEditing: "primaryKey", readOnlyEnforcement: "server",
  objectTypes: ["database", "schema", "table", "view", "index", "column"],
};

export const quoteIdent = (n: string) => `"${n.replaceAll('"', '""')}"`;

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "postgres",
  displayName: "PostgreSQL",
  family: "relational",
  capabilities,
  quoteIdent,
  selectTop: (t: string, n: number) => `SELECT * FROM ${t} LIMIT ${n}`,
  placeholder: (i: number) => `$${i}`,
  connectionSchema: {
    type: "object", required: ["host", "database", "user"],
    properties: {
      host: { type: "string", title: "Host", default: "localhost" },
      port: { type: "number", title: "Port", default: 5432 },
      database: { type: "string", title: "Database" },
      user: { type: "string", title: "User" },
      password: { type: "string", title: "Password", secret: true },
      ssl: { type: "boolean", title: "Use TLS", default: true, description: "Certificate verification is always on unless sslVerify is disabled." },
      sslVerify: { type: "boolean", title: "Verify server certificate", default: true },
      sslCaFile: { type: "string", title: "CA certificate file (PEM, optional)", description: "Trust this CA in addition to the system store (internal PKI). NODE_EXTRA_CA_CERTS also works." },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
