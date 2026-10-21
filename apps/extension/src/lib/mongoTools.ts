/** Pure helpers behind the MongoDB commands (kept free of VS Code so they can be tested). */

export interface FieldStat { path: string; types: Record<string, number>; present: number }

const typeOf = (v: unknown): string => (v === null ? "null" : Array.isArray(v) ? "array" : v instanceof Date ? "date" : typeof v === "object" && v && "$oid" in v ? "objectId" : typeof v === "number" ? (Number.isInteger(v) ? "int" : "double") : typeof v);

/** Walks sampled documents (relaxed JSON) and counts field presence and types, descending into sub-documents and arrays of documents. */
export function analyzeDocuments(docs: Record<string, unknown>[], maxDepth = 4): { sampled: number; fields: FieldStat[] } {
  const stats = new Map<string, FieldStat>();
  const visit = (v: unknown, path: string, depth: number, seen: Set<string>) => {
    const s = stats.get(path) ?? { path, types: {}, present: 0 };
    const t = typeOf(v); s.types[t] = (s.types[t] ?? 0) + 1;
    if (!seen.has(path)) { s.present++; seen.add(path); }
    stats.set(path, s);
    if (depth >= maxDepth) return;
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && !("$oid" in (v as object))) for (const [k, x] of Object.entries(v as object)) visit(x, `${path}.${k}`, depth + 1, seen);
    else if (Array.isArray(v)) for (const x of v) if (x && typeof x === "object" && !Array.isArray(x)) for (const [k, y] of Object.entries(x as object)) visit(y, `${path}[].${k}`, depth + 1, seen);
  };
  for (const d of docs) { const seen = new Set<string>(); for (const [k, v] of Object.entries(d)) visit(v, k, 1, seen); }
  return { sampled: docs.length, fields: [...stats.values()].sort((a, b) => b.present - a.present || (a.path < b.path ? -1 : 1)) };
}

export function analysisMarkdown(name: string, a: { sampled: number; fields: FieldStat[] }): string {
  const rows = a.fields.map((f) => `| \`${f.path}\` | ${Math.round((f.present / Math.max(1, a.sampled)) * 100)}% | ${Object.entries(f.types).sort((x, y) => y[1] - x[1]).map(([t, n]) => `${t} (${n})`).join(", ")} |`);
  return `# Schema analysis: ${name}\n\nSampled ${a.sampled} documents.\n\n| Field | Present in | Types (occurrences) |\n|---|---|---|\n${rows.join("\n")}\n`;
}

/** Splits `db.c.aggregate([ ... ])` into its stages' source text so prefixes of the pipeline can be previewed. */
export function pipelineStages(command: string): { head: string; stages: string[] } | undefined {
  const m = /^([\s\S]*?\.aggregate\(\s*)\[/.exec(command);
  if (!m) return undefined;
  const start = m[0].length;
  const stages: string[] = []; let depth = 0, i = start, from = start, str: string | undefined;
  for (; i < command.length; i++) {
    const c = command[i]!;
    if (str) { if (c === "\\") i++; else if (c === str) str = undefined; continue; }
    if (c === '"' || c === "'") { str = c; continue; }
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === ")") depth--;
    else if (c === "]") { if (depth === 0) { const s = command.slice(from, i).trim(); if (s) stages.push(s); return { head: m[1]!, stages }; } depth--; }
    else if (c === "," && depth === 0) { const s = command.slice(from, i).trim(); if (s) stages.push(s); from = i + 1; }
  }
  return undefined;
}

export const pipelinePrefix = (head: string, stages: string[], n: number, limit: number) => `${head}[${[...stages.slice(0, n), `{ "$limit": ${limit} }`].join(", ")}])`;
