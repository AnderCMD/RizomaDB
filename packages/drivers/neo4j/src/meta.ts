import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";
import { assessCypher } from "./cypher.js";

// Metadata only: importing this file must not load any HTTP client code.
export const capabilities: Capabilities = {
  sql: false, transactions: true, savepoints: false, multiDatabase: true, schemas: false, routines: false, triggers: false,
  cancelQuery: true, streamingResults: false, explain: "none", ddlGeneration: false, rowEditing: "none",
  // The Query API has no read-only session switch in Community: the driver classifies statements and rejects non-reads.
  readOnlyEnforcement: "client",
  objectTypes: ["database", "table", "column", "index"],
};

export const quoteIdent = (n: string) => `\`${n.replace(/`/g, "``")}\``;

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "neo4j",
  displayName: "Neo4j",
  family: "graph",
  language: "cypher",
  capabilities,
  quoteIdent,
  placeholder: (i: number) => `$p${i}`,
  // "Tables" are node labels.
  selectTop: (label: string, n: number) => `MATCH (n:${label}) RETURN n LIMIT ${Math.max(1, Math.floor(n))}`,
  openCommand: (ref, limit) => `MATCH (n:${quoteIdent(ref.name)}) RETURN n LIMIT ${Math.max(1, Math.floor(limit))}`,
  assess: assessCypher,
  connectionSchema: {
    type: "object", required: ["host"],
    properties: {
      host: { type: "string", title: "Host", default: "localhost" },
      port: { type: "number", title: "HTTP port", default: 7474, description: "Port of the HTTP Query API (7474, or 7473 with TLS), not the Bolt port" },
      database: { type: "string", title: "Database", default: "neo4j" },
      user: { type: "string", title: "User", default: "neo4j" },
      password: { type: "string", title: "Password", secret: true },
      ssl: { type: "boolean", title: "Use TLS (https)", default: false },
      sslVerify: { type: "boolean", title: "Verify server certificate", default: true },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
