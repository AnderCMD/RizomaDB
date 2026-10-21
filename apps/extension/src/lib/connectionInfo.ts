import type { ConnectionProfile } from "@rizomadb/core";

/** The database (or file, service, keyspace, graph…) a profile points at, for labels. Empty when the engine has none. */
export function databaseOf(p: Pick<ConnectionProfile, "options">): string {
  const o = p.options as Record<string, unknown>;
  for (const k of ["database", "service", "keyspace", "graph", "catalog", "projectId", "org", "region"]) {
    const v = o[k]; if (typeof v === "string" && v.trim()) return v.trim();
  }
  const path = o["path"];
  return typeof path === "string" && path ? path.split(/[\\/]/).filter(Boolean).pop() ?? "" : "";
}
