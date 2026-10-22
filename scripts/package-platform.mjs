#!/usr/bin/env node
// Builds a VSIX for one platform that carries DuckDB's native library (the universal VSIX does not, see docs/engines/duckdb.md).
// Usage: node scripts/package-platform.mjs <target> [outDir]
//   target: darwin-arm64 | darwin-x64 | linux-x64 | linux-arm64 | win32-x64 | win32-arm64 (VS Code's --target names)
// The native package comes from the local install when the target is this machine's platform, otherwise from `npm pack` (release builds only).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TARGETS = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64", "win32-x64", "win32-arm64"];
const [target, outArg] = process.argv.slice(2);
if (!TARGETS.includes(target)) { console.error(`Usage: package-platform.mjs <${TARGETS.join("|")}> [outDir]`); process.exit(2); }

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ext = join(root, "apps", "extension");
const out = resolve(outArg ?? ext);
const require = createRequire(join(root, "packages", "drivers", "duckdb", "package.json"));
const nodeApiDir = realpathSync(dirname(require.resolve("@duckdb/node-api/package.json")));
const bindingsDir = realpathSync(dirname(createRequire(join(nodeApiDir, "package.json")).resolve("@duckdb/node-bindings/package.json")));
const version = JSON.parse(readFileSync(join(bindingsDir, "package.json"), "utf8")).version;
const pkgName = `@duckdb/node-bindings-${target}`;

const stage = join(ext, "native", "node_modules", "@duckdb");
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });

function nativeSource() {
  if (`${process.platform}-${process.arch}` === target) {
    try { return realpathSync(dirname(createRequire(join(bindingsDir, "package.json")).resolve(`${pkgName}/package.json`))); } catch { /* not installed: fall through */ }
  }
  const tmp = mkdtempSync(join(tmpdir(), "rz-duckdb-"));
  run("npm", ["pack", `${pkgName}@${version}`, "--pack-destination", tmp], tmp);
  const tgz = join(tmp, `${pkgName.replace("@", "").replace("/", "-")}-${version}.tgz`);
  run("tar", ["-xzf", tgz, "-C", tmp]);
  return join(tmp, "package");
}

rmSync(join(ext, "native"), { recursive: true, force: true });
try {
  mkdirSync(stage, { recursive: true });
  cpSync(nodeApiDir, join(stage, "node-api"), { recursive: true, dereference: true });
  cpSync(bindingsDir, join(stage, "node-bindings"), { recursive: true, dereference: true });
  cpSync(nativeSource(), join(stage, `node-bindings-${target}`), { recursive: true, dereference: true });
  // The two JS packages find each other by name, so lay them out the way npm would.
  for (const n of ["node-api", "node-bindings"]) rmSync(join(stage, n, "node_modules"), { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const file = join(out, `rizomadb-${target}.vsix`);
  run("pnpm", ["exec", "vsce", "package", "--no-dependencies", "--target", target, "-o", file], ext);
  if (!existsSync(file)) throw new Error("vsce did not produce the file");
  console.log(file);
} finally {
  rmSync(join(ext, "native"), { recursive: true, force: true });
}
