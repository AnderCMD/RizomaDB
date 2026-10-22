import * as z from "zod/mini";

export const HistoryToHost = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("ready") }),
  z.object({ v: z.literal(1), type: z.enum(["open", "run", "copy", "star"]), i: z.number().check(z.minimum(0), z.maximum(100_000)) }),
  z.object({ v: z.literal(1), type: z.literal("clear") }),
]);

export const HostToHistory = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("load"), items: z.array(z.object({
    i: z.number(), ts: z.string(), connectionName: z.string(), environment: z.string(), status: z.string(), durationMs: z.number(), rowCount: z.number(), sql: z.string(), error: z.optional(z.string()), canRun: z.boolean(), starred: z.boolean(),
  })) }),
]);
