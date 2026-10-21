import { build } from "esbuild";
import { cpSync } from "node:fs";

const common = { bundle: true, minify: false, sourcemap: true, logLevel: "info" };
await build({
  ...common, entryPoints: ["src/extension.ts"], outfile: "dist/extension.js",
  platform: "node", format: "cjs", target: "node22", external: ["vscode", "pg-native", "cpu-features"],
});
// Driver child process: runs drivers outside the extension host.
await build({
  ...common, entryPoints: ["src/worker/driverWorker.ts"], outfile: "dist/driverWorker.cjs",
  platform: "node", format: "cjs", target: "node22", external: ["pg-native"],
});
// Webview script runs in the browser sandbox: no Node APIs, no eval.
await build({
  ...common, entryPoints: ["src/ui/webview/main.ts"], outfile: "dist/webview.js",
  platform: "browser", format: "iife", target: "es2022",
});
await build({
  ...common, entryPoints: ["src/ui/webview/plan.ts"], outfile: "dist/plan.js",
  platform: "browser", format: "iife", target: "es2022",
});
cpSync("src/ui/webview/webview.css", "dist/webview.css");
