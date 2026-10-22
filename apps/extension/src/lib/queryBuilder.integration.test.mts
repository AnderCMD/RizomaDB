import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, type Connection, type DriverPlugin, type ResolvedConnectionConfig } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { postgresDriver } from "@rizomadb/driver-postgres";
import { mysqlDriver } from "@rizomadb/driver-mysql";
import { buildSelect, BuilderError, kindOfNative, type BuilderColumn } from "./queryBuilder.js";

const run = (c: Connection, sql: string) => collect(c.execute({ sql }, new AbortController().signal));
const cols: BuilderColumn[] = [{ name: "id", kind: "integer" }, { name: "name", kind: "text" }, { name: "age", kind: "integer" }, { name: "ok", kind: "boolean" }];
const input = (driver: string, quote: (s: string) => string, extra: Partial<Parameters<typeof buildSelect>[0]> = {}) => ({ driver, quote, table: "people", columns: cols, select: [], where: [], limit: 100, ...extra });

describe("query builder (text)", () => {
  it("guesses a column kind from the native type", () => {
    expect(["int4", "bigint", "smallint unsigned", "serial", "integer"].map(kindOfNative)).toEqual(["integer", "integer", "integer", "integer", "integer"]);
    expect(["numeric(10,2)", "double precision", "NUMBER", "float8"].map(kindOfNative)).toEqual(["decimal", "decimal", "decimal", "decimal"]);
    expect(["boolean", "tinyint(1)", "varchar(20)", "text", "jsonb", "bytea", "interval"].map(kindOfNative)).toEqual(["boolean", "integer", "text", "text", "json", "binary", "text"]);
  });
  const q = (s: string) => `"${s}"`;
  it("builds the statement per driver", () => {
    expect(buildSelect(input("postgres", q, { select: ["name"], where: [{ column: "age", op: ">=", value: "30" }, { column: "name", op: "LIKE", value: "O'B%" }], orderBy: [{ column: "age", desc: true }], limit: 5 })))
      .toBe(`SELECT "name" FROM "people" WHERE "age" >= 30 AND "name" LIKE 'O''B%' ORDER BY "age" DESC LIMIT 5`);
    expect(buildSelect(input("mssql", q, { limit: 3 }))).toBe(`SELECT TOP 3 * FROM "people"`);
    expect(buildSelect(input("oracle", q, { limit: 3 }))).toBe(`SELECT * FROM "people" FETCH FIRST 3 ROWS ONLY`);
    expect(buildSelect(input("mysql", q, { where: [{ column: "name", op: "=", value: "a\\b" }] }))).toContain(`'a\\\\b'`);
  });
  it("rejects values that do not fit the column and unknown names", () => {
    expect(() => buildSelect(input("postgres", q, { where: [{ column: "age", op: "=", value: "1; DROP TABLE people" }] }))).toThrow(BuilderError);
    expect(() => buildSelect(input("postgres", q, { where: [{ column: "nope", op: "=", value: "1" }] }))).toThrow(BuilderError);
    expect(() => buildSelect(input("postgres", q, { where: [{ column: "ok", op: "=", value: "maybe" }] }))).toThrow(BuilderError);
    expect(() => buildSelect(input("postgres", q, { where: [{ column: "age", op: "LIKE", value: "1" }] }))).toThrow(BuilderError);
    expect(buildSelect(input("postgres", q, { where: [{ column: "id", op: "IN", value: "1, 2,3" }, { column: "name", op: "IS NULL" }] }))).toContain(`"id" IN (1, 2, 3) AND "name" IS NULL`);
  });
});

const pg = Number(process.env.RZ_PG_PORT ?? 54329), my = Number(process.env.RZ_MYSQL_PORT ?? 33069);
const engines: { name: string; plugin: DriverPlugin; port: number; admin: ResolvedConnectionConfig; cfg: (db: string) => ResolvedConnectionConfig; create: string; bool: string }[] = [
  { name: "postgres", plugin: postgresDriver, port: pg, admin: { host: "localhost", port: pg, user: "postgres", password: "rizoma_test", ssl: false, database: "postgres" }, cfg: (db) => ({ host: "localhost", port: pg, user: "postgres", password: "rizoma_test", ssl: false, database: db }), create: "CREATE TABLE people (id int PRIMARY KEY, name text, age int, ok boolean)", bool: "true" },
  { name: "mysql", plugin: mysqlDriver, port: my, admin: { host: "127.0.0.1", port: my, user: "root", password: "rizoma_test", ssl: false }, cfg: (db) => ({ host: "127.0.0.1", port: my, user: "root", password: "rizoma_test", ssl: false, database: db }), create: "CREATE TABLE people (id int PRIMARY KEY, name varchar(40), age int, ok boolean)", bool: "true" },
];
const ups = await Promise.all(engines.map((e) => engineUp("127.0.0.1", e.port, e.name)));
engines.forEach((e, n) => describe.skipIf(!ups[n])(`query builder on ${e.name}`, () => {
  let conn: Connection;
  beforeAll(async () => {
    const db = `rz_${randomBytes(4).toString("hex")}`;
    const a = await e.plugin.connect(e.admin, { log() {} }); await run(a, `CREATE DATABASE ${db}`); await a.close();
    conn = await e.plugin.connect(e.cfg(db), { log() {} });
    await run(conn, e.create);
    for (const [id, name, age, ok] of [[1, "Ann", 30, e.bool], [2, "O'Brien", 41, "false"], [3, "Back\\slash", 25, e.bool], [4, "Zoë", 41, "false"]]) await run(conn, `INSERT INTO people VALUES (${id}, '${String(name).replaceAll("\\", e.name === "mysql" ? "\\\\" : "\\").replaceAll("'", "''")}', ${age}, ${ok})`);
  });
  afterAll(async () => { await conn?.close(); });
  const ids = async (sql: string) => (await run(conn, sql)).rows.map((r) => Number(r[0]));
  it("answers what the choices say, including awkward text", async () => {
    const b = (extra: Partial<Parameters<typeof buildSelect>[0]>) => buildSelect(input(e.name, conn.quoteIdent, { select: ["id"], orderBy: [{ column: "id", desc: false }], ...extra }));
    expect(await ids(b({ where: [{ column: "age", op: ">=", value: "40" }] }))).toEqual([2, 4]);
    expect(await ids(b({ where: [{ column: "name", op: "=", value: "O'Brien" }] }))).toEqual([2]);
    expect(await ids(b({ where: [{ column: "name", op: "=", value: "Back\\slash" }] }))).toEqual([3]);
    expect(await ids(b({ where: [{ column: "name", op: "=", value: "Zoë" }] }))).toEqual([4]);
    expect(await ids(b({ where: [{ column: "ok", op: "=", value: "true" }] }))).toEqual([1, 3]);
    expect(await ids(b({ where: [{ column: "id", op: "IN", value: "1,4" }] }))).toEqual([1, 4]);
    expect(await ids(b({ where: [{ column: "age", op: "=", value: "41" }], orderBy: [{ column: "id", desc: true }], limit: 1 }))).toEqual([4]);
  });
}));
