import * as vscode from "vscode";
import type { ConnectionManager } from "../lib/connections.js";
import type { ConnectionProfile } from "@rizomadb/core";
import type { TableInfo } from "@rizomadb/driver-api";
import { t } from "../i18n.js";
import { ENGINES, FAMILY_ORDER, type EngineFamily } from "../engineCatalog.js";
import { ENGINE_LOGOS } from "../engineLogos.js";
import { logoDataUri } from "../lib/logoSvg.js";
import { databaseOf } from "../lib/connectionInfo.js";
import { friendly } from "./driverMessages.js";

export type Node =
  | { kind: "group"; family: EngineFamily; profiles: ConnectionProfile[] }
  | { kind: "connection"; profile: ConnectionProfile }
  | { kind: "schema"; profile: ConnectionProfile; schema: string }
  | { kind: "category"; profile: ConnectionProfile; schema?: string; views: boolean; items: TableInfo[] }
  | { kind: "table"; profile: ConnectionProfile; schema?: string; name: string; isView: boolean }
  | { kind: "column"; label: string; detail: string; pk: boolean };

const envColor: Record<string, string> = { prod: "charts.red", staging: "charts.yellow", dev: "charts.green" };
const iconCache = new Map<string, { light: vscode.Uri; dark: vscode.Uri }>();

/** Short on purpose: the tree row is narrow and long group names get cut off. */
const familyLabel = (f: EngineFamily) => ({
  relational: t("Relational"), analytics: t("Analytics"), document: t("Documents"), keyvalue: t("Key-value"),
  search: t("Search"), graph: t("Graphs"), timeseries: t("Time series"), widecolumn: t("Wide-column"),
})[f];
const familyColor: Record<EngineFamily, string> = { relational: "charts.blue", analytics: "charts.orange", document: "charts.green", keyvalue: "charts.red", search: "charts.yellow", graph: "charts.purple", timeseries: "charts.blue", widecolumn: "charts.orange" };
/** What a driver calls its top-level objects. */
const objectsLabel = (driver: string) => ({
  mongodb: t("Collections"), firestore: t("Collections"), redis: t("Keys"), elasticsearch: t("Indices"), neo4j: t("Labels"), influxdb: t("Measurements"),
} as Record<string, string>)[driver] ?? t("Tables");

/** The engine entry a profile was created from (remembered in a tag), or the first one that uses its driver. */
export function engineOf(p: ConnectionProfile) {
  const key = p.tags.find((x) => x.startsWith("engine:"))?.slice(7);
  return ENGINES.find((e) => e.key === key) ?? ENGINES.find((e) => e.driver === p.driver);
}

export class Explorer implements vscode.TreeDataProvider<Node> {
  private ev = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.ev.event;
  /** Which connection is active right now (set by the extension). */
  activeId: () => string | undefined = () => undefined;
  constructor(private mgr: ConnectionManager) { mgr.onChange(() => this.ev.fire(undefined)); }
  refresh() { this.ev.fire(undefined); }

  private icon(p: ConnectionProfile): { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon {
    const e = engineOf(p), logo = e && !ENGINE_LOGOS[e.key]?.wordmark ? ENGINE_LOGOS[e.key] : undefined;
    if (!e || !logo) return new vscode.ThemeIcon(this.mgr.isReadOnly(p) ? "lock" : "database", new vscode.ThemeColor(envColor[p.environment] ?? "charts.blue"));
    let u = iconCache.get(e.key);
    if (!u) { u = { light: vscode.Uri.parse(logoDataUri(logo, e.key, "light")), dark: vscode.Uri.parse(logoDataUri(logo, e.key, "dark")) }; iconCache.set(e.key, u); }
    return u;
  }

  getTreeItem(n: Node): vscode.TreeItem {
    if (n.kind === "group") {
      const it = new vscode.TreeItem(familyLabel(n.family), vscode.TreeItemCollapsibleState.Expanded);
      it.description = String(n.profiles.length); it.iconPath = new vscode.ThemeIcon(n.family === "relational" ? "table" : n.family === "analytics" ? "graph" : n.family === "keyvalue" ? "key" : n.family === "search" ? "search" : n.family === "graph" ? "type-hierarchy" : n.family === "timeseries" ? "pulse" : n.family === "widecolumn" ? "list-flat" : "json", new vscode.ThemeColor(familyColor[n.family]));
      it.contextValue = "group"; return it;
    }
    if (n.kind === "connection") {
      const p = n.profile, ro = this.mgr.isReadOnly(p), connected = this.mgr.isConnected(p.id);
      const it = new vscode.TreeItem(p.name, vscode.TreeItemCollapsibleState.Collapsed);
      // Environment is conveyed by text as well as colour (WCAG: not colour alone).
      const src = this.mgr.sourceOf(p.id);
      const db = databaseOf(p), isActive = this.activeId() === p.id;
      it.description = `${isActive ? "● " : ""}[${p.environment.toUpperCase()}]${db ? ` · ${db}` : ""}${src ? ` · ${src}` : ""}${ro ? " · " + t("read-only") : ""}${connected ? "" : " · " + t("disconnected")}`;
      it.iconPath = this.icon(p);
      it.contextValue = "connection";
      it.tooltip = `${p.name} (${engineOf(p)?.name ?? p.driver}) — ${p.environment}${db ? ` — ${db}` : ""}${isActive ? ` — ${t("Active connection")}` : ""}`;
      return it;
    }
    if (n.kind === "schema") {
      const it = new vscode.TreeItem(n.schema, vscode.TreeItemCollapsibleState.Collapsed);
      it.iconPath = new vscode.ThemeIcon("database"); it.contextValue = "schema"; return it;
    }
    if (n.kind === "category") {
      const it = new vscode.TreeItem(n.views ? t("Views") : objectsLabel(n.profile.driver), vscode.TreeItemCollapsibleState.Collapsed);
      it.description = `(${n.items.length})`;
      it.iconPath = new vscode.ThemeIcon(n.views ? "eye" : "list-flat", new vscode.ThemeColor(n.views ? "charts.blue" : "charts.purple"));
      it.contextValue = "category"; return it;
    }
    if (n.kind === "table") {
      const it = new vscode.TreeItem(n.name, vscode.TreeItemCollapsibleState.Collapsed);
      it.iconPath = new vscode.ThemeIcon(n.isView ? "eye" : n.profile.driver === "redis" ? "key" : n.profile.driver === "mongodb" ? "json" : "table");
      it.contextValue = n.profile.driver === "redis" || n.profile.driver === "mongodb" ? `table.${n.profile.driver}` : "table";
      it.command = { command: "rizomadb.openTable", title: t("Open"), arguments: [n] };
      return it;
    }
    const it = new vscode.TreeItem(n.label, vscode.TreeItemCollapsibleState.None);
    it.description = n.detail; it.iconPath = new vscode.ThemeIcon(n.pk ? "key" : "symbol-field"); return it;
  }

  async getChildren(n?: Node): Promise<Node[]> {
    if (!n) {
      const all = this.mgr.list();
      if (!vscode.workspace.getConfiguration("rizomadb").get<boolean>("explorer.groupByFamily", true)) return all.map((profile) => ({ kind: "connection", profile }));
      return FAMILY_ORDER.flatMap((family) => { const profiles = all.filter((p) => (engineOf(p)?.family ?? "relational") === family); return profiles.length ? [{ kind: "group" as const, family, profiles }] : []; });
    }
    if (n.kind === "group") return n.profiles.map((profile) => ({ kind: "connection", profile }));
    try {
      if (n.kind === "column") return [];
      if (n.kind === "category") return n.items.map((x) => ({ kind: "table", profile: n.profile, ...(n.schema ? { schema: n.schema } : {}), name: x.name, isView: x.kind === "view" }));
      const conn = await this.mgr.connect(n.profile.id);
      const driver = await this.mgr.loadDriver(n.profile.driver);
      const categories = async (schema?: string): Promise<Node[]> => {
        const list = await conn.introspect().listTables(schema);
        const tables = list.filter((x) => x.kind !== "view"), views = list.filter((x) => x.kind === "view");
        const mk = (items: TableInfo[], isViews: boolean): Node => ({ kind: "category", profile: n.profile, ...(schema ? { schema } : {}), views: isViews, items });
        return [mk(tables, false), ...(views.length ? [mk(views, true)] : [])];
      };
      if (n.kind === "connection") {
        if (driver.capabilities.schemas) return (await conn.introspect().listSchemas()).map((schema) => ({ kind: "schema", profile: n.profile, schema }));
        return categories();
      }
      if (n.kind === "schema") return categories(n.schema);
      const info = await conn.introspect().describeTable({ name: n.name, ...(n.schema ? { schema: n.schema } : {}) });
      return (info.columns ?? []).map((c) => ({ kind: "column", label: c.name, detail: `${c.nativeType}${c.nullable ? "" : " NOT NULL"}`, pk: c.primaryKey }));
    } catch (e) {
      void vscode.window.showErrorMessage(t("RizomaDB: {0}", friendly((e as Error).message)));
      return [];
    }
  }
}
