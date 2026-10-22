import { describe, it, expect, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, type Connection, type DriverPlugin, type ResolvedConnectionConfig } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { postgresDriver } from "@rizomadb/driver-postgres";
import { mysqlDriver } from "@rizomadb/driver-mysql";
import { clickhouseDriver } from "@rizomadb/driver-clickhouse";
import { redisDriver } from "@rizomadb/driver-redis";
import { PASSWORD_PLACEHOLDER, readOnlyUserScript, readOnlyUserStatements, ReadOnlyUserError, type ReadOnlyUserEngine } from "./readOnlyUser.js";

/** The generated scripts, run by an administrator against real servers; then the new account must read and must not write. */
const sig = () => new AbortController().signal;
const run = (c: Connection, sql: string) => collect(c.execute({ sql }, sig()));
const suffix = randomBytes(4).toString("hex");

interface Case { engine: ReadOnlyUserEngine; plugin: DriverPlugin; port: number; admin: ResolvedConnectionConfig; as: (user: string, password: string) => ResolvedConnectionConfig; db: string; setup: string[]; read: string; write: string; teardown: string[] }
const pgPort = Number(process.env.RZ_PG_PORT ?? 54329), myPort = Number(process.env.RZ_MYSQL_PORT ?? 33069), chPort = Number(process.env.RZ_CLICKHOUSE_PORT ?? 18124), rePort = Number(process.env.RZ_REDIS_PORT ?? 63799);
const cases: Case[] = [
  { engine: "postgres", plugin: postgresDriver, port: pgPort, db: "postgres",
    admin: { host: "localhost", port: pgPort, user: "postgres", password: "rizoma_test", ssl: false, database: "postgres" },
    as: (user, password) => ({ host: "localhost", port: pgPort, user, password, ssl: false, database: "postgres" }),
    setup: [`CREATE TABLE ro_${suffix} (id int PRIMARY KEY, name text)`, `INSERT INTO ro_${suffix} VALUES (1, 'a')`], read: `SELECT name FROM ro_${suffix}`, write: `INSERT INTO ro_${suffix} VALUES (2, 'b')`,
    teardown: [`DROP TABLE ro_${suffix}`, `DROP OWNED BY ro_${suffix}_u`, `DROP ROLE ro_${suffix}_u`] },
  { engine: "mysql", plugin: mysqlDriver, port: myPort, db: `ro_${suffix}`,
    admin: { host: "127.0.0.1", port: myPort, user: "root", password: "rizoma_test", ssl: false },
    as: (user, password) => ({ host: "127.0.0.1", port: myPort, user, password, ssl: false, database: `ro_${suffix}` }),
    setup: [`CREATE DATABASE ro_${suffix}`, `CREATE TABLE ro_${suffix}.t (id int PRIMARY KEY, name varchar(10))`, `INSERT INTO ro_${suffix}.t VALUES (1, 'a')`], read: `SELECT name FROM ro_${suffix}.t`, write: `INSERT INTO ro_${suffix}.t VALUES (2, 'b')`,
    teardown: [`DROP DATABASE ro_${suffix}`, `DROP USER 'ro_${suffix}_u'@'%'`] },
  { engine: "clickhouse", plugin: clickhouseDriver, port: chPort, db: `ro_${suffix}`,
    admin: { host: "localhost", port: chPort, user: "default", password: "rizoma_test" },
    as: (user, password) => ({ host: "localhost", port: chPort, user, password, database: `ro_${suffix}` }),
    setup: [`CREATE DATABASE ro_${suffix}`, `CREATE TABLE ro_${suffix}.t (id Int32, name String) ENGINE = MergeTree ORDER BY id`, `INSERT INTO ro_${suffix}.t VALUES (1, 'a')`], read: `SELECT name FROM ro_${suffix}.t`, write: `INSERT INTO ro_${suffix}.t VALUES (2, 'b')`,
    teardown: [`DROP DATABASE ro_${suffix}`, `DROP USER ro_${suffix}_u`] },
  { engine: "redis", plugin: redisDriver, port: rePort, db: "",
    admin: { host: "localhost", port: rePort },
    as: (user, password) => ({ host: "localhost", port: rePort, user, password }),
    setup: [`SET ro_${suffix} a`], read: `GET ro_${suffix}`, write: `SET ro_${suffix} b`,
    teardown: [`DEL ro_${suffix}`, `ACL DELUSER ro_${suffix}_u`] },
];

const ups = await Promise.all(cases.map((c) => engineUp(c.admin["host"] as string, c.port, c.engine)));

describe("read-only user script", () => {
  it("rejects names that could change the statement", () => {
    expect(() => readOnlyUserStatements("postgres", { user: "x; DROP", database: "d" })).toThrow(ReadOnlyUserError);
    expect(() => readOnlyUserStatements("mysql", { user: "ok", database: "" })).toThrow(ReadOnlyUserError);
    expect(() => readOnlyUserStatements("postgres", { user: "ok", database: "d\nx" })).toThrow(ReadOnlyUserError);
    expect(readOnlyUserStatements("postgres", { user: "ok", database: 'we"ird', schema: "s" })[2]).toBe('GRANT CONNECT ON DATABASE "we""ird" TO "ok"');
    expect(readOnlyUserStatements("mysql", { user: "ok", database: "we`ird" })[1]).toContain("`we``ird`.*");
  });
  it("tells the person to replace the password and never writes one", () => {
    const s = readOnlyUserScript("postgres", { user: "u", database: "d" }, "Review this first");
    expect(s).toMatchObject({ language: "sql" });
    expect(s.text.startsWith("-- Review this first\n")).toBe(true);
    expect(s.text).toContain(PASSWORD_PLACEHOLDER);
    expect(readOnlyUserScript("redis", { user: "u" }, "x").text.startsWith("ACL SETUSER")).toBe(true);
  });

  cases.forEach((c, n) => {
    const user = `ro_${suffix}_u`, password = `Pw_${randomBytes(6).toString("hex")}`;
    describe.skipIf(!ups[n])(`${c.engine}: the account can read and cannot write`, () => {
      let admin: Connection;
      afterAll(async () => { if (admin) { for (const s of c.teardown) await run(admin, s).catch(() => undefined); await admin.close(); } });
      it("creates the account from the generated script", async () => {
        admin = await c.plugin.connect(c.admin, { log() {} });
        for (const s of c.setup) await run(admin, s);
        for (const s of readOnlyUserStatements(c.engine, { user, database: c.db })) await run(admin, s.replaceAll(PASSWORD_PLACEHOLDER, password));
        const ro = await c.plugin.connect(c.as(user, password), { log() {} });
        try {
          const rows = (await run(ro, c.read)).rows;
          expect(String(rows[0]?.[0])).toBe("a");
          await expect(run(ro, c.write)).rejects.toBeDefined();
        } finally { await ro.close(); }
        const after = (await run(admin, c.read)).rows;
        expect(after.length).toBe(1);   // the refused write changed nothing
      });
    });
  });
});
