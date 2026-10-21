import { describe, it, expect } from "vitest";
import { assessStatement, decide, expandVariables, MemorySecretStore, parseProfile, redactObject, redactString, resolveConfig, saveSecrets } from "./index.js";

describe("secrets", () => {
  it("keeps secrets out of stored options and resolves them back", async () => {
    const store = new MemorySecretStore();
    const options = await saveSecrets(store, "p1", ["password"], { host: "h", password: "s3cret!" });
    expect(JSON.stringify(options)).not.toContain("s3cret");
    const profile = parseProfile({ id: "p1", name: "n", driver: "postgres", options, secretKeys: ["password"] });
    expect((await resolveConfig(profile, store, {})).password).toBe("s3cret!");
  });
  it("expands env variables and fails loudly when missing", () => {
    expect(expandVariables({ h: "${env:H}" }, { H: "x" })).toEqual({ h: "x" });
    expect(() => expandVariables("${env:NOPE}", {})).toThrow(/NOPE/);
  });
});

describe("redaction", () => {
  it("redacts keys, URIs and literal secrets", () => {
    expect(redactObject({ user: "a", password: "x", nested: { apiKey: "k" } })).toEqual({ user: "a", password: "«redacted»", nested: { apiKey: "«redacted»" } });
    expect(redactString("postgres://u:hunter2@host/db")).not.toContain("hunter2");
    expect(redactString("failed with s3cret!", ["s3cret!"])).not.toContain("s3cret!");
    expect(redactString("password=abc123 more")).not.toContain("abc123");
  });
});

describe("policy", () => {
  it("classifies statements ignoring comments and literals", () => {
    expect(assessStatement("SELECT * FROM t").risk).toBe("none");
    expect(assessStatement("DELETE FROM t").risk).toBe("destructive");
    expect(assessStatement("DELETE FROM t WHERE id=1").risk).toBe("write");
    expect(assessStatement("SELECT 'drop table x' -- delete from t").risk).toBe("none");
    expect(assessStatement("/* where */ UPDATE t SET a=1").risk).toBe("destructive");
    expect(assessStatement("WITH x AS (SELECT 1) DELETE FROM t USING x").risk).toBe("destructive");
    expect(assessStatement("TRUNCATE t").risk).toBe("destructive");
  });
  it("blocks writes on prod and read-only, confirms destructive elsewhere", () => {
    expect(decide("UPDATE t SET a=1 WHERE id=1", { environment: "prod", readOnly: false }).allowed).toBe(false);
    expect(decide("DROP TABLE t", { environment: "dev", readOnly: true }).allowed).toBe(false);
    expect(decide("DROP TABLE t", { environment: "dev", readOnly: false })).toMatchObject({ allowed: true, needsConfirmation: true });
    expect(decide("SELECT 1", { environment: "prod", readOnly: false })).toMatchObject({ allowed: true, needsConfirmation: false });
  });
});
