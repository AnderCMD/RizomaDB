import { describe, it, expect } from "vitest";
import { ENGINES, FAMILY_ORDER } from "./engineCatalog.js";
import { ENGINE_LOGOS } from "./engineLogos.js";

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

describe("engine catalog", () => {
  it("has unique keys, known families and a short monogram", () => {
    expect(new Set(ENGINES.map((e) => e.key)).size).toBe(ENGINES.length);
    for (const e of ENGINES) { expect(FAMILY_ORDER).toContain(e.family); expect(e.mark.length).toBeLessThanOrEqual(2); }
  });
  it("covers every driver the extension registers", () => {
    const drivers = ["sqlite", "postgres", "mysql", "mssql", "oracle", "mongodb", "redis", "clickhouse", "elasticsearch", "influxdb3", "trino", "firestore", "cassandra", "influxdb", "dynamodb", "neo4j", "hydradb", "duckdb"];
    expect([...new Set(ENGINES.map((e) => e.driver))].sort()).toEqual([...drivers].sort());
  });
  it("uses official marks where upstream has them and keeps monogram tiles at WCAG AA contrast (4.5:1) elsewhere", () => {
    expect(Object.keys(ENGINE_LOGOS).every((k) => ENGINES.some((e) => e.key === k))).toBe(true);
    for (const e of ENGINES.filter((x) => !ENGINE_LOGOS[x.key])) expect(contrast(e.color, e.fg), e.name).toBeGreaterThanOrEqual(4.5);
  });
});
