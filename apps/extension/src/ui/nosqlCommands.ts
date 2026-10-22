import * as vscode from "vscode";
import { collect, type Connection, type Value } from "@rizomadb/driver-api";
import { decideEffective, type EffectivePolicy } from "@rizomadb/core";
import { analysisMarkdown, analyzeDocuments, pipelinePrefix, pipelineStages } from "../lib/mongoTools.js";
import { formatValue } from "../lib/format.js";
import { commandAt } from "../lib/commandAt.js";
import type { ConnectionManager } from "../lib/connections.js";
import type { Node } from "./explorer.js";
import { t } from "../i18n.js";
import { friendly } from "./driverMessages.js";
import { isEditableRedisType, readCommand, writeCommand } from "../lib/redisEdit.js";

const sig = () => new AbortController().signal;

interface Deps { mgr: ConnectionManager; policy: () => EffectivePolicy; reg: (id: string, fn: (...a: never[]) => unknown) => void; refresh: () => void; bind: (d: vscode.TextDocument) => Promise<string | undefined> }

export function registerNoSqlCommands({ mgr, policy, reg, refresh, bind }: Deps) {
  const tableNode = (n?: Node) => (n?.kind === "table" ? n : undefined);
  const exec = async (conn: Connection, command: string) => collect(conn.execute({ sql: command }, sig()));
  const docsOf = (r: Awaited<ReturnType<typeof exec>>): Record<string, unknown>[] => r.rows.map((row) => Object.fromEntries(r.columns.map((c, i) => [c.name, jsonish(row[i]!)])));
  const jsonish = (v: Value): unknown => (v instanceof Date ? v : v !== null && typeof v === "object" && !(v instanceof Uint8Array) && !Array.isArray(v) ? (v as { json: unknown }).json : typeof v === "bigint" ? Number(v) : v);

  /** Runs a mutating command only after the shared policy and an explicit confirmation. */
  const guarded = async (n: Extract<Node, { kind: "table" }>, command: string, what: string) => {
    const profile = n.profile; const plugin = await mgr.loadDriver(profile.driver);
    const d = decideEffective(command, { environment: profile.environment, readOnly: mgr.isReadOnly(profile) }, policy(), plugin.assess);
    if (!d.allowed) { void vscode.window.showErrorMessage(d.reason ? friendly(d.reason) : t("Blocked by policy")); return false; }
    const ok = await vscode.window.showWarningMessage(t("[{0}] {1}: {2}", profile.environment.toUpperCase(), profile.name, what), { modal: true, detail: command }, t("Run"));
    if (!ok) return false;
    try { await exec(await mgr.connect(profile.id), command); refresh(); return true; }
    catch (e) { void vscode.window.showErrorMessage(t("Command failed: {0}", friendly((e as Error).message))); return false; }
  };

  reg("rizomadb.mongo.analyzeSchema", async (n?: Node) => {
    const tb = tableNode(n); if (!tb) return;
    const conn = await mgr.connect(tb.profile.id);
    const cmd = `db.getSiblingDB(${JSON.stringify(tb.schema ?? "test")}).getCollection(${JSON.stringify(tb.name)}).aggregate([{ "$sample": { "size": 1000 } }])`;
    const docs = docsOf(await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t("Sampling {0}…", tb.name) }, () => exec(conn, cmd)));
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ language: "markdown", content: analysisMarkdown(`${tb.schema ?? ""}.${tb.name}`, analyzeDocuments(docs), { title: (n) => t("Schema analysis: {0}", n), sampled: (n) => t("Sampled {0} documents.", n), field: t("Field"), presentIn: t("Present in"), types: t("Types (occurrences)") }) }), { preview: false });
  });

  reg("rizomadb.mongo.previewPipeline", async () => {
    const ed = vscode.window.activeTextEditor; if (!ed || ed.document.languageId !== "rizomadb-mongo") { void vscode.window.showInformationMessage(t("Open a MongoDB query file with a db.collection.aggregate([...]) command.")); return; }
    const text = ed.selection.isEmpty ? commandAt("rizomadb-mongo", ed.document.getText(), ed.document.offsetAt(ed.selection.active)) : ed.document.getText(ed.selection);
    const p = text ? pipelineStages(text) : undefined;
    if (!p || !p.stages.length) { void vscode.window.showWarningMessage(t("No aggregate([...]) pipeline found at the cursor.")); return; }
    const id = await bind(ed.document); if (!id) return;
    const conn = await mgr.connect(id);
    const out: string[] = [`# ${t("Pipeline preview")}`, ""];
    for (let i = 1; i <= p.stages.length; i++) {
      out.push(`## ${t("After stage {0}", i)}: \`${p.stages[i - 1]!.replace(/\s+/g, " ").slice(0, 120)}\``, "");
      try {
        const r = await exec(conn, pipelinePrefix(p.head, p.stages, i, 5));
        out.push("```json", ...docsOf(r).map((d) => JSON.stringify(d, (_, v) => (typeof v === "bigint" ? String(v) : v))), "```", "");
      } catch (e) { out.push(`> ${t("Error")}: ${(e as Error).message}`, ""); break; }
    }
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ language: "markdown", content: out.join("\n") }), { viewColumn: vscode.ViewColumn.Beside, preview: true });
  });

  reg("rizomadb.mongo.createIndex", async (n?: Node) => {
    const tb = tableNode(n); if (!tb) return;
    const keys = await vscode.window.showInputBox({ title: t("Index keys (1 ascending, -1 descending)"), value: '{ "field": 1 }', ignoreFocusOut: true }); if (!keys) return;
    const unique = await vscode.window.showQuickPick([{ label: t("Non-unique"), v: false }, { label: t("Unique"), v: true }], { title: t("Index type") }); if (!unique) return;
    const cmd = `db.getSiblingDB(${JSON.stringify(tb.schema ?? "test")}).getCollection(${JSON.stringify(tb.name)}).createIndex(${keys}, { "unique": ${unique.v} })`;
    if (await guarded(tb, cmd, t("create an index on {0}?", tb.name))) void vscode.window.showInformationMessage(t("Index created."));
  });

  reg("rizomadb.mongo.dropIndex", async (n?: Node) => {
    const tb = tableNode(n); if (!tb) return;
    const conn = await mgr.connect(tb.profile.id);
    const list = await exec(conn, `db.getSiblingDB(${JSON.stringify(tb.schema ?? "test")}).getCollection(${JSON.stringify(tb.name)}).getIndexes()`);
    const names = docsOf(list).map((d) => String(d.name)).filter((x) => x !== "_id_");
    if (!names.length) { void vscode.window.showInformationMessage(t("This collection has no secondary indexes.")); return; }
    const pick = await vscode.window.showQuickPick(names, { title: t("Index to drop") }); if (!pick) return;
    await guarded(tb, `db.getSiblingDB(${JSON.stringify(tb.schema ?? "test")}).getCollection(${JSON.stringify(tb.name)}).dropIndex(${JSON.stringify(pick)})`, t("drop index {0}?", pick));
  });

  reg("rizomadb.redis.deleteKey", async (n?: Node) => { const tb = tableNode(n); if (tb) await guarded(tb, `DEL ${JSON.stringify(tb.name)}`, t("delete key {0}?", tb.name)); });
  reg("rizomadb.redis.setTtl", async (n?: Node) => {
    const tb = tableNode(n); if (!tb) return;
    const v = await vscode.window.showInputBox({ title: t("TTL in seconds (empty = remove expiry)"), validateInput: (x) => (x === "" || /^\d+$/.test(x) ? undefined : t("Enter a whole number of seconds")) }); if (v === undefined) return;
    await guarded(tb, v === "" ? `PERSIST ${JSON.stringify(tb.name)}` : `EXPIRE ${JSON.stringify(tb.name)} ${v}`, t("change the expiry of {0}?", tb.name));
  });
  reg("rizomadb.redis.renameKey", async (n?: Node) => {
    const tb = tableNode(n); if (!tb) return;
    const to = await vscode.window.showInputBox({ title: t("New key name"), value: tb.name, validateInput: (x) => (x && x !== tb.name ? undefined : t("Enter a different name")) }); if (!to) return;
    await guarded(tb, `RENAMENX ${JSON.stringify(tb.name)} ${JSON.stringify(to)}`, t("rename {0} to {1}? (fails if the target exists)", tb.name, to));
  });
  reg("rizomadb.redis.editValue", async (n?: Node) => {
    const tb = tableNode(n); if (!tb) return;
    const conn = await mgr.connect(tb.profile.id), key = tb.name;
    const type = String((await exec(conn, `TYPE ${JSON.stringify(key)}`)).rows[0]?.[0] ?? "none");
    if (type === "none") { void vscode.window.showWarningMessage(t("The key no longer exists.")); return; }
    if (!isEditableRedisType(type)) { void vscode.window.showInformationMessage(t("Editing {0} values is not supported yet; use the console.", type)); return; }
    const read = (await exec(conn, readCommand(type, key))).rows;
    let target: string | number | undefined, current: string;
    if (type === "string") current = String(read[0]?.[0] ?? "");
    else {
      if (!read.length) { void vscode.window.showInformationMessage(t("This key has no elements.")); return; }
      const pick = await vscode.window.showQuickPick(read.map((r) => ({ label: String(r[0]), description: String(r[1] ?? "").slice(0, 80), value: String(r[1] ?? "") })), { title: type === "hash" ? t("Field to edit") : t("List element to edit"), matchOnDescription: true });
      if (!pick) return;
      target = type === "list" ? Number(pick.label) : pick.label; current = pick.value;
    }
    const value = await vscode.window.showInputBox({ title: t("New value for {0}", target === undefined ? key : `${key} → ${String(target)}`), value: current, ignoreFocusOut: true }); if (value === undefined) return;
    await guarded(tb, writeCommand(type, key, target, value), t("edit the value of {0}?", key));
  });
  void formatValue;
}
