import { build } from "esbuild";
import { cpSync } from "node:fs";

const common = { bundle: true, minify: false, sourcemap: true, logLevel: "info" };
await build({
  ...common, entryPoints: ["src/extension.ts"], outfile: "dist/extension.js",
  platform: "node", format: "cjs", target: "node22", external: ["vscode", "pg-native"],
});
// Webview script runs in the browser sandbox: no Node APIs, no eval.
await build({
  ...common, entryPoints: ["src/ui/webview/main.ts"], outfile: "dist/webview.js",
  platform: "browser", format: "iife", target: "es2022",
});
cpSync("src/ui/webview/webview.css", "dist/webview.css");
