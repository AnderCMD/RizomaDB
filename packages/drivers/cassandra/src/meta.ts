import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";
import { assessCql } from "./cql.js";

// Metadata only: importing this file must not load the Cassandra client library.
export const capabilities: Capabilities = {
  sql: false, transactions: false, savepoints: false, multiDatabase: true, schemas: true, routines: false, triggers: false,
  cancelQuery: true, streamingResults: true, explain: "none", ddlGeneration: false, rowEditing: "none",
  // CQL has no read-only session: the driver classifies statements. For a server-side guarantee use a role with SELECT only.
  readOnlyEnforcement: "client",
  objectTypes: ["schema", "table", "view", "index", "column"],
};

export const quoteIdent = (n: string) => `"${n.replace(/"/g, '""')}"`;

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "cassandra",
  displayName: "Apache Cassandra / ScyllaDB",
  family: "widecolumn",
  language: "cql",
  capabilities,
  quoteIdent,
  placeholder: () => "?",
  selectTop: (table: string, n: number) => `SELECT * FROM ${table} LIMIT ${Math.max(1, Math.floor(n))}`,
  assess: assessCql,
  connectionSchema: {
    type: "object", required: ["host", "localDataCenter"],
    properties: {
      host: { type: "string", title: "Contact point(s)", default: "localhost", description: "One host, or several separated by commas" },
      port: { type: "number", title: "Port", default: 9042 },
      localDataCenter: { type: "string", title: "Local data center", default: "datacenter1", description: "Required by the driver; see `SELECT data_center FROM system.local`" },
      keyspace: { type: "string", title: "Default keyspace" },
      user: { type: "string", title: "User" },
      password: { type: "string", title: "Password", secret: true },
      ssl: { type: "boolean", title: "Use TLS", default: false },
      sslVerify: { type: "boolean", title: "Verify server certificate", default: true },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
