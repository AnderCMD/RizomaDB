import pg from "pg";
import { randomBytes } from "node:crypto";
import { engineUp, runConformance } from "@rizomadb/driver-api/conformance";
import { postgresDriver } from "./index.js";

const base = { host: "localhost", port: Number(process.env.RZ_PG_PORT ?? 54329), user: "postgres", password: "rizoma_test", ssl: false };

/** Each config() call provisions a fresh empty database so runs are independent. */
async function freshDb() {
  const name = `rz_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Client({ ...base, database: "postgres" });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  return { ...base, database: name };
}

const enabled = await engineUp("localhost", Number(process.env.RZ_PG_PORT ?? 54329));

runConformance({
  enabled,
  plugin: postgresDriver,
  config: freshDb,
  manyRowsSql: "SELECT g FROM generate_series(1, 200000) g",
  slowSql: "SELECT pg_sleep(10)",
  paramSql: "SELECT $1::text AS a, $2::text AS b",
  badConfig: () => ({ ...base, database: "postgres", password: "wrong" }),
});

import { describe, it, expect } from "vitest";
import { collect } from "@rizomadb/driver-api";
describe.skipIf(!enabled)("postgres value mapping", () => {
  it("returns int8 losslessly, jsonb as {json}, arrays as arrays", async () => {
    const c = await postgresDriver.connect({ ...base, database: "postgres" }, { log() {} });
    const r = await collect(c.execute({ sql: "SELECT 9223372036854775807::int8 AS a, 5::int8 AS b, '{\"x\":1}'::jsonb AS j, ARRAY['p','q']::text[] AS arr" }, new AbortController().signal));
    expect(r.rows[0]).toEqual([9223372036854775807n, 5, { json: { x: 1 } }, ["p", "q"]]);
    await c.close();
  });
});
