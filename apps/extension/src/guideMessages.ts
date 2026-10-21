import * as z from "zod/mini";

export const GuideToHost = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("ready") }),
  z.object({ v: z.literal(1), type: z.literal("visit"), id: z.string().check(z.minLength(1), z.maxLength(40)) }),
  z.object({ v: z.literal(1), type: z.literal("action"), id: z.string().check(z.minLength(1), z.maxLength(40)) }),
  z.object({ v: z.literal(1), type: z.literal("reset") }),
]);

export const HostToGuide = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("load"), current: z.string(), done: z.array(z.string()), steps: z.array(z.object({
    id: z.string(), icon: z.string(), title: z.string(), lead: z.string(), points: z.array(z.string()), tip: z.optional(z.string()),
    actions: z.array(z.object({ id: z.string(), label: z.string(), icon: z.string() })),
  })) }),
]);
