import * as z from "zod/mini";

export const DesignTable = z.object({
  name: z.string().check(z.minLength(1), z.maxLength(128)),
  columns: z.array(z.object({
    name: z.string().check(z.minLength(1), z.maxLength(128)), type: z.string().check(z.minLength(1), z.maxLength(100)), nullable: z.boolean(),
    default: z.optional(z.string().check(z.maxLength(500))), identity: z.optional(z.boolean()),
  })).check(z.minLength(1), z.maxLength(1024)),
  primaryKey: z.array(z.string()),
  indexes: z.array(z.object({ name: z.string().check(z.minLength(1)), columns: z.array(z.string()).check(z.minLength(1)), unique: z.boolean() })),
  foreignKeys: z.array(z.object({ name: z.string().check(z.minLength(1)), columns: z.array(z.string()).check(z.minLength(1)), refTable: z.string().check(z.minLength(1)), refColumns: z.array(z.string()).check(z.minLength(1)) })),
});
export type DesignTable = z.infer<typeof DesignTable>;

export const DesignerToHost = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("preview"), table: DesignTable }),
  z.object({ v: z.literal(1), type: z.literal("apply"), table: DesignTable }),
]);

export const HostToDesigner = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("load"), engine: z.string(), types: z.array(z.string()), existing: z.boolean(), table: DesignTable }),
  z.object({ v: z.literal(1), type: z.literal("ddl"), statements: z.array(z.object({ sql: z.string(), destructive: z.optional(z.string()), manual: z.optional(z.string()) })), error: z.optional(z.string()) }),
  z.object({ v: z.literal(1), type: z.literal("result"), ok: z.boolean(), message: z.string() }),
]);
