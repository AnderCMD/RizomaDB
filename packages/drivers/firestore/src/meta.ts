import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";
import { assessFirestore } from "./console.js";

// Metadata only: importing this file must not load any HTTP client code.
export const capabilities: Capabilities = {
  sql: false, transactions: false, savepoints: false, multiDatabase: false, schemas: false, routines: false, triggers: false,
  cancelQuery: true, streamingResults: false, explain: "none", ddlGeneration: false, rowEditing: "none",
  // The REST API has no read-only session: the driver classifies commands. For a server-side guarantee use an IAM role with read access only.
  readOnlyEnforcement: "client",
  objectTypes: ["table", "column"],
};

export const quoteIdent = (n: string) => JSON.stringify(n);

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "firestore",
  displayName: "Google Cloud Firestore",
  family: "document",
  language: "json",
  capabilities,
  quoteIdent,
  placeholder: () => "?",
  selectTop: (collection: string, n: number) => `{ "from": ${collection}, "limit": ${Math.max(1, Math.floor(n))} }`,
  openCommand: (ref, limit) => `{ "from": ${JSON.stringify(ref.name)}, "limit": ${Math.max(1, Math.floor(limit))} }`,
  assess: assessFirestore,
  connectionSchema: {
    type: "object", required: ["projectId"],
    properties: {
      projectId: { type: "string", title: "Project ID" },
      databaseId: { type: "string", title: "Database ID", default: "(default)" },
      credentialsFile: { type: "string", title: "Google credentials file (JSON)", description: "A service-account key, or the file written by `gcloud auth application-default login`. RizomaDB asks Google for short-lived tokens with it. Empty = GOOGLE_APPLICATION_CREDENTIALS or the gcloud default file." },
      accessToken: { type: "string", title: "OAuth access token", secret: true, description: "For example from `gcloud auth print-access-token` (expires after about an hour). Not needed for the emulator." },
      host: { type: "string", title: "Endpoint host (empty = Google Cloud)", description: "Set for the Firestore emulator, e.g. localhost" },
      port: { type: "number", title: "Endpoint port", default: 8080 },
      ssl: { type: "boolean", title: "Use TLS (https)", default: false },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
