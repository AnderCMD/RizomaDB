// CI helper: service containers accept TCP before they can answer queries. Waits (up to 6 minutes) for the slow starters.
const checks = [
  ["trino", () => fetch(`http://127.0.0.1:${process.env.RZ_TRINO_PORT ?? 8080}/v1/info`).then((r) => r.json()).then((j) => j.starting === false)],
  ["influxdb", () => fetch(`http://127.0.0.1:${process.env.RZ_INFLUXDB_PORT ?? 8086}/health`).then((r) => r.ok)],
  ["neo4j", () => fetch(`http://127.0.0.1:${process.env.RZ_NEO4J_PORT ?? 7474}/`).then((r) => r.ok)],
  ["dynamodb", () => fetch(`http://127.0.0.1:${process.env.RZ_DYNAMODB_PORT ?? 8000}/`).then(() => true)],
];
const deadline = Date.now() + 6 * 60_000;
for (const [name, ok] of checks) {
  for (;;) {
    if (await ok().catch(() => false)) { console.log(`${name}: ready`); break; }
    if (Date.now() > deadline) { console.error(`${name}: not ready in time`); process.exit(1); }
    await new Promise((r) => setTimeout(r, 3000));
  }
}
