import type { Capabilities, DriverPlugin } from "@rizomadb/driver-api";
import { assessFlux } from "./flux.js";

// Metadata only: importing this file must not load any HTTP client code.
export const capabilities: Capabilities = {
  sql: false, transactions: false, savepoints: false, multiDatabase: true, schemas: true, routines: false, triggers: false,
  cancelQuery: true, streamingResults: true, explain: "none", ddlGeneration: false, rowEditing: "none",
  // Flux can write with to(); the driver classifies scripts. For a server-side guarantee use a read-only API token.
  readOnlyEnforcement: "client",
  objectTypes: ["schema", "table", "column"],
};

export const quoteIdent = (n: string) => JSON.stringify(n);

export const meta: Omit<DriverPlugin, "connect"> = {
  id: "influxdb",
  displayName: "InfluxDB 2.x",
  family: "timeseries",
  language: "flux",
  capabilities,
  quoteIdent,
  placeholder: () => "?",
  // Buckets are "schemas", measurements are "tables". `quotedTable` is the quoted measurement; the bucket is chosen in the connection.
  selectTop: (measurement: string, n: number) => `from(bucket: "BUCKET") |> range(start: -1h) |> filter(fn: (r) => r._measurement == ${measurement}) |> limit(n: ${Math.max(1, Math.floor(n))})`,
  openCommand: (ref, limit) => `from(bucket: ${JSON.stringify(ref.schema ?? "BUCKET")})\n  |> range(start: -24h)\n  |> filter(fn: (r) => r._measurement == ${JSON.stringify(ref.name)})\n  |> limit(n: ${Math.max(1, Math.floor(limit))})`,
  assess: assessFlux,
  connectionSchema: {
    type: "object", required: ["host", "org", "token"],
    properties: {
      host: { type: "string", title: "Host", default: "localhost" },
      port: { type: "number", title: "Port", default: 8086 },
      org: { type: "string", title: "Organization" },
      token: { type: "string", title: "API token", secret: true },
      ssl: { type: "boolean", title: "Use TLS (https)", default: false },
      sslVerify: { type: "boolean", title: "Verify server certificate", default: true },
      readOnly: { type: "boolean", title: "Read-only", default: false },
    },
  },
};
