import { describe, it, expect } from "vitest";
import { customEnvironmentPolicy, customEnvironments } from "./environments.js";

describe("custom environments", () => {
  it("keeps valid new names only, once each", () => {
    expect(customEnvironments([{ name: "QA", protection: "confirm" }, { name: "qa" }, { name: "prod", protection: "none" }, { name: "bad name!" }, { name: "uat", protection: "weird" }, 5, null]))
      .toEqual([{ name: "qa", protection: "confirm" }, { name: "uat", protection: "none" }]);
    expect(customEnvironments("nope")).toEqual([]);
  });
  it("turns protection into policy rules and adds nothing for unprotected ones", () => {
    expect(customEnvironmentPolicy([{ name: "qa", protection: "confirm" }, { name: "demo", protection: "readOnly" }, { name: "lab", protection: "none" }]))
      .toEqual({ version: 1, environments: { qa: { confirmDestructive: true, confirmWrites: true }, demo: { readOnly: true, confirmDestructive: true, confirmWrites: true } } });
    expect(customEnvironmentPolicy([{ name: "lab" }])).toBeUndefined();
  });
});
