// Shared helpers for tests that need real database engines (see test/compose/docker-compose.yml).
import pg from "pg";
import mysql from "mysql2/promise";
import oracledb from "oracledb";
import { Connection as Tds, Request } from "tedious";
import { randomBytes } from "node:crypto";
import net from "node:net";
import type { DriverPlugin, ResolvedConnectionConfig } from "@rizomadb/driver-api";
import { sqliteDriver } from "@rizomadb/driver-sqlite";
import { postgresDriver } from "@rizomadb/driver-postgres";
import { mysqlDriver } from "@rizomadb/driver-mysql";
import { mssqlDriver } from "@rizomadb/driver-mssql";
import { oracleDriver } from "@rizomadb/driver-oracle";

export type EngineId = "sqlite" | "postgres" | "mysql" | "mssql" | "oracle";
export interface TestEngine { id: EngineId; plugin: DriverPlugin; host: string; port: number; /** Provisions an empty, isolated database/schema and returns its config. */ freshConfig(): Promise<ResolvedConnectionConfig> }

const rand = () => randomBytes(5).toString("hex");
const env = (n: string, d: number) => Number(process.env[n] ?? d);

export const reachable = (host: string, port: number, timeoutMs = 1000) => new Promise<boolean>((res) => {
  const s = net.connect({ host, port }); const done = (ok: boolean) => { s.destroy(); res(ok); };
  s.setTimeout(timeoutMs, () => done(false)); s.once("connect", () => done(true)); s.once("error", () => done(false));
});

export async function available(e: TestEngine): Promise<boolean> {
  if (e.id === "sqlite") return true;
  const up = await reachable(e.host, e.port);
  if (!up && process.env.RZ_REQUIRE_ENGINES) throw new Error(`Engine required but unreachable: ${e.id} at ${e.host}:${e.port}`);
  return up;
}

export const engines: TestEngine[] = [
  { id: "sqlite", plugin: sqliteDriver, host: "", port: 0, freshConfig: async () => ({ path: ":memory:" }) },
  { id: "postgres", plugin: postgresDriver, host: "localhost", port: env("RZ_PG_PORT", 54329), async freshConfig() {
    const base = { host: this.host, port: this.port, user: "postgres", password: "rizoma_test", ssl: false }; const db = `rz_${rand()}`;
    const a = new pg.Client({ ...base, database: "postgres" }); await a.connect(); await a.query(`CREATE DATABASE ${db}`); await a.end(); return { ...base, database: db };
  } },
  { id: "mysql", plugin: mysqlDriver, host: "127.0.0.1", port: env("RZ_MYSQL_PORT", 33069), async freshConfig() {
    const base = { host: this.host, port: this.port, user: "root", password: "rizoma_test", ssl: false }; const db = `rz_${rand()}`;
    const a = await mysql.createConnection({ host: base.host, port: base.port, user: base.user, password: base.password }); await a.query(`CREATE DATABASE ${db}`); await a.end(); return { ...base, database: db };
  } },
  { id: "mssql", plugin: mssqlDriver, host: "127.0.0.1", port: env("RZ_MSSQL_PORT", 14339), async freshConfig() {
    const base = { host: this.host, port: this.port, user: "sa", password: "Rizoma_test1", ssl: true, sslVerify: false }; const db = `rz_${rand()}`;
    await new Promise<void>((res, rej) => {
      const c = new Tds({ server: base.host, authentication: { type: "default", options: { userName: base.user, password: base.password } }, options: { port: base.port, encrypt: true, trustServerCertificate: true } });
      c.connect((e) => { if (e) return rej(e); c.execSql(new Request(`CREATE DATABASE ${db}`, (e2) => { c.close(); if (e2) rej(e2); else res(); })); });
    });
    return { ...base, database: db };
  } },
  { id: "oracle", plugin: oracleDriver, host: "127.0.0.1", port: env("RZ_ORACLE_PORT", 15219), async freshConfig() {
    const base = { host: this.host, port: this.port, service: "FREEPDB1", password: "rizoma_test" }; const user = `RZ_${rand().toUpperCase()}`;
    const a = await oracledb.getConnection({ user: "system", password: base.password, connectString: `${base.host}:${base.port}/${base.service}` });
    await a.execute(`CREATE USER ${user} IDENTIFIED BY "rizoma_test" QUOTA UNLIMITED ON USERS`); await a.execute(`GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW TO ${user}`); await a.close();
    return { ...base, user };
  } },
];

/** Engines selected by RZ_ENGINES (comma list or "all"); default sqlite only. */
export const wanted = (id: EngineId) => { const w = (process.env.RZ_ENGINES ?? "sqlite").split(","); return w.includes(id) || w.includes("all"); };
