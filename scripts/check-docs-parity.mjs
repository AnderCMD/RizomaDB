#!/usr/bin/env node
// Lists documentation pages that exist in English but not in Spanish, and the root community files without a Spanish version.
// AGENTS.md is the only file kept in English alone. Usage: node scripts/check-docs-parity.mjs   (exit code 1 when something is missing)
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
  release: ["release", { "v1-checklist": "lista-de-aceptacion-v1" }],
  design: ["design", { "design-guide": "guia-de-diseno" }],
  legal: ["legal", { "third-party-licenses": "licencias-de-terceros" }],
  engines: ["motores", {}],
};
const missing = [];

for (const dir of readdirSync(join(root, "docs"), { withFileTypes: true })) {
  if (dir.name === "es") continue;
  if (!dir.isDirectory()) { if (dir.name === "ci-cd.md" && !existsSync(join(root, "docs/es/ci-cd.md"))) missing.push("docs/es/ci-cd.md"); continue; }
  for (const file of ls(`docs/${dir.name}`)) {
    const base = file.replace(/\.md$/, "");
    const [esDir, esNames] = ES[dir.name] ?? [dir.name, {}];
    const target = `docs/es/${esDir}/${esNames[base] ?? base}.md`;
    if (!existsSync(join(root, target))) missing.push(target);
  }
}
for (const f of ["README", "CONTRIBUTING", "SECURITY", "CODE_OF_CONDUCT", "CHANGELOG", "GOVERNANCE", "ROADMAP"]) if (!existsSync(join(root, `${f}.es.md`))) missing.push(`${f}.es.md`);
if (!existsSync(join(root, "assets/brand/README.es.md"))) missing.push("assets/brand/README.es.md");

if (missing.length) { console.error(`${missing.length} Spanish pages missing:\n${missing.map((m) => `  ${m}`).join("\n")}`); process.exit(1); }
console.log("documentation is available in English and Spanish");
