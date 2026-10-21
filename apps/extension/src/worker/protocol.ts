import type { Capabilities, ExecuteRequest, ResolvedConnectionConfig, ResultEvent, ServerInfo } from "@rizomadb/driver-api";

export type WireError = { kind: string; message: string; position?: number; code?: string };

export type Request =
  | { id: number; op: "connect"; driver: string; cfg: ResolvedConnectionConfig }
  | { id: number; op: "execute"; target: number; req: ExecuteRequest }
  | { id: number; op: "next"; rid: number }
  | { op: "abort"; rid: number }
  | { id: number; op: "call"; target: number; method: "ping" | "close" | "listSchemas" | "listTables" | "describeTable" | "describeSchema" | "foreignKeys" | "indexes" | "begin" | "commit" | "rollback"; args: unknown[] };

export type Response =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: WireError };

export type ConnectResult = { target: number; serverInfo: ServerInfo; capabilities: Capabilities };
export type NextResult = { done: boolean; value?: ResultEvent };
