import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { t, effectiveLanguage } from "../i18n.js";
import { i18nBlock } from "./webviewStrings.js";
import { GuideToHost } from "../guideMessages.js";

let current: vscode.WebviewPanel | undefined;

/** What a guide button may run: a fixed table, never a command name that comes from the webview. */
const ACTIONS: Record<string, { command: string; label: () => string; icon: string }> = {
  newConnection: { command: "rizomadb.newConnection", label: () => t("Open New connection"), icon: "plus" },
  showView: { command: "workbench.view.extension.rizomadb", label: () => t("Show the connections view"), icon: "rows" },
  newQuery: { command: "rizomadb.newQuery", label: () => t("Open a new query"), icon: "code" },
  openSettings: { command: "rizomadb.openSettings", label: () => t("Open the settings"), icon: "columns" },
  openHistory: { command: "rizomadb.openHistory", label: () => t("Open the query history"), icon: "refresh" },
};

interface Step { id: string; icon: string; title: string; lead: string; points: string[]; tip?: string; actions: string[] }

const steps = (): Step[] => [
  { id: "welcome", icon: "plug", title: t("Welcome to RizomaDB"),
    lead: t("RizomaDB is a free client for many databases. This guide takes you from your first connection to editing data safely, one step at a time."),
    points: [t("It works with relational databases, document stores, key-value, search, graph, time series and wide-column engines."), t("Nothing is sent anywhere: there is no telemetry, and passwords live in VS Code's secret storage."), t("Use Next to move on. Every step has buttons that do the thing for you, and you can come back any time from the book icon of the connections view.")],
    actions: ["showView"] },
  { id: "connect", icon: "plus", title: t("1. Create a connection"),
    lead: t("Open the New connection screen and pick your engine by its logo."),
    points: [t("The form already has the usual values for each engine (localhost, the default port, the typical user). Fill in only what differs."), t("Choose the environment: dev, staging or prod. Production asks before writing; you can also create your own environments, like qa."), t("Press Test connection to check it without saving, then Save connection. If it cannot connect, you can still save it."), t("Need a tunnel? Use SSH or a proxy under Network path.")],
    tip: t("Passwords and tokens are never written to your settings files."), actions: ["newConnection"] },
  { id: "tree", icon: "rows", title: t("2. Find your way around the tree"),
    lead: t("The connections view groups your connections by type and shows each engine's logo."),
    points: [t("A dot marks the connection in use; the status bar at the bottom shows it too, with its database."), t("Expand a connection to see its tables (or collections, keys, indices…). Views have their own group."), t("Hover a row for quick buttons, and use the collapse-all button in the view title to tidy up."), t("The cloud icon imports connections from other tools; the gear opens the settings.")],
    actions: ["showView"] },
  { id: "open", icon: "panel", title: t("3. Open a table"),
    lead: t("Click a table to see its rows. The results open in the lower half of the window by default."),
    points: [t("Data shows the rows. Properties lists columns, types and indexes. Relations shows foreign keys, and DDL gives the CREATE script."), t("Where results open is a setting: lower half, the whole editor area, or beside the editor."), t("The tab shows connection.table with the engine's logo, so many results stay easy to tell apart.")],
    actions: ["openSettings"] },
  { id: "query", icon: "code", title: t("4. Write and run a query"),
    lead: t("Open a query editor, write a statement and run it."),
    points: [t("Ctrl+Enter (⌘+Enter on Mac) runs the statement under the cursor; add Shift to run the selection."), t("Each engine has its own language: SQL, Mongo shell, Redis commands, Cypher, REST for search engines…"), t("Placeholders like :name or $1 ask you for their values before running."), t("The history keeps what you ran, so you can open it again or run it again.")],
    actions: ["newQuery", "openHistory"] },
  { id: "results", icon: "columns", title: t("5. Work with the results"),
    lead: t("The results grid is made for exploring: everything is one click away, and every icon has a label when you hover it."),
    points: [t("Click a column name to sort, use the funnel to filter, drag the edge to resize and the columns button to hide some."), t("Ctrl/⌘+F searches inside the results. The record panel shows one row as a form (Alt+Enter)."), t("Right-click a cell for copy, filter by value or set NULL. The copy and save buttons export as CSV, TSV, JSON or Markdown."), t("Long results load in pages: press Load more at the bottom to continue, on any engine.")],
    tip: t("The keyboard button in the toolbar lists every shortcut."), actions: [] },
  { id: "edit", icon: "pencil", title: t("6. Edit data safely"),
    lead: t("You can change a value right in the grid when you open a table that has a primary key."),
    points: [t("Double-click a cell, or press Enter or F2, or use the pencil button. Enter confirms and Esc cancels."), t("Changes are not sent yet: they wait as pending changes. Review the SQL, undo, redo, or discard them."), t("Press Apply to send them all in one transaction. Production and staging ask for confirmation first."), t("If you prefer, turn on Save each edit immediately in the settings: each edit is applied as you confirm it (dev only skips the prompt).")],
    tip: t("Views, custom queries and read-only connections cannot be edited; the grid tells you why."), actions: ["openSettings"] },
  { id: "schema", icon: "json", title: t("7. Change the structure"),
    lead: t("Rename, retype or drop a column without writing SQL."),
    points: [t("Open the menu of a column header (the three dots, or right-click) and choose Rename, Change type, Toggle NOT NULL, Set default or Drop."), t("You always see the exact SQL and confirm it first; destructive changes are flagged."), t("The table designer, the ER diagram and the schema comparison are in the right-click menu of a connection.")],
    actions: ["showView"] },
  { id: "safety", icon: "lock", title: t("8. Keep production safe"),
    lead: t("Safety is on by default, and you can make it stricter."),
    points: [t("Each connection can be read-only, and production is read-only unless you decide otherwise."), t("Add environments with the protection you want in the settings: ask before every write, or block writes."), t("Teams can share a policy file, and the audit log records what ran (without values).")],
    actions: ["openSettings"] },
  { id: "settings", icon: "columns", title: t("9. Make it yours"),
    lead: t("The settings screen groups everything in cards, with a reset button for each."),
    points: [t("Change the language of RizomaDB without touching VS Code's."), t("Choose where results open, how many rows load per page, and which groups the tree uses."), t("Everything saves as you type, in your user settings.")],
    actions: ["openSettings"] },
  { id: "done", icon: "check", title: t("You are ready"),
    lead: t("That is the whole tour. You can open it again whenever you like."),
    points: [t("Tip: hover any icon to read what it does."), t("The commands start with RizomaDB in the command palette (⇧⌘P or Ctrl+Shift+P)."), t("If something does not work, the output panel named RizomaDB policy and the status bar tell you what is blocking it.")],
    actions: ["newConnection"] },
];

/** The interactive guide: a step list on the left, one step at a time on the right, with buttons that do the step for you. */
export function openGuide(ctx: vscode.ExtensionContext, start?: string) {
  if (current) { current.reveal(); return; }
  const root = vscode.Uri.joinPath(ctx.extensionUri, "dist");
  const panel = vscode.window.createWebviewPanel("rizomadb.guide", t("RizomaDB guide"), vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [root] });
  current = panel; panel.onDidDispose(() => { current = undefined; });
  panel.iconPath = vscode.Uri.joinPath(ctx.extensionUri, "media", "icon.png");
  const nonce = randomBytes(16).toString("base64"), w = panel.webview;
  w.html = `<!doctype html><html lang="${effectiveLanguage()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${w.asWebviewUri(vscode.Uri.joinPath(root, "webview.css"))}"><title>${t("RizomaDB guide")}</title></head>
<body><div id="app"></div>${i18nBlock()}<script nonce="${nonce}" src="${w.asWebviewUri(vscode.Uri.joinPath(root, "guide.js"))}"></script></body></html>`;

  const all = steps();
  const load = () => void w.postMessage({
    v: 1, type: "load", current: start ?? ctx.globalState.get<string>("guide.last", "welcome"), done: ctx.globalState.get<string[]>("guide.done", []),
    steps: all.map((s) => ({ id: s.id, icon: s.icon, title: s.title, lead: s.lead, points: s.points, ...(s.tip ? { tip: s.tip } : {}), actions: s.actions.map((a) => ({ id: a, label: ACTIONS[a]!.label(), icon: ACTIONS[a]!.icon })) })),
  });
  w.onDidReceiveMessage(async (raw: unknown) => {
    const p = GuideToHost.safeParse(raw); if (!p.success) return;
    const m = p.data;
    if (m.type === "ready") load();
    else if (m.type === "visit") {
      if (!all.some((s) => s.id === m.id)) return;
      const done = new Set(ctx.globalState.get<string[]>("guide.done", [])); done.add(m.id);
      await ctx.globalState.update("guide.done", [...done]); await ctx.globalState.update("guide.last", m.id);
    } else if (m.type === "reset") { await ctx.globalState.update("guide.done", []); await ctx.globalState.update("guide.last", "welcome"); start = "welcome"; load(); }
    else { const a = ACTIONS[m.id]; if (a) await vscode.commands.executeCommand(a.command); }
  });
}

/** Offers the guide once, the first time the extension runs. */
export async function offerGuideOnce(ctx: vscode.ExtensionContext) {
  if (ctx.globalState.get<boolean>("guide.offered", false)) return;
  await ctx.globalState.update("guide.offered", true);
  const go = t("Start the guide");
  const pick = await vscode.window.showInformationMessage(t("Welcome to RizomaDB! Want a quick guided tour?"), go, t("Not now"));
  if (pick === go) openGuide(ctx);
}
