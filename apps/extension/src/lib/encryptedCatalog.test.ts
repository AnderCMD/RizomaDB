import { describe, it, expect } from "vitest";
import { seal, unseal, SealedCatalogError } from "./encryptedCatalog.js";

const profiles = [
  { id: "a", name: "Orders", driver: "postgres", environment: "staging" as const, readOnly: true, options: { host: "db.internal", port: 5432, database: "orders", user: "app" }, secretKeys: ["password"], tags: ["engine:postgres"] },
  { id: "b", name: "Cache", driver: "redis", environment: "dev" as const, readOnly: false, options: { host: "localhost" }, secretKeys: [], tags: [] },
];
const code = (f: () => unknown) => { try { f(); } catch (e) { return (e as SealedCatalogError).code; } return "none"; };

describe("sealed catalog", () => {
  it("round-trips profiles with the right passphrase", () => {
    expect(unseal(seal(profiles, "correct horse"), "correct horse")).toEqual(profiles);
  });
  it("is not readable without the passphrase and differs on every seal", () => {
    const a = seal(profiles, "correct horse"), b = seal(profiles, "correct horse");
    expect(a).not.toContain("db.internal"); expect(a).not.toContain("Orders"); expect(a).not.toBe(b);
    expect(code(() => unseal(a, "wrong passphrase"))).toBe("wrong-passphrase");
  });
  it("rejects tampering, foreign files and weak passphrases", () => {
    const f = JSON.parse(seal(profiles, "correct horse")); f.data = Buffer.from("x".repeat(40)).toString("base64");
    expect(code(() => unseal(JSON.stringify(f), "correct horse"))).toBe("wrong-passphrase");
    expect(code(() => unseal("{nope", "correct horse"))).toBe("not-sealed");
    expect(code(() => unseal(JSON.stringify({ format: "other" }), "x"))).toBe("not-sealed");
    expect(code(() => seal(profiles, "short"))).toBe("weak-passphrase");
  });
  it("bounds the cost parameters taken from the file", () => {
    const f = JSON.parse(seal(profiles, "correct horse")); f.kdf.N = 2 ** 30;
    expect(code(() => unseal(JSON.stringify(f), "correct horse"))).toBe("invalid");
    f.kdf.N = 3 * 2 ** 14; expect(code(() => unseal(JSON.stringify(f), "correct horse"))).toBe("invalid");
  });
  it("never writes a secret value: only what the profiles hold", () => {
    expect(seal(profiles, "correct horse")).not.toContain("hunter2");
    expect(JSON.stringify(profiles)).not.toContain("password\":\"");
  });
});
