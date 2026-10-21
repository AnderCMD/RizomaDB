import { beforeAll } from "vitest";
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runConformance } from "@rizomadb/driver-api/conformance";
import { sqliteDriver } from "@rizomadb/driver-sqlite";
import { workerDriver } from "./workerDriver.js";

const out = join(mkdtempSync(join(tmpdir(), "rz-worker-")), "driverWorker.cjs");
beforeAll(async () => {
  await build({ entryPoints: [join(process.cwd(), "src/worker/driverWorker.ts")], outfile: out, bundle: true, platform: "node", format: "cjs", external: ["pg-native", "@duckdb/node-api", "@duckdb/node-bindings"], logLevel: "silent" });
}, 30_000);

// The wrapper reads the worker path lazily so beforeAll has run.
const lazy = { ...workerDriver(sqliteDriver, out), connect: (...a: Parameters<typeof sqliteDriver.connect>) => workerDriver(sqliteDriver, out).connect(...a) };

runConformance({
  plugin: lazy,
  config: () => ({ path: ":memory:" }),
  // A long synchronous statement: only terminating the worker can stop it.
  slowSql: "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < 400000000) SELECT count(*) FROM n",
  paramSql: "SELECT ? AS a, ? AS b",
  badConfig: () => ({ path: "/nonexistent-dir/x/y.db" }),
});
