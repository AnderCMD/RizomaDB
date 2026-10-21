import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";
import { assessMongo } from "./assess.js";

// Metadata only: importing this file must not load the MongoDB client library.
export const capabilities: Capabilities = {
  sql: false,
  // Multi-document transactions need a replica set; edits are applied sequentially with per-document concurrency checks.
  transactions: false, savepoints: false, multiDatabase: true, schemas: true, routines: false, triggers: false,
  cancelQuery: true, streamingResults: true, explain: "json", ddlGeneration: false, rowEditing: "documentId",
  // The driver rejects write commands on read-only connections; for a server-enforced guarantee use a read-only MongoDB user.
  readOnlyEnforcement: "client",
  objectTypes: ["database", "table", "index", "column"],
};

export const quoteIdent = (n: string) => JSON.stringify(n);

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "mongodb",
  displayName: "MongoDB",
  family: "document",
  language: "mongo",
  capabilities,
  quoteIdent,
  placeholder: () => "?",
  selectTop: (collection: string, n: number) => `db.getCollection(${collection}).find({}).limit(${n})`,
  // The tree reports a collection as database.collection, so opening one must target that database explicitly (selectTop would build `"db"."coll"`, which is not valid shell syntax).
  openCommand: (ref, limit) => `db${ref.schema ? `.getSiblingDB(${JSON.stringify(ref.schema)})` : ""}.getCollection(${JSON.stringify(ref.name)}).find({}).limit(${Math.max(1, Math.floor(limit))})`,
  assess: assessMongo,
  connectionSchema: {
    type: "object", required: [],
    properties: {
      uri: { type: "string", title: "Connection string (optional)", description: "mongodb:// or mongodb+srv:// — overrides the fields below", secret: true },
      host: { type: "string", title: "Host", default: "localhost" },
      port: { type: "number", title: "Port", default: 27017 },
      database: { type: "string", title: "Default database" },
      user: { type: "string", title: "User" },
      password: { type: "string", title: "Password", secret: true },
      authSource: { type: "string", title: "Auth database", default: "admin" },
      ssl: { type: "boolean", title: "Use TLS", default: true },
      sslVerify: { type: "boolean", title: "Verify server certificate", default: true },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
