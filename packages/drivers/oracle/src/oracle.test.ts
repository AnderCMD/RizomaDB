import oracledb from "oracledb";
import { randomBytes } from "node:crypto";
import { engineUp, runConformance } from "@rizomadb/driver-api/conformance";
import { oracleDriver } from "./index.js";

const base = { host: "127.0.0.1", port: Number(process.env.RZ_ORACLE_PORT ?? 15219), service: "FREEPDB1", password: "rizoma_test" };

/** Each run gets a fresh user (= schema) so tests are independent. */
async function freshUser() {
  const user = `RZ_${randomBytes(4).toString("hex").toUpperCase()}`;
  const admin = await oracledb.getConnection({ user: "system", password: base.password, connectString: `${base.host}:${base.port}/${base.service}` });
  await admin.execute(`CREATE USER ${user} IDENTIFIED BY "rizoma_test" QUOTA UNLIMITED ON USERS`);
  await admin.execute(`GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW TO ${user}`);
  await admin.close();
  return { ...base, user };
}

const enabled = await engineUp("127.0.0.1", Number(process.env.RZ_ORACLE_PORT ?? 15219));

runConformance({
  enabled,
  plugin: oracleDriver, config: freshUser,
  // DBMS_SESSION.SLEEP is not interruptible by break(); a CPU-bound query is (documented limitation).
  slowSql: "SELECT COUNT(*) FROM dual CONNECT BY LEVEL <= 2000000000", paramSql: "SELECT :1 AS a, :2 AS b FROM dual",
  bigintSql: "SELECT 9223372036854775807 AS big FROM dual",
  createTableSql: "CREATE TABLE conf_t (id NUMBER PRIMARY KEY, name VARCHAR2(100) NOT NULL)",
  badConfig: () => ({ ...base, user: "system", password: "wrong" }),
});
