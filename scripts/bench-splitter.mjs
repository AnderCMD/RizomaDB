// Before/after benchmark for the comment-only check in splitStatements. Run: node scripts/bench-splitter.mjs
const OLD = /^(--[^\n]*\s*|\/\*[\s\S]*?\*\/\s*)+$/;
const WS = /\s/;
function onlyComments(text) {
  let i = 0, seen = false; const n = text.length;
  while (i < n) {
    if (WS.test(text[i])) { i++; continue; }
    if (text.startsWith("--", i)) { const e = text.indexOf("\n", i); i = e < 0 ? n : e; seen = true; continue; }
    if (text.startsWith("/*", i)) { const e = text.indexOf("*/", i + 2); if (e < 0) return false; i = e + 2; seen = true; continue; }
    return false;
  }
  return seen;
}
const time = (f) => { const t = performance.now(); f(); return performance.now() - t; };
console.log("adversarial: N x '/* a */ ' + 'x'  (old regex is exponential in N, so it is only run for small N)");
for (const n of [10, 16, 20, 22, 24]) { const s = "/* a */ ".repeat(n) + "x"; console.log(`old N=${n} (${s.length} B): ${time(() => OLD.test(s)).toFixed(1)} ms`); }
console.log("\nnew scanner, same shape, by size:");
for (const kb of [1, 10, 50, 100, 500]) { const s = "/* a */ ".repeat((kb * 1024) / 8) + "x"; console.log(`${kb} KB: ${time(() => onlyComments(s)).toFixed(2)} ms`); }
