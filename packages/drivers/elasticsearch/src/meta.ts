import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";
import { assessConsole } from "./console.js";

// Metadata only: importing this file must not load any HTTP client code.
export const capabilities: Capabilities = {
  sql: false, transactions: false, savepoints: false, multiDatabase: false, schemas: false, routines: false, triggers: false,
  cancelQuery: true, streamingResults: true, explain: "json", ddlGeneration: false, rowEditing: "none",
  // The REST API has no read-only session: the driver rejects non-read requests. For a server-side guarantee use a read-only API key/role.
  readOnlyEnforcement: "client",
  objectTypes: ["table", "column"],
};

export const quoteIdent = (n: string) => JSON.stringify(n);

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "elasticsearch",
  displayName: "Elasticsearch / OpenSearch",
  family: "search",
  language: "json",
  capabilities,
  quoteIdent,
  placeholder: () => "?",
  selectTop: (index: string, n: number) => `GET /${index}/_search\n{ "size": ${n}, "query": { "match_all": {} } }`,
  openCommand: (ref, limit) => `GET /${ref.name}/_search\n{ "size": ${limit}, "query": { "match_all": {} } }`,
  assess: assessConsole,
  connectionSchema: {
    type: "object", required: ["host"],
    properties: {
      host: { type: "string", title: "Host", default: "localhost" },
      port: { type: "number", title: "Port", default: 9200 },
      user: { type: "string", title: "User (basic auth)" },
      password: { type: "string", title: "Password", secret: true },
      apiKey: { type: "string", title: "API key (instead of user/password)", secret: true },
      ssl: { type: "boolean", title: "Use TLS (https)", default: true },
      sslVerify: { type: "boolean", title: "Verify server certificate", default: true },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
