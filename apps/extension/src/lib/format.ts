import type { Value } from "@rizomadb/driver-api";

const MAX_CELL = 10_000;

/** Webview messages are JSON: everything becomes string | null. */
export function formatValue(v: Value): string | null {
  if (v === null) return null;
  let s: string;
  if (typeof v === "string") s = v;
  else if (typeof v === "bigint" || typeof v === "number" || typeof v === "boolean") s = String(v);
  else if (v instanceof Date) s = Number.isNaN(v.getTime()) ? "Invalid Date" : v.toISOString();
  else if (v instanceof Uint8Array) s = "\\x" + Buffer.from(v.subarray(0, 64)).toString("hex") + (v.length > 64 ? `… (${v.length} bytes)` : "");
  else if (Array.isArray(v)) s = JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));
  else s = JSON.stringify((v as { json: unknown }).json, (_, x) => (typeof x === "bigint" ? x.toString() : x));
  return s.length > MAX_CELL ? s.slice(0, MAX_CELL) + "…" : s;
}
