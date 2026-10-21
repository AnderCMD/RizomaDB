import { z } from "zod";
import { assessStatement, type Assessment, type Decision, type Risk } from "./policy.js";

const Statement = z.enum(["select", "insert", "update", "delete", "merge", "create", "alter", "drop", "truncate", "grant", "revoke", "execute"]);
export type StatementKind = z.infer<typeof Statement>;

const EnvRule = z.object({
  /** Writes are blocked outright. */
  readOnly: z.boolean().optional(),
  /** Only these statement kinds may run (intersection across layers). */
  allow: z.array(Statement).optional(),
  /** These statement kinds never run (union across layers). */
  deny: z.array(Statement).optional(),
  /** The user must type this text (or the connection name when `true`) before a write runs. */
  requireApproval: z.boolean().optional(),
  confirmDestructive: z.boolean().optional(),
  /** Ask before every write, not just destructive ones. */
  confirmWrites: z.boolean().optional(),
  maxRows: z.number().int().positive().optional(),
  timeoutSeconds: z.number().int().positive().optional(),
});
export type EnvRule = z.infer<typeof EnvRule>;

export const PolicyFile = z.object({
  version: z.literal(1),
  environments: z.record(z.string(), EnvRule).default({}),
  /** Apply to every environment. */
  defaults: EnvRule.optional(),
  disable: z.array(z.enum(["ai", "export", "import", "backup", "restore", "dataSync", "designer", "admin"])).default([]),
  maskColumns: z.array(z.object({ column: z.string(), rule: z.enum(["redact", "nullify", "hash", "last4"]) })).default([]),
  audit: z.object({ enabled: z.boolean().optional(), includeValues: z.boolean().optional() }).optional(),
});
export type PolicyFile = z.infer<typeof PolicyFile>;

export interface EffectivePolicy {
  environments: Record<string, EnvRule>;
  defaults: EnvRule;
  disable: Set<string>;
  maskColumns: { column: string; rule: "redact" | "nullify" | "hash" | "last4" }[];
  audit: { enabled: boolean; includeValues: boolean };
}

export const builtInPolicy: PolicyFile = { version: 1, environments: { prod: { readOnly: true, confirmDestructive: true, confirmWrites: true }, staging: { confirmDestructive: true, confirmWrites: true } }, disable: [], maskColumns: [] };

export function parsePolicy(text: string): PolicyFile {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch (e) { throw new Error(`Policy is not valid JSON: ${(e as Error).message}`, { cause: e }); }
  const r = PolicyFile.safeParse(raw);
  if (!r.success) throw new Error(`Invalid policy: ${r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
  return r.data;
}

const minOf = (a?: number, b?: number) => (a === undefined ? b : b === undefined ? a : Math.min(a, b));
const union = <T,>(a?: T[], b?: T[]) => (a || b ? [...new Set([...(a ?? []), ...(b ?? [])])] : undefined);
const inter = <T,>(a?: T[], b?: T[]) => (a && b ? a.filter((x) => b.includes(x)) : a ?? b);

function mergeRule(a: EnvRule = {}, b: EnvRule = {}): EnvRule {
  const out: EnvRule = {};
  const ro = a.readOnly || b.readOnly; if (ro !== undefined) out.readOnly = ro;
  const ap = a.requireApproval || b.requireApproval; if (ap !== undefined) out.requireApproval = ap;
  // confirmations: any layer asking for them wins; they are only off if every layer that speaks says so
  const cd = a.confirmDestructive === true || b.confirmDestructive === true ? true : a.confirmDestructive ?? b.confirmDestructive; if (cd !== undefined) out.confirmDestructive = cd;
  const cw = a.confirmWrites || b.confirmWrites; if (cw !== undefined) out.confirmWrites = cw;
  const allow = inter(a.allow, b.allow); if (allow) out.allow = allow;
  const deny = union(a.deny, b.deny); if (deny) out.deny = deny;
  const mr = minOf(a.maxRows, b.maxRows); if (mr !== undefined) out.maxRows = mr;
  const to = minOf(a.timeoutSeconds, b.timeoutSeconds); if (to !== undefined) out.timeoutSeconds = to;
  return out;
}

/**
 * Layers are merged so a lower layer can only make things stricter: booleans OR, limits take the minimum,
 * deny lists union, allow lists intersect. Order of layers does not matter, so no layer can relax another.
 */
export function mergePolicies(...layers: PolicyFile[]): EffectivePolicy {
  const out: EffectivePolicy = { environments: {}, defaults: {}, disable: new Set(), maskColumns: [], audit: { enabled: true, includeValues: false } };
  for (const l of layers) {
    out.defaults = mergeRule(out.defaults, l.defaults);
    for (const [env, rule] of Object.entries(l.environments)) out.environments[env] = mergeRule(out.environments[env], rule);
    l.disable.forEach((d) => out.disable.add(d));
    for (const m of l.maskColumns) if (!out.maskColumns.some((x) => x.column === m.column && x.rule === m.rule)) out.maskColumns.push(m);
    // audit can be turned on or value-logging off by any layer, never the reverse
    if (l.audit?.enabled === false && layers.length === 1) out.audit.enabled = false;
    if (l.audit?.includeValues === true && layers.length === 1) out.audit.includeValues = true;
  }
  return out;
}

export const ruleFor = (p: EffectivePolicy, environment: string): EnvRule => mergeRule(p.defaults, p.environments[environment]);

export function statementKind(sql: string): StatementKind | undefined {
  const m = /^\s*(?:\/\*[\s\S]*?\*\/\s*|--[^\n]*\n\s*)*(with|select|insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|exec|execute|call|show|explain|describe|values|pragma|set|use)\b/i.exec(sql);
  const w = m?.[1]?.toLowerCase();
  if (!w) return undefined;
  if (w === "with") { const body = assessStatement(sql); return body.risk === "none" ? "select" : /\bdelete\b/i.test(sql) ? "delete" : /\bupdate\b/i.test(sql) ? "update" : /\binsert\b/i.test(sql) ? "insert" : "select"; }
  if (["select", "show", "explain", "describe", "values", "pragma", "use"].includes(w)) return "select";
  if (w === "exec" || w === "execute" || w === "call") return "execute";
  if (w === "set") return undefined;
  return w as StatementKind;
}

export interface PolicyContext { environment: string; readOnly: boolean }
export interface EffectiveDecision extends Decision { needsApproval?: boolean; /** 'policy' confirmations cannot be switched off by a user preference */ confirmSource?: "destructive" | "policy"; maxRows?: number; timeoutSeconds?: number }

/** One decision function for every write path. `assess` lets non-SQL engines classify their own commands. */
export function decideEffective(sql: string, ctx: PolicyContext, policy: EffectivePolicy, assess: (s: string) => Assessment = assessStatement): EffectiveDecision {
  const rule = ruleFor(policy, ctx.environment);
  const a = assess(sql);
  const limits = { ...(rule.maxRows !== undefined ? { maxRows: rule.maxRows } : {}), ...(rule.timeoutSeconds !== undefined ? { timeoutSeconds: rule.timeoutSeconds } : {}) };
  if (a.risk === "none") {
    const kind = statementKind(sql);
    if (kind === "select" && rule.deny?.includes("select")) return { allowed: false, needsConfirmation: false, reason: `Reading is disabled by policy for '${ctx.environment}'`, ...limits };
    return { allowed: true, needsConfirmation: false, ...limits };
  }
  if (ctx.readOnly) return { allowed: false, needsConfirmation: false, reason: "Connection is read-only", ...limits };
  if (rule.readOnly) return { allowed: false, needsConfirmation: false, reason: `Environment '${ctx.environment}' is read-only by policy`, ...limits };
  const kind = statementKind(sql);
  if (kind && rule.deny?.includes(kind)) return { allowed: false, needsConfirmation: false, reason: `${kind.toUpperCase()} statements are denied by policy for '${ctx.environment}'`, ...limits };
  if (rule.allow && (!kind || !rule.allow.includes(kind))) return { allowed: false, needsConfirmation: false, reason: `Only ${rule.allow.map((x) => x.toUpperCase()).join(", ")} statements are allowed by policy for '${ctx.environment}'`, ...limits };
  const destructive = a.risk === ("destructive" as Risk);
  const needsApproval = !!rule.requireApproval;
  const needsConfirmation = needsApproval || (destructive ? rule.confirmDestructive !== false : !!rule.confirmWrites);
  return { allowed: true, needsConfirmation, ...(needsConfirmation ? { confirmSource: needsApproval || (!destructive && rule.confirmWrites) ? ("policy" as const) : ("destructive" as const) } : {}), ...(needsApproval ? { needsApproval: true } : {}), ...(needsConfirmation ? { reason: a.reasons.join("; ") || "Statement modifies data" } : {}), ...limits };
}

export const defaultEffectivePolicy: EffectivePolicy = mergePolicies(builtInPolicy);

export function featureEnabled(p: EffectivePolicy, feature: string): boolean { return !p.disable.has(feature); }
