export class ConsoleSyntaxError extends Error { constructor(message: string, readonly position = 0) { super(message); this.name = "ConsoleSyntaxError"; } }

export type Op = "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "not-in" | "array-contains" | "array-contains-any";
const OPS: Record<Op, string> = { "==": "EQUAL", "!=": "NOT_EQUAL", "<": "LESS_THAN", "<=": "LESS_THAN_OR_EQUAL", ">": "GREATER_THAN", ">=": "GREATER_THAN_OR_EQUAL", in: "IN", "not-in": "NOT_IN", "array-contains": "ARRAY_CONTAINS", "array-contains-any": "ARRAY_CONTAINS_ANY" };
export const opName = (op: string): string => { const n = OPS[op as Op]; if (!n) throw new ConsoleSyntaxError(`Unknown operator "${op}". Use one of: ${Object.keys(OPS).join(", ")}`); return n; };

export type Command =
  | { kind: "query"; from: string; group: boolean; where: [string, Op, unknown][]; orderBy: [string, "asc" | "desc"][]; limit?: number; select?: string[] }
  | { kind: "get"; path: string }
  | { kind: "collections"; path: string }
  | { kind: "set"; path: string; data: Record<string, unknown> }
  | { kind: "update"; path: string; data: Record<string, unknown> }
  | { kind: "delete"; path: string };

/** Removes // and block comments outside strings. */
export function stripComments(s: string): string {
  let out = "", i = 0, str = false;
  while (i < s.length) {
    const c = s[i]!;
    if (str) { out += c; if (c === "\\") { out += s[i + 1] ?? ""; i += 2; continue; } if (c === '"') str = false; i++; continue; }
    if (c === '"') { str = true; out += c; i++; continue; }
    if (c === "/" && s[i + 1] === "/") { while (i < s.length && s[i] !== "\n") i++; continue; }
    if (c === "/" && s[i + 1] === "*") { const e = s.indexOf("*/", i + 2); i = e < 0 ? s.length : e + 2; continue; }
    out += c; i++;
  }
  return out;
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/** Parses one JSON command object. Throws ConsoleSyntaxError with a readable message. */
export function parseCommand(text: string): Command {
  let j: unknown;
  try { j = JSON.parse(stripComments(text).replace(/,(\s*[}\]])/g, "$1")); }
  catch (e) { throw new ConsoleSyntaxError(`Not valid JSON: ${(e as Error).message}`, Number(/position (\d+)/.exec((e as Error).message)?.[1] ?? 0)); }
  if (!j || typeof j !== "object" || Array.isArray(j)) throw new ConsoleSyntaxError("A command is one JSON object, e.g. { \"from\": \"users\", \"limit\": 20 }");
  const o = j as Record<string, unknown>;
  const path = (k: string, docs: boolean) => {
    const p = o[k]; if (!isStr(p)) throw new ConsoleSyntaxError(`"${k}" must be a path string`);
    const segs = p.split("/").filter(Boolean);
    if (docs && segs.length % 2 !== 0) throw new ConsoleSyntaxError(`"${p}" is a collection path; a document path has an even number of segments (collection/doc)`);
    return segs.join("/");
  };
  const data = (): Record<string, unknown> => { if (!o.data || typeof o.data !== "object" || Array.isArray(o.data)) throw new ConsoleSyntaxError('"data" must be an object'); return o.data as Record<string, unknown>; };
  if ("get" in o) return { kind: "get", path: path("get", true) };
  if ("delete" in o) return { kind: "delete", path: path("delete", true) };
  if ("set" in o) return { kind: "set", path: path("set", true), data: data() };
  if ("update" in o) return { kind: "update", path: path("update", true), data: data() };
  if ("collections" in o) { const p = typeof o.collections === "string" ? o.collections.split("/").filter(Boolean).join("/") : ""; return { kind: "collections", path: p }; }
  const group = isStr(o.collectionGroup);
  const from = group ? o.collectionGroup as string : o.from;
  if (!isStr(from)) throw new ConsoleSyntaxError('Missing "from" (collection path) or "collectionGroup"');
  const where = (Array.isArray(o.where) ? o.where : o.where === undefined ? [] : (() => { throw new ConsoleSyntaxError('"where" must be a list of [field, operator, value]'); })()) as unknown[];
  const w = where.map((c): [string, Op, unknown] => {
    if (!Array.isArray(c) || c.length !== 3 || !isStr(c[0]) || !isStr(c[1])) throw new ConsoleSyntaxError('Each "where" entry is [field, operator, value]');
    opName(c[1]); return [c[0], c[1] as Op, c[2]];
  });
  const rawOrder = o.orderBy === undefined ? [] : Array.isArray(o.orderBy) ? o.orderBy : [o.orderBy];
  // ["field", "desc"] is one entry; [["a"], ["b", "desc"]] or ["a", ["b", "desc"]] are lists.
  const singlePair = rawOrder.length === 2 && typeof rawOrder[0] === "string" && (rawOrder[1] === "asc" || rawOrder[1] === "desc");
  const ob = (singlePair ? [rawOrder] : rawOrder).map((c): [string, "asc" | "desc"] => {
    const a = Array.isArray(c) ? c : [c]; if (!isStr(a[0])) throw new ConsoleSyntaxError('"orderBy" entries are field or [field, "asc"|"desc"]');
    if (a[1] !== undefined && a[1] !== "asc" && a[1] !== "desc") throw new ConsoleSyntaxError('Sort direction must be "asc" or "desc"');
    return [a[0], (a[1] as "asc" | "desc" | undefined) ?? "asc"];
  });
  if (o.limit !== undefined && (!Number.isInteger(o.limit) || (o.limit as number) < 1)) throw new ConsoleSyntaxError('"limit" must be a positive integer');
  const sel = o.select === undefined ? undefined : (Array.isArray(o.select) && o.select.every(isStr) ? (o.select as string[]) : (() => { throw new ConsoleSyntaxError('"select" must be a list of field names'); })());
  return { kind: "query", from: group ? from : from.split("/").filter(Boolean).join("/"), group, where: w, orderBy: ob, ...(o.limit !== undefined ? { limit: o.limit as number } : {}), ...(sel ? { select: sel } : {}) };
}

/** Default-deny: only get/query/collections are reads. */
export function assessFirestore(text: string): { risk: "none" | "write" | "destructive"; reasons: string[] } {
  let c: Command;
  try { c = parseCommand(text); } catch { return { risk: "write", reasons: ["Not a recognised command: treated as a write"] }; }
  switch (c.kind) {
    case "query": case "get": case "collections": return { risk: "none", reasons: c.kind === "query" && !c.where.length && c.limit === undefined ? ["No filter or limit: reads the whole collection (billed per document)"] : [] };
    case "delete": return { risk: "destructive", reasons: ["Deletes the document (its sub-collections remain)"] };
    default: return { risk: "write", reasons: [`${c.kind} modifies a document`] };
  }
}
