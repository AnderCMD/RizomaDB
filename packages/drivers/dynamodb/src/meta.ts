import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";
import { assessPartiql } from "./partiql.js";

// Metadata only: importing this file must not load any HTTP client code.
export const capabilities: Capabilities = {
  sql: false, transactions: false, savepoints: false, multiDatabase: false, schemas: false, routines: false, triggers: false,
  cancelQuery: true, streamingResults: true, explain: "none", ddlGeneration: false, rowEditing: "none",
  // No read-only session exists: the driver classifies statements. For a server-side guarantee use an IAM policy with read-only actions.
  readOnlyEnforcement: "client",
  objectTypes: ["table", "column", "index"],
};

export const quoteIdent = (n: string) => `"${n.replace(/"/g, '""')}"`;

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "dynamodb",
  displayName: "Amazon DynamoDB",
  family: "keyvalue",
  capabilities,
  quoteIdent,
  placeholder: () => "?",
  // PartiQL has no LIMIT: row limits are applied by the driver's maxRows.
  selectTop: (table: string) => `SELECT * FROM ${table}`,
  openCommand: (ref) => `SELECT * FROM ${quoteIdent(ref.name)}`,
  assess: assessPartiql,
  connectionSchema: {
    type: "object", required: ["region"],
    properties: {
      region: { type: "string", title: "Region", default: "us-east-1" },
      accessKeyId: { type: "string", title: "Access key ID" },
      secretAccessKey: { type: "string", title: "Secret access key", secret: true },
      sessionToken: { type: "string", title: "Session token (temporary credentials)", secret: true },
      host: { type: "string", title: "Endpoint host (empty = AWS)", description: "Set for DynamoDB Local or a VPC endpoint, e.g. localhost" },
      port: { type: "number", title: "Endpoint port", default: 443 },
      ssl: { type: "boolean", title: "Use TLS (https)", default: true },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
