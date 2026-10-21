import * as vscode from "vscode";
import type { ConnectionManager } from "../lib/connections.js";
import type { ConnectionProfile } from "@rizomadb/core";

export type Node =
  | { kind: "connection"; profile: ConnectionProfile }
  | { kind: "schema"; profile: ConnectionProfile; schema: string }
  | { kind: "table"; profile: ConnectionProfile; schema?: string; name: string; isView: boolean }
  | { kind: "column"; label: string; detail: string; pk: boolean };

const envColor: Record<string, string> = { prod: "charts.red", staging: "charts.yellow", dev: "charts.green" };

export class Explorer implements vscode.TreeDataProvider<Node> {
  private ev = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.ev.event;
  constructor(private mgr: ConnectionManager) { mgr.onChange(() => this.ev.fire(undefined)); }
  refresh() { this.ev.fire(undefined); }

  getTreeItem(n: Node): vscode.TreeItem {
    if (n.kind === "connection") {
      const p = n.profile, ro = this.mgr.isReadOnly(p);
      const it = new vscode.TreeItem(p.name, vscode.TreeItemCollapsibleState.Collapsed);
      // Environment is conveyed by text as well as colour (WCAG: not colour alone).
      it.description = `[${p.environment.toUpperCase()}]${ro ? " · " + vscode.l10n.t("read-only") : ""}${this.mgr.isConnected(p.id) ? "" : " · " + vscode.l10n.t("disconnected")}`;
      it.iconPath = new vscode.ThemeIcon(ro ? "lock" : "database", new vscode.ThemeColor(envColor[p.environment] ?? "charts.blue"));
      it.contextValue = "connection";
      it.tooltip = `${p.name} (${p.driver}) — ${p.environment}`;
      return it;
    }
    if (n.kind === "schema") {
      const it = new vscode.TreeItem(n.schema, vscode.TreeItemCollapsibleState.Collapsed);
      it.iconPath = new vscode.ThemeIcon("symbol-namespace"); it.contextValue = "schema"; return it;
    }
    if (n.kind === "table") {
      const it = new vscode.TreeItem(n.name, vscode.TreeItemCollapsibleState.Collapsed);
      it.iconPath = new vscode.ThemeIcon(n.isView ? "eye" : "table"); it.contextValue = "table";
      it.description = n.isView ? vscode.l10n.t("view") : undefined;
      it.command = { command: "rizomadb.openTable", title: "Open", arguments: [n] };
      return it;
    }
    const it = new vscode.TreeItem(n.label, vscode.TreeItemCollapsibleState.None);
    it.description = n.detail; it.iconPath = new vscode.ThemeIcon(n.pk ? "key" : "symbol-field"); return it;
  }

  async getChildren(n?: Node): Promise<Node[]> {
    if (!n) return this.mgr.list().map((profile) => ({ kind: "connection", profile }));
    try {
      if (n.kind === "column") return [];
      const conn = await this.mgr.connect(n.profile.id);
      const driver = await this.mgr.loadDriver(n.profile.driver);
      if (n.kind === "connection") {
        if (driver.capabilities.schemas) return (await conn.introspect().listSchemas()).map((schema) => ({ kind: "schema", profile: n.profile, schema }));
        return (await conn.introspect().listTables()).map((t) => ({ kind: "table", profile: n.profile, name: t.name, isView: t.kind === "view" }));
      }
      if (n.kind === "schema") {
        return (await conn.introspect().listTables(n.schema)).map((t) => ({ kind: "table", profile: n.profile, schema: n.schema, name: t.name, isView: t.kind === "view" }));
      }
      const info = await conn.introspect().describeTable({ name: n.name, ...(n.schema ? { schema: n.schema } : {}) });
      return (info.columns ?? []).map((c) => ({ kind: "column", label: c.name, detail: `${c.nativeType}${c.nullable ? "" : " NOT NULL"}`, pk: c.primaryKey }));
    } catch (e) {
      void vscode.window.showErrorMessage(vscode.l10n.t("RizomaDB: {0}", (e as Error).message));
      return [];
    }
  }
}
