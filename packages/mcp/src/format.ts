import type { Value } from "@rizomadb/driver-api";

/** JSON-safe text for a normalized value. */
export function formatValue(v: Value): string | number | boolean | null {
  if (v === null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return `<${v.length} bytes>`;
  return JSON.stringify(Array.isArray(v) ? v : (v as { json: unknown }).json, (_, x) => (typeof x === "bigint" ? x.toString() : x));
}
