import * as z from "zod/mini";
import type { LogoShape } from "./engineLogos.js";

export const Shape: z.ZodMiniType<LogoShape> = z.lazy(() => z.object({ t: z.string().check(z.maxLength(20)), a: z.record(z.string().check(z.maxLength(30)), z.string().check(z.maxLength(20000))), c: z.optional(z.array(Shape).check(z.maxLength(200))) }));
const short = z.string().check(z.maxLength(2000));

export const ConnectForm = z.object({
  key: z.string().check(z.minLength(1), z.maxLength(40)),
  name: z.string().check(z.maxLength(200)),
  environment: z.string().check(z.regex(/^[a-z0-9-]{1,24}$/)),
  /** Only for an environment that does not exist yet: how much protection it gets. */
  newEnvProtection: z.optional(z.enum(["none", "confirm", "readOnly"])),
  /** Driver fields: text/number/secret as typed, booleans as checked. */
  values: z.record(z.string().check(z.maxLength(100)), z.union([short, z.boolean()])),
  via: z.enum(["none", "ssh", "http", "socks5"]),
  net: z.record(z.string().check(z.maxLength(40)), short),
  /** After a failed connection test: store the profile anyway. */
  force: z.boolean(),
});
export type ConnectForm = z.infer<typeof ConnectForm>;

export const ConnectToHost = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("ready") }),
  z.object({ v: z.literal(1), type: z.literal("pick"), key: z.string().check(z.minLength(1), z.maxLength(40)) }),
  z.object({ v: z.literal(1), type: z.literal("test"), form: ConnectForm }),
  z.object({ v: z.literal(1), type: z.literal("save"), form: ConnectForm }),
  z.object({ v: z.literal(1), type: z.literal("conn"), action: z.enum(["connect", "disconnect", "query", "readonly", "delete"]), id: z.string().check(z.minLength(1), z.maxLength(100)) }),
]);

export const HostToConnect = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("engines"), engines: z.array(z.object({ key: z.string(), name: z.string(), family: z.string(), color: z.string(), fg: z.string(), mark: z.string(), experimental: z.optional(z.boolean()), logo: z.optional(z.object({ bg: z.string(), vb: z.string().check(z.maxLength(40)), shapes: z.array(Shape).check(z.maxLength(60)), wordmark: z.optional(z.boolean()) })) })) }),
  z.object({ v: z.literal(1), type: z.literal("connections"), items: z.array(z.object({ id: z.string(), name: z.string(), engine: z.string(), environment: z.string(), readOnly: z.boolean(), connected: z.boolean(), shared: z.boolean(), target: z.string(), active: z.boolean(), database: z.string() })) }),
  z.object({ v: z.literal(1), type: z.literal("form"), key: z.string(), fields: z.array(z.object({
    key: z.string(), title: z.string(), description: z.optional(z.string()), kind: z.enum(["text", "number", "boolean"]), required: z.boolean(), secret: z.boolean(),
    value: z.union([z.string(), z.boolean()]),
  })), tunnel: z.boolean(), defaultName: z.string(), environments: z.array(z.string()) }),
  z.object({ v: z.literal(1), type: z.literal("result"), action: z.enum(["test", "save"]), ok: z.boolean(), message: z.string(), field: z.optional(z.string()), canForce: z.optional(z.boolean()) }),
]);
