import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DriverError, type DriverPlugin, type Connection, type ResolvedConnectionConfig } from "./index.js";
import { collect } from "./util.js";

export interface ConformanceOptions {
  plugin: DriverPlugin;
  /** Config for a fresh, empty, writable database. */
  config: () => Promise<ResolvedConnectionConfig> | ResolvedConnectionConfig;
  /** SQL that blocks for ~seconds, to exercise cancellation. */
  slowSql: string;
  /** Two-parameter query returning (a, b), in the dialect's placeholder syntax. */
  paramSql: string;
  /** Config that must fail to authenticate/connect. */
  badConfig?: () => ResolvedConnectionConfig;
}

const ctx = { log: () => {} };

/** Every driver must pass this kit. */
export function runConformance(opts: ConformanceOptions): void {
  describe(`conformance: ${opts.plugin.id}`, () => {
    let conn: Connection;
    beforeAll(async () => { conn = await opts.plugin.connect(await opts.config(), ctx); });
    afterAll(async () => { await conn?.close(); });

    it("reports server info and pings", async () => {
      expect(conn.serverInfo.version).toBeTruthy();
      await conn.ping();
    });

    it("streams rows in batches with columns then done", async () => {
      const ev: string[] = [];
      for await (const e of conn.execute({ sql: "SELECT 1 AS a, 'x' AS b", batchSize: 1 }, new AbortController().signal)) ev.push(e.type);
      expect(ev[0]).toBe("columns");
      expect(ev.at(-1)).toBe("done");
      expect(ev).toContain("rows");
    });

    it("keeps 64-bit integers lossless", async () => {
      const r = await collect(conn.execute({ sql: "SELECT 9223372036854775807 AS big" }, new AbortController().signal));
      expect(String(r.rows[0]![0])).toBe("9223372036854775807");
    });

    it("round-trips NULL and unicode via parameters", async () => {
      const r = await collect(conn.execute({ sql: opts.paramSql, params: ["héllo 🌱", null] }, new AbortController().signal));
      expect(r.rows[0]).toEqual(["héllo 🌱", null]);
    });

    it("honors maxRows", async () => {
      const sql = "SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3";
      const r = await collect(conn.execute({ sql, maxRows: 2 }, new AbortController().signal));
      expect(r.rows).toHaveLength(2);
    });

    it("types syntax errors", async () => {
      await expect(collect(conn.execute({ sql: "SELEC nope" }, new AbortController().signal)))
        .rejects.toMatchObject({ name: "DriverError", kind: "syntax" });
    });

    it("rejects immediately when already aborted", async () => {
      const ac = new AbortController(); ac.abort();
      await expect(collect(conn.execute({ sql: "SELECT 1" }, ac.signal)))
        .rejects.toMatchObject({ kind: "cancelled" });
    });

    if (opts.plugin.capabilities.cancelQuery) {
      it("cancels a running query", async () => {
        const ac = new AbortController();
        const p = collect(conn.execute({ sql: opts.slowSql }, ac.signal));
        setTimeout(() => ac.abort(), 150);
        const t = Date.now();
        await expect(p).rejects.toMatchObject({ kind: "cancelled" });
        expect(Date.now() - t).toBeLessThan(3000);
        await conn.ping();
      });
    }

    it("introspects created tables", async () => {
      await collect(conn.execute({ sql: "CREATE TABLE conf_t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)" }, new AbortController().signal));
      const tables = await conn.introspect().listTables();
      expect(tables.map((t) => t.name)).toContain("conf_t");
      const t = await conn.introspect().describeTable({ name: "conf_t" });
      expect(t.columns?.find((c) => c.name === "id")?.primaryKey).toBe(true);
      expect(t.columns?.find((c) => c.name === "name")?.nullable).toBe(false);
    });

    if (opts.plugin.capabilities.transactions) {
      it("rolls back and commits", async () => {
        const run = (sql: string, tx?: { execute: Connection["execute"] }) =>
          collect((tx ?? conn).execute({ sql }, new AbortController().signal));
        const tx1 = await conn.begin!();
        await run("INSERT INTO conf_t VALUES (100, 'a')", tx1);
        await tx1.rollback();
        expect((await run("SELECT * FROM conf_t WHERE id = 100")).rows).toHaveLength(0);
        const tx2 = await conn.begin!();
        await run("INSERT INTO conf_t VALUES (101, 'b')", tx2);
        await tx2.commit();
        expect((await run("SELECT * FROM conf_t WHERE id = 101")).rows).toHaveLength(1);
      });
    }

    it("quotes identifiers safely", () => {
      const q = conn.quoteIdent('we"ird`name');
      expect(q).not.toBe('we"ird`name');
      expect(q.length).toBeGreaterThan(10);
    });

    if (opts.badConfig) {
      it("fails with a typed connection or authentication error", async () => {
        const err = await opts.plugin.connect(opts.badConfig!(), ctx).then(() => null, (e: unknown) => e);
        expect(err).toBeInstanceOf(DriverError);
        expect(["connection", "authentication"]).toContain((err as DriverError).kind);
      });
    }

    if (opts.plugin.capabilities.readOnlyEnforcement) {
      it("blocks writes in read-only mode", async () => {
        const ro = await opts.plugin.connect({ ...(await opts.config()), readOnly: true }, ctx);
        try {
          await expect(collect(ro.execute({ sql: "CREATE TABLE ro_t (a INTEGER)" }, new AbortController().signal)))
            .rejects.toBeInstanceOf(DriverError);
        } finally { await ro.close(); }
      });
    }
  });
}
