export const QUERY_LANGUAGES = ["sql", "rizomadb-mongo", "rizomadb-redis", "rizomadb-es", "rizomadb-cypher"] as const;
export const isQueryLanguage = (id: string) => (QUERY_LANGUAGES as readonly string[]).includes(id);

/**
 * The command to run at a cursor for line-oriented engines:
 *  - redis: the current non-comment line
 *  - mongo: the blank-line-delimited block containing the cursor
 */
export function commandAt(language: string, text: string, offset: number): string | undefined {
  const lines = text.split("\n");
  let pos = 0, idx = 0;
  for (; idx < lines.length; idx++) { if (offset <= pos + lines[idx]!.length) break; pos += lines[idx]!.length + 1; }
  idx = Math.min(idx, lines.length - 1);
  if (language === "rizomadb-cypher") return cypherStatementAt(text, offset);
  if (language === "rizomadb-redis") {
    for (const i of [idx, ...Array.from({ length: idx }, (_, k) => idx - 1 - k)]) { const l = lines[i]!.trim(); if (l && !l.startsWith("#")) return l; }
    return undefined;
  }
  // Mongo shell and Elasticsearch console requests are blank-line separated blocks.
  let a = idx, b = idx;
  if (!lines[idx]!.trim()) { while (a > 0 && !lines[a]!.trim()) a--; b = a; }
  while (a > 0 && lines[a - 1]!.trim()) a--;
  while (b < lines.length - 1 && lines[b + 1]!.trim()) b++;
  const block = lines.slice(a, b + 1).filter((l) => !/^\s*\/\//.test(l)).join("\n").trim();
  return block || undefined;
}

/** The `;`-terminated Cypher statement containing the cursor (semicolons inside strings, backticks and comments do not split). */
function cypherStatementAt(text: string, offset: number): string | undefined {
  const ranges: [number, number][] = [];
  let start = 0, i = 0;
  while (i < text.length) {
    const c = text[i]!, n = text[i + 1];
    if (c === "/" && n === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { const e = text.indexOf("*/", i + 2); i = e < 0 ? text.length : e + 2; continue; }
    if (c === "'" || c === '"' || c === "`") { const q = c; i++; while (i < text.length && text[i] !== q) { if (text[i] === "\\" && q !== "`") i++; i++; } i++; continue; }
    if (c === ";") { ranges.push([start, i]); start = i + 1; }
    i++;
  }
  ranges.push([start, text.length]);
  const hit = ranges.find(([a, b]) => offset >= a && offset <= b + 1) ?? ranges[ranges.length - 1]!;
  const body = text.slice(hit[0], hit[1]).trim();
  if (body) return body;
  // Cursor on whitespace after a terminator: fall back to the nearest previous non-empty statement.
  const prev = [...ranges].reverse().find(([a, b]) => b <= hit[0] && text.slice(a, b).trim());
  return prev ? text.slice(prev[0], prev[1]).trim() : undefined;
}
