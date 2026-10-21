export interface Policy {
  /** Environments that are forced read-only regardless of the profile. */
  readOnlyEnvironments: string[];
  /** Environments that need an extra confirmation for write statements. */
  confirmEnvironments: string[];
  maxRows?: number;
}

export const defaultPolicy: Policy = { readOnlyEnvironments: ["prod"], confirmEnvironments: ["prod", "staging"] };

export type Risk = "none" | "write" | "destructive";

export interface Assessment { risk: Risk; reasons: string[] }

/** Strips comments and string literals so keyword scanning is not fooled by them. */
export function stripNoise(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""');
}

export function assessStatement(sql: string): Assessment {
  const s = stripNoise(sql).trim().replace(/;+\s*$/, "").toLowerCase();
  const reasons: string[] = [];
  const first = /^\s*([a-z]+)/.exec(s)?.[1] ?? "";
  const writes = /\b(insert|update|delete|merge|drop|truncate|alter|create|grant|revoke)\b/.test(s);
  if (/^(select|show|explain|describe|values|with|pragma)$/.test(first) && !writes) return { risk: "none", reasons };
  let risk: Risk = "write";
  if (/\b(drop|truncate)\b/.test(s)) { risk = "destructive"; reasons.push("DROP/TRUNCATE removes objects or all rows"); }
  if (/\b(update|delete)\b/.test(s) && !/\bwhere\b/.test(s)) { risk = "destructive"; reasons.push("UPDATE/DELETE without WHERE affects every row"); }
  if (risk === "write") reasons.push("Statement modifies data or schema");
  return { risk, reasons };
}

export interface Decision { allowed: boolean; needsConfirmation: boolean; reason?: string }

export function decide(sql: string, ctx: { environment: string; readOnly: boolean }, policy: Policy = defaultPolicy, assess: (s: string) => Assessment = assessStatement): Decision {
  const a = assess(sql);
  const forcedRO = ctx.readOnly || policy.readOnlyEnvironments.includes(ctx.environment);
  if (a.risk !== "none" && forcedRO) {
    return { allowed: false, needsConfirmation: false, reason: ctx.readOnly ? "Connection is read-only" : `Environment '${ctx.environment}' is read-only by policy` };
  }
  const confirm = a.risk === "destructive" || (a.risk === "write" && policy.confirmEnvironments.includes(ctx.environment));
  return { allowed: true, needsConfirmation: confirm, ...(confirm ? { reason: a.reasons.join("; ") } : {}) };
}
