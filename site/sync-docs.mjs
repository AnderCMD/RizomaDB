// Copies the repository docs into the site tree so there is a single source of truth.
import { cpSync, mkdirSync, rmSync } from "node:fs";
const copy = (from, to) => { rmSync(to, { recursive: true, force: true }); mkdirSync(to, { recursive: true }); cpSync(from, to, { recursive: true }); };
// English
for (const d of ["guides", "engines", "enterprise", "security", "market", "drivers", "reference", "design"]) copy(`../docs/${d}`, `content/en/${d}`);
cpSync("../docs/ci-cd.md", "content/en/ci-cd.md");
// Spanish: guides, references, engines, enterprise, security, driver authoring and CI/CD are translated; the market comparison stays in English
for (const d of ["guias", "referencia", "motores", "empresa", "seguridad", "drivers"]) copy(`../docs/es/${d}`, `content/es/${d}`);
cpSync("../docs/es/ci-cd.md", "content/es/ci-cd.md");
for (const d of ["adr", "release"]) copy(`../docs/${d}`, `content/es/${d}`);
