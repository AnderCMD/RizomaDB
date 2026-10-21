// Reproducible performance budget check: node packages/sql/bench/run.mjs (after pnpm build)
import { SchemaIndex, complete, tokenize, splitScript } from "../dist/index.js";

const N = 5000;
const col = (name) => ({ name, nativeType: "int", nullable: true, primaryKey: name === "col_0" });
const idx = new SchemaIndex(Array.from({ length: N }, (_, i) => ({ schema: "public", name: `table_${String(i).padStart(4, "0")}`, kind: "table", columns: Array.from({ length: 20 }, (_, c) => col(`col_${c}`)) })));
const cases = {
  "tables after FROM": ["select * from table_00", 22],
  "qualified columns": ["select t.co from table_0042 t join table_0043 u on t.col_0 = u.col_0", 11],
  "columns in WHERE": ["select * from table_0042 t where co", 35],
};
const budgetMs = 100;
let worst = 0;
for (const [name, [sql, off]] of Object.entries(cases)) {
  for (let i = 0; i < 20; i++) complete(sql, off, idx, "postgres"); // warm-up
  const times = [];
  for (let i = 0; i < 300; i++) { const t = performance.now(); complete(sql, off, idx, "postgres"); times.push(performance.now() - t); }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  worst = Math.max(worst, p95);
  console.log(`${name.padEnd(22)} p50 ${times[150].toFixed(2)} ms  p95 ${p95.toFixed(2)} ms`);
}
const big = "select a, b, c from t where x = 'str;ing' -- c\n;".repeat(20000);
let t = performance.now(); tokenize(big, "postgres"); const tk = performance.now() - t;
t = performance.now(); splitScript(big, "postgres"); const sp = performance.now() - t;
console.log(`tokenize ${(big.length / 1e6).toFixed(1)} MB: ${tk.toFixed(0)} ms · split: ${sp.toFixed(0)} ms`);
if (worst > budgetMs) { console.error(`FAIL: completion p95 ${worst.toFixed(1)} ms > ${budgetMs} ms budget`); process.exit(1); }
console.log(`OK: completion p95 within ${budgetMs} ms budget on ${N} tables`);
