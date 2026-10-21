import { describe, it, expect } from "vitest";
import { columnStatements, type TableM } from "./index.js";

const t = (schema?: string): TableM => ({ name: "people", ...(schema ? { schema } : {}), columns: [{ name: "id", type: "integer", nullable: false }, { name: "name", type: "text", nullable: true }], primaryKey: ["id"], indexes: [], foreignKeys: [] });

describe("columnStatements", () => {
  it("renames with a real RENAME on every engine, never drop + add", () => {
    expect(columnStatements("postgres", t("public"), { op: "rename", column: "name", to: "full name" })[0]!.sql).toBe('ALTER TABLE "public"."people" RENAME COLUMN "name" TO "full name"');
    expect(columnStatements("mysql", t(), { op: "rename", column: "name", to: "n" })[0]!.sql).toBe("ALTER TABLE `people` RENAME COLUMN `name` TO `n`");
    expect(columnStatements("mssql", t("dbo"), { op: "rename", column: "name", to: "o'n" })[0]!.sql).toBe("EXEC sp_rename N'dbo.people.name', N'o''n', N'COLUMN'");
    expect(columnStatements("sqlite", t(), { op: "rename", column: "name", to: "n" })[0]!.sql).toBe('ALTER TABLE "people" RENAME COLUMN "name" TO "n"');
  });
  it("rejects clashes, unknown columns and unsafe names", () => {
    expect(() => columnStatements("postgres", t(), { op: "rename", column: "name", to: "ID" })).toThrow(/already exists/);
    expect(() => columnStatements("postgres", t(), { op: "rename", column: "nope", to: "x" })).toThrow(/Unknown column/);
    expect(() => columnStatements("postgres", t(), { op: "rename", column: "name", to: "" })).toThrow();
    expect(() => columnStatements("postgres", t(), { op: "type", column: "name", type: "text; DROP TABLE x" })).toThrow(/Unsafe/);
  });
  it("changes type, nullability and default through the shared migration code", () => {
    expect(columnStatements("postgres", t(), { op: "type", column: "name", type: "varchar(40)" })[0]!.sql).toBe('ALTER TABLE "people" ALTER COLUMN "name" TYPE varchar(40)');
    const nn = columnStatements("postgres", t(), { op: "nullable", column: "name", nullable: false })[0]!;
    expect(nn.sql).toBe('ALTER TABLE "people" ALTER COLUMN "name" SET NOT NULL'); expect(nn.destructive).toBeTruthy();
    expect(columnStatements("postgres", t(), { op: "default", column: "name", default: "'x'" })[0]!.sql).toBe('ALTER TABLE "people" ALTER COLUMN "name" SET DEFAULT \'x\'');
  });
  it("adds and drops columns, flagging the drop as destructive, and protects the primary key", () => {
    expect(columnStatements("mysql", t(), { op: "add", column: { name: "age", type: "int", nullable: true } })[0]!.sql).toBe("ALTER TABLE `people` ADD COLUMN `age` int");
    const d = columnStatements("postgres", t(), { op: "drop", column: "name" })[0]!;
    expect(d.sql).toBe('ALTER TABLE "people" DROP COLUMN "name"'); expect(d.destructive).toBeTruthy();
    expect(() => columnStatements("postgres", t(), { op: "drop", column: "id" })).toThrow(/primary key/);
  });
});
