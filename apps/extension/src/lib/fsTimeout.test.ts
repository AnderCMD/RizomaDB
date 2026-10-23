import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTextWithin } from "./fsTimeout.js";

describe("readTextWithin", () => {
  it("reads a file", async () => {
    const f = join(mkdtempSync(join(tmpdir(), "rz-")), "a.json"); writeFileSync(f, "{}");
    expect(await readTextWithin(f)).toBe("{}");
  });
  it("reports a missing file with its own error code (so callers can skip it)", async () => {
    await expect(readTextWithin("/nonexistent/x.json")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
