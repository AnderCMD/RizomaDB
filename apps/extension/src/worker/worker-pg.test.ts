import { beforeAll } from "vitest";
import { build } from "esbuild";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runConformance } from "@rizomadb/driver-api/conformance";
import { postgresDriver } from "@rizomadb/driver-postgres";
import { workerDriver } from "./workerDriver.js";

const out = join(mkdtempSync(join(tmpdir(), "rz-worker-pg-")), "driverWorker.cjs");
beforeAll(async () => {
  await build({ entryPoints: [join(process.cwd(), "src/worker/driverWorker.ts")], outfile: out, bundle: true, platform: "node", format: "cjs", external: ["pg-native", "@duckdb/node-api", "@duckdb/node-bindings"], logLevel: "silent" });
}, 30_000);

const base = { host: "localhost", port: Number(process.env.RZ_PG_PORT ?? 54329), user: "postgres", password: "rizoma_test", ssl: false };
async function freshDb() {
  const name = `rz_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Client({ ...base, database: "postgres" });
  await admin.connect(); await admin.query(`CREATE DATABASE ${name}`); await admin.end();
  return { ...base, database: name };
}
const lazy = { ...postgresDriver, connect: (...a: Parameters<typeof postgresDriver.connect>) => workerDriver(postgresDriver, out).connect(...a) };

runConformance({
  plugin: lazy, config: freshDb, slowSql: "SELECT pg_sleep(10)", paramSql: "SELECT $1::text AS a, $2::text AS b",
  badConfig: () => ({ ...base, database: "postgres", password: "wrong" }),
});
