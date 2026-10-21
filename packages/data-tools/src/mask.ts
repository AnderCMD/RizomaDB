import { createHash } from "node:crypto";
import type { Value } from "@rizomadb/driver-api";

export type MaskRule = "redact" | "nullify" | "hash" | "last4";
export interface MaskSpec { /** Exact column name (case-insensitive) or /regex/. */ column: string; rule: MaskRule }

const test = (spec: string, name: string) => {
  const m = /^\/(.+)\/([a-z]*)$/.exec(spec);
  return m ? new RegExp(m[1]!, m[2]).test(name) : spec.toLowerCase() === name.toLowerCase();
};

export function maskFor(specs: MaskSpec[] | undefined, columns: string[]): ((row: Value[]) => Value[]) | undefined {
  if (!specs?.length) return undefined;
  const rules = columns.map((c) => specs.find((s) => test(s.column, c))?.rule);
  if (rules.every((r) => !r)) return undefined;
  return (row) => row.map((v, i) => {
    const r = rules[i];
    if (!r || v === null) return v;
    const s = typeof v === "string" ? v : String(v instanceof Date ? v.toISOString() : v instanceof Uint8Array ? "binary" : typeof v === "object" ? JSON.stringify(v) : v);
    if (r === "nullify") return null;
    if (r === "redact") return "***";
    if (r === "hash") return createHash("sha256").update(s).digest("hex").slice(0, 16);
    return s.length <= 4 ? "****" : "*".repeat(s.length - 4) + s.slice(-4);
  });
}
