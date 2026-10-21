import { describe, it, expect } from "vitest";
import pg from "pg";
import mysql from "mysql2/promise";
import oracledb from "oracledb";
import { Connection as Tds, Request } from "tedious";
import { randomBytes } from "node:crypto";
import { collect, type Connection, type DriverPlugin, type ResolvedConnectionConfig } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { postgresDriver } from "@rizomadb/driver-postgres";
import { mysqlDriver } from "@rizomadb/driver-mysql";
import { mssqlDriver } from "@rizomadb/driver-mssql";
import { oracleDriver } from "@rizomadb/driver-oracle";
import { SchemaIndex, complete, explain, type Dialect } from "./index.js";

const rand = () => randomBytes(5).toString("hex");
type Eng = { id: "postgres" | "mysql" | "mssql" | "oracle"; dialect: Dialect; plugin: DriverPlugin; host: string; port: number; config: () => Promise<ResolvedConnectionConfig> };
const engines: Eng[] = [
  { id: "postgres", dialect: "postgres", plugin: postgresDriver, host: "localhost", port: 54329, config: async () => {
    const base = { host: "localhost", port: 54329, user: "postgres", password: "rizoma_test", ssl: false }; const db = `rz_${rand()}`;
    const a = new pg.Client({ ...base, database: "postgres" }); await a.connect(); await a.query(`CREATE DATABASE ${db}`); await a.end(); return { ...base, database: db }; } },
  { id: "mysql", dialect: "mysql", plugin: mysqlDriver, host: "127.0.0.1", port: Number(process.env.RZ_MYSQL_PORT ?? 33069), config: async () => {
    const base = { host: "127.0.0.1", port: Number(process.env.RZ_MYSQL_PORT ?? 33069), user: "root", password: "rizoma_test", ssl: false }; const db = `rz_${rand()}`;
    const a = await mysql.createConnection(base); await a.query(`CREATE DATABASE ${db}`); await a.end(); return { ...base, database: db }; } },
  { id: "mssql", dialect: "mssql", plugin: mssqlDriver, host: "127.0.0.1", port: Number(process.env.RZ_MSSQL_PORT ?? 14339), config: async () => {
    const base = { host: "127.0.0.1", port: Number(process.env.RZ_MSSQL_PORT ?? 14339), user: "sa", password: "Rizoma_test1", ssl: true, sslVerify: false }; const db = `rz_${rand()}`;
    await new Promise<void>((res, rej) => { const c = new Tds({ server: base.host, authentication: { type: "default", options: { userName: base.user, password: base.password } }, options: { port: base.port, encrypt: true, trustServerCertificate: true } });
      c.connect((e) => { if (e) return rej(e); c.execSql(new Request(`CREATE DATABASE ${db}`, (e2) => { c.close(); if (e2) rej(e2); else res(); })); }); });
    return { ...base, database: db }; } },
  { id: "oracle", dialect: "oracle", plugin: oracleDriver, host: "127.0.0.1", port: Number(process.env.RZ_ORACLE_PORT ?? 15219), config: async () => {
    const base = { host: "127.0.0.1", port: Number(process.env.RZ_ORACLE_PORT ?? 15219), service: "FREEPDB1", password: "rizoma_test" }; const user = `RZ_${rand().toUpperCase()}`;
    const a = await oracledb.getConnection({ user: "system", password: base.password, connectString: `${base.host}:${base.port}/${base.service}` });
    await a.execute(`CREATE USER ${user} IDENTIFIED BY "rizoma_test" QUOTA UNLIMITED ON USERS`); await a.execute(`GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW TO ${user}`); await a.close(); return { ...base, user }; } },
];

for (const e of engines) {
  const up = await engineUp(e.host, e.port);
  describe.skipIf(!up)(`live intelligence on ${e.id}`, () => {
    async function setup(): Promise<Connection> {
      const c = await e.plugin.connect(await e.config(), { log() {} });
      const x = (sql: string) => collect(c.execute({ sql }, new AbortController().signal));
      await x("CREATE TABLE customers (id INTEGER PRIMARY KEY, name VARCHAR(50) NOT NULL)");
      await x("CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, total INTEGER, FOREIGN KEY (customer_id) REFERENCES customers(id))");
      return c;
    }
    it("builds a schema index from the real catalog and completes columns, aliases and FK joins", async () => {
      const c = await setup();
      const api = c.introspect();
      const idx = new SchemaIndex(await api.describeSchema!(), await api.foreignKeys!());
      const lower = (s: string) => s.toLowerCase();
      const at = (sql: string) => { const i = sql.indexOf("|"); return complete(sql.replace("|", ""), i, idx, e.dialect).items.map((x) => lower(x.label)); };
      expect(at("select c.| from customers c")).toEqual(["id", "name"]);
      expect(at("select * from orders o join |")).toContain("customers");
      expect(at("select * from orders o join customers c on |").some((l) => l.includes("customer_id") && l.includes("="))).toBe(true);
      await c.close();
    });
    it("returns a real plan tree", async () => {
      const c = await setup();
      const plan = await explain(c, e.id, "SELECT c.name FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.total > 5");
      expect(plan.root.length).toBeGreaterThan(0);
      expect(plan.raw.length).toBeGreaterThan(10);
      if (e.id === "postgres") {
        const a = await explain(c, "postgres", "SELECT * FROM customers", { analyze: true });
        expect(a.analyzed).toBe(true); expect(a.executionMs).toBeGreaterThanOrEqual(0);
      }
      await c.close();
    });
  });
}
