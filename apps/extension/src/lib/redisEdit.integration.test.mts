import { describe, it, expect, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, type Connection } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { redisDriver } from "@rizomadb/driver-redis";
import { isEditableRedisType, readCommand, writeCommand } from "./redisEdit.js";

const port = Number(process.env.RZ_REDIS_PORT ?? 63799);
const up = await engineUp("localhost", port, "redis");
const run = (c: Connection, sql: string) => collect(c.execute({ sql }, new AbortController().signal));
const rows = async (c: Connection, sql: string) => (await run(c, sql)).rows;
const key = (k: string) => `rz:edit:${randomBytes(4).toString("hex")}:${k}`;

describe("Redis value edits (command text)", () => {
  it("knows which types it can edit and refuses a bad target", () => {
    expect(["string", "hash", "list", "set", "zset", "stream"].filter(isEditableRedisType)).toEqual(["string", "hash", "list"]);
    expect(() => writeCommand("hash", "k", undefined, "v")).toThrow();
    expect(() => writeCommand("list", "k", "x", "v")).toThrow();
    expect(readCommand("list", "k")).toBe('LRANGE "k" 0 999');
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
});
