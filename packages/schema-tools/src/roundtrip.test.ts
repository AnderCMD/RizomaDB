import { describe, it, expect } from "vitest";
import { collect, type Connection } from "@rizomadb/driver-api";
import { available, engines, wanted, type EngineId } from "@rizomadb/test-engines";
import { buildModel, createScript, diffModels, migrationStatements, type ColumnM, type Dialect, type SchemaModel } from "./index.js";

const T: Record<EngineId, { int: string; big: string; str: string; text: string; dec: string; bool: string; ts: string; def: string }> = {
  sqlite: { int: "INTEGER", big: "INTEGER", str: "TEXT", text: "TEXT", dec: "NUMERIC", bool: "INTEGER", ts: "TEXT", def: "'draft'" },
  postgres: { int: "integer", big: "bigint", str: "character varying(100)", text: "text", dec: "numeric(10,2)", bool: "boolean", ts: "timestamp", def: "'draft'" },
  mysql: { int: "int", big: "bigint", str: "varchar(100)", text: "text", dec: "decimal(10,2)", bool: "tinyint(1)", ts: "datetime", def: "'draft'" },
  mssql: { int: "int", big: "bigint", str: "nvarchar(100)", text: "nvarchar(max)", dec: "decimal(10,2)", bool: "bit", ts: "datetime2", def: "'draft'" },
  oracle: { int: "NUMBER(10)", big: "NUMBER(19)", str: "VARCHAR2(100)", text: "CLOB", dec: "NUMBER(10,2)", bool: "NUMBER(1)", ts: "TIMESTAMP", def: "'draft'" },
};

const col = (name: string, type: string, nullable = true, def?: string): ColumnM => ({ name, type, nullable, ...(def !== undefined ? { default: def } : {}) });

function design(d: Dialect): SchemaModel {
  const t = T[d];
  return { dialect: d, tables: [
    { name: "authors", columns: [col("id", t.int, false), col("name", t.str, false), col("bio", t.text), col("rating", t.dec)], primaryKey: ["id"],
      indexes: [{ name: "ix_authors_name", columns: ["name"], unique: true }], foreignKeys: [] },
    { name: "books", columns: [col("id", t.int, false), col("author_id", t.int, false), col("title", t.str, false), col("status", t.str, false, t.def), col("pages", t.int, true, "0"), col("published", t.bool), col("created", t.ts)], primaryKey: ["id"],
      indexes: [{ name: "ix_books_author_title", columns: ["author_id", "title"], unique: false }],
      foreignKeys: [{ name: "fk_books_author", columns: ["author_id"], refTable: "authors", refColumns: ["id"] }] },
  ] };
}

async function introspect(conn: Connection, d: Dialect): Promise<SchemaModel> {
  const api = conn.introspect();
  return buildModel(d, await api.describeSchema!(), await api.indexes!(), await api.foreignKeys!());
}
const exec = async (conn: Connection, sql: string) => { await collect(conn.execute({ sql }, new AbortController().signal)); };

for (const e of engines) {
  const up = wanted(e.id) && (await available(e));
  describe.skipIf(!up)(`schema round-trip on ${e.id}`, () => {
    it("design → DDL → apply → introspection is identical, then migrations converge", async () => {
      const conn = await e.plugin.connect(await e.freshConfig(), { log() {} });
      const d = e.id as Dialect;
      const v1 = design(d);
      for (const s of createScript(v1)) await exec(conn, s);
      const got1 = await introspect(conn, d);
      const first = diffModels(got1, v1);
      expect(first.changes, JSON.stringify(first.changes.map((c) => c.kind + ":" + ("what" in c ? c.what : "")), null, 1)).toEqual([]);

      // evolve the design: add column + index + table, widen a column, drop a column
      const t = T[d];
      const v2: SchemaModel = { dialect: d, tables: [
        { ...v1.tables[0]!, columns: [...v1.tables[0]!.columns.filter((c) => c.name !== "bio"), col("email", t.str)], indexes: [...v1.tables[0]!.indexes, { name: "ix_authors_email", columns: ["email"], unique: false }] },
        { ...v1.tables[1]!, columns: [...v1.tables[1]!.columns, col("isbn", t.str)] },
        { name: "tags", columns: [col("id", t.int, false), col("label", t.str, false)], primaryKey: ["id"], indexes: [], foreignKeys: [] },
      ] };
      const plan = diffModels(got1, v2);
      expect(plan.identical).toBe(false);
      const stmts = migrationStatements(d, plan.changes);
      expect(stmts.some((s) => s.destructive)).toBe(true);
      for (const s of stmts) if (!s.sql.startsWith("--")) await exec(conn, s.sql);
      const got2 = await introspect(conn, d);
      const second = diffModels(got2, v2);
      expect(second.changes, JSON.stringify(second.changes.map((c) => c.kind), null, 1)).toEqual([]);

      // and back again: the reverse migration restores the original design
      const back = migrationStatements(d, diffModels(got2, v1).changes);
      for (const s of back) if (!s.sql.startsWith("--") && !s.manual) await exec(conn, s.sql);
      expect(diffModels(await introspect(conn, d), v1).changes).toEqual([]);
      await conn.close();
    }, 60_000);
  });
}
