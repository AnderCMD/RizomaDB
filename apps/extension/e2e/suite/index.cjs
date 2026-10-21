// Runs inside the VS Code extension host.
const vscode = require("vscode");
const assert = require("node:assert");

exports.run = async function run() {
  const ext = vscode.extensions.all.find((e) => e.packageJSON.name === "rizomadb");
  assert.ok(ext, "extension is installed in the dev host");
  await ext.activate();
  assert.ok(ext.isActive, "extension activates");
  const declared = ext.packageJSON.contributes.commands.map((c) => c.command);
  const registered = new Set(await vscode.commands.getCommands(true));
  const missing = declared.filter((c) => !registered.has(c));
  assert.deepStrictEqual(missing, [], `declared commands without handler: ${missing.join(", ")}`);
  // A SQL document gets our language features without throwing.
  const doc = await vscode.workspace.openTextDocument({ language: "sql", content: "select 1;" });
  await vscode.window.showTextDocument(doc);
  const items = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", doc.uri, new vscode.Position(0, 6));
  assert.ok(items, "completion provider answers");
  console.log(`host node ${process.versions.node}, electron ${process.versions.electron}`);
  let sqliteOk = true; try { require("node:sqlite"); } catch { sqliteOk = false; }
  console.log(`node:sqlite available in this host: ${sqliteOk}`);
  console.log(`e2e OK: ${declared.length} commands registered`);
};
