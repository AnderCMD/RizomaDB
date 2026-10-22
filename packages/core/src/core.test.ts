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
    expect(redactString("CREATE USER x PASSWORD 'hunter2'")).not.toContain("hunter2");
    expect(redactString('ALTER ROLE r WITH PASSWORD "hunter2" VALID UNTIL 2030')).not.toContain("hunter2");
    expect(redactString("CREATE USER u IDENTIFIED BY 'hunter2'")).not.toContain("hunter2");
    expect(redactString("CREATE USER u IDENTIFIED WITH mysql_native_password BY 'hunter2'")).not.toContain("hunter2");
    expect(redactString("SELECT password FROM users WHERE id = 1")).toBe("SELECT password FROM users WHERE id = 1");
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

describe("statement classification (default-deny)", () => {
  it("treats ordinary reads as reads even when they use risky-looking identifiers", () => {
    for (const sql of ["SELECT REPLACE(name, 'a', 'b') FROM t", "SELECT comment, set, copy FROM t", "SELECT created, updated_at, deleted FROM t", "WITH x AS (SELECT 1) SELECT * FROM x", "EXPLAIN SELECT 1", "SELECT 'DROP TABLE t'", "SHOW TABLES", "PRAGMA table_info(t)", "SELECT * FROM t -- delete me", "SELECT \"update\" FROM t", "VACUUM INTO 'b.db'"])
      expect(assessStatement(sql).risk, sql).toBe("none");
  });
  it("treats everything that can change state as a write, including unknown shapes", () => {
    for (const sql of ["PRAGMA writable_schema = 1", "PRAGMA journal_mode(wal)", "ATTACH DATABASE 'x' AS y", "VACUUM", "SET search_path = x", "CALL do_things()", "COPY t FROM '/tmp/x'", "SELECT * INTO copy_t FROM t", "SELECT 1; DROP TABLE t", "REINDEX t", "EXPLAIN ANALYZE DELETE FROM t WHERE id = 1", "WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d", "LOCK TABLE t", "DO $$ BEGIN END $$", "FROBNICATE t"])
      expect(assessStatement(sql).risk, sql).not.toBe("none");
  });
});

import fc from "fast-check";
describe("classifier robustness (fuzz)", () => {
  it("assessStatement and decide never throw and always return a valid risk", () => {
    const frag = fc.constantFrom("select", "insert", "delete", "update", "drop", "from", "where", "--", "/*", "*/", "'", '"', ";", " ", "\n", "with", "into", "pragma", "é", "set", "(", ")");
    fc.assert(fc.property(fc.array(frag, { maxLength: 40 }).map((a) => a.join(" ")), (s) => {
      expect(["none", "write", "destructive"]).toContain(assessStatement(s).risk);
      expect(typeof decide(s, { environment: "prod", readOnly: false }).allowed).toBe("boolean");
    }), { numRuns: 4000 });
  });
});
