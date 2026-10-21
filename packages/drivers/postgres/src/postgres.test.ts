import pg from "pg";
import { randomBytes } from "node:crypto";
import { runConformance } from "@rizomadb/driver-api/conformance";
import { postgresDriver } from "./index.js";

const base = { host: "localhost", port: 54329, user: "postgres", password: "rizoma_test", ssl: false };

/** Each config() call provisions a fresh empty database so runs are independent. */
async function freshDb() {
  const name = `rz_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Client({ ...base, database: "postgres" });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  return { ...base, database: name };
}

runConformance({
  plugin: postgresDriver,
  config: freshDb,
  slowSql: "SELECT pg_sleep(10)",
  paramSql: "SELECT $1::text AS a, $2::text AS b",
  badConfig: () => ({ ...base, database: "postgres", password: "wrong" }),
});
