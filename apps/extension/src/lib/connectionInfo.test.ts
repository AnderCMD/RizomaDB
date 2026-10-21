import { describe, it, expect } from "vitest";
import { databaseOf } from "./connectionInfo.js";

describe("databaseOf", () => {
  it("names the database, service, keyspace or file", () => {
    expect(databaseOf({ options: { host: "h", database: "shop" } })).toBe("shop");
    expect(databaseOf({ options: { service: "FREEPDB1" } })).toBe("FREEPDB1");
    expect(databaseOf({ options: { path: "/home/me/data/app.sqlite" } })).toBe("app.sqlite");
    expect(databaseOf({ options: { path: "C:\\data\\app.db" } })).toBe("app.db");
    expect(databaseOf({ options: { host: "h" } })).toBe("");
  });
});
