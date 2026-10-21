import mysql from "mysql2/promise";
import { randomBytes } from "node:crypto";
import { runConformance } from "@rizomadb/driver-api/conformance";
import { mysqlDriver } from "./index.js";

const port = Number(process.env.RZ_MYSQL_PORT ?? 33069);
const base = { host: "127.0.0.1", port, user: "root", password: "rizoma_test", ssl: false };

async function freshDb() {
  const name = `rz_${randomBytes(6).toString("hex")}`;
  const admin = await mysql.createConnection(base);
  await admin.query(`CREATE DATABASE ${name}`); await admin.end();
  return { ...base, database: name };
}

runConformance({
  plugin: mysqlDriver, config: freshDb, slowSql: "SELECT SLEEP(10)", paramSql: "SELECT ? AS a, ? AS b",
  badConfig: () => ({ ...base, password: "wrong" }),
});
