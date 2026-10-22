// Copies the repository docs into the site tree so there is a single source of truth.
import { cpSync, mkdirSync, rmSync } from "node:fs";
const copy = (from, to) => { rmSync(to, { recursive: true, force: true }); mkdirSync(to, { recursive: true }); cpSync(from, to, { recursive: true }); };
// English
for (const d of ["guides", "engines", "enterprise", "security", "market", "drivers", "reference", "design", "release", "legal"]) copy(`../docs/${d}`, `content/en/${d}`);
cpSync("../docs/ci-cd.md", "content/en/ci-cd.md");
// Spanish: every page has a translation
for (const d of ["guias", "referencia", "motores", "empresa", "seguridad", "drivers"]) copy(`../docs/es/${d}`, `content/es/${d}`);
cpSync("../docs/es/ci-cd.md", "content/es/ci-cd.md");
for (const d of ["mercado", "release", "design", "legal"]) copy(`../docs/es/${d}`, `content/es/${d}`);
