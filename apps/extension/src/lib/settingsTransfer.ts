/** Export and import of RizomaDB's user settings as a small JSON file. Only keys the extension contributes are ever read or written. */
export interface SettingSpec { type?: string; enum?: string[]; minimum?: number }

export const EXPORT_FORMAT = "rizomadb-settings";

export function buildExport(values: Record<string, unknown>) {
  return { format: EXPORT_FORMAT, version: 1, settings: values };
}

/** True when `value` is acceptable for the contributed setting. */
export function validSetting(spec: SettingSpec, value: unknown): boolean {
  if (spec.enum) return typeof value === "string" && spec.enum.includes(value);
  switch (spec.type) {
    case "boolean": return typeof value === "boolean";
    case "number": case "integer": return typeof value === "number" && Number.isFinite(value) && (spec.minimum === undefined || value >= spec.minimum) && (spec.type !== "integer" || Number.isInteger(value));
    case "string": return typeof value === "string" && value.length <= 2000;
    case "array": return Array.isArray(value);
    case "object": return typeof value === "object" && value !== null && !Array.isArray(value);
    default: return false;
  }
}

export interface ImportResult { accepted: Record<string, unknown>; rejected: string[] }

/** Parses an exported file: unknown keys, wrong types and out-of-range values are rejected one by one, never applied. */
export function parseImport(text: string, specs: Record<string, SettingSpec>): ImportResult {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error("not-json"); }
  const settings = (data as { format?: unknown; settings?: unknown } | null)?.settings;
  if (typeof data !== "object" || data === null || (data as { format?: unknown }).format !== EXPORT_FORMAT || typeof settings !== "object" || settings === null || Array.isArray(settings)) throw new Error("not-settings");
  const accepted: Record<string, unknown> = {}, rejected: string[] = [];
  for (const [key, value] of Object.entries(settings as Record<string, unknown>)) {
    const spec = specs[key];
    if (spec && validSetting(spec, value)) accepted[key] = value; else rejected.push(key);
  }
  return { accepted, rejected };
}
