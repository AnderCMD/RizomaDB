// Copies the built webview bundles and axe-core next to the harness pages, then serves them: node test/a11y/prepare.mjs
import { cpSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";

const out = new URL("./out/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const here = new URL("./", import.meta.url).pathname;
for (const f of ["grid", "plan", "er", "designer", "metrics", "connect", "settings", "history", "guide"]) cpSync(join(here, `${f}.html`), join(out, `${f}.html`));
for (const f of ["theme-dark.css", "theme-light.css"]) cpSync(join(here, f), join(out, f));
const dist = new URL("../../apps/extension/dist/", import.meta.url).pathname;
for (const f of ["webview.js", "webview.css", "plan.js", "er.js", "designer.js", "metrics.js", "connect.js", "settings.js", "history.js", "guide.js"]) cpSync(join(dist, f), join(out, f));
cpSync(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url).pathname, join(out, "axe.min.js"));
cpSync(join(here, "keyboard.js"), join(out, "keyboard.js"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
createServer((req, res) => { const p = join(out, (req.url ?? "/").split("?")[0]); if (!existsSync(p)) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": types[extname(p)] ?? "text/plain" }).end(readFileSync(p)); }).listen(8766, () => console.log("Harness on http://localhost:8766/grid.html (also plan, er, designer, metrics, connect, connect#form)"));
