#!/usr/bin/env node
// Writes one CSV per language for a native-speaker review: English, current translation, an empty "corrected" column.
// Usage: node scripts/export-translations.mjs [outDir]   (default: translation-review/)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../apps/extension/", import.meta.url).pathname;
const out = process.argv[2] ?? join(new URL("..", import.meta.url).pathname, "translation-review");
mkdirSync(out, { recursive: true });
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const english = read("package.nls.json");

for (const lang of ["pt-br", "fr"]) {
  const rows = [["source", "key", "english", "current", "corrected"]];
  for (const [en, tr] of Object.entries(read(`l10n/bundle.l10n.${lang}.json`))) rows.push(["ui", "", en, tr, ""]);
  const nls = read(`package.nls.${lang}.json`);
  for (const [k, tr] of Object.entries(nls)) rows.push(["manifest", k, english[k] ?? "", tr, ""]);
  const file = join(out, `${lang}.csv`);
  writeFileSync(file, "\uFEFF" + rows.map((r) => r.map(csv).join(",")).join("\n") + "\n");
  console.log(`${file}: ${rows.length - 1} strings`);
}
