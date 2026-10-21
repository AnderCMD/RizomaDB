import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { collect, DriverError, type Connection } from "@rizomadb/driver-api";
import { engineUp } from "@rizomadb/driver-api/conformance";
import { redisDriver, assessRedis, parseCommandLine, RedisSyntaxError } from "./index.js";

describe("command parsing and risk", () => {
  it("parses quoting like redis-cli", () => {
    expect(parseCommandLine('SET "a b" \'c d\' e\\x41 "x\\ty" plain')).toEqual(["SET", "a b", "c d", "e\\x41", "x\ty", "plain"]);
    expect(parseCommandLine('SET k "q\\"uote" "\\x41\\n"')).toEqual(["SET", "k", 'q"uote', "A\n"]);
    expect(parseCommandLine("  ")).toEqual([]);
    expect(() => parseCommandLine('SET "unterminated')).toThrow(RedisSyntaxError);
    expect(() => parseCommandLine('SET "a"b')).toThrow(/Closing quote/);
  });
  it("classifies reads, writes and destructive commands (unknown = write)", () => {
    expect(assessRedis("GET k").risk).toBe("none"); expect(assessRedis("config get maxmemory").risk).toBe("none"); expect(assessRedis("SCAN 0 MATCH a*").risk).toBe("none");
    expect(assessRedis("SET k v").risk).toBe("write"); expect(assessRedis("DEL a").risk).toBe("write"); expect(assessRedis("DEL a b c").risk).toBe("destructive");
    expect(assessRedis("FLUSHALL").risk).toBe("destructive"); expect(assessRedis("CONFIG SET save ''").risk).toBe("destructive");
    expect(assessRedis("SOMENEWCOMMAND x").risk).toBe("write");
  });
});

const targets = [["redis", 63799], ["valkey", 63800]] as const;
for (const [name, port] of targets) {
  const up = await engineUp("127.0.0.1", Number(process.env[`RZ_${name.toUpperCase()}_PORT`] ?? port));
  describe.skipIf(!up)(`${name} driver`, () => {
    const p = Number(process.env[`RZ_${name.toUpperCase()}_PORT`] ?? port);
    const cfg = { host: "127.0.0.1", port: p, ssl: false };
    let conn: Connection, ro: Connection, k: string;
    const run = (c: Connection, cmd: string, extra: { maxRows?: number } = {}, s = new AbortController().signal) => collect(c.execute({ sql: cmd, ...extra }, s));
    beforeAll(async () => { k = `rz:${randomBytes(4).toString("hex")}`; conn = await redisDriver.connect(cfg, { log() {} }); ro = await redisDriver.connect({ ...cfg, readOnly: true }, { log() {} }); });
    afterAll(async () => { await run(conn, `SCAN 0 MATCH ${k}:*`).then(async (r) => { for (const key of r.rows) await run(conn, `DEL ${key[0]}`); }); await conn.close(); await ro.close(); });

    it("identifies the product and pings", async () => { expect(conn.serverInfo.product).toBe(name === "valkey" ? "Valkey" : "Redis"); expect(conn.serverInfo.version).toMatch(/^\d/); await conn.ping(); });

    it("reads and writes strings, keeping 64-bit values exact", async () => {
      await run(conn, `SET ${k}:s 9223372036854775807`);
      expect((await run(conn, `GET ${k}:s`)).rows).toEqual([["9223372036854775807"]]);
      expect((await run(conn, `SET ${k}:u "héllo 🌱"`)).rows[0]![0]).toBe("OK");
      expect((await run(conn, `GET ${k}:u`)).rows[0]![0]).toBe("héllo 🌱");
      expect((await run(conn, `GET ${k}:missing`)).rows).toEqual([[null]]);
    });

    it("shapes hashes, lists, sorted sets, streams and INFO into columns", async () => {
      await run(conn, `HSET ${k}:h a 1 b 2`); await run(conn, `RPUSH ${k}:l x y z`); await run(conn, `ZADD ${k}:z 1.5 m1 2 m2`); await run(conn, `XADD ${k}:x 1-1 f v`);
      expect((await run(conn, `HGETALL ${k}:h`)).rows).toEqual([["a", "1"], ["b", "2"]]);
      expect((await run(conn, `LRANGE ${k}:l 0 -1`)).rows).toEqual([[0, "x"], [1, "y"], [2, "z"]]);
      expect((await run(conn, `ZRANGE ${k}:z 0 -1 WITHSCORES`)).rows).toEqual([["m1", 1.5], ["m2", 2]]);
      const x = await run(conn, `XRANGE ${k}:x - +`); expect(x.rows[0]![0]).toBe("1-1"); expect(x.rows[0]![1]).toEqual({ json: { f: "v" } });
      const info = await run(conn, "INFO server"); expect(info.columns.map((c) => c.name)).toEqual(["property", "value"]); expect(info.rows.length).toBeGreaterThan(5);
    });

    it("OPEN shows a key by type; SCAN iterates cursors for you and refuses KEYS", async () => {
      expect((await run(conn, `OPEN ${k}:h`)).rows).toEqual([["a", "1"], ["b", "2"]]);
      expect((await run(conn, `OPEN ${k}:z`)).rows).toEqual([["m1", 1.5], ["m2", 2]]);
      await expect(run(conn, `OPEN ${k}:nope`)).rejects.toMatchObject({ kind: "syntax" });
      for (let i = 0; i < 1500; i++) await conn.execute({ sql: `SET ${k}:bulk:${i} 1` }, new AbortController().signal)[Symbol.asyncIterator]().next();
      const scanned = await run(conn, `SCAN 0 MATCH ${k}:bulk:* COUNT 100`);
      expect(scanned.rows).toHaveLength(1500); expect(scanned.columns.map((c) => c.name)).toEqual(["key", "type"]);
      expect((await run(conn, `SCAN 0 MATCH ${k}:bulk:*`, { maxRows: 10 })).rows.length).toBeLessThanOrEqual(10);
      await expect(run(conn, "KEYS *")).rejects.toMatchObject({ kind: "permission", message: expect.stringMatching(/SCAN/) });
      await run(conn, `DEL ${Array.from({ length: 1500 }, (_, i) => `${k}:bulk:${i}`).join(" ")}`);
    });

    it("types errors and refuses streaming commands", async () => {
      await expect(run(conn, "NOSUCHCOMMAND")).rejects.toMatchObject({ kind: "syntax" });
      await expect(run(conn, `LPUSH ${k}:s v`)).rejects.toMatchObject({ kind: "syntax", message: expect.stringMatching(/WRONGTYPE/) });
      await expect(run(conn, 'SET "oops')).rejects.toMatchObject({ kind: "syntax" });
      await expect(run(conn, "MONITOR")).rejects.toMatchObject({ kind: "unsupported" });
    });

    it("cancels a blocking command by reconnecting, and stays usable", async () => {
      const dead = new AbortController(); dead.abort();
      await expect(run(conn, "PING", {}, dead.signal)).rejects.toMatchObject({ kind: "cancelled" });
      const ac = new AbortController();
      const p1 = run(conn, `BLPOP ${k}:never 10`, {}, ac.signal);
      setTimeout(() => ac.abort(), 200);
      const t0 = Date.now();
      await expect(p1).rejects.toMatchObject({ kind: "cancelled" });
      expect(Date.now() - t0).toBeLessThan(3000);
      await new Promise((r) => setTimeout(r, 200));
      await conn.ping();
      expect((await run(conn, `GET ${k}:s`)).rows[0]![0]).toBe("9223372036854775807");
    });

    it("blocks writes on read-only connections", async () => {
      await expect(run(ro, `SET ${k}:ro 1`)).rejects.toMatchObject({ kind: "permission" });
      await expect(run(ro, "FLUSHALL")).rejects.toMatchObject({ kind: "permission" });
      expect((await run(ro, `GET ${k}:s`)).rows[0]![0]).toBe("9223372036854775807");
    });

    it("introspects databases, keys and key metadata", async () => {
      const api = conn.introspect();
      expect(await api.listSchemas()).toContain("db0");
      expect((await api.listTables("db0")).map((t) => t.name)).toEqual(expect.arrayContaining([`${k}:s`, `${k}:h`]));
      const d = await api.describeTable({ schema: "db0", name: `${k}:h` });
      expect(d.columns!.map((c) => c.name)).toEqual(["field", "value"]); expect(d.columns![0]!.nativeType).toContain("hash");
    });

    it("fails with typed errors for a wrong password or an unreachable host", async () => {
      const bad = await redisDriver.connect({ ...cfg, user: "nobody", password: "wrong" }, { log() {} }).catch((e: unknown) => e);
      expect(bad).toBeInstanceOf(DriverError); expect(["authentication", "syntax", "connection"]).toContain((bad as DriverError).kind);
      const down = await redisDriver.connect({ host: "127.0.0.1", port: 1, ssl: false }, { log() {} }).catch((e: unknown) => e);
      expect((down as DriverError).kind).toBe("connection");
    });
  });
}
