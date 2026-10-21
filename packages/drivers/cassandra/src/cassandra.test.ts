import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, type Connection, type Value } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { cassandraDriver, assessCql } from "./index.js";

describe("CQL risk classification", () => {
  const risk = (s: string) => assessCql(s).risk;
  it("classifies", () => {
    expect(risk("SELECT * FROM t WHERE k = 1")).toBe("none"); expect(risk("select 'DELETE' from t -- DROP")).toBe("none"); expect(risk("USE ks")).toBe("none");
    expect(risk("INSERT INTO t (k) VALUES (1)")).toBe("write"); expect(risk("UPDATE t SET a = 1 WHERE k = 1")).toBe("write"); expect(risk("CREATE TABLE x (k int PRIMARY KEY)")).toBe("write");
    expect(risk("DELETE FROM t WHERE k = 1")).toBe("destructive"); expect(risk("TRUNCATE t")).toBe("destructive"); expect(risk("DROP KEYSPACE ks")).toBe("destructive");
    expect(risk("BEGIN BATCH INSERT INTO t (k) VALUES (1) APPLY BATCH")).toBe("write");
    expect(risk("SELECT * FROM t; DROP TABLE t")).toBe("write"); expect(risk("GRANT SELECT ON ks.t TO u")).toBe("write");
  });
  it("warns about ALLOW FILTERING", () => expect(assessCql("SELECT * FROM t ALLOW FILTERING").reasons[0]).toMatch(/FILTERING/));
});

const port = Number(process.env.RZ_CASSANDRA_PORT ?? 19042);
const up = await engineUp("127.0.0.1", port);
const cfg = { host: "127.0.0.1", port, localDataCenter: "datacenter1" };

describe.skipIf(!up)("cassandra driver", () => {
  let conn: Connection, ro: Connection; const ks = `rz_${randomBytes(4).toString("hex")}`;
  const run = (c: Connection, sql: string, params?: Value[], extra: { maxRows?: number } = {}, s = new AbortController().signal) => collect(c.execute({ sql, ...(params ? { params } : {}), ...extra }, s));
  beforeAll(async () => {
    conn = await cassandraDriver.connect(cfg, { log() {} });
    ro = await cassandraDriver.connect({ ...cfg, readOnly: true }, { log() {} });
    await run(conn, `CREATE KEYSPACE ${ks} WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}`);
    await run(conn, `CREATE TABLE ${ks}.t (pk text, ck int, big bigint, d decimal, v varint, b boolean, f double, ts timestamp, id uuid, tags set<text>, m map<text,int>, l list<int>, blob_c blob, PRIMARY KEY (pk, ck))`);
    await run(conn, `CREATE INDEX t_f_idx ON ${ks}.t (f)`);
  });
  afterAll(async () => { await run(conn, `DROP KEYSPACE IF EXISTS ${ks}`).catch(() => {}); await conn.close(); await ro.close(); });

  it("identifies the server and pings", async () => { expect(conn.serverInfo.product).toBe(process.env.RZ_CASSANDRA_EXPECT ?? "Apache Cassandra"); expect(conn.serverInfo.version).toMatch(/^\d/); await conn.ping(); });
  it("round-trips typed values", async () => {
    await run(conn, `INSERT INTO ${ks}.t (pk, ck, big, d, v, b, f, ts, id, tags, m, l, blob_c) VALUES ('a', 1, 9007199254740993, 1.50, 123456789012345678901234567890, true, 2.5, '2020-01-02T03:04:05Z', 123e4567-e89b-12d3-a456-426614174000, {'x','y'}, {'k': 1}, [1,2], 0x0102ff)`);
    const r = await run(conn, `SELECT pk, ck, big, d, v, b, f, ts, id, tags, m, l, blob_c FROM ${ks}.t WHERE pk = ? AND ck = ?`, ["a", 1]);
    expect(r.columns.map((c) => c.name)).toEqual(["pk", "ck", "big", "d", "v", "b", "f", "ts", "id", "tags", "m", "l", "blob_c"]);
    expect(r.columns.find((c) => c.name === "tags")!.nativeType).toMatch(/set/i);
    expect(r.rows[0]).toEqual(["a", 1, 9007199254740993n, "1.50", "123456789012345678901234567890", true, 2.5, new Date("2020-01-02T03:04:05Z"), "123e4567-e89b-12d3-a456-426614174000", { json: ["x", "y"] }, { json: { k: 1 } }, { json: [1, 2] }, new Uint8Array([1, 2, 255])]);
  });
  it("binds typed parameters", async () => {
    await run(conn, `INSERT INTO ${ks}.t (pk, ck, big, b, f, ts, id, tags, m, l, blob_c) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["p", 1, 9007199254740993n, true, 0.25, new Date("2021-05-06T07:08:09Z"), "123e4567-e89b-12d3-a456-426614174000", { json: ["x"] }, { json: { k: 2 } }, { json: [3] }, new Uint8Array([9])]);
    const r = await run(conn, `SELECT big, b, f, ts, tags, m, l, blob_c FROM ${ks}.t WHERE pk = 'p' AND ck = 1`);
    expect(r.rows[0]).toEqual([9007199254740993n, true, 0.25, new Date("2021-05-06T07:08:09Z"), { json: ["x"] }, { json: { k: 2 } }, { json: [3] }, new Uint8Array([9])]);
  });
  it("binds parameters for writes and streams large result sets with maxRows", async () => {
    for (let i = 2; i <= 300; i++) await run(conn, `INSERT INTO ${ks}.t (pk, ck, f) VALUES (?, ?, ?)`, ["bulk", i, i + 0.5]);
    expect((await run(conn, `SELECT ck FROM ${ks}.t WHERE pk = ?`, ["bulk"])).rows.length).toBe(299);
    expect((await run(conn, `SELECT ck FROM ${ks}.t WHERE pk = ?`, ["bulk"], { maxRows: 12 })).rows.length).toBe(12);
    expect((await run(conn, `SELECT ck FROM ${ks}.t WHERE pk = 'nothing'`)).rows).toEqual([]);
  });
  it("maps errors", async () => {
    await expect(run(conn, "SELEKT 1")).rejects.toMatchObject({ kind: "syntax" });
    await expect(run(conn, `SELECT * FROM ${ks}.nope`)).rejects.toMatchObject({ kind: "syntax" });
    await expect(cassandraDriver.connect({ ...cfg, port: 1 }, { log() {} })).rejects.toMatchObject({ kind: "connection" });
  });
  it("read-only connections refuse writes", async () => {
    await expect(run(ro, `DELETE FROM ${ks}.t WHERE pk = 'a'`)).rejects.toMatchObject({ kind: "permission" });
    expect((await run(ro, `SELECT pk FROM ${ks}.t WHERE pk = 'a'`)).rows.length).toBe(1);
  });
  it("introspects keyspaces, tables, keys and indexes", async () => {
    const api = conn.introspect();
    expect(await api.listSchemas()).toContain(ks);
    expect((await api.listTables(ks)).map((t) => t.name)).toEqual(["t"]);
    const d = await api.describeTable({ schema: ks, name: "t" });
    expect(d.columns!.slice(0, 2).map((c) => `${c.name}:${c.primaryKey}`)).toEqual(["pk:true", "ck:true"]); expect(d.columns!.find((c) => c.name === "big")!.nativeType).toBe("bigint");
    expect((await api.indexes!(ks)).some((i) => i.name === "t_f_idx" && i.table === "t")).toBe(true);
  });
  it("cancels while streaming", async () => {
    const ac = new AbortController(); const it = conn.execute({ sql: `SELECT ck FROM ${ks}.t WHERE pk = 'bulk'`, batchSize: 1 }, ac.signal)[Symbol.asyncIterator]();
    await it.next(); await it.next(); ac.abort();
    await expect((async () => { for (;;) { const r = await it.next(); if (r.done) return; } })()).rejects.toMatchObject({ kind: "cancelled" });
  });
});
