import { runConformance } from "@rizomadb/driver-api/conformance";
import { sqliteDriver } from "./index.js";

runConformance({
  plugin: sqliteDriver,
  config: () => ({ path: ":memory:" }),
  slowSql: "SELECT 1",
  paramSql: "SELECT ? AS a, ? AS b",
  badConfig: () => ({ path: "/nonexistent-dir/x/y.db" }),
});
