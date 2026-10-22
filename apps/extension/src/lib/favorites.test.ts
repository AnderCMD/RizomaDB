import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Favorites } from "./favorites.js";

const entry = { connectionId: "c1", connectionName: "Main", environment: "dev", sql: "SELECT 1" };

describe("Favorites", () => {
  const file = () => join(mkdtempSync(join(tmpdir(), "rz-fav-")), "favorites.json");
  it("stars and un-stars the same query, newest first", async () => {
    const f = new Favorites(file(), () => new Date("2026-01-01T00:00:00Z"));
    expect(await f.list()).toEqual([]);
    expect(await f.toggle(entry)).toBe(true);
    expect(await f.toggle({ ...entry, sql: "SELECT 2" })).toBe(true);
    expect((await f.list()).map((x) => x.sql)).toEqual(["SELECT 2", "SELECT 1"]);
    expect(await f.toggle({ ...entry, sql: "  SELECT 1  " })).toBe(false);
    expect((await f.list()).map((x) => x.sql)).toEqual(["SELECT 2"]);
  });
  it("tells the same text on two connections apart", async () => {
    const f = new Favorites(file());
    await f.toggle(entry); await f.toggle({ ...entry, connectionId: "c2" });
    expect(await f.list()).toHaveLength(2);
  });
  it("redacts secrets before writing and keeps the file private", async () => {
    const path = file(), f = new Favorites(path);
    await f.toggle({ ...entry, sql: "CREATE USER x PASSWORD 'hunter2'" });
    expect(readFileSync(path, "utf8")).not.toContain("hunter2");
    expect(statSync(path).mode & 0o077).toBe(0);
  });
  it("treats a missing or corrupt file as empty", async () => {
    expect(await new Favorites(join(tmpdir(), "rz-none", "x.json")).list()).toEqual([]);
    const path = file(); await new Favorites(path).toggle(entry);
    const { writeFileSync } = await import("node:fs"); writeFileSync(path, "{nope");
    expect(await new Favorites(path).list()).toEqual([]);
  });
});
