import * as z from "zod/mini";

export const SettingsToHost = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("ready") }),
  z.object({ v: z.literal(1), type: z.literal("set"), key: z.string().check(z.minLength(1), z.maxLength(100)), value: z.union([z.string().check(z.maxLength(2000)), z.number(), z.boolean()]) }),
  z.object({ v: z.literal(1), type: z.literal("reset"), key: z.string().check(z.minLength(1), z.maxLength(100)) }),
  z.object({ v: z.literal(1), type: z.literal("language") }),
  z.object({ v: z.literal(1), type: z.literal("json"), key: z.optional(z.string().check(z.maxLength(100))) }),
]);

const Item = z.object({
  key: z.string(), title: z.string(), description: z.string(), kind: z.enum(["boolean", "number", "text", "choice", "object"]),
  value: z.union([z.string(), z.number(), z.boolean()]), modified: z.boolean(),
  options: z.optional(z.array(z.string())), min: z.optional(z.number()),
});
export const HostToSettings = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("load"), language: z.string(), groups: z.array(z.object({ id: z.string(), title: z.string(), items: z.array(Item) })) }),
  z.object({ v: z.literal(1), type: z.literal("saved"), key: z.string(), ok: z.boolean(), message: z.string() }),
]);
