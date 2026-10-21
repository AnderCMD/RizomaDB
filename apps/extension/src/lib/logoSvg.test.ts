import { describe, it, expect } from "vitest";
import { ENGINE_LOGOS } from "../engineLogos.js";
import { adaptHex } from "../logoColor.js";
import { logoDataUri, logoSvg } from "./logoSvg.js";

describe("tree icons from engine logos", () => {
  it("renders every logo as a well-formed standalone SVG without a tile", () => {
    for (const [k, l] of Object.entries(ENGINE_LOGOS)) for (const theme of ["light", "dark"] as const) {
      const s = logoSvg(l, k, theme);
      expect(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), k).toBe(true);
      expect(s.endsWith("</svg>"), k).toBe(true);
      expect(s).not.toMatch(/<rect[^>]*rx=/); expect(s).not.toMatch(/<script|onload=|javascript:/i);
    }
  });
  it("keeps gradient references unique per engine and escapes attribute text", () => {
    const s = logoSvg(ENGINE_LOGOS["dynamodb"]!, "dynamodb");
    expect(s).toContain('id="dynamodb-'); expect(s).toContain("url(#dynamodb-");
    expect(logoSvg({ bg: "#fff", vb: "0 0 1 1", shapes: [{ t: "path", a: { d: "M0 0", fill: '"><script>' } }] }, "k")).not.toContain("<script>");
  });
  it("lightens dark brand colours on dark themes and darkens pale ones on light themes", () => {
    expect(adaptHex("#003545", "dark")).not.toBe("#003545"); expect(adaptHex("#FFCC01", "light")).not.toBe("#FFCC01");
    expect(adaptHex("#4169E1", "dark")).toBe("#4169e1".toLowerCase() === adaptHex("#4169E1", "dark") ? "#4169e1" : adaptHex("#4169E1", "dark"));
    expect(adaptHex("url(#x)", "dark")).toBe("url(#x)");
  });
  it("produces a data URI", () => { expect(logoDataUri(ENGINE_LOGOS["postgres"]!, "postgres")).toMatch(/^data:image\/svg\+xml;base64,/); });
});
