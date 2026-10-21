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
  // Query editors get a Run lens above every statement, and the connection / Run all lenses on the first line.
  const sql = await vscode.workspace.openTextDocument({ language: "sql", content: "select 1;\nselect 2;" });
  await vscode.window.showTextDocument(sql);
  const lenses = await vscode.commands.executeCommand("vscode.executeCodeLensProvider", sql.uri);
  const titles = lenses.map((l) => l.command?.command);
  assert.strictEqual(titles.filter((c) => c === "rizomadb.runAt").length, 2, "one Run lens per statement");
  assert.strictEqual(titles.filter((c) => c === "rizomadb.explainAt").length, 2, "one Explain lens per SQL statement");
  assert.ok(titles.includes("rizomadb.runAll") && titles.includes("rizomadb.selectConnection"), "header lenses");
  const mongo = await vscode.workspace.openTextDocument({ language: "rizomadb-mongo", content: "db.a.find({})\n\ndb.b.find({})" });
  const mlenses = await vscode.commands.executeCommand("vscode.executeCodeLensProvider", mongo.uri);
  assert.strictEqual(mlenses.filter((l) => l.command?.command === "rizomadb.runAt").length, 2, "Mongo blocks get lenses too");
  assert.ok(mlenses.every((l) => l.command?.command !== "rizomadb.explainAt"), "no Explain lens outside SQL");
  console.log(`host node ${process.versions.node}, electron ${process.versions.electron}`);
  let sqliteOk = true; try { require("node:sqlite"); } catch { sqliteOk = false; }
  console.log(`node:sqlite available in this host: ${sqliteOk}`);
  console.log(`e2e OK: ${declared.length} commands registered`);
};
