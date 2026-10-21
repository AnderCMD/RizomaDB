export const QUERY_LANGUAGES = ["sql", "rizomadb-mongo", "rizomadb-redis"] as const;
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
  if (language === "rizomadb-redis") {
    for (const i of [idx, ...Array.from({ length: idx }, (_, k) => idx - 1 - k)]) { const l = lines[i]!.trim(); if (l && !l.startsWith("#")) return l; }
    return undefined;
  }
  let a = idx, b = idx;
  if (!lines[idx]!.trim()) { while (a > 0 && !lines[a]!.trim()) a--; b = a; }
  while (a > 0 && lines[a - 1]!.trim()) a--;
  while (b < lines.length - 1 && lines[b + 1]!.trim()) b++;
  const block = lines.slice(a, b + 1).filter((l) => !/^\s*\/\//.test(l)).join("\n").trim();
  return block || undefined;
}
