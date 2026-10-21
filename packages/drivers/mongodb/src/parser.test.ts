import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { Long, ObjectId, Decimal128 } from "mongodb";
import { MongoSyntaxError, parseMongoCommand, parseMongoValue } from "./parser.js";

describe("mongo shell-lite parser", () => {
  it("parses find with relaxed JSON, chains and constructors", () => {
    const c = parseMongoCommand(`db.users.find({ age: { $gt: 18 }, 'name': /^a/i, tags: ["x", 'y',], _id: ObjectId("507f1f77bcf86cd799439011"), at: ISODate("2020-01-02T03:04:05Z") }, { name: 1 }).sort({ age: -1 }).limit(10);`);
    expect(c).toMatchObject({ target: "collection", collection: "users", method: "find", chain: [{ method: "sort", args: [{ age: -1 }] }, { method: "limit", args: [10] }] });
    const f = c.args[0] as Record<string, unknown>;
    expect(f.age).toEqual({ $gt: 18 }); expect(f.name).toEqual(/^a/i); expect(f.tags).toEqual(["x", "y"]);
    expect(f._id).toBeInstanceOf(ObjectId); expect((f.at as Date).toISOString()).toBe("2020-01-02T03:04:05.000Z");
  });
  it("supports getCollection, db-level commands, comments and big numbers", () => {
    expect(parseMongoCommand('db.getCollection("my-coll").countDocuments({})')).toMatchObject({ collection: "my-coll", method: "countDocuments" });
    expect(parseMongoCommand("db.runCommand({ ping: 1 })")).toMatchObject({ target: "db", method: "runCommand" });
    expect(parseMongoCommand("db.stats() // trailing comment")).toMatchObject({ target: "db", method: "stats" });
    const v = parseMongoValue('{ big: 9223372036854775807, l: NumberLong("5"), d: NumberDecimal("1.50"), neg: -3.5e2, i: NumberInt(7.9) }') as Record<string, unknown>;
    expect(v.big).toBeInstanceOf(Long); expect(String(v.big)).toBe("9223372036854775807"); expect(v.d).toBeInstanceOf(Decimal128); expect(v.neg).toBe(-350); expect(v.i).toBe(7);
  });
  it("rejects code execution, unknown functions, prototype keys and trailing junk with positions", () => {
    for (const bad of ['db.a.find({ $where: function() { return 1 } })', "db.a.find(process.exit())", "db.a.find({__proto__: 1})", "db.a.find({}); drop", "find({})", "db.a.find({", 'db.a.find("unterminated)', "db.a.find(/x"]) expect(() => parseMongoCommand(bad), bad).toThrow(MongoSyntaxError);
    try { parseMongoCommand("db.a.find({a: 1} x"); } catch (e) { expect((e as MongoSyntaxError).position).toBeGreaterThan(10); }
    expect(() => parseMongoValue("[".repeat(500))).toThrow(/too deep/);
  });
  it("never throws anything but MongoSyntaxError (fuzz)", () => {
    const frag = fc.constantFrom("db", ".", "a", "find", "(", ")", "{", "}", "[", "]", ":", ",", '"', "'", "/", "1", "-", "ObjectId", "$gt", "\\", " ", "\n", "new", ";", "é", "🌱", "//", "/*");
    fc.assert(fc.property(fc.array(frag, { maxLength: 40 }).map((a) => a.join("")), (s) => {
      try { parseMongoCommand(s); } catch (e) { expect(e).toBeInstanceOf(MongoSyntaxError); }
    }), { numRuns: 4000 });
  });
});

describe("opening a collection from the tree", () => {
  it("builds a command the shell parser accepts, targeting the collection's database", async () => {
    const { meta } = await import("./meta.js");
    const sql = meta.openCommand!({ schema: "shop", name: "or\"ders" }, 200);
    expect(sql).toBe('db.getSiblingDB("shop").getCollection("or\\"ders").find({}).limit(200)');
    expect(() => parseMongoCommand(sql)).not.toThrow();
    expect(() => parseMongoCommand(meta.openCommand!({ name: "plain" }, 5))).not.toThrow();
  });
});
