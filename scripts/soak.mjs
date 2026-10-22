// Long-running leak check: node --expose-gc scripts/soak.mjs [minutes=1]
// Runs queries, cancellations, transactions and guarded/audited statements in a loop and fails if heap/RSS keep growing.
import { sqliteDriver } from "../packages/drivers/sqlite/dist/index.js";
import { postgresDriver } from "../packages/drivers/postgres/dist/index.js";
import { mysqlDriver } from "../packages/drivers/mysql/dist/index.js";
import { collect } from "../packages/driver-api/dist/index.js";
import { AuditLog, builtInPolicy, guardConnection, mergePolicies } from "../packages/core/dist/index.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const minutes = Number(process.argv[2] ?? 1);
const audit = new AuditLog({ file: join(mkdtempSync(join(tmpdir(), "rz-soak-")), "a.jsonl"), maxBytes: 1_000_000, keepFiles: 2 });
const policy = mergePolicies(builtInPolicy);
const run = (c, sql, signal = new AbortController().signal) => collect(c.execute({ sql }, signal));
const targets = [["sqlite", () => sqliteDriver.connect({ path: ":memory:" }, { log() {} }), "SELECT * FROM t WHERE a < 50", "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 100000) SELECT i FROM n"]];
if (process.env.RZ_PG_PORT !== "off") targets.push(["postgres", () => postgresDriver.connect({ host: "localhost", port: Number(process.env.RZ_PG_PORT ?? 54329), user: "postgres", password: "rizoma_test", database: "postgres", ssl: false }, { log() {} }), "SELECT g, md5(g::text) FROM generate_series(1, 50) g", "SELECT g FROM generate_series(1, 200000) g"]);
if (process.env.RZ_MYSQL_PORT !== "off") targets.push(["mysql", () => mysqlDriver.connect({ host: "127.0.0.1", port: Number(process.env.RZ_MYSQL_PORT ?? 33069), user: "root", password: "rizoma_test", ssl: false }, { log() {} }), "SELECT 1 AS a, 'x' AS b", "SELECT 1 FROM information_schema.columns a, information_schema.columns b LIMIT 200000"]);

const conns = [];
for (const [name, open, q, big] of targets) {
  const raw = await open();
  const g = guardConnection(raw, { plugin: name === "sqlite" ? sqliteDriver : name === "mysql" ? mysqlDriver : postgresDriver, connectionId: name, connectionName: name, environment: "dev", readOnly: () => false, policy: () => policy, audit });
  if (name === "sqlite") { await run(g, "CREATE TABLE t (a INTEGER, b TEXT)"); await run(g, "INSERT INTO t SELECT value, 'x' || value FROM generate_series(1, 200)").catch(async () => { for (let i = 0; i < 200; i++) await run(g, `INSERT INTO t VALUES (${i}, 'x${i}')`); }); }
  conns.push({ name, g, q, big });
}

let lateCancelFailures = 0;
const samples = [];
const t0 = Date.now(); let iter = 0, lastSample = 0;
while (Date.now() - t0 < minutes * 60_000) {
  for (const { name, g, q, big } of conns) {
    await run(g, q);
    // Cancel in the middle of a big result, then run the next statement at once: a late cancel must never hit it.
    { const ac2 = new AbortController(); const it = g.execute({ sql: big }, ac2.signal)[Symbol.asyncIterator]();
      for (;;) { const r = await it.next().catch(() => ({ done: true })); if (r.done || r.value?.type === "rows") break; }
      ac2.abort(); await it.return?.().catch(() => {});
      try { await run(g, "SELECT 1"); } catch { lateCancelFailures++; } }
    const tx = await g.begin?.(); if (tx) { await collect(tx.execute({ sql: name === "sqlite" ? "INSERT INTO t VALUES (1000, 'tmp')" : "SELECT 1" }, new AbortController().signal)); await tx.rollback(); }
    const ac = new AbortController(); ac.abort(); await run(g, "SELECT 1", ac.signal).catch(() => {});
    await run(g, "DROP TABLE nothing_here").catch(() => {});
  }
  iter++;
  if (Date.now() - lastSample > 5000) { global.gc?.(); const m = process.memoryUsage(); samples.push({ t: Date.now() - t0, heap: m.heapUsed, rss: m.rss }); lastSample = Date.now(); }
}
for (const c of conns) await c.g.close();
await audit.flush();
const warm = samples.slice(Math.ceil(samples.length / 4));
const slope = (key) => { const n = warm.length; if (n < 3) return 0; const xs = warm.map((s) => s.t / 60_000), ys = warm.map((s) => s[key] / 1048576); const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; return xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0); };
const hs = slope("heap"), rs = slope("rss");
console.log(`${lateCancelFailures} late-cancel failures; ${iter} iterations over ${minutes} min; heap ${(samples.at(-1).heap / 1048576).toFixed(1)} MB (${hs.toFixed(2)} MB/min), rss ${(samples.at(-1).rss / 1048576).toFixed(1)} MB (${rs.toFixed(2)} MB/min)`);
if (lateCancelFailures) { console.error(`FAIL: ${lateCancelFailures} statements were hit by an earlier cancel`); process.exit(1); }
if (hs > 2 || rs > 10) { console.error("FAIL: memory keeps growing"); process.exit(1); }
console.log("OK: no sustained growth");
