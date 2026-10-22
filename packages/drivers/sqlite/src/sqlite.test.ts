import { runConformance } from "@rizomadb/driver-api/conformance";
import { sqliteDriver } from "./index.js";

runConformance({
  plugin: sqliteDriver,
  config: () => ({ path: ":memory:" }),
  manyRowsSql: "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 200000) SELECT i FROM n",
  slowSql: "SELECT 1",
  paramSql: "SELECT ? AS a, ? AS b",
  badConfig: () => ({ path: "/nonexistent-dir/x/y.db" }),
});
