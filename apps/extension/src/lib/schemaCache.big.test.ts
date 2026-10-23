import { describe, it, expect } from "vitest";
import { SchemaCache } from "./schemaCache.js";

const fakeMgr = (tables: number, calls: string[]) => ({
  connect: async () => ({ introspect: () => ({
    listSchemas: async () => ["app"],
    listTables: async () => { calls.push("listTables"); return Array.from({ length: tables }, (_, i) => ({ name: `t${i}`, kind: "table" as const })); },
    describeSchema: async () => { calls.push("describeSchema"); return []; },
    foreignKeys: async () => { calls.push("foreignKeys"); return []; },
  }) }),
  loadDriver: async () => ({ capabilities: { schemas: true } }),
  get: () => ({ id: "c", driver: "x", options: { user: "app" } }),
}) as never;

describe("schema cache on a huge database", () => {
  it("reads full definitions of a normal schema", async () => {
    const calls: string[] = [];
    await new SchemaCache(fakeMgr(10, calls)).get("c");
    expect(calls).toContain("describeSchema");
  });
  it("uses table names only above the size limit, never asking for every column", async () => {
    const calls: string[] = [];
    const idx = await new SchemaCache(fakeMgr(40000, calls)).get("c");
    expect(calls).not.toContain("describeSchema");
    expect(calls).not.toContain("foreignKeys");
    expect(idx).toBeDefined();
  });
});
