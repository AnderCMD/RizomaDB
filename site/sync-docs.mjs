// Copies the repository docs into the site tree so there is a single source of truth.
import { cpSync, mkdirSync, rmSync } from "node:fs";
const copy = (from, to) => { rmSync(to, { recursive: true, force: true }); mkdirSync(to, { recursive: true }); cpSync(from, to, { recursive: true }); };
for (const d of ["guides", "engines", "enterprise", "security", "market", "drivers"]) copy(`../docs/${d}`, `content/en/${d}`);
for (const d of ["adr", "release"]) copy(`../docs/${d}`, `content/es/${d}`);
cpSync("../docs/ci-cd.md", "content/en/ci-cd.md");
