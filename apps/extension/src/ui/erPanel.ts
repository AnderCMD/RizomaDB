import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { layoutEr, toMermaid, toPlantUml, toSvg, type SchemaModel } from "@rizomadb/schema-tools";
import * as z from "zod/mini";

const FromWebview = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("export"), format: z.enum(["svg", "mermaid", "plantuml"]) }),
  z.object({ v: z.literal(1), type: z.literal("png"), data: z.string().check(z.maxLength(40_000_000), z.regex(/^[A-Za-z0-9+/=]+$/)) }),
]);

export function showEr(ctx: vscode.ExtensionContext, title: string, model: SchemaModel, only?: Set<string>) {
  const root = vscode.Uri.joinPath(ctx.extensionUri, "dist");
  const panel = vscode.window.createWebviewPanel("rizomadb.er", `ER: ${title}`, vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [root] });
  const nonce = randomBytes(16).toString("base64"), w = panel.webview, t = vscode.l10n.t;
  w.html = `<!doctype html><html lang="${vscode.env.language}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}'; img-src data:;">
<link rel="stylesheet" href="${w.asWebviewUri(vscode.Uri.joinPath(root, "webview.css"))}"><title>ER</title></head>
<body><header><strong id="title"></strong>
<button id="zin" aria-label="${t("Zoom in")}">+</button><button id="zout" aria-label="${t("Zoom out")}">−</button><button id="zfit">${t("Fit")}</button>
<button id="x-svg">SVG</button><button id="x-png">PNG</button><button id="x-mermaid">Mermaid</button><button id="x-plantuml">PlantUML</button></header>
<svg id="svg" role="group" aria-label="${t("Entity-relationship diagram")}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs><g id="viewport"></g></svg>
<div id="live" class="sr-only" aria-live="polite"></div>
<script nonce="${nonce}" src="${w.asWebviewUri(vscode.Uri.joinPath(root, "er.js"))}"></script></body></html>`;
  const L = layoutEr(model, only);
  const pk = (n: string, t: SchemaModel["tables"][number]) => t.primaryKey.some((p) => p.toLowerCase() === n.toLowerCase());
  void w.postMessage({ v: 1, type: "er", title, width: L.width, height: L.height,
    nodes: L.nodes.map((n) => ({ name: n.table.name, x: n.x, y: n.y, w: n.w, h: n.h, cols: n.table.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable, pk: pk(c.name, n.table), fk: n.table.foreignKeys.some((f) => f.columns.some((x) => x.toLowerCase() === c.name.toLowerCase())) })) })),
    edges: L.edges });
  w.onDidReceiveMessage(async (raw: unknown) => {
    const m = FromWebview.safeParse(raw); if (!m.success) return;
    if (m.data.type === "png") {
      const uri = await vscode.window.showSaveDialog({ filters: { PNG: ["png"] }, defaultUri: vscode.Uri.file(`er-${title}.png`) });
      if (uri) await writeFile(uri.fsPath, Buffer.from(m.data.data, "base64"));
      return;
    }
    const f = m.data.format;
    const content = f === "svg" ? toSvg(model, title, only) : f === "mermaid" ? toMermaid(model) : toPlantUml(model);
    const uri = await vscode.window.showSaveDialog({ filters: { [f]: [f === "svg" ? "svg" : f === "mermaid" ? "mmd" : "puml"] }, defaultUri: vscode.Uri.file(`er-${title}.${f === "svg" ? "svg" : f === "mermaid" ? "mmd" : "puml"}`) });
    if (uri) await writeFile(uri.fsPath, content);
  });
}
