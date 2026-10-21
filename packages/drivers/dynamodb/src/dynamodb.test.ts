import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, type Connection, type Value } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { dynamodbDriver, assessPartiql, fromAttr, toAttr } from "./index.js";

describe("PartiQL risk classification", () => {
  const risk = (s: string) => assessPartiql(s).risk;
  it("classifies", () => {
    expect(risk('SELECT * FROM "t" WHERE pk = ?')).toBe("none"); expect(risk("select 1 from t -- DELETE")).toBe("none");
    expect(risk('INSERT INTO "t" VALUE {\'pk\': \'a\'}')).toBe("write"); expect(risk('UPDATE "t" SET a = 1 WHERE pk = \'x\'')).toBe("write");
    expect(risk('DELETE FROM "t" WHERE pk = \'x\'')).toBe("destructive");
    expect(risk("SELECT * FROM t; DELETE FROM t")).toBe("write"); expect(risk("DROP TABLE t")).toBe("write"); expect(risk("SELECT '; DELETE' FROM t")).toBe("none");
  });
  it("warns about scans", () => { expect(assessPartiql('SELECT * FROM "t"').reasons[0]).toMatch(/scan/); expect(assessPartiql('SELECT * FROM "t" WHERE pk = 1').reasons).toEqual([]); });
});

describe("attribute value mapping", () => {
  it("round-trips scalars, collections and big numbers", () => {
    expect(fromAttr({ N: "9007199254740993" })).toBe(9007199254740993n); expect(fromAttr({ N: "1.5" })).toBe(1.5); expect(fromAttr({ N: "0.1234567890123456789" })).toBe("0.1234567890123456789");
    expect(fromAttr({ M: { a: { L: [{ N: "1" }, { S: "x" }, { NULL: true }] } } })).toEqual({ a: [1, "x", null] });
    expect(toAttr({ json: { a: [1, "x", true, null], b: 2.5 } })).toEqual({ M: { a: { L: [{ N: "1" }, { S: "x" }, { BOOL: true }, { NULL: true }] }, b: { N: "2.5" } } });
    expect(toAttr(12345678901234567890n)).toEqual({ N: "12345678901234567890" });
  });
});

const port = Number(process.env.RZ_DYNAMODB_PORT ?? 18000);
const up = await engineUp("127.0.0.1", port);
const cfg = { region: "us-east-1", host: "127.0.0.1", port, ssl: false, accessKeyId: "local", secretAccessKey: "local" };

describe.skipIf(!up)("dynamodb driver (DynamoDB Local)", () => {
  let conn: Connection, ro: Connection; const table = `rz_${randomBytes(4).toString("hex")}`;
  const run = (c: Connection, sql: string, params?: Value[], extra: { maxRows?: number } = {}, s = new AbortController().signal) => collect(c.execute({ sql, ...(params ? { params } : {}), ...extra }, s));
  beforeAll(async () => {
    conn = await dynamodbDriver.connect(cfg, { log() {} });
    ro = await dynamodbDriver.connect({ ...cfg, readOnly: true }, { log() {} });
    // CreateTable is not PartiQL: call the API through a raw request on the same signer.
    const { signV4 } = await import("./sigv4.js");
    const body = JSON.stringify({ TableName: table, BillingMode: "PAY_PER_REQUEST", AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }, { AttributeName: "sk", AttributeType: "N" }, { AttributeName: "g", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }, { AttributeName: "sk", KeyType: "RANGE" }], GlobalSecondaryIndexes: [{ IndexName: "by_g", KeySchema: [{ AttributeName: "g", KeyType: "HASH" }], Projection: { ProjectionType: "ALL" } }] });
    const h = signV4({ accessKeyId: "local", secretAccessKey: "local" }, { method: "POST", host: `127.0.0.1:${port}`, path: "/", headers: { "content-type": "application/x-amz-json-1.0", "x-amz-target": "DynamoDB_20120810.CreateTable" }, body, region: "us-east-1", service: "dynamodb" });
    const r = await fetch(`http://127.0.0.1:${port}/`, { method: "POST", headers: h, body }); if (!r.ok) throw new Error(await r.text());
    for (let i = 1; i <= 30; i++) await run(conn, `INSERT INTO "${table}" VALUE {'pk': ?, 'sk': ?, 'g': ?, 'big': ?, 'tags': ?, 'f': ?}`, [`u${i % 3}`, i, i % 2 ? "odd" : "even", 9007199254740993n, { json: ["a", "b"] }, 1.5]);
  });
  afterAll(async () => { await conn.close(); await ro.close(); });

  it("pings and identifies the endpoint", async () => { expect(conn.serverInfo.product).toMatch(/DynamoDB/); await conn.ping(); });
  it("reads typed items with bound parameters", async () => {
    const r = await run(conn, `SELECT pk, sk, big, tags, f FROM "${table}" WHERE pk = ? AND sk = ?`, ["u1", 1]);
    expect(r.columns.map((c) => c.name)).toEqual(["pk", "sk", "big", "tags", "f"]);
    expect(r.rows).toEqual([["u1", 1, 9007199254740993n, { json: ["a", "b"] }, 1.5]]);
  });
  it("queries a global secondary index and pages through large results", async () => {
    const r = await run(conn, `SELECT pk, sk FROM "${table}"."by_g" WHERE g = ?`, ["odd"]); expect(r.rows.length).toBe(15);
    const all = await run(conn, `SELECT * FROM "${table}"`); expect(all.rows.length).toBe(30);
    const cut = await run(conn, `SELECT * FROM "${table}"`, undefined, { maxRows: 4 }); expect(cut.rows.length).toBe(4);
  });
  it("updates and deletes", async () => {
    await run(conn, `UPDATE "${table}" SET f = ? WHERE pk = ? AND sk = ?`, [2.5, "u1", 1]);
    expect((await run(conn, `SELECT f FROM "${table}" WHERE pk = 'u1' AND sk = 1`)).rows).toEqual([[2.5]]);
    await run(conn, `DELETE FROM "${table}" WHERE pk = 'u1' AND sk = 1`);
    expect((await run(conn, `SELECT f FROM "${table}" WHERE pk = 'u1' AND sk = 1`)).rows).toEqual([]);
  });
  it("read-only connections refuse writes", async () => {
    await expect(run(ro, `DELETE FROM "${table}" WHERE pk = 'u0' AND sk = 3`)).rejects.toMatchObject({ kind: "permission" });
    expect((await run(ro, `SELECT sk FROM "${table}" WHERE pk = 'u0' AND sk = 3`)).rows.length).toBe(1);
  });
  it("maps errors", async () => {
    await expect(run(conn, `SELEKT * FROM "${table}"`)).rejects.toMatchObject({ kind: "syntax" });
    await expect(run(conn, `SELECT * FROM "nope_${table}"`)).rejects.toMatchObject({ kind: "syntax" });
    await expect(dynamodbDriver.connect({ ...cfg, port: 1 }, { log() {} })).rejects.toMatchObject({ kind: "connection" });
    await expect(dynamodbDriver.connect({ region: "us-east-1" }, { log() {} })).rejects.toMatchObject({ kind: "authentication" });
  });
  it("introspects tables, keys and indexes", async () => {
    const api = conn.introspect();
    expect((await api.listTables()).map((t) => t.name)).toContain(table);
    const d = await api.describeTable({ name: table });
    expect(d.columns!.filter((c) => c.primaryKey).map((c) => c.name)).toEqual(["pk", "sk"]); expect(d.columns!.find((c) => c.name === "sk")!.nativeType).toBe("N");
    const ix = (await api.indexes!()).filter((i) => i.table === table);
    expect(ix).toEqual(expect.arrayContaining([expect.objectContaining({ name: "PRIMARY", columns: ["pk", "sk"], primary: true }), expect.objectContaining({ name: "by_g", columns: ["g"] })]));
  });
});
