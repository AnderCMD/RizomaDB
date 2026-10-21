import * as z from "zod/mini";
import { Shape } from "./connectMessages.js";

/** Versioned host⇄webview protocol (ADR 0008). Validated at both ends. */
export const PROTOCOL_VERSION = 1;

const Col = z.object({ name: z.string(), nativeType: z.string(), kind: z.string() });
const Cell = z.nullable(z.string());

export const HostToWebview = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("start"), title: z.string(), sql: z.string(), columns: z.array(Col), editable: z.optional(z.boolean()), append: z.optional(z.boolean()), table: z.optional(z.object({ name: z.string(), schema: z.optional(z.string()), alter: z.boolean() })),
    connection: z.optional(z.object({ name: z.string(), environment: z.string(), key: z.string(), color: z.string(), fg: z.string(), mark: z.string(), logo: z.optional(z.object({ bg: z.string(), vb: z.string().check(z.maxLength(40)), shapes: z.array(Shape).check(z.maxLength(60)), wordmark: z.optional(z.boolean()) })) })),
    flags: z.optional(z.object({ pk: z.array(z.string()), required: z.array(z.string()) })) }),
  z.object({ v: z.literal(1), type: z.literal("rows"), rows: z.array(z.array(Cell)) }),
  z.object({ v: z.literal(1), type: z.literal("done"), rowCount: z.number(), affectedRows: z.optional(z.number()), durationMs: z.number(), truncated: z.boolean(), more: z.optional(z.boolean()), capped: z.optional(z.boolean()), next: z.optional(z.number()) }),
  z.object({ v: z.literal(1), type: z.literal("error"), kind: z.string(), message: z.string(), position: z.optional(z.number()) }),
  z.object({
    v: z.literal(1), type: z.literal("pending"),
    sets: z.array(z.object({ row: z.number(), col: z.number(), text: Cell })),
    deletes: z.array(z.number()),
    inserts: z.array(z.array(z.object({ set: z.boolean(), text: Cell }))),
    count: z.number(), canUndo: z.boolean(), canRedo: z.boolean(),
  }),
  z.object({ v: z.literal(1), type: z.literal("properties"), ok: z.boolean(), error: z.optional(z.string()),
    columns: z.array(z.object({ name: z.string(), type: z.string(), nullable: z.boolean(), pk: z.boolean(), default: z.optional(z.string()) })),
    indexes: z.array(z.object({ name: z.string(), columns: z.array(z.string()), unique: z.boolean(), primary: z.boolean() })),
    foreignKeys: z.array(z.object({ name: z.string(), columns: z.array(z.string()), refTable: z.string(), refSchema: z.optional(z.string()), refColumns: z.array(z.string()) })),
    referencedBy: z.array(z.object({ name: z.string(), table: z.string(), schema: z.optional(z.string()), columns: z.array(z.string()), refColumns: z.array(z.string()) })),
    ddl: z.string() }),
  z.object({ v: z.literal(1), type: z.literal("notice"), level: z.enum(["error", "info"]), text: z.string() }),
]);
export type HostToWebview = z.infer<typeof HostToWebview>;

export const WebviewToHost = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("cancel") }),
  z.object({ v: z.literal(1), type: z.literal("edit"), row: z.number(), col: z.number(), text: Cell }),
  z.object({ v: z.literal(1), type: z.literal("toggleDelete"), row: z.number() }),
  z.object({ v: z.literal(1), type: z.enum(["insertRow", "undo", "redo", "review", "apply", "discard"]) }),
  z.object({ v: z.literal(1), type: z.literal("refresh") }),
  z.object({ v: z.literal(1), type: z.literal("loadMore"), mode: z.enum(["page", "all"]) }),
  z.object({ v: z.literal(1), type: z.literal("openSql") }),
  z.object({ v: z.literal(1), type: z.literal("openText"), text: z.string().check(z.maxLength(500_000)) }),
  z.object({ v: z.literal(1), type: z.literal("loadProperties") }),
  z.object({ v: z.literal(1), type: z.literal("showEr") }),
  z.object({ v: z.literal(1), type: z.literal("openRelated"), name: z.string().check(z.maxLength(256)), schema: z.optional(z.string().check(z.maxLength(256))) }),
  z.object({ v: z.literal(1), type: z.literal("setDeleted"), rows: z.array(z.number()).check(z.maxLength(100_000)), deleted: z.boolean() }),
  z.object({ v: z.literal(1), type: z.literal("columnAction"), action: z.enum(["rename", "type", "nullable", "default", "drop", "add"]), column: z.string().check(z.maxLength(256)) }),
  z.object({ v: z.literal(1), type: z.literal("save"), format: z.enum(["csv", "tsv", "json", "md"]), text: z.string().check(z.maxLength(5_000_000)) }),
  z.object({ v: z.literal(1), type: z.literal("copy"), text: z.string().check(z.maxLength(5_000_000)) }),
]);
export type WebviewToHost = z.infer<typeof WebviewToHost>;
