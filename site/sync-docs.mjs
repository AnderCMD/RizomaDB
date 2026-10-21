// Copies the repository docs into the site tree so there is a single source of truth.
import { cpSync, mkdirSync, rmSync } from "node:fs";
const copy = (from, to) => { rmSync(to, { recursive: true, force: true }); mkdirSync(to, { recursive: true }); cpSync(from, to, { recursive: true }); };
// English
for (const d of ["guides", "engines", "enterprise", "security", "market", "drivers", "reference"]) copy(`../docs/${d}`, `content/en/${d}`);
cpSync("../docs/ci-cd.md", "content/en/ci-cd.md");
// Spanish: the user guides and references are translated; the rest of the technical pages stay in English
copy("../docs/es/guias", "content/es/guias");
copy("../docs/es/referencia", "content/es/referencia");
for (const d of ["adr", "release"]) copy(`../docs/${d}`, `content/es/${d}`);
