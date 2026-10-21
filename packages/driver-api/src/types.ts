export type EngineFamily =
  | "relational" | "document" | "keyvalue" | "search"
  | "widecolumn" | "graph" | "timeseries" | "stream";

export type ObjectType = "database" | "schema" | "table" | "view" | "index" | "column";

export interface Capabilities {
  sql: boolean;
  transactions: boolean;
  savepoints: boolean;
  multiDatabase: boolean;
  schemas: boolean;
  routines: boolean;
  triggers: boolean;
  cancelQuery: boolean;
  streamingResults: boolean;
  explain: "none" | "text" | "json" | "visual";
  ddlGeneration: boolean;
  rowEditing: "primaryKey" | "rowId" | "documentId" | "key" | "none";
  readOnlyEnforcement: "server" | "client";
  objectTypes: ObjectType[];
}

/** Normalized value. bigint keeps 64-bit integers lossless; decimals stay strings. */
export type Value =
  | null | boolean | number | bigint | string | Date | Uint8Array
  | { json: unknown } | Value[];

export interface ColumnInfo {
  name: string;
  /** Native engine type name, e.g. "int4", "TEXT". */
  nativeType: string;
  kind: "integer" | "float" | "decimal" | "text" | "boolean" | "datetime" | "binary" | "json" | "other";
}

export type ResultEvent =
  | { type: "columns"; columns: ColumnInfo[] }
  | { type: "rows"; rows: Value[][] }
  | { type: "done"; rowCount: number; affectedRows?: number; durationMs: number }
  | { type: "message"; text: string };

export interface ExecuteRequest {
  sql: string;
  params?: Value[];
  /** Max rows to emit before the stream ends truncated. */
  maxRows?: number;
  batchSize?: number;
}

export interface ServerInfo { product: string; version: string }

export interface TableRef { schema?: string; name: string }
export interface ColumnDef { name: string; nativeType: string; nullable: boolean; default?: string; primaryKey: boolean }
export interface TableInfo extends TableRef { kind: "table" | "view"; columns?: ColumnDef[] }

export interface IntrospectionApi {
  listSchemas(): Promise<string[]>;
  listTables(schema?: string): Promise<TableInfo[]>;
  describeTable(ref: TableRef): Promise<TableInfo>;
}

export interface Transaction {
  execute(req: ExecuteRequest, signal: AbortSignal): AsyncIterable<ResultEvent>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface Connection {
  readonly serverInfo: ServerInfo;
  execute(req: ExecuteRequest, signal: AbortSignal): AsyncIterable<ResultEvent>;
  introspect(): IntrospectionApi;
  quoteIdent(name: string): string;
  begin?(): Promise<Transaction>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

/** Secrets are resolved by the host before reaching the driver and never logged. */
export interface ResolvedConnectionConfig {
  [key: string]: unknown;
  readOnly?: boolean;
}

export interface DriverContext { log(message: string): void }

export interface JsonSchema { type: "object"; required?: string[]; properties: Record<string, JsonSchemaProp> }
export interface JsonSchemaProp {
  type: "string" | "number" | "boolean";
  title: string; description?: string; default?: unknown; secret?: boolean; enum?: string[];
}

export interface DriverPlugin {
  readonly id: string;
  readonly displayName: string;
  readonly family: EngineFamily;
  readonly capabilities: Capabilities;
  readonly connectionSchema: JsonSchema;
  /** Dialect identifier quoting; pure, usable without a connection. */
  quoteIdent(name: string): string;
  /** Positional bind placeholder for the 1-based index, e.g. `?`, `$1`, `@p1`, `:1`. */
  placeholder(index: number): string;
  /** `SELECT *` over an already-quoted table name limited to n rows, in the dialect. */
  selectTop(quotedTable: string, n: number): string;
  connect(cfg: ResolvedConnectionConfig, ctx: DriverContext): Promise<Connection>;
}
