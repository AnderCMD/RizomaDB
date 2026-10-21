import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "node:net";
import { DriverError, type DriverPlugin, type Connection, type ResolvedConnectionConfig } from "./index.js";
import { collect } from "./util.js";

/** True when something accepts TCP connections at host:port. */
export function reachable(host: string, port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((res) => {
    const s = net.connect({ host, port });
    const done = (ok: boolean) => { s.destroy(); res(ok); };
    s.setTimeout(timeoutMs, () => done(false));
    s.once("connect", () => done(true)); s.once("error", () => done(false));
  });
}

/** Engine suites skip when the engine is down locally, but fail in CI (RZ_REQUIRE_ENGINES=1). */
export async function engineUp(host: string, port: number): Promise<boolean> {
  const up = await reachable(host, port);
  if (!up && process.env.RZ_REQUIRE_ENGINES) throw new Error(`Engine required but unreachable at ${host}:${port}`);
  return up;
}

export interface ConformanceOptions {
  /** When false, the whole suite is skipped (see engineUp). */
  enabled?: boolean;
  plugin: DriverPlugin;
  /** Config for a fresh, empty, writable database. */
  config: () => Promise<ResolvedConnectionConfig> | ResolvedConnectionConfig;
  /** SQL that blocks for ~seconds, to exercise cancellation. */
  slowSql: string;
  /** CREATE TABLE conf_t(id integer primary key, name text not null) in the dialect. */
  createTableSql?: string;
  /** Expression yielding the BIGINT 9223372036854775807 (dialects differ on literals/casts). */
  bigintSql?: string;
  /** Two-parameter query returning (a, b), in the dialect's placeholder syntax. */
  paramSql: string;
  /** Config that must fail to authenticate/connect. */
  badConfig?: () => ResolvedConnectionConfig;
}

const ctx = { log: () => {} };

/** Every driver must pass this kit. */
export function runConformance(opts: ConformanceOptions): void {
  describe.skipIf(opts.enabled === false)(`conformance: ${opts.plugin.id}`, () => {
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
      const r = await collect(conn.execute({ sql: opts.bigintSql ?? "SELECT 9223372036854775807 AS big" }, new AbortController().signal));
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
      await collect(conn.execute({ sql: opts.createTableSql ?? "CREATE TABLE conf_t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)" }, new AbortController().signal));
      const tables = await conn.introspect().listTables();
      const found = tables.find((t) => t.name.toLowerCase() === "conf_t");
      expect(found, "table listed").toBeTruthy();
      const t = await conn.introspect().describeTable({ name: found!.name, ...(found!.schema ? { schema: found!.schema } : {}) });
      expect(t.columns?.find((c) => c.name.toLowerCase() === "id")?.primaryKey).toBe(true);
      expect(t.columns?.find((c) => c.name.toLowerCase() === "name")?.nullable).toBe(false);
    });

    it("bulk-describes schemas and reports foreign keys", async () => {
      const api = conn.introspect();
      const exec = (sql: string) => collect(conn.execute({ sql }, new AbortController().signal));
      await exec("CREATE TABLE conf_p (id INTEGER PRIMARY KEY)");
      await exec("CREATE TABLE conf_c (id INTEGER PRIMARY KEY, pid INTEGER, FOREIGN KEY (pid) REFERENCES conf_p(id))");
      if (api.describeSchema) {
        const all = await api.describeSchema();
        const c = all.find((t) => t.name.toLowerCase() === "conf_c");
        expect(c?.columns?.map((x) => x.name.toLowerCase())).toEqual(["id", "pid"]);
        expect(c?.columns?.find((x) => x.name.toLowerCase() === "id")?.primaryKey).toBe(true);
      }
      if (api.foreignKeys) {
        const fk = (await api.foreignKeys()).find((f) => f.from.table.toLowerCase() === "conf_c");
        expect(fk?.to.table.toLowerCase()).toBe("conf_p");
        expect(fk?.from.columns.map((x) => x.toLowerCase())).toEqual(["pid"]);
        expect(fk?.to.columns.map((x) => x.toLowerCase())).toEqual(["id"]);
      }
    });

    it("lists indexes with ordered columns and primary/unique flags", async () => {
      const api = conn.introspect();
      if (!api.indexes) return;
      const exec = (sql: string) => collect(conn.execute({ sql }, new AbortController().signal));
      await exec("CREATE TABLE conf_i (a INTEGER NOT NULL, b INTEGER NOT NULL, c INTEGER, PRIMARY KEY (a))");
      await exec("CREATE UNIQUE INDEX conf_i_bc ON conf_i (b, c)");
      await exec("CREATE INDEX conf_i_c ON conf_i (c)");
      const all = (await api.indexes()).filter((i) => i.table.toLowerCase() === "conf_i");
      const by = (n: string) => all.find((i) => i.name.toLowerCase() === n);
      expect(by("conf_i_bc")).toMatchObject({ unique: true, primary: false });
      expect(by("conf_i_bc")!.columns.map((x) => x.toLowerCase())).toEqual(["b", "c"]);
      expect(by("conf_i_c")).toMatchObject({ unique: false });
      expect(all.some((i) => i.primary && i.columns.map((x) => x.toLowerCase()).join() === "a")).toBe(true);
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
