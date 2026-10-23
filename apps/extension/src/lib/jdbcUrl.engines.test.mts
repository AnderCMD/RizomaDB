import { describe, it, expect } from "vitest";
import { collect, type DriverPlugin, type ResolvedConnectionConfig } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { postgresDriver } from "@rizomadb/driver-postgres";
import { mysqlDriver } from "@rizomadb/driver-mysql";
import { mssqlDriver } from "@rizomadb/driver-mssql";
import { oracleDriver } from "@rizomadb/driver-oracle";
import { parseJdbcUrl } from "./jdbcUrl.js";

/** A JDBC URL turned into a driver config by the same parser the form uses, then connected to a real server. */
const cases: { name: string; plugin: DriverPlugin; port: number; url: (p: number) => string; password: string; sql: string }[] = [
  { name: "postgres", plugin: postgresDriver, port: Number(process.env.RZ_PG_PORT ?? 54329), url: (p) => `jdbc:postgresql://localhost:${p}/postgres?user=postgres&sslmode=disable`, password: "rizoma_test", sql: "SELECT 1 AS n" },
  { name: "mysql", plugin: mysqlDriver, port: Number(process.env.RZ_MYSQL_PORT ?? 33069), url: (p) => `jdbc:mysql://127.0.0.1:${p}/mysql?user=root&useSSL=false`, password: "rizoma_test", sql: "SELECT 1 AS n" },
  { name: "mssql", plugin: mssqlDriver, port: Number(process.env.RZ_MSSQL_PORT ?? 14339), url: (p) => `jdbc:sqlserver://127.0.0.1:${p};databaseName=master;user=sa;encrypt=true;trustServerCertificate=true`, password: "Rizoma_test1", sql: "SELECT 1 AS n" },
  { name: "oracle (service name)", plugin: oracleDriver, port: Number(process.env.RZ_ORACLE_PORT ?? 15219), url: (p) => `jdbc:oracle:thin:@//127.0.0.1:${p}/FREEPDB1`, password: "rizoma_test", sql: "SELECT 1 AS n FROM dual" },
  { name: "oracle (SID)", plugin: oracleDriver, port: Number(process.env.RZ_ORACLE_PORT ?? 15219), url: (p) => `jdbc:oracle:thin:@127.0.0.1:${p}:FREE`, password: "rizoma_test", sql: "SELECT 1 AS n FROM dual" },
  { name: "oracle (descriptor)", plugin: oracleDriver, port: Number(process.env.RZ_ORACLE_PORT ?? 15219), url: (p) => `jdbc:oracle:thin:@(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=127.0.0.1)(PORT=${p}))(CONNECT_DATA=(SERVICE_NAME=FREEPDB1)))`, password: "rizoma_test", sql: "SELECT 1 AS n FROM dual" },
];

for (const c of cases) {
  const up = await engineUp("127.0.0.1", c.port, c.name);
  describe.skipIf(!up)(`${c.name}: connecting from a JDBC URL`, () => {
    it("fills the connection and answers a query", async () => {
      const j = parseJdbcUrl(c.url(c.port));
      const cfg = { ...j.values, ...(c.name.startsWith("oracle") && !j.values.user ? { user: "system" } : {}), password: c.password } as ResolvedConnectionConfig;
      const conn = await c.plugin.connect(cfg, { log() {} });
      try {
        await conn.ping();
        const res = await collect(conn.execute({ sql: c.sql }, new AbortController().signal));
        expect(JSON.stringify(res)).toMatch(/1/);
      } finally { await conn.close(); }
    });
  });
}
