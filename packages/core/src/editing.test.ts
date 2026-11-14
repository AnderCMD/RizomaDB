import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import pg from "pg";
import mysql from "mysql2/promise";
import oracledb from "oracledb";
import { Connection as Tds, Request } from "tedious";
import { collect, type Connection, type DriverPlugin, type ResolvedConnectionConfig } from "@rizomadb/driver-api";
import { sqliteDriver } from "@rizomadb/driver-sqlite";
import { postgresDriver } from "@rizomadb/driver-postgres";
import { mysqlDriver } from "@rizomadb/driver-mysql";
import { mssqlDriver } from "@rizomadb/driver-mssql";
import { oracleDriver } from "@rizomadb/driver-oracle";
import { applyChanges, chooseRowKey, EditError, EditQueue, generate, defaultEffectivePolicy, keyColumns, keySource, type EditTarget } from "./index.js";

const ctl = new AbortController().signal;
const run = (c: Connection, sql: string, params: never[] = []) => collect(c.execute({ sql, params }, ctl));

interface Engine { id: string; plugin: DriverPlugin; upper?: boolean; config: () => Promise<ResolvedConnectionConfig>; ddl: string[] }

const rand = () => randomBytes(5).toString("hex");
const engines: Engine[] = [
  { id: "sqlite", plugin: sqliteDriver, config: async () => ({ path: ":memory:" }),
    ddl: ["CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL, note TEXT)", "CREATE TABLE nokey (a INTEGER, b TEXT)"] },
  { id: "postgres", plugin: postgresDriver, ddl: ["CREATE TABLE people (id integer PRIMARY KEY, name text NOT NULL, note text)", "CREATE TABLE nokey (a integer, b text)"],
    config: async () => {
      const base = { host: "localhost", port: Number(process.env.RZ_PG_PORT ?? 54329), user: "postgres", password: "rizoma_test", ssl: false }; const db = `rz_${rand()}`;
      const a = new pg.Client({ ...base, database: "postgres" }); await a.connect(); await a.query(`CREATE DATABASE ${db}`); await a.end(); return { ...base, database: db };
    } },
  { id: "mysql", plugin: mysqlDriver, ddl: ["CREATE TABLE people (id INT PRIMARY KEY, name VARCHAR(100) NOT NULL, note VARCHAR(100))", "CREATE TABLE nokey (a INT, b VARCHAR(10))"],
    config: async () => {
      const base = { host: "127.0.0.1", port: Number(process.env.RZ_MYSQL_PORT ?? 33069), user: "root", password: "rizoma_test", ssl: false }; const db = `rz_${rand()}`;
      const a = await mysql.createConnection(base); await a.query(`CREATE DATABASE ${db}`); await a.end(); return { ...base, database: db };
    } },
  { id: "mssql", plugin: mssqlDriver, ddl: ["CREATE TABLE people (id INT PRIMARY KEY, name NVARCHAR(100) NOT NULL, note NVARCHAR(100))", "CREATE TABLE nokey (a INT, b NVARCHAR(10))"],
    config: async () => {
      const base = { host: "127.0.0.1", port: Number(process.env.RZ_MSSQL_PORT ?? 14339), user: "sa", password: "Rizoma_test1", ssl: true, sslVerify: false }; const db = `rz_${rand()}`;
      await new Promise<void>((res, rej) => { const c = new Tds({ server: base.host, authentication: { type: "default", options: { userName: base.user, password: base.password } }, options: { port: base.port, encrypt: true, trustServerCertificate: true } });
        c.connect((e) => { if (e) return rej(e); c.execSql(new Request(`CREATE DATABASE ${db}`, (e2) => { c.close(); if (e2) rej(e2); else res(); })); }); });
      return { ...base, database: db };
    } },
  { id: "oracle", plugin: oracleDriver, upper: true, ddl: ["CREATE TABLE people (id NUMBER PRIMARY KEY, name VARCHAR2(100) NOT NULL, note VARCHAR2(100))", "CREATE TABLE nokey (a NUMBER, b VARCHAR2(10))"],
    config: async () => {
      const base = { host: "127.0.0.1", port: Number(process.env.RZ_ORACLE_PORT ?? 15219), service: "FREEPDB1", password: "rizoma_test" }; const user = `RZ_${rand().toUpperCase()}`;
      const a = await oracledb.getConnection({ user: "system", password: base.password, connectString: `${base.host}:${base.port}/${base.service}` });
      await a.execute(`CREATE USER ${user} IDENTIFIED BY "rizoma_test" QUOTA UNLIMITED ON USERS`); await a.execute(`GRANT CREATE SESSION, CREATE TABLE TO ${user}`); await a.close();
      return { ...base, user };
    } },
];

const wanted = (process.env.RZ_ENGINES ?? "sqlite").split(",");

for (const e of engines) {
  describe.runIf(wanted.includes(e.id) || wanted.includes("all"))(`edit queue on ${e.id}`, () => {
    const N = (s: string) => (e.upper ? s.toUpperCase() : s);
    async function setup(readOnly = false) {
      const cfg = await e.config();
      const admin = await e.plugin.connect(cfg, { log() {} });
      for (const s of e.ddl) await run(admin, s);
      await run(admin, "INSERT INTO people (id, name, note) VALUES (1, 'Ada', NULL)");
      await run(admin, "INSERT INTO people (id, name, note) VALUES (2, 'Linus', 'x')");
      const conn = readOnly ? await e.plugin.connect({ ...cfg, readOnly: true }, { log() {} }) : admin;
      const describe = async (t: string): Promise<EditTarget> => {
        const found = (await admin.introspect().listTables()).find((x) => x.name.toLowerCase() === t)!;
        const info = await admin.introspect().describeTable({ name: found.name, ...(found.schema ? { schema: found.schema } : {}) });
        return { ...(found.schema ? { schema: found.schema } : {}), table: found.name, columns: info.columns! };
      };
      const people = await describe("people");
      const rows = async () => (await run(admin, `SELECT ${N("id")}, ${N("name")}, ${N("note")} FROM people ORDER BY 1`)).rows.map((r) => r.map((v) => (typeof v === "bigint" ? Number(v) : v)));
      const base = { conn, plugin: e.plugin, environment: "dev", readOnly: false, policy: defaultEffectivePolicy, confirm: async () => true };
      return { admin, conn, people, describe, rows, base, cfg, close: async () => { if (conn !== admin) await conn.close(); await admin.close(); } };
    }

    it("applies insert + update + delete atomically, with exact generated SQL", async () => {
      const t = await setup();
      const q = new EditQueue();
      q.add({ kind: "insert", values: { [N("id")]: 3, [N("name")]: "Grace", [N("note")]: null } });
      q.add({ kind: "update", key: { [N("id")]: 1 }, before: { [N("name")]: "Ada" }, set: { [N("name")]: "Ada L." } });
      q.add({ kind: "delete", key: { [N("id")]: 2 }, before: {} });
      const preview = q.preview(e.plugin, t.people);
      expect(preview[1]!.sql).toContain("UPDATE");
      expect(preview[1]!.params).toContain("Ada L.");
      expect((await applyChanges(q.list(), { ...t.base, target: t.people })).applied).toBe(3);
      expect(await t.rows()).toEqual([[1, "Ada L.", null], [3, "Grace", null]]);
      await t.close();
    });

    it("detects concurrent modification and rolls everything back", async () => {
      const t = await setup();
      await run(t.admin, "UPDATE people SET name = 'Changed' WHERE id = 1");
      const changes = [
        { kind: "insert" as const, values: { [N("id")]: 9, [N("name")]: "Late" } },
        { kind: "update" as const, key: { [N("id")]: 1 }, before: { [N("name")]: "Ada" }, set: { [N("name")]: "Mine" } },
      ];
      await expect(applyChanges(changes, { ...t.base, target: t.people })).rejects.toMatchObject({ code: "conflict", changeIndex: 1 });
      expect(await t.rows()).toEqual([[1, "Changed", null], [2, "Linus", "x"]]);
      await t.close();
    });

    it("treats NULL correctly in concurrency predicates and values", async () => {
      const t = await setup();
      await applyChanges([{ kind: "update", key: { [N("id")]: 1 }, before: { [N("note")]: null }, set: { [N("note")]: "n" } },
                          { kind: "update", key: { [N("id")]: 2 }, before: { [N("note")]: "x" }, set: { [N("note")]: null } }], { ...t.base, target: t.people });
      expect(await t.rows()).toEqual([[1, "Ada", "n"], [2, "Linus", null]]);
      await t.close();
    });

    it("stores hostile strings literally (no injection) via bound parameters", async () => {
      const t = await setup();
      const evil = "x'); DROP TABLE people; --";
      await applyChanges([{ kind: "insert", values: { [N("id")]: 5, [N("name")]: evil } }], { ...t.base, target: t.people });
      expect((await t.rows()).find((r) => r[0] === 5)?.[1]).toBe(evil);
      await t.close();
    });

    it("refuses tables without a primary key", async () => {
      const t = await setup();
      const nk = await t.describe("nokey");
      expect(() => generate(e.plugin, nk, { kind: "delete", key: {}, before: {} })).toThrow(EditError);
      await expect(applyChanges([{ kind: "delete", key: {}, before: {} }], { ...t.base, target: nk })).rejects.toMatchObject({ code: "no-key" });
      await t.close();
    });

    it("edits a table without a primary key by its row values, and refuses duplicate rows", async () => {
      const t = await setup();
      await run(t.admin, "INSERT INTO nokey (a, b) VALUES (1, 'x')");
      await run(t.admin, "INSERT INTO nokey (a, b) VALUES (2, 'y')");
      await run(t.admin, "INSERT INTO nokey (a, b) VALUES (2, 'y')");
      const base = await t.describe("nokey");
      const nk: EditTarget = { ...base, rowKey: chooseRowKey(base.columns, [], { lobText: e.id === "mssql" }) };
      expect(keySource(nk)).toBe("row");
      const [A, B] = [N("a"), N("b")];
      const all = async () => (await run(t.admin, `SELECT ${A}, ${B} FROM nokey ORDER BY 1, 2`)).rows.map((r) => r.map((v) => (typeof v === "bigint" ? Number(v) : v)));
      await applyChanges([{ kind: "update", key: { [A]: 1, [B]: "x" }, before: { [B]: "x" }, set: { [B]: "z" } }], { ...t.base, target: nk });
      expect(await all()).toEqual([[1, "z"], [2, "y"], [2, "y"]]);
      // Two identical rows: the statement would touch both, so the batch rolls back.
      await expect(applyChanges([{ kind: "delete", key: { [A]: 2, [B]: "y" }, before: {} }], { ...t.base, target: nk })).rejects.toMatchObject({ code: "conflict" });
      expect(await all()).toEqual([[1, "z"], [2, "y"], [2, "y"]]);
      await applyChanges([{ kind: "delete", key: { [A]: 1, [B]: "z" }, before: {} }], { ...t.base, target: nk });
      expect(await all()).toEqual([[2, "y"], [2, "y"]]);
      await t.close();
    });

    it("uses a unique index on NOT NULL columns as the key of a table without a primary key", async () => {
      const t = await setup();
      await run(t.admin, `CREATE TABLE uq (a ${e.id === "oracle" ? "NUMBER" : "INT"} NOT NULL, b ${e.id === "oracle" ? "VARCHAR2(10)" : "VARCHAR(10)"})`);
      await run(t.admin, "CREATE UNIQUE INDEX uq_a ON uq (a)");
      await run(t.admin, "INSERT INTO uq (a, b) VALUES (1, 'x')");
      const base = await t.describe("uq");
      const idx = (await t.admin.introspect().indexes?.(base.schema)) ?? [];
      const uniques = idx.filter((i) => i.unique && i.table.toLowerCase() === "uq").map((i) => i.columns);
      const rowKey = chooseRowKey(base.columns, uniques);
      const target: EditTarget = { ...base, ...(rowKey ? { rowKey } : {}) };
      // InnoDB promotes the first UNIQUE NOT NULL index of a table without a primary key to its clustered key, and
      // MySQL reports that column as PRI: the table is then edited by it as a primary key.
      expect(keyColumns(target)).toEqual([N("a")]);
      expect(keySource(target)).toBe(e.id === "mysql" ? "primary" : "unique");
      const preview = generate(e.plugin, target, { kind: "update", key: { [N("a")]: 1 }, before: { [N("b")]: "x" }, set: { [N("b")]: "y" } });
      expect(preview.sql).toContain("WHERE");
      await applyChanges([preview.change], { ...t.base, target });
      expect((await run(t.admin, `SELECT ${N("b")} FROM uq`)).rows).toEqual([["y"]]);
      await t.close();
    });

    it("validates NOT NULL before touching the database", async () => {
      const t = await setup();
      await expect(applyChanges([{ kind: "update", key: { [N("id")]: 1 }, before: { [N("name")]: "Ada" }, set: { [N("name")]: null } }], { ...t.base, target: t.people }))
        .rejects.toMatchObject({ code: "validation" });
      await t.close();
    });

    it("blocks edits on read-only connections and prod environments, and honors declined confirmation", async () => {
      const t = await setup(true);
      const ch = [{ kind: "delete" as const, key: { [N("id")]: 1 }, before: {} }];
      await expect(applyChanges(ch, { ...t.base, readOnly: true, target: t.people })).rejects.toMatchObject({ code: "blocked" });
      await expect(applyChanges(ch, { ...t.base, environment: "prod", target: t.people })).rejects.toMatchObject({ code: "blocked" });
      await expect(applyChanges(ch, { ...t.base, confirm: async () => false, target: t.people })).rejects.toMatchObject({ code: "declined" });
      expect((await t.rows()).length).toBe(2);
      await t.close();
    });

    it("supports undo/redo of queued changes", () => {
      const q = new EditQueue();
      q.add({ kind: "insert", values: { a: 1 } }); q.add({ kind: "insert", values: { a: 2 } });
      q.undo(); expect(q.size).toBe(1); q.redo(); expect(q.size).toBe(2);
      q.undo(); q.add({ kind: "insert", values: { a: 3 } }); q.redo(); expect(q.size).toBe(2);
    });
  });
}
