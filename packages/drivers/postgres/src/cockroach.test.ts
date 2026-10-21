import pg from "pg";
import { randomBytes } from "node:crypto";
import { engineUp, runConformance } from "@rizomadb/driver-api/conformance";
import { postgresDriver } from "./index.js";

// CockroachDB speaks the PostgreSQL protocol; this runs the same conformance kit to see what actually works.
const port = Number(process.env.RZ_COCKROACH_PORT ?? 26257);
const base = { host: "localhost", port, user: "root", ssl: false };
const enabled = await engineUp("localhost", port, "cockroach");

async function freshDb() {
  const name = `rz_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Client({ ...base, database: "defaultdb" });
  await admin.connect(); await admin.query(`CREATE DATABASE ${name}`); await admin.end();
  return { ...base, database: name };
}

runConformance({
  enabled,
  plugin: postgresDriver,
  config: freshDb,
  slowSql: "SELECT pg_sleep(10)",
  paramSql: "SELECT $1::text AS a, $2::text AS b",
  badConfig: () => ({ ...base, port: 1, database: "defaultdb" }),
});
