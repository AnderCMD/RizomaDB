#!/usr/bin/env node
// Unzips a VSIX and runs a real DuckDB query through its driver worker, exactly as the extension spawns it.
// Usage: node scripts/smoke-vsix-duckdb.mjs <file.vsix> [expect=ok|unsupported]
import { execFileSync, fork } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [vsix, expect = "ok"] = process.argv.slice(2);
if (!vsix) { console.error("Usage: smoke-vsix-duckdb.mjs <file.vsix> [ok|unsupported]"); process.exit(2); }
const dir = mkdtempSync(join(tmpdir(), "rz-smoke-"));
execFileSync("unzip", ["-q", resolve(vsix), "-d", dir]);
const worker = fork(join(dir, "extension", "dist", "driverWorker.cjs"), [], { serialization: "advanced", env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, execArgv: [] });
const finish = (code, msg) => { clearTimeout(timer); worker.kill(); rmSync(dir, { recursive: true, force: true }); console.log(msg); process.exit(code); };
const timer = setTimeout(() => finish(1, "FAIL: timed out"), 30000);
worker.on("message", (m) => {
  if (m.id === 1) {
    if (!m.ok) return finish(expect === "unsupported" && m.error.kind === "unsupported" ? 0 : 1, `${expect === "unsupported" && m.error.kind === "unsupported" ? "OK" : "FAIL"}: connect said "${m.error.message.split("\n")[0]}"`);
    if (expect === "unsupported") return finish(1, "FAIL: DuckDB loaded but was expected to be absent");
    worker.send({ id: 2, op: "execute", target: m.result.target, req: { sql: "SELECT 42 AS answer" } });
  } else if (m.id === 2) worker.send({ id: 3, op: "next", rid: 2 });
  else if (m.id === 3) {
    const cols = m.result?.value?.columns?.map((c) => c.name).join(",");
    finish(cols === "answer" ? 0 : 1, cols === "answer" ? "OK: DuckDB answered a query from the packaged extension" : `FAIL: unexpected ${JSON.stringify(m)}`);
  }
});
worker.send({ id: 1, op: "connect", driver: "duckdb", cfg: { path: ":memory:" } });
