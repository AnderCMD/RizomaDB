import { Connection, Request } from "tedious";
import { randomBytes } from "node:crypto";
import { runConformance } from "@rizomadb/driver-api/conformance";
import { mssqlDriver } from "./index.js";

const base = { host: "127.0.0.1", port: Number(process.env.RZ_MSSQL_PORT ?? 14339), user: "sa", password: "Rizoma_test1", ssl: true, sslVerify: false };

async function freshDb() {
  const name = `rz_${randomBytes(6).toString("hex")}`;
  await new Promise<void>((res, rej) => {
    const c = new Connection({ server: base.host, authentication: { type: "default", options: { userName: base.user, password: base.password } }, options: { port: base.port, encrypt: true, trustServerCertificate: true } });
    c.connect((e) => { if (e) return rej(e); c.execSql(new Request(`CREATE DATABASE ${name}`, (e2) => { c.close(); e2 ? rej(e2) : res(); })); });
  });
  return { ...base, database: name };
}

runConformance({
  plugin: mssqlDriver, config: freshDb, slowSql: "WAITFOR DELAY '00:00:10'", bigintSql: "SELECT CAST(9223372036854775807 AS BIGINT) AS big", paramSql: "SELECT @p1 AS a, @p2 AS b",
  badConfig: () => ({ ...base, password: "wrong" }),
});
