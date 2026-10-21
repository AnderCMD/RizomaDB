import { DriverError, type Connection, type DriverPlugin, type Transaction } from "@rizomadb/driver-api";
import type { Request, Response, WireError } from "./protocol.js";

// Drivers load on first use, so a worker only pays for the engine it actually talks to.
const drivers: Record<string, () => Promise<DriverPlugin>> = {
  sqlite: async () => (await import("@rizomadb/driver-sqlite")).sqliteDriver,
  postgres: async () => (await import("@rizomadb/driver-postgres")).postgresDriver,
  mysql: async () => (await import("@rizomadb/driver-mysql")).mysqlDriver,
  mssql: async () => (await import("@rizomadb/driver-mssql")).mssqlDriver,
  oracle: async () => (await import("@rizomadb/driver-oracle")).oracleDriver,
  mongodb: async () => (await import("@rizomadb/driver-mongodb")).mongoDriver,
  redis: async () => (await import("@rizomadb/driver-redis")).redisDriver,
  clickhouse: async () => (await import("@rizomadb/driver-clickhouse")).clickhouseDriver,
  elasticsearch: async () => (await import("@rizomadb/driver-elasticsearch")).elasticsearchDriver,
  neo4j: async () => (await import("@rizomadb/driver-neo4j")).neo4jDriver,
  duckdb: async () => {
    try { return (await import("@rizomadb/driver-duckdb")).duckdbDriver; }
    catch (e) { throw new DriverError("unsupported", `DuckDB is not included in this build (its native library is platform-specific): ${(e as Error).message}`); }
  },
};
type Target = Connection | Transaction;
const targets = new Map<number, Target>();
const iters = new Map<number, { it: AsyncIterator<unknown>; ac: AbortController }>();
let seq = 1;

const wire = (e: unknown): WireError => {
  if (e instanceof DriverError) return { kind: e.kind, message: e.message, ...(e.position !== undefined ? { position: e.position } : {}), ...(e.code ? { code: e.code } : {}) };
  return { kind: "unknown", message: (e as Error)?.message ?? String(e) };
};
const send = (m: Response) => process.send!(m);

process.on("message", async (m: Request) => {
  if (m.op === "abort") { iters.get(m.rid)?.ac.abort(); return; }
  try {
    if (m.op === "connect") {
      const load = drivers[m.driver];
      if (!load) throw new DriverError("unsupported", `Unknown driver ${m.driver}`);
      const d = await load();
      const c = await d.connect(m.cfg, { log: () => {} });
      const target = seq++;
      targets.set(target, c);
      send({ id: m.id, ok: true, result: { target, serverInfo: c.serverInfo, capabilities: d.capabilities } });
    } else if (m.op === "execute") {
      const t = targets.get(m.target) as Connection;
      const ac = new AbortController();
      iters.set(m.id, { it: t.execute(m.req, ac.signal)[Symbol.asyncIterator](), ac });
      send({ id: m.id, ok: true, result: null });
    } else if (m.op === "next") {
      const s = iters.get(m.rid);
      if (!s) { send({ id: m.id, ok: true, result: { done: true } }); return; }
      try {
        const r = await s.it.next();
        if (r.done) iters.delete(m.rid);
        send({ id: m.id, ok: true, result: r.done ? { done: true } : { done: false, value: r.value } });
      } catch (e) { iters.delete(m.rid); throw e; }
    } else {
      const t = targets.get(m.target);
      let result: unknown = null;
      if (m.method === "ping") await (t as Connection).ping();
      else if (m.method === "close") { await (t as Connection).close(); targets.delete(m.target); }
      else if (m.method === "begin") { const tx = await (t as Connection).begin!(); const id = seq++; targets.set(id, tx); result = id; }
      else if (m.method === "commit") { await (t as Transaction).commit(); targets.delete(m.target); }
      else if (m.method === "rollback") { await (t as Transaction).rollback(); targets.delete(m.target); }
      else result = await (((t as Connection).introspect()) as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[m.method]!(...m.args);
      send({ id: m.id, ok: true, result });
    }
  } catch (e) { send({ id: m.id, ok: false, error: wire(e) }); }
});
