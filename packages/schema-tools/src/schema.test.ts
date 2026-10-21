import { describe, it, expect } from "vitest";
import { buildModel, createScript, diffModels, migrationStatements, normalizeDefault, normalizeType, renderScript, toHtml, toMarkdown, toMermaid, toMigration, toPlantUml, toSvg, topoSort, assertFragment, type SchemaModel, type TableM } from "./index.js";

const t = (name: string, extra: Partial<TableM> = {}): TableM => ({ name, columns: [{ name: "id", type: "integer", nullable: false }], primaryKey: ["id"], indexes: [], foreignKeys: [], ...extra });
const model = (tables: TableM[], dialect: SchemaModel["dialect"] = "postgres"): SchemaModel => ({ dialect, tables });
const orders = t("orders", { columns: [{ name: "id", type: "integer", nullable: false }, { name: "customer_id", type: "integer", nullable: true }], foreignKeys: [{ name: "fk_o_c", columns: ["customer_id"], refTable: "customers", refColumns: ["id"] }], indexes: [{ name: "ix_o_c", columns: ["customer_id"], unique: false }] });
const customers = t("customers", { columns: [{ name: "id", type: "integer", nullable: false }, { name: "name", type: "text", nullable: false, default: "'x'" }] });

describe("normalization", () => {
  it("treats type aliases as equal per dialect", () => {
    expect(normalizeType("postgres", "int4")).toBe(normalizeType("postgres", "INTEGER"));
    expect(normalizeType("postgres", "varchar(50)")).toBe(normalizeType("postgres", "character varying(50)"));
    expect(normalizeType("mysql", "int(11)")).toBe(normalizeType("mysql", "int"));
    expect(normalizeType("mysql", "tinyint(1)")).not.toBe(normalizeType("mysql", "tinyint"));
    expect(normalizeType("oracle", "INTEGER")).toBe(normalizeType("oracle", "NUMBER(38)"));
    expect(normalizeType("postgres", "numeric(10, 2)")).toBe("numeric(10,2)");
  });
  it("strips casts, parentheses and quotes from defaults", () => {
    expect(normalizeDefault("'draft'::character varying")).toBe("draft");
    expect(normalizeDefault("((0))")).toBe("0");
    expect(normalizeDefault("'a''b'")).toBe("a'b");
    expect(normalizeDefault("NULL")).toBeUndefined();
  });
});

describe("DDL", () => {
  it("creates tables in dependency order with quoting per dialect", () => {
    const s = createScript(model([orders, customers]));
    expect(s[0]).toContain('CREATE TABLE "customers"');
    expect(s.join("\n").indexOf('"customers"')).toBeLessThan(s.join("\n").indexOf('CREATE TABLE "orders"'));
    expect(createScript(model([customers], "mysql"))[0]).toContain("`customers`");
    expect(createScript(model([customers], "mssql"))[0]).toContain("[customers]");
  });
  it("defers FKs of cyclic tables (except on SQLite)", () => {
    const a = t("a", { columns: [{ name: "id", type: "integer", nullable: false }, { name: "b_id", type: "integer", nullable: true }], foreignKeys: [{ name: "fk_a_b", columns: ["b_id"], refTable: "b", refColumns: ["id"] }] });
    const b = t("b", { columns: [{ name: "id", type: "integer", nullable: false }, { name: "a_id", type: "integer", nullable: true }], foreignKeys: [{ name: "fk_b_a", columns: ["a_id"], refTable: "a", refColumns: ["id"] }] });
    const pg = createScript(model([a, b]));
    expect(pg.filter((x) => x.startsWith("ALTER TABLE")).length).toBeGreaterThan(0);
    expect(createScript(model([a, b], "sqlite")).some((x) => x.startsWith("ALTER TABLE"))).toBe(false);
  });
  it("rejects statement-breaking fragments and bad identifiers", () => {
    expect(() => createScript(model([t("x", { columns: [{ name: "id", type: "int); DROP TABLE y; --", nullable: false }] })]))).toThrow(/Unsafe/);
    expect(() => assertFragment("default", "1; select 1")).toThrow();
    expect(() => assertFragment("default", "'a;b'")).not.toThrow();
    expect(() => createScript(model([t("")]))).toThrow(/Invalid identifier/);
  });
  it("escapes quote characters in identifiers", () => {
    expect(createScript(model([t('we"ird')]))[0]).toContain('"we""ird"');
  });
});

describe("diff and migrations", () => {
  const base = model([customers]);
  it("detects no change for identical models", () => { expect(diffModels(base, base).identical).toBe(true); });
  it("generates ordered, dialect-correct statements with destructive and manual flags", () => {
    const to = model([{ ...customers, columns: [{ name: "id", type: "bigint", nullable: false }, { name: "email", type: "text", nullable: true }], indexes: [{ name: "ix_email", columns: ["email"], unique: true }] }, orders]);
    const sql = migrationStatements("postgres", diffModels(base, to).changes);
    const text = sql.map((s) => s.sql);
    expect(text.some((s) => s.includes('DROP COLUMN "name"'))).toBe(true);
    expect(sql.find((s) => s.sql.includes('DROP COLUMN "name"'))!.destructive).toMatch(/data/);
    expect(text).toContain('ALTER TABLE "customers" ALTER COLUMN "id" TYPE bigint');
    expect(text.indexOf('CREATE TABLE "orders" (\n  "id" integer NOT NULL,\n  "customer_id" integer,\n  CONSTRAINT "pk_orders" PRIMARY KEY ("id"),\n  CONSTRAINT "fk_o_c" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id")\n)')).toBeGreaterThan(-1);
    expect(sql.findIndex((s) => s.sql.includes("DROP COLUMN"))).toBeLessThan(sql.findIndex((s) => s.sql.includes("CREATE TABLE")));
  });
  it("uses MODIFY on MySQL, ALTER COLUMN on SQL Server, MODIFY(...) on Oracle, and flags SQLite as manual", () => {
    const from = model([customers]); const to = model([{ ...customers, columns: [{ name: "id", type: "bigint", nullable: false }, customers.columns[1]!] }]);
    for (const [d, needle] of [["mysql", "MODIFY COLUMN"], ["mssql", "ALTER COLUMN"], ["oracle", "MODIFY ("]] as const) {
      const sql = migrationStatements(d, diffModels({ ...from, dialect: d }, { ...to, dialect: d }).changes).map((s) => s.sql).join("\n");
      expect(sql).toContain(needle);
    }
    expect(migrationStatements("sqlite", diffModels({ ...from, dialect: "sqlite" }, { ...to, dialect: "sqlite" }).changes)[0]!.manual).toMatch(/rebuild/);
  });
  it("drops dependents before parents", () => {
    const sql = migrationStatements("postgres", diffModels(model([customers, orders]), model([])).changes).map((s) => s.sql);
    expect(sql.findIndex((s) => s.includes('DROP TABLE "orders"'))).toBeLessThan(sql.findIndex((s) => s.includes('DROP TABLE "customers"')));
  });
  it("wraps scripts for Flyway and Liquibase", () => {
    const st = [{ sql: "CREATE TABLE a (id int)" }, { sql: "DROP TABLE b", destructive: "drops b" }];
    const fw = toMigration("flyway", "Add table A", st, { version: "2", now: new Date("2026-01-02T03:04:05Z") });
    expect(fw.fileName).toBe("V2__add_table_a.sql"); expect(fw.content).toContain("WARNING (destructive)");
    const lb = toMigration("liquibase", "Add table A", st, { now: new Date("2026-01-02T03:04:05Z") });
    expect(lb.content.startsWith("--liquibase formatted sql")).toBe(true); expect(lb.content).toContain("--changeset rizomadb:20260102030405-1");
    expect(renderScript(st)).toContain(";");
  });
});

describe("ER, documentation", () => {
  const m = model([customers, orders]);
  it("exports Mermaid, PlantUML and SVG with accessible metadata", () => {
    expect(toMermaid(m)).toContain("customers ||--o{ orders");
    expect(toPlantUml(m)).toContain("@startuml");
    const svg = toSvg(m, "Shop");
    expect(svg).toContain('role="img"'); expect(svg).toContain("<title>Shop</title>"); expect(svg).toContain('data-table="orders"');
    expect(topoSort(m.tables).order.map((x) => x.name)).toEqual(["customers", "orders"]);
  });
  it("escapes markup in documentation", () => {
    const evil = model([t("<script>x</script>")]);
    expect(toHtml(evil)).not.toContain("<script>x"); expect(toSvg(evil)).not.toContain("<script>x");
    expect(toMarkdown(m)).toContain("## orders");
  });
  it("builds a model from introspection and ignores MySQL implicit FK indexes", () => {
    const mm = buildModel("mysql", [{ name: "o", kind: "table", columns: [{ name: "id", nativeType: "int", nullable: false, primaryKey: true }, { name: "c", nativeType: "int", nullable: true, primaryKey: false }] }],
      [{ name: "fk_o_c", table: "o", columns: ["c"], unique: false, primary: false }, { name: "PRIMARY", table: "o", columns: ["id"], unique: true, primary: true }],
      [{ name: "fk_o_c", from: { table: "o", columns: ["c"] }, to: { table: "p", columns: ["id"] } }]);
    expect(mm.tables[0]!.indexes).toEqual([]); expect(mm.tables[0]!.foreignKeys).toHaveLength(1); expect(mm.tables[0]!.primaryKey).toEqual(["id"]);
  });
});
