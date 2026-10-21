import * as z from "zod/mini";

/** Versioned host⇄webview protocol (ADR 0008). Validated at both ends. */
export const PROTOCOL_VERSION = 1;

const Col = z.object({ name: z.string(), nativeType: z.string(), kind: z.string() });
const Cell = z.nullable(z.string());

export const HostToWebview = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("start"), title: z.string(), sql: z.string(), columns: z.array(Col), editable: z.optional(z.boolean()) }),
  z.object({ v: z.literal(1), type: z.literal("rows"), rows: z.array(z.array(Cell)) }),
  z.object({ v: z.literal(1), type: z.literal("done"), rowCount: z.number(), affectedRows: z.optional(z.number()), durationMs: z.number(), truncated: z.boolean() }),
  z.object({ v: z.literal(1), type: z.literal("error"), kind: z.string(), message: z.string(), position: z.optional(z.number()) }),
  z.object({
    v: z.literal(1), type: z.literal("pending"),
    sets: z.array(z.object({ row: z.number(), col: z.number(), text: Cell })),
    deletes: z.array(z.number()),
    inserts: z.array(z.array(z.object({ set: z.boolean(), text: Cell }))),
    count: z.number(), canUndo: z.boolean(), canRedo: z.boolean(),
  }),
  z.object({ v: z.literal(1), type: z.literal("notice"), level: z.enum(["error", "info"]), text: z.string() }),
]);
export type HostToWebview = z.infer<typeof HostToWebview>;

export const WebviewToHost = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("cancel") }),
  z.object({ v: z.literal(1), type: z.literal("edit"), row: z.number(), col: z.number(), text: Cell }),
  z.object({ v: z.literal(1), type: z.literal("toggleDelete"), row: z.number() }),
  z.object({ v: z.literal(1), type: z.enum(["insertRow", "undo", "redo", "review", "apply", "discard"]) }),
  z.object({ v: z.literal(1), type: z.literal("copy"), text: z.string().check(z.maxLength(5_000_000)) }),
]);
export type WebviewToHost = z.infer<typeof WebviewToHost>;
