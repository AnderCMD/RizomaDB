import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";
import { assessCypher } from "./cypher.js";

// Metadata only: importing this file must not load any HTTP client code.
export const capabilities: Capabilities = {
  sql: false, transactions: false, savepoints: false, multiDatabase: false, schemas: false, routines: false, triggers: false,
  cancelQuery: true, streamingResults: true, explain: "none", ddlGeneration: false, rowEditing: "none",
  // The HTTP API has no read-only session: the driver classifies statements and rejects anything that is not a read.
  readOnlyEnforcement: "client",
  objectTypes: ["table", "column"],
};

export const quoteIdent = (n: string) => `\`${n.replace(/`/g, "``")}\``;

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "hydradb",
  displayName: "HydraDB",
  family: "graph",
  language: "cypher",
  capabilities,
  quoteIdent,
  placeholder: (i: number) => `$p${i}`,
  // "Tables" are node labels. HydraDB cannot list labels or properties, so only the id is projected.
  selectTop: (label: string, n: number) => `MATCH (n:${label}) RETURN n.id AS id LIMIT ${Math.max(1, Math.floor(n))}`,
  openCommand: (ref, limit) => `MATCH (n:${quoteIdent(ref.name)}) RETURN n.id AS id LIMIT ${Math.max(1, Math.floor(limit))}`,
  assess: assessCypher,
  connectionSchema: {
    type: "object", required: ["host", "token"],
    properties: {
      host: { type: "string", title: "Host", default: "localhost" },
      port: { type: "number", title: "HTTP port", default: 8443, description: "Port of the HTTP query API (8443), not the Bolt port" },
      token: { type: "string", title: "Bearer token", secret: true, description: "The token the server was started with (GRAPH_AUTH_TOKEN_FILE)" },
      graph: { type: "string", title: "Graph", default: "default", description: "Graph id (the database name over Bolt)" },
      cell: { type: "string", title: "Cell ID", default: "cell-0", description: "Partition of the graph. HydraDB cannot list cells: ask the operator" },
      namespace: { type: "string", title: "Namespace (optional)", description: "Sent as X-Graph-Namespace when the server needs it" },
      labels: { type: "string", title: "Labels to show in the tree", description: "Comma-separated node labels. HydraDB cannot list labels by itself" },
      ssl: { type: "boolean", title: "Use TLS (https)", default: false, description: "Deployed servers require TLS; plain HTTP is for local development" },
      sslVerify: { type: "boolean", title: "Verify server certificate", default: true },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
