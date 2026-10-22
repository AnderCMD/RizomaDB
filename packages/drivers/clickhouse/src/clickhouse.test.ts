import { randomBytes } from "node:crypto";
import { engineUp, runConformance } from "@rizomadb/driver-api/conformance";
import { clickhouseDriver } from "./index.js";

const port = Number(process.env.RZ_CLICKHOUSE_PORT ?? 18124);
const enabled = await engineUp("127.0.0.1", port);
const base = { host: "127.0.0.1", port, user: "default", password: "rizoma_test", ssl: false };

async function freshDb() {
  const name = `rz_${randomBytes(5).toString("hex")}`;
  const admin = await clickhouseDriver.connect({ ...base, database: "default" }, { log() {} });
  for await (const _ of admin.execute({ sql: `CREATE DATABASE ${name}` }, new AbortController().signal)) void _;
  await admin.close();
  return { ...base, database: name };
}

runConformance({
  plugin: clickhouseDriver, enabled, config: freshDb,
  manyRowsSql: "SELECT number FROM numbers(200000)",
  slowSql: "SELECT count() FROM numbers(100000000000)",
  paramSql: "SELECT {p1:String} AS a, {p2:Nullable(String)} AS b",
  bigintSql: "SELECT toInt64(9223372036854775807) AS big",
  createTableSql: "CREATE TABLE conf_t (id Int32, name String) ENGINE = MergeTree ORDER BY id",
  skipFkAndIndexTests: true,
  badConfig: () => ({ ...base, password: "wrong" }),
});
