export const BUILTIN_ENVIRONMENTS = ["dev", "staging", "prod"] as const;
export type Protection = "none" | "confirm" | "readOnly";
export interface CustomEnvironment { name: string; protection: Protection }

export const ENV_NAME = /^[a-z0-9-]{1,24}$/;

/** The environments the user added in settings (valid, not built-in, one entry per name). */
export function customEnvironments(raw: unknown): CustomEnvironment[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>(BUILTIN_ENVIRONMENTS);
  const out: CustomEnvironment[] = [];
  for (const x of raw as { name?: unknown; protection?: unknown }[]) {
    const name = typeof x?.name === "string" ? x.name.trim().toLowerCase() : "";
    if (!ENV_NAME.test(name) || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, protection: x.protection === "readOnly" || x.protection === "confirm" ? x.protection : "none" });
  }
  return out;
}

/** A policy layer for those environments: "confirm" asks before every write, "readOnly" blocks writes. Layers can only add strictness. */
export function customEnvironmentPolicy(raw: unknown): unknown {
  const environments: Record<string, { readOnly?: boolean; confirmDestructive?: boolean; confirmWrites?: boolean }> = {};
  for (const e of customEnvironments(raw)) {
    if (e.protection === "confirm") environments[e.name] = { confirmDestructive: true, confirmWrites: true };
    else if (e.protection === "readOnly") environments[e.name] = { readOnly: true, confirmDestructive: true, confirmWrites: true };
  }
  return Object.keys(environments).length ? { version: 1, environments } : undefined;
}
