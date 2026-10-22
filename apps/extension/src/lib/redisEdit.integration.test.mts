import { describe, it, expect, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, type Connection } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { redisDriver } from "@rizomadb/driver-redis";
import { isEditableRedisType, readCommand, STREAM_ID, streamAddCommand, streamDeleteCommand, streamReadCommand, writeCommand, writeCommands } from "./redisEdit.js";

const port = Number(process.env.RZ_REDIS_PORT ?? 63799);
const up = await engineUp("localhost", port, "redis");
const run = (c: Connection, sql: string) => collect(c.execute({ sql }, new AbortController().signal));
const rows = async (c: Connection, sql: string) => (await run(c, sql)).rows;
const key = (k: string) => `rz:edit:${randomBytes(4).toString("hex")}:${k}`;

describe("Redis value edits (command text)", () => {
  it("knows which types it can edit and refuses a bad target", () => {
    expect(["string", "hash", "list", "set", "zset", "stream"].filter(isEditableRedisType)).toEqual(["string", "hash", "list", "set", "zset"]);
    expect(() => writeCommand("hash", "k", undefined, "v")).toThrow();
    expect(() => writeCommand("list", "k", "x", "v")).toThrow();
    expect(readCommand("list", "k")).toBe('LRANGE "k" 0 999');
  });
});

describe("Redis stream edits (command text)", () => {
  it("builds an add and a delete, and refuses what is not an entry", () => {
    expect(streamAddCommand("k", [["a", "1"], ["b", 'x "y"']])).toBe('XADD "k" * "a" "1" "b" "x \\"y\\""');
    expect(streamAddCommand("k", [["a", "1"]], "5-1")).toBe('XADD "k" 5-1 "a" "1"');
    expect(() => streamAddCommand("k", [])).toThrow();
    expect(() => streamAddCommand("k", [["", "1"]])).toThrow();
    expect(() => streamAddCommand("k", [["a", "1"]], "abc")).toThrow();
    expect(streamDeleteCommand("k", "5-1")).toBe('XDEL "k" 5-1');
    expect(() => streamDeleteCommand("k", "*")).toThrow();
    expect(["*", "5", "5-1", "5-*", "x", "-1", ""].map((i) => STREAM_ID.test(i))).toEqual([true, true, true, true, false, false, false]);
    expect(streamReadCommand("k")).toBe('XRANGE "k" - + COUNT 1000');
  });
});

describe.skipIf(!up)("Redis value edits against a real server", () => {
  const made: string[] = [];
  let conn: Connection;
  const open = async () => (conn ??= await redisDriver.connect({ host: "localhost", port }, { log() {} }));
  afterAll(async () => { if (conn) { for (const k of made) await run(conn, `DEL ${JSON.stringify(k)}`).catch(() => undefined); await conn.close(); } });
  // Text that needs quoting survives the round trip: quotes, backslashes, a newline, accents and emoji.
  const awkward = 'say "hi" \\ back\nline é 🌱';

  it("replaces a string and keeps its expiry", async () => {
    const c = await open(), k = key("s"); made.push(k);
    await run(c, `SET ${JSON.stringify(k)} "old"`); await run(c, `EXPIRE ${JSON.stringify(k)} 500`);
    await run(c, writeCommand("string", k, undefined, awkward));
    expect((await rows(c, readCommand("string", k)))[0]![0]).toBe(awkward);
    const ttl = Number((await rows(c, `TTL ${JSON.stringify(k)}`))[0]![0]);
    expect(ttl).toBeGreaterThan(400); expect(ttl).toBeLessThanOrEqual(500);
  });
  it("sets one hash field and leaves the others", async () => {
    const c = await open(), k = key("h"); made.push(k);
    await run(c, `HSET ${JSON.stringify(k)} a 1 b 2`);
    await run(c, writeCommand("hash", k, "b", awkward));
    expect(Object.fromEntries((await rows(c, readCommand("hash", k))) as [string, string][])).toEqual({ a: "1", b: awkward });
  });
  it("sets one list element by index", async () => {
    const c = await open(), k = key("l"); made.push(k);
    await run(c, `RPUSH ${JSON.stringify(k)} x y z`);
    await run(c, writeCommand("list", k, 1, awkward));
    expect((await rows(c, readCommand("list", k))).map((r) => r[1])).toEqual(["x", awkward, "z"]);
    await expect(run(c, writeCommand("list", k, 9, "nope"))).rejects.toBeDefined();   // out of range is the server's error, not a silent append
  });
  it("adds stream entries with awkward text and deletes one, leaving the rest", async () => {
    const c = await open(), k = key("x"); made.push(k);
    await run(c, streamAddCommand(k, [["msg", awkward], ["n", "1"]], "1-1"));
    await run(c, streamAddCommand(k, [["msg", "second"]], "2-1"));
    await run(c, streamAddCommand(k, [["msg", "auto"]]));
    let r = await rows(c, streamReadCommand(k));
    expect(r.map((x) => x[0]).slice(0, 2)).toEqual(["1-1", "2-1"]); expect(r).toHaveLength(3);
    expect((r[0]![1] as { json: Record<string, string> }).json.msg).toBe(awkward);
    await run(c, streamDeleteCommand(k, "2-1"));
    r = await rows(c, streamReadCommand(k));
    expect(r.map((x) => x[0]).slice(0, 1)).toEqual(["1-1"]); expect(r).toHaveLength(2);
  });
});

describe.skipIf(!up)("Redis set and sorted set edits against a real server", () => {
  it("renames a set member without losing it, and changes a sorted-set score", async () => {
    const c = await redisDriver.connect({ host: "localhost", port }, { log() {} });
    const s = key("set"), z = key("z");
    try {
      await run(c, `SADD ${JSON.stringify(s)} a b`);
      for (const cmd of writeCommands("set", s, "a", "a2 \"x\"")) await run(c, cmd);
      expect((await rows(c, readCommand("set", s))).map((r) => r[1]).sort()).toEqual(['a2 "x"', "b"]);
      expect(writeCommands("set", s, "b", "b")).toEqual([]);
      await run(c, `ZADD ${JSON.stringify(z)} 1.5 m1 2 m2`);
      for (const cmd of writeCommands("zset", z, "m1", "9")) await run(c, cmd);
      expect(Object.fromEntries((await rows(c, readCommand("zset", z))) as [string, number][])).toEqual({ m1: 9, m2: 2 });
      expect(() => writeCommands("zset", z, "m1", "abc")).toThrow();
      await run(c, writeCommands("zset", z, "ghost", "5")[0]!);   // XX: a member that does not exist is not created
      expect((await rows(c, readCommand("zset", z))).length).toBe(2);
    } finally { await run(c, `DEL ${JSON.stringify(s)} ${JSON.stringify(z)}`).catch(() => undefined); await c.close(); }
  });
});
