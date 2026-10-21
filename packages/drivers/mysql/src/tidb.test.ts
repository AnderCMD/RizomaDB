import mysql from "mysql2/promise";
import { randomBytes } from "node:crypto";
import { engineUp, runConformance } from "@rizomadb/driver-api/conformance";
import { mysqlDriver } from "./index.js";

// TiDB speaks the MySQL protocol; this runs the same conformance kit to see what actually works.
const port = Number(process.env.RZ_TIDB_PORT ?? 14000);
const base = { host: "127.0.0.1", port, user: "root", password: "", ssl: false };
const enabled = await engineUp("127.0.0.1", port);

async function freshDb() {
  const name = `rz_${randomBytes(6).toString("hex")}`;
  const admin = await mysql.createConnection(base);
  await admin.query(`CREATE DATABASE ${name}`); await admin.end();
  return { ...base, database: name };
}

runConformance({
  enabled,
  plugin: mysqlDriver, config: freshDb, slowSql: "SELECT SLEEP(10)", paramSql: "SELECT ? AS a, ? AS b",
  badConfig: () => ({ ...base, port: 1 }),
});

import { describe, it, expect } from "vitest";
import { isReadOnlyStatement } from "./readonly.js";
describe("client-side read-only check (used for TiDB)", () => {
  it("allows reads and rejects everything else", () => {
    for (const s of ["SELECT 1", "select * from t where a = 'x; DROP'", "SHOW TABLES", "EXPLAIN SELECT 1", "WITH c AS (SELECT 1) SELECT * FROM c", "/* hi */ SELECT 1;", "(SELECT 1) UNION (SELECT 2)"]) expect(isReadOnlyStatement(s), s).toBe(true);
    for (const s of ["INSERT INTO t VALUES (1)", "UPDATE t SET a=1", "DELETE FROM t", "DROP TABLE t", "SELECT 1; DROP TABLE t", "SELECT * FROM t FOR UPDATE", "SELECT 1 INTO OUTFILE '/tmp/x'", "WITH c AS (SELECT 1) DELETE FROM t", "SET GLOBAL x = 1", "CALL p()", "", "LOAD DATA INFILE 'x' INTO TABLE t", "/* SELECT */ DROP TABLE t"]) expect(isReadOnlyStatement(s), s).toBe(false);
  });
});
