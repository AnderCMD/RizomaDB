import { describe, it, expect } from "vitest";
import { collect, type Connection, type ResolvedConnectionConfig } from "@rizomadb/driver-api";
import { available, engines, wanted, type TestEngine } from "@rizomadb/test-engines";
import { Admin, MetricSampler, grantStatement, lit, providers, snapshotToRecord, type Engine } from "./index.js";

describe("provider hygiene", () => {
  it("validates identifiers and ids before building statements", () => {
    expect(() => providers.postgres.kill("1; DROP TABLE x", true)).toThrow(/Invalid session id/);
    expect(() => providers.oracle.kill("12,34' OR '1'='1", true)).toThrow();
    expect(providers.oracle.kill("12,34", true)[0]).toBe("ALTER SYSTEM KILL SESSION '12,34'");
    expect(providers.mysql.kill("42", false)[0]).toBe("KILL QUERY 42"); expect(providers.mssql.kill("55", true)[0]).toBe("KILL 55");
    expect(() => providers.postgres.setVariable("x; DROP", "1")).toThrow(); expect(providers.mysql.setVariable("long_query_time", "5").statements[0]).toBe("SET GLOBAL long_query_time = 5");
    expect(providers.mysql.setVariable("sql_mode", "A'B").statements[0]).toContain("'A''B'");
    expect(() => providers.mssql.setVariable("x", "abc")).toThrow(/integers/);
    expect(() => providers.postgres.slow(0)).toThrow(/limit/);
    expect(lit("it's")).toBe("'it''s'");
  });
  it("renders reviewed GRANT/REVOKE statements and rejects unknown privileges", () => {
    expect(grantStatement("postgres", "GRANT", "select", { schema: "public", name: "t" }, "r1")).toBe('GRANT SELECT ON "public"."t" TO "r1"');
    expect(grantStatement("mysql", "REVOKE", "INSERT", { schema: "db", name: "t" }, "u1")).toBe("REVOKE INSERT ON `db`.`t` FROM 'u1'@'%'");
    expect(grantStatement("mssql", "GRANT", "SELECT", { name: "t" }, "u")).toBe("GRANT SELECT ON [t] TO [u]");
    expect(() => grantStatement("postgres", "GRANT", "SUPERUSER", { name: "t" }, "u")).toThrow(/Unsupported/);
    expect(() => grantStatement("postgres", "GRANT", "SELECT", { name: 't"; DROP' }, "u")).toThrow(/Invalid object/);
  });
  it("turns cumulative counters into rates and hit ratios", () => {
    const s = new MetricSampler(providers.postgres.metricDefs);
    expect(s.push({ connections: 3, transactions: 100, cache_hits: 900, cache_reads: 100, rows_read: 0 }, 0).transactions).toBeUndefined();
    const r = s.push({ connections: 4, transactions: 160, cache_hits: 1800, cache_reads: 200, rows_read: 500 }, 2000);
    expect(r).toMatchObject({ connections: 4, transactions: 30, rows_read: 250 }); expect(r.cache_hit_ratio).toBeCloseTo(90, 5);
    const m = new MetricSampler(providers.mysql.metricDefs);
    m.push({ connections: 1, queries: 0, transactions: 0, cache_reads_total: 0, disk_reads: 0 }, 0);
    expect(m.push({ connections: 1, queries: 10, transactions: 2, cache_reads_total: 1000, disk_reads: 10 }, 1000).cache_hit_ratio).toBeCloseTo(99, 5);
  });
});

// Admin views are per-database on PostgreSQL/MySQL/SQL Server (the fresh config already uses the superuser); Oracle needs SYSTEM.
const priv = (e: TestEngine, cfg: ResolvedConnectionConfig): ResolvedConnectionConfig => {
  if (e.id === "oracle") return { host: e.host, port: e.port, service: "FREEPDB1", user: "system", password: "rizoma_test" };
  return cfg;
};
const sig = () => new AbortController().signal;
const x = (c: Connection, sql: string) => collect(c.execute({ sql }, sig()));
const col = (t: { columns: string[]; rows: unknown[][] }, name: string) => t.columns.indexOf(name);

for (const e of engines.filter((q) => q.id !== "sqlite")) {
  const up = wanted(e.id) && (await available(e));
  describe.skipIf(!up)(`admin on ${e.id}`, () => {
    const engine = e.id as Engine;
    const O = e.id === "oracle";
    async function setup() {
      const fresh = await e.freshConfig();
      const cfg = priv(e, fresh);
      const adminConn = await e.plugin.connect(cfg, { log() {} });
      // a table to fight over lives in the fresh database/schema (Oracle: the fresh user's schema, accessed as that user)
      const dataCfg = O ? fresh : fresh;
      const a = await e.plugin.connect(dataCfg, { log() {} });
      await x(a, O ? "CREATE TABLE lk (id NUMBER PRIMARY KEY, v NUMBER)" : "CREATE TABLE lk (id INT PRIMARY KEY, v INT)");
      await x(a, "INSERT INTO lk (id, v) VALUES (1, 0)");
      if (O) await x(a, "COMMIT");
      const b = await e.plugin.connect(dataCfg, { log() {} });
      return { admin: new Admin(adminConn, engine), adminConn, a, b, dataCfg, fresh, cfg, close: async () => { await a.close(); await b.close(); await adminConn.close(); } };
    }
    const selfId = async (c: Connection, via?: Connection) => {
      if (O) { // the data user cannot read v$ views: ask the session for its SID, and the privileged one for the serial
        const sid = String((await x(c, "SELECT SYS_CONTEXT('USERENV','SID') FROM dual")).rows[0]![0]);
        return `${sid},${String((await x(via!, `SELECT serial# FROM v$session WHERE sid = ${Number(sid)}`)).rows[0]![0])}`;
      } const t = await new Admin(c, engine).sessions(); const mine = t.rows.find((r) => [true, 1, "1", 1n].includes(r[col(t, "is_me")] as never)); return String(mine?.[col(t, "id")]); };

    it("lists sessions (including your own) with normalized columns", async () => {
      const s = await setup();
      const t = await s.admin.sessions();
      expect(t.columns).toEqual(expect.arrayContaining(["id", "user", "state", "query", "is_me"]));
      expect(t.rows.length).toBeGreaterThan(0);
      expect(await selfId(s.adminConn, s.adminConn)).toMatch(/\d/);
      await s.close();
    });

    it("detects a blocked session and its blocker, then kills the blocked one", async () => {
      const s = await setup();
      const bId = await selfId(s.b, s.adminConn);
      const tx = await s.a.begin!();
      await collect(tx.execute({ sql: "UPDATE lk SET v = 1 WHERE id = 1" }, sig()));
      const blocked = collect((await s.b.begin!()).execute({ sql: "UPDATE lk SET v = 2 WHERE id = 1" }, sig())).then(() => "completed", (err: Error) => `failed: ${err.message}`);
      let row: unknown[] | undefined, t = await s.admin.locks();
      for (let i = 0; i < 40 && !row; i++) { await new Promise((r) => setTimeout(r, 250)); t = await s.admin.locks(); row = t.rows.find((r) => String(r[col(t, "blocked_id")]) === bId); }
      expect(row, JSON.stringify(t)).toBeTruthy();
      expect(String(row![col(t, "blocking_id")])).not.toBe(bId);
      expect(String(row![col(t, "blocked_query")] ?? "")).toMatch(/UPDATE/i);
      for (const stmt of s.admin.killStatements(bId, true)) { try { await x(s.adminConn, stmt); } catch (err) { throw new Error(`kill failed: [${stmt}] ${(err as Error).message}`, { cause: err }); } }
      expect(await Promise.race([blocked, new Promise((r) => setTimeout(() => r("still blocked"), 15000))])).toMatch(/^failed/);
      await tx.rollback();
      await s.close();
    }, 90_000);

    it("reports table statistics, variables, roles and effective privileges (and revokes)", async () => {
      const s = await setup();
      const ts = await s.admin.tableStats();
      expect(ts.columns).toEqual(expect.arrayContaining(["schema", "table", "size_bytes"]));
      expect(ts.rows.some((r) => String(r[col(ts, "table")]).toLowerCase() === "lk")).toBe(true);
      const v = await s.admin.variables();
      expect(v.rows.some((r) => ["max_connections", "user connections", "db_name"].includes(String(r[0]).toLowerCase()))).toBe(true);
      expect((await s.admin.roles()).rows.length).toBeGreaterThan(0);

      const role = `rz_role_${Date.now() % 100000}`;
      const dbq = O ? `"${(s.fresh.user as string)}".` : "";
      const setupSql: string[] = e.id === "postgres" ? [`CREATE ROLE ${role}`] : e.id === "mysql" ? [`CREATE USER '${role}'@'%'`] : e.id === "mssql" ? [`CREATE USER ${role} WITHOUT LOGIN`] : [`CREATE USER ${role} IDENTIFIED BY "x"`];
      for (const q of setupSql) await x(e.id === "mssql" || e.id === "postgres" || e.id === "mysql" ? (e.id === "postgres" ? s.adminConn : s.a) : s.adminConn, q);
      const tbl = e.id === "postgres" ? { schema: "public", name: "lk" } : e.id === "mysql" ? { schema: String(s.fresh.database), name: "lk" } : e.id === "oracle" ? { schema: String(s.fresh.user), name: "lk" } : { schema: "dbo", name: "lk" };
      void dbq;
      const grant = O ? `GRANT SELECT ON "${tbl.schema}"."LK" TO ${role}` : grantStatement(engine, "GRANT", "SELECT", tbl, role);
      const revoke = O ? `REVOKE SELECT ON "${tbl.schema}"."LK" FROM ${role}` : grantStatement(engine, "REVOKE", "SELECT", tbl, role);
      const runner = e.id === "postgres" ? s.a : e.id === "oracle" ? s.a : s.a;
      await x(runner, grant);
      const has = async () => { const p = await s.admin.privileges(e.id === "mysql" ? `${role}@%` : role); return JSON.stringify(p.rows).toLowerCase().includes("select") && JSON.stringify(p.rows).toLowerCase().includes("lk"); };
      expect(await has()).toBe(true);
      await x(runner, revoke);
      expect(await has()).toBe(false);
      await s.close();
    }, 60_000);

    it("samples live metrics and slow-query data", async () => {
      const s = await setup();
      const snap = snapshotToRecord(await s.admin.metricsSnapshot());
      expect(snap.connections).toBeGreaterThanOrEqual(1);
      const sampler = new MetricSampler(providers[engine].metricDefs);
      sampler.push(snap, 0);
      for (let i = 0; i < 20; i++) await x(s.a, "SELECT 1" + (O ? " FROM dual" : ""));
      const next = sampler.push(snapshotToRecord(await s.admin.metricsSnapshot()), 1000);
      expect(next.connections).toBeGreaterThanOrEqual(1);
      expect(Object.values(next).every((n) => Number.isFinite(n) && n >= 0)).toBe(true);
      const slow = await s.admin.slowQueries(5);
      expect(slow.columns).toEqual(expect.arrayContaining(["query", "calls", "total_ms"])); expect(slow.source.length).toBeGreaterThan(3);
      const idx = await s.admin.unusedIndexes(); expect(idx.columns).toEqual(expect.arrayContaining(["schema", "table", "index"]));
      await s.close();
    }, 60_000);
  });
}
