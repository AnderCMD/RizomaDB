import { z } from "zod";

export const Environment = z.enum(["dev", "staging", "prod"]).or(z.string().regex(/^[a-z0-9-]{1,24}$/));

/** Profile as stored on disk / shared: never contains secret values. */
export const ConnectionProfile = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  driver: z.string().min(1),
  environment: Environment.default("dev"),
  readOnly: z.boolean().default(false),
  /** Non-secret driver options (host, port, database, path...). May use ${env:VAR}. */
  options: z.record(z.string(), z.unknown()).default({}),
  /** Option keys whose values live in the secret store, never here. */
  secretKeys: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});
export type ConnectionProfile = z.infer<typeof ConnectionProfile>;

export function parseProfile(input: unknown): ConnectionProfile {
  return ConnectionProfile.parse(input);
}
