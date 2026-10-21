// Launches a real VS Code (the installed one, or RZ_VSCODE_PATH) with the extension loaded and runs e2e/suite/index.cjs inside it.
import { runTests } from "@vscode/test-electron";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
let exe = process.env.RZ_VSCODE_PATH;
if (!exe) {
  const mac = "/Applications/Visual Studio Code.app/Contents/MacOS/Code";
  exe = process.platform === "darwin" ? mac : undefined;
}
const base = mkdtempSync(path.join(tmpdir(), "rz-e2e-"));
await runTests({
  vscodeExecutablePath: exe,
  extensionDevelopmentPath: path.resolve(here, ".."),
  extensionTestsPath: path.join(here, "suite", "index.cjs"),
  launchArgs: ["--disable-extensions", "--user-data-dir", path.join(base, "user"), "--extensions-dir", path.join(base, "ext"), "--disable-workspace-trust", base],
});
