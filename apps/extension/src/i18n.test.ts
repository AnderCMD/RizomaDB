import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : []; });
const strings = new Set<string>();
for (const f of walk(join(process.cwd(), "src"))) for (const m of readFileSync(f, "utf8").matchAll(/\b(?:t|vscode\.l10n\.t)\(\s*("(?:[^"\\]|\\.)*")/g)) { try { strings.add(JSON.parse(m[1]!) as string); } catch { /* template literal etc. */ } }
const nls = (f: string) => JSON.parse(readFileSync(join(process.cwd(), f), "utf8")) as Record<string, string>;
const ph = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join();
const LANGS = [{ name: "Spanish", bundle: "bundle.l10n.es.json", manifest: "package.nls.es.json" }, { name: "Portuguese (Brazil)", bundle: "bundle.l10n.pt-br.json", manifest: "package.nls.pt-br.json" }, { name: "French", bundle: "bundle.l10n.fr.json", manifest: "package.nls.fr.json" }];

for (const L of LANGS) describe(`${L.name} translation`, () => {
  const es = JSON.parse(readFileSync(join(process.cwd(), "l10n", L.bundle), "utf8")) as Record<string, string>;
  it("covers every UI string in the code", () => { expect([...strings].filter((s) => !(s in es))).toEqual([]); });
  it("keeps every placeholder", () => { expect(Object.entries(es).filter(([k, v]) => ph(k) !== ph(v)).map(([k]) => k)).toEqual([]); });
  it("has no stale entries or untranslated copies of long sentences", () => {
    expect(Object.keys(es).filter((k) => !strings.has(k))).toEqual([]);
    expect(Object.entries(es).filter(([k, v]) => k === v && k.length > 40).map(([k]) => k)).toEqual([]);
  });
  it("translates the manifest (commands, settings, views) to the same keys as English", () => {
    const en = nls("package.nls.json"), sp = nls(L.manifest);
    expect(Object.keys(en).filter((k) => !(k in sp))).toEqual([]);
    expect(Object.keys(sp).filter((k) => !(k in en))).toEqual([]);
    expect(Object.entries(sp).filter(([k, v]) => v === en[k] && v.length > 25).map(([k]) => k)).toEqual([]);
    for (const [k, v] of Object.entries(sp)) expect(ph(v), k).toBe(ph(en[k]!));
  });
});

describe("manifest", () => {
  it("uses only keys that exist in the manifest", () => {
    const pkg = readFileSync(join(process.cwd(), "package.json"), "utf8");
    const en = nls("package.nls.json");
    for (const m of pkg.matchAll(/"%([^%"]+)%"/g)) expect(m[1]! in en, m[1]).toBe(true);
  });
});
