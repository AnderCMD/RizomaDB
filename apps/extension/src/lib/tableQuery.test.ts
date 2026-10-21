import { describe, it, expect } from "vitest";
import { buildTableQuery, filterKindOf, FilterError } from "./tableQuery.js";

const q = (driver: string, extra: Partial<Parameters<typeof buildTableQuery>[0]> = {}) => buildTableQuery({ driver, quoted: '"t"', name: "t", where: "", order: "", limit: 100, ...extra });

describe("table query builder", () => {
  it("knows which engines take a filter", () => {
    expect([filterKindOf("postgres"), filterKindOf("mongodb"), filterKindOf("elasticsearch"), filterKindOf("neo4j"), filterKindOf("redis"), filterKindOf("hydradb")]).toEqual(["sql", "mongo", "es", "cypher", undefined, undefined]);
  });
  it("places WHERE, ORDER BY and the limit the way each SQL dialect wants", () => {
    expect(q("postgres", { where: "age > 30", order: "name DESC" })).toBe('SELECT * FROM "t" WHERE age > 30 ORDER BY name DESC LIMIT 100');
    expect(q("mysql")).toBe('SELECT * FROM "t" LIMIT 100');
    expect(q("mssql", { where: "a = 1" })).toBe('SELECT TOP 100 * FROM "t" WHERE a = 1');
    expect(q("oracle", { order: "id" })).toBe('SELECT * FROM "t" ORDER BY id FETCH FIRST 100 ROWS ONLY');
  });
  it("refuses fragments that could end the statement or hide the rest", () => {
    expect(() => q("postgres", { where: "1=1; DROP TABLE t" })).toThrow(FilterError);
    expect(() => q("postgres", { where: "1=1 -- x" })).toThrow(FilterError);
    expect(() => q("postgres", { order: "a /* c */" })).toThrow(FilterError);
    expect(q("postgres", { where: "note = 'a;b -- c'" })).toBe('SELECT * FROM "t" WHERE note = \'a;b -- c\' LIMIT 100');
  });
  it("builds a Mongo find with filter and sort, and keeps brackets paired", () => {
    expect(q("mongodb", { schema: "shop", name: "orders", where: '{ "status": "A" }', order: '{ "total": -1 }' })).toBe('db.getSiblingDB("shop").getCollection("orders").find({ "status": "A" }).sort({ "total": -1 }).limit(100)');
    expect(q("mongodb", { name: "x" })).toBe('db.getCollection("x").find({}).limit(100)');
    expect(() => q("mongodb", { where: "{}).drop(" })).toThrow(FilterError);
    expect(q("mongodb", { name: "x", where: '{ "a": "}" }' })).toContain('{ "a": "}" }');
  });
  it("builds an Elasticsearch search from a query string and a sort", () => {
    const r = q("elasticsearch", { name: "logs-*", where: "level:error", order: "ts:desc" });
    expect(r.startsWith("GET /logs-*/_search\n")).toBe(true);
    expect(JSON.parse(r.split("\n").slice(1).join("\n"))).toEqual({ size: 100, query: { query_string: { query: "level:error" } }, sort: [{ ts: { order: "desc" } }] });
    expect(() => q("elasticsearch", { name: "a/b" })).toThrow(FilterError);
    expect(() => q("elasticsearch", { name: "a", order: "x; y" })).toThrow(FilterError);
  });
  it("builds a Cypher match for Neo4j", () => {
    expect(q("neo4j", { quoted: "`Person`", where: "n.age > 30", order: "n.name" })).toBe("MATCH (n:`Person`) WHERE n.age > 30 RETURN n ORDER BY n.name LIMIT 100");
    expect(() => q("neo4j", { where: "n.a = 1; MATCH (m) DETACH DELETE m" })).toThrow(FilterError);
  });
  it("throws for engines without a filter", () => { expect(() => q("redis")).toThrow(FilterError); });
});
