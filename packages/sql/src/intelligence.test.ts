import { describe, it, expect } from "vitest";
import { SchemaIndex, bindParameters, complete, diagnose, findParameters, formatSql, analyzeContext } from "./index.js";
import type { ForeignKey, TableInfo } from "@rizomadb/driver-api";

const col = (name: string, nativeType = "int", primaryKey = false) => ({ name, nativeType, nullable: !primaryKey, primaryKey });
const tables: TableInfo[] = [
  { schema: "public", name: "customers", kind: "table", columns: [col("id", "int", true), col("name", "text"), col("email", "text")] },
  { schema: "public", name: "orders", kind: "table", columns: [col("id", "int", true), col("customer_id"), col("total", "numeric"), col("created_at", "timestamp")] },
  { schema: "public", name: "order_items", kind: "table", columns: [col("id", "int", true), col("order_id"), col("sku", "text")] },
  { schema: "public", name: "active_customers", kind: "view", columns: [col("id"), col("name", "text")] },
];
const fks: ForeignKey[] = [
  { name: "orders_customer_fk", from: { schema: "public", table: "orders", columns: ["customer_id"] }, to: { schema: "public", table: "customers", columns: ["id"] } },
  { name: "items_order_fk", from: { schema: "public", table: "order_items", columns: ["order_id"] }, to: { schema: "public", table: "orders", columns: ["id"] } },
];
const schema = new SchemaIndex(tables, fks);
const at = (sql: string, d: "postgres" | "mysql" | "mssql" = "postgres") => { const i = sql.indexOf("|"); return complete(sql.replace("|", ""), i, schema, d); };
const labels = (r: { items: { label: string }[] }) => r.items.map((i) => i.label);

describe("completion", () => {
  it("suggests tables after FROM, filtered by prefix", () => {
    expect(labels(at("select * from cu|"))).toEqual(expect.arrayContaining(["customers"]));
    expect(labels(at("select * from cu|"))).not.toContain("orders");
    expect(at("select * from |").items.length).toBeGreaterThan(3);
  });
  it("resolves aliases for column completion, including aliases defined after the cursor", () => {
    expect(labels(at("select c.| from customers c"))).toEqual(["id", "name", "email"]);
    expect(labels(at("select c.na| from customers as c join orders o on o.customer_id = c.id"))).toEqual(["name"]);
    expect(labels(at("select o.| from customers c join orders o on 1=1"))).toContain("customer_id");
  });
  it("completes columns of all tables in scope, qualifying ambiguous names", () => {
    const l = labels(at("select | from customers c join orders o on o.customer_id = c.id"));
    expect(l).toEqual(expect.arrayContaining(["c.id", "o.id", "name", "total", "c", "o"]));
  });
  it("suggests FK join conditions after ON and related tables after JOIN", () => {
    expect(labels(at("select * from orders o join customers c on |"))).toContain("c.id = o.customer_id");
    const j = at("select * from orders o join |");
    expect(j.items[0]!.detail).toBe("related by foreign key");
    expect(labels(j).slice(0, 2).sort()).toEqual(["customers", "order_items"]);
  });
  it("understands CTEs and derived tables", () => {
    expect(labels(at("with big as (select id, total as amount from orders) select b.| from big b"))).toEqual(["id", "amount"]);
    expect(labels(at("select t.| from (select name as n, email from customers) t"))).toEqual(["n", "email"]);
    expect(labels(at("with big as (select 1) select * from |"))).toContain("big");
  });
  it("handles subquery scopes and schema-qualified tables", () => {
    expect(labels(at("select * from customers c where exists (select 1 from orders o where o.customer_id = c.|)"))).toEqual(["id", "name", "email"]);
    expect(labels(at("select * from public.|"))).toEqual(expect.arrayContaining(["customers", "orders"]));
    expect(labels(at("update customers set | where id = 1"))).toEqual(expect.arrayContaining(["name", "email"]));
  });
  it("quotes identifiers that need it per dialect", () => {
    const s = new SchemaIndex([{ name: "Order Items", kind: "table", columns: [col("Unit Price")] }]);
    expect(complete("select * from ", 14, s, "mssql").items[0]!.insertText).toBe("[Order Items]");
    expect(complete("select * from ", 14, s, "mysql").items[0]!.insertText).toBe("`Order Items`");
    expect(complete("select * from ", 14, s, "postgres").items[0]!.insertText).toBe('"Order Items"');
  });
  it("multi-statement scripts only look at the current statement", () => {
    expect(labels(at("select * from orders; select | from customers"))).toContain("email");
    expect(labels(at("select * from orders; select | from customers"))).not.toContain("total");
  });
  it("never throws on garbage", () => {
    for (const s of ["", "(((|", "select from where |", "'unterminated |", "select a.b.c.|", "with |"]) expect(() => at(s)).not.toThrow();
  });
  it("meets the latency budget with 5000 tables", () => {
    const big: TableInfo[] = Array.from({ length: 5000 }, (_, i) => ({ schema: "public", name: `table_${String(i).padStart(4, "0")}`, kind: "table", columns: Array.from({ length: 20 }, (_, c) => col(`col_${c}`)) }));
    const idx = new SchemaIndex(big);
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) complete("select * from table_00", 22, idx, "postgres");
    for (let i = 0; i < 50; i++) complete("select t.| from table_0042 t".replace("|", ""), 9, idx, "postgres");
    const avg = (performance.now() - t0) / 100;
    expect(avg).toBeLessThan(100);
    console.log(`completion avg ${avg.toFixed(2)} ms over 5000 tables`);
  });
});

describe("context", () => {
  it("reports clause and prefix", () => {
    const sql = "select a from t where x = 1 order by na";
    const c = analyzeContext(sql, sql.length, "postgres");
    expect(c.clause).toBe("order"); expect(c.prefix).toBe("na");
  });
});

describe("diagnostics", () => {
  it("warns on UPDATE/DELETE without WHERE and destructive DDL", () => {
    const d = diagnose("update customers set name = 'x'; delete from orders where id = 1; drop table t", "postgres");
    expect(d.map((x) => x.code)).toEqual(["no-where", "destructive"]);
  });
  it("flags unknown tables only when the schema is loaded, and respects CTEs", () => {
    expect(diagnose("select * from nope", "postgres", schema).map((d) => d.code)).toEqual(["unknown-table"]);
    expect(diagnose("select * from nope", "postgres").length).toBe(0);
    expect(diagnose("with nope as (select 1) select * from nope", "postgres", schema)).toEqual([]);
    expect(diagnose("select * from customers c join orders o on 1=1", "postgres", schema)).toEqual([]);
  });
  it("reports unterminated strings and comments with positions", () => {
    const d = diagnose("select 'abc", "postgres");
    expect(d[0]).toMatchObject({ code: "unterminated-string", start: 7 });
    expect(diagnose("select /* x", "postgres")[0]!.code).toBe("unterminated-comment");
  });
});

describe("parameters", () => {
  it("finds and binds named, numbered and positional parameters per dialect", () => {
    expect(findParameters("select * from t where a = :a and b = :a and c = :c", "oracle").map((p) => [p.name, p.occurrences.length])).toEqual([["a", 2], ["c", 1]]);
    expect(findParameters("select $1, $2, $1", "postgres").map((p) => p.name)).toEqual(["1", "2"]);
    expect(findParameters("select ?, ?", "mysql").map((p) => p.name)).toEqual(["1", "2"]);
    const b = bindParameters("select * from t where a = :a and b = :a", "oracle", { a: 5 }, (i) => `:${i}`);
    expect(b).toEqual({ sql: "select * from t where a = :1 and b = :2", params: [5, 5], missing: [] });
    expect(bindParameters("where x = @x", "mssql", {}, (i) => `@p${i}`).missing).toEqual(["x"]);
  });
  it("ignores MySQL user variables, T-SQL DECLAREd variables, globals, casts and string contents", () => {
    expect(findParameters("set @v = 1; select @v", "mysql")).toEqual([]);
    expect(findParameters("declare @n int = 1; select @n, @@version, @real", "mssql").map((p) => p.name)).toEqual(["real"]);
    expect(findParameters("select a::int, ':x' from t", "postgres")).toEqual([]);
  });
});

describe("formatter", () => {
  it("formats per dialect, keeps parameters, and never throws", () => {
    expect(formatSql("select a,b from t where x=1 and y=:y", "oracle")).toContain("WHERE");
    expect(formatSql("select * from [My Table]", "mssql")).toContain("[My Table]");
    expect(formatSql("select $1, $2", "postgres")).toContain("$1");
    expect(formatSql("select 'unterminated", "postgres")).toBeTypeOf("string");
  });
});
