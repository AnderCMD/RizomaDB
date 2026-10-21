import pg from "pg";
import { randomBytes } from "node:crypto";
import { engineUp, runConformance } from "@rizomadb/driver-api/conformance";
import { postgresDriver } from "./index.js";

// YugabyteDB's YSQL is PostgreSQL-compatible; this runs the same conformance kit to see what actually works.
const port = Number(process.env.RZ_YUGABYTE_PORT ?? 15433);
const base = { host: "localhost", port, user: "yugabyte", password: "yugabyte", ssl: false };
const enabled = await engineUp("localhost", port, "yugabyte");

async function freshDb() {
  const name = `rz_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Client({ ...base, database: "yugabyte" });
  await admin.connect(); await admin.query(`CREATE DATABASE ${name}`); await admin.end();
  return { ...base, database: name };
}

runConformance({
  enabled,
  plugin: postgresDriver,
  config: freshDb,
  slowSql: "SELECT pg_sleep(10)",
  paramSql: "SELECT $1::text AS a, $2::text AS b",
  badConfig: () => ({ ...base, port: 1, database: "yugabyte" }),
});

import { describe, it, expect } from "vitest";
describe.skipIf(!enabled)("yugabyte identification", () => {
  it("reports the product", async () => {
    const c = await postgresDriver.connect({ ...base, database: "yugabyte" }, { log() {} });
    expect(c.serverInfo.product).toBe("YugabyteDB"); expect(c.serverInfo.version).toMatch(/^\d{4}\./);
    await c.close();
  });
});
