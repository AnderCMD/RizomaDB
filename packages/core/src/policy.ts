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

const READ_PRAGMAS = /^pragma\s+(table_info|table_xinfo|table_list|index_list|index_info|index_xinfo|foreign_key_list|database_list|compile_options|integrity_check|quick_check|collation_list|function_list|schema_version|user_version|page_count|page_size|freelist_count|encoding)\b\s*(\([^)]*\))?\s*$/;
// Anything that can change data, schema, privileges, files, sessions or server state.
// Words like `comment`, `replace()`, `set` or `copy` are common column/function names, so they only count when they START a statement
// (which the default-deny first-word rule already covers); the words below are never legitimate inside a read.
const WRITE_WORDS = /\b(insert|update|delete|merge|drop|truncate|alter|create|grant|revoke|attach|detach|vacuum|reindex)\b/;

/**
 * Default-deny classification: a statement is a read only if it starts with a known read keyword and
 * contains nothing that could write. Unknown shapes count as writes so they can never slip past read-only guards.
 */
export function assessStatement(sql: string): Assessment {
  const s = stripNoise(sql).trim().replace(/;+\s*$/, "").toLowerCase();
  const reasons: string[] = [];
  if (/^vacuum\s+into\b/.test(s)) return { risk: "none", reasons }; // writes a copy of the database to a file, not to the database
  const first = /^\s*([a-z]+)/.exec(s)?.[1] ?? "";
  if (first === "pragma") return READ_PRAGMAS.test(s) ? { risk: "none", reasons } : { risk: "write", reasons: ["This PRAGMA can change database settings"] };
  const readsOnly = /^(select|show|explain|describe|desc|values|table|with)$/.test(first);
  // SELECT ... INTO creates or fills something; `into @var` / `into outfile` too
  const selectInto = /\bselect\b[\s\S]*\binto\b/.test(s) && !/^insert\b/.test(s);
  if (readsOnly && !WRITE_WORDS.test(s.replace(/\b(on conflict|do nothing)\b/g, "")) && !selectInto) return { risk: "none", reasons };
  let risk: Risk = "write";
  if (/\b(drop|truncate)\b/.test(s)) { risk = "destructive"; reasons.push("DROP/TRUNCATE removes objects or all rows"); }
  if (/\b(update|delete)\b/.test(s) && !/\bwhere\b/.test(s)) { risk = "destructive"; reasons.push("UPDATE/DELETE without WHERE affects every row"); }
  if (risk === "write") reasons.push(readsOnly ? "Statement may modify data or schema" : "Statement modifies data, schema, settings or the server");
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
