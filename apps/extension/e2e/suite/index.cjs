// Runs inside the VS Code extension host.
const vscode = require("vscode");
const assert = require("node:assert");

exports.run = async function run() {
  const ext = vscode.extensions.all.find((e) => e.packageJSON.name === "rizomadb-client");
  assert.ok(ext, "extension is installed in the dev host");
  const started = performance.now();
  await ext.activate();
  const activationMs = Math.round(performance.now() - started);
  assert.ok(ext.isActive, "extension activates");
  // Activation does no network and loads no driver (measured ~100 ms on a laptop, also with the CPUs busy); 1 s still leaves room for a slow CI machine and catches an accidental heavy import.
  console.log(`RizomaDB activation: ${activationMs} ms`);
  assert.ok(activationMs < 1000, `activation took ${activationMs} ms (budget 1000 ms)`);
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
  // Formatting uses the editor's indentation and the rizomadb.format.* settings, read for the document.
  const formatted = async (options) => {
    const d = await vscode.workspace.openTextDocument({ language: "sql", content: "SELECT a FROM t WHERE x=1\n" });
    await vscode.window.showTextDocument(d);
    const edits = await vscode.commands.executeCommand("vscode.executeFormatDocumentProvider", d.uri, options);
    assert.ok(edits && edits.length > 0, "the SQL formatter answers");
    const we = new vscode.WorkspaceEdit(); we.set(d.uri, edits); await vscode.workspace.applyEdit(we);
    return d.getText();
  };
  const fcfg = vscode.workspace.getConfiguration("rizomadb.format");
  await fcfg.update("keywordCase", "lower", vscode.ConfigurationTarget.Global);
  try {
    assert.strictEqual(await formatted({ tabSize: 4, insertSpaces: false }), "select\n\ta\nfrom\n\tt\nwhere\n\tx = 1\n", "tabs from the editor, lower-case keywords from the setting");
    assert.strictEqual(await formatted({ tabSize: 3, insertSpaces: true }), "select\n   a\nfrom\n   t\nwhere\n   x = 1\n", "tab size from the editor");
  } finally { await fcfg.update("keywordCase", undefined, vscode.ConfigurationTarget.Global); }
  // Every screen opens as a real webview tab (CSP, nonce and the bundled scripts load without throwing).
  const opened = async (cmd, title) => {
    await vscode.commands.executeCommand(cmd);
    await new Promise((r) => setTimeout(r, 600));
    const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    assert.ok(tabs.some((t) => t.input && t.input.viewType && String(t.input.viewType).includes(title)), `${cmd} opens a ${title} tab`);
  };
  await opened("rizomadb.openSettings", "rizomadb.settings");
  await opened("rizomadb.newConnection", "rizomadb.connect");
  await opened("rizomadb.openGuide", "rizomadb.guide");
  await opened("rizomadb.openHistory", "rizomadb.history");
  // The extension language setting changes the screens' own titles in a real window (the settings screen reopens itself on a change).
  const cfg = vscode.workspace.getConfiguration("rizomadb");
  const titleIn = async (lang) => {
    await cfg.update("language", lang, vscode.ConfigurationTarget.Global);
    await new Promise((r) => setTimeout(r, 400));
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await vscode.commands.executeCommand("rizomadb.newConnection");
    await new Promise((r) => setTimeout(r, 600));
    return vscode.window.tabGroups.all.flatMap((g) => g.tabs).map((t) => t.label).find((l) => /conexi|connection/i.test(l));
  };
  try {
    assert.strictEqual(await titleIn("en"), "New connection");
    assert.strictEqual(await titleIn("es"), "Nueva conexión");
  } finally { await cfg.update("language", undefined, vscode.ConfigurationTarget.Global); }
  console.log(`host node ${process.versions.node}, electron ${process.versions.electron}`);
  let sqliteOk = true; try { require("node:sqlite"); } catch { sqliteOk = false; }
  console.log(`node:sqlite available in this host: ${sqliteOk}`);
  console.log(`e2e OK: ${declared.length} commands registered`);
};
