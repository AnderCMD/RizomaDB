import { onlyComments, splitStatements, type SplitOptions, type Statement } from "./splitter.js";

const lineOffsets = (text: string) => { const o = [0]; for (let i = 0; i < text.length; i++) if (text[i] === "\n") o.push(i + 1); return o; };
const lineEnd = (text: string, start: number) => { const e = text.indexOf("\n", start); return e < 0 ? text.length : e; };
const trimmed = (text: string, a: number, b: number): Statement | undefined => {
  const raw = text.slice(a, b), lead = raw.length - raw.trimStart().length, body = raw.trim();
  return body ? { text: body, start: a + lead, end: a + lead + body.length } : undefined;
};

/** Cypher: `;`-terminated statements; semicolons inside strings, backticks and comments do not split. */
function cypherRanges(text: string, max = Infinity): Statement[] {
  const out: Statement[] = []; let start = 0, i = 0;
  const push = (end: number) => { const s = trimmed(text, start, end); if (s && !onlyComments(s.text, "//")) out.push(s); };
  while (i < text.length && out.length < max) {
    const c = text[i]!, n = text[i + 1];
    if (c === "/" && n === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { const e = text.indexOf("*/", i + 2); i = e < 0 ? text.length : e + 2; continue; }
    if (c === "'" || c === '"' || c === "`") { const q = c; i++; while (i < text.length && text[i] !== q) { if (text[i] === "\\" && q !== "`") i++; i++; } i++; continue; }
    if (c === ";") { push(i); start = i + 1; }
    i++;
  }
  if (out.length < max) push(text.length);
  return out;
}

/** Redis: one command per non-empty line; `#` starts a comment line. */
function redisRanges(text: string): Statement[] {
  const out: Statement[] = [];
  for (const a of lineOffsets(text)) { const s = trimmed(text, a, lineEnd(text, a)); if (s && !s.text.startsWith("#")) out.push(s); }
  return out;
}

/** Mongo shell and search-engine consoles: requests are blocks separated by blank lines; `//` lines are comments. */
function blockRanges(text: string): Statement[] {
  const out: Statement[] = []; let blockStart = -1, blockEnd = -1;
  const flush = () => {
    if (blockStart < 0) return;
    const s = trimmed(text, blockStart, blockEnd);
    if (s && s.text.split("\n").some((l) => l.trim() && !/^\s*\/\//.test(l))) out.push(s);
    blockStart = -1;
  };
  for (const a of lineOffsets(text)) {
    const e = lineEnd(text, a);
    if (!text.slice(a, e).trim()) { flush(); continue; }
    if (blockStart < 0) blockStart = a;
    blockEnd = e;
  }
  flush();
  return out;
}

/** Where each runnable statement of a query editor starts and ends, for the language the editor uses. */
export function statementRanges(languageId: string, text: string, opts: SplitOptions = {}): Statement[] {
  const max = opts.maxStatements ?? Infinity;
  switch (languageId) {
    case "sql": return splitStatements(text, opts);
    case "rizomadb-cypher": return cypherRanges(text, max);
    case "rizomadb-redis": return redisRanges(text);
    case "rizomadb-mongo": case "rizomadb-es": return blockRanges(text);
    default: return [];
  }
}

interface Cached { version: number; languageId: string; max: number; ranges: Statement[]; complete: boolean }
const cache = new WeakMap<object, Cached>();

/**
 * `statementRanges` memoised per document and `version`/`languageId`, so moving the cursor does not re-parse an unchanged
 * document. The WeakMap holds no reference to a closed document. A parse stopped early by `maxStatements` serves any
 * smaller limit and is redone only for a larger one.
 */
export function cachedStatementRanges(doc: { version: number; languageId: string; getText(): string }, opts: SplitOptions = {}): Statement[] {
  const max = opts.maxStatements ?? Infinity, hit = cache.get(doc);
  if (hit && hit.version === doc.version && hit.languageId === doc.languageId && (hit.complete || max <= hit.max)) return hit.ranges.length > max ? hit.ranges.slice(0, max) : hit.ranges;
  const ranges = statementRanges(doc.languageId, doc.getText(), opts);
  cache.set(doc, { version: doc.version, languageId: doc.languageId, max, ranges, complete: ranges.length < max });
  return ranges;
}
