export type Theme = "light" | "dark";

const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const lum = ([r, g, b]: [number, number, number]) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
const hex = (c: [number, number, number]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/**
 * A brand colour that stays readable on a bare background (no tile): dark brand colours are lightened on dark themes,
 * pale ones darkened on light themes, until the contrast with the editor background is at least 3:1 (logos are exempt from
 * WCAG, but an invisible mark helps nobody).
 */
export function adaptHex(color: string, theme: Theme): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const bg = theme === "dark" ? 0.013 : 1, target = theme === "dark" ? [255, 255, 255] : [0, 0, 0];
  let c = rgb(color);
  const ratio = (x: [number, number, number]) => { const l = lum(x); return (Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05); };
  for (let i = 0; i < 20 && ratio(c) < 3; i++) c = c.map((v, k) => v + (target[k]! - v) * 0.12) as [number, number, number];
  return hex(c);
}
