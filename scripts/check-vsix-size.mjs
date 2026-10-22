// Fails when the packaged extension grows past the budget (8 MB for the universal package, 60 MB for the per-platform ones that carry DuckDB). Usage: node scripts/check-vsix-size.mjs path.vsix [maxMB]
import { statSync } from "node:fs";
const [file, max = "8"] = process.argv.slice(2);
const mb = statSync(file).size / 1024 / 1024;
console.log(`${file}: ${mb.toFixed(2)} MB (budget ${max} MB)`);
if (mb > Number(max)) { console.error("VSIX size budget exceeded"); process.exit(1); }
