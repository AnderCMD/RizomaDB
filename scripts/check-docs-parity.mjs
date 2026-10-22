#!/usr/bin/env node
// Lists documentation pages that exist in English but not in Spanish, Portuguese (Brazil) or French, and the root community files.
// Usage: node scripts/check-docs-parity.mjs   (exit code 1 when something is missing)
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const ls = (d) => (existsSync(join(root, d)) ? readdirSync(join(root, d)).filter((f) => f.endsWith(".md")) : []);

// Spanish uses translated folder and file names.
const ES = {
  guides: ["guias", { "getting-started": "primeros-pasos", migration: "migracion", troubleshooting: "solucion-de-problemas", connections: "conexiones", "query-editor": "editor-de-consultas", "results-grid": "rejilla-de-resultados", keyboard: "teclado", "help-test": "ayuda-a-probar", "editing-data": "edicion-de-datos", "language-and-settings": "idioma-y-ajustes" }],
  enterprise: ["empresa", { policy: "politicas", audit: "auditoria", deployment: "despliegue", compliance: "cumplimiento" }],
  security: ["seguridad", { "threat-model": "modelo-de-amenazas", "dependency-policy": "politica-de-dependencias" }],
  drivers: ["drivers", { authoring: "crear-un-driver" }],
  reference: ["referencia", { settings: "ajustes", commands: "comandos", "engine-matrix": "matriz-de-motores" }],
  market: ["mercado", { "honest-comparison": "comparacion-honesta" }],
  engines: ["motores", {}],
};
// Pages that stay in one language on purpose: decision records, the running log, the release checklist, legal and design notes, competitive research.
const EXEMPT = new Set(["design", "adr", "ai", "release", "legal", "architecture", "es", "pt-br", "fr"]);
const missing = [];

for (const dir of readdirSync(join(root, "docs"), { withFileTypes: true })) {
  if (EXEMPT.has(dir.name)) continue;
  if (!dir.isDirectory()) { if (dir.name === "ci-cd.md") for (const [l, p] of [["es", "docs/es/ci-cd.md"], ["pt-br", "docs/pt-br/ci-cd.md"], ["fr", "docs/fr/ci-cd.md"]]) if (!existsSync(join(root, p))) missing.push(`${l}: ${p}`); continue; }
  for (const file of ls(`docs/${dir.name}`)) {
    const base = file.replace(/\.md$/, "");
    if (dir.name === "market" && base === "competitive-analysis") continue;   // internal research, English only
    const [esDir, esNames] = ES[dir.name] ?? [dir.name, {}];
    if (!existsSync(join(root, "docs", "es", esDir, `${esNames[base] ?? base}.md`))) missing.push(`es: docs/es/${esDir}/${esNames[base] ?? base}.md`);
    for (const l of ["pt-br", "fr"]) if (!existsSync(join(root, "docs", l, dir.name, file))) missing.push(`${l}: docs/${l}/${dir.name}/${file}`);
  }
}
for (const f of ["README", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "CHANGELOG", "GOVERNANCE", "ROADMAP"]) for (const l of ["es", "pt-br", "fr"]) if (!existsSync(join(root, `${f}.${l}.md`))) missing.push(`${l}: ${f}.${l}.md`);

for (const l of ["es", "pt-br", "fr"]) if (!existsSync(join(root, `assets/brand/README.${l}.md`))) missing.push(`${l}: assets/brand/README.${l}.md`);

if (missing.length) { console.error(`${missing.length} translated pages missing:\n${missing.map((m) => `  ${m}`).join("\n")}`); process.exit(1); }
console.log("documentation is available in English, Spanish, Portuguese (Brazil) and French");
