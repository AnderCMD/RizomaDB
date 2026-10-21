import type { EngineLogo, LogoShape } from "../engineLogos.js";
import { adaptHex, type Theme } from "../logoColor.js";

const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const hasGradient = (shapes: LogoShape[]): boolean => shapes.some((s) => s.t === "defs" || s.t.endsWith("Gradient") || (s.c ? hasGradient(s.c) : false));
const node = (s: LogoShape, prefix: string, theme: Theme | undefined): string => {
  const attrs = Object.entries(s.a).map(([k, v]) => {
    const val = k === "id" ? prefix + v : k === "fill" && theme ? adaptHex(v, theme) : v.replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${prefix}${id})`);
    return `${k}="${esc(val)}"`;
  }).join(" ");
  return s.c?.length ? `<${s.t} ${attrs}>${s.c.map((c) => node(c, prefix, theme)).join("")}</${s.t}>` : `<${s.t} ${attrs}/>`;
};

/** Standalone 16x16 SVG of an engine mark without a tile behind it; solid brand colours are adapted to the theme. */
export function logoSvg(logo: EngineLogo, key: string, theme: Theme = "dark"): string {
  const adapt = hasGradient(logo.shapes) ? undefined : theme;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${esc(logo.vb)}" width="16" height="16" preserveAspectRatio="xMidYMid meet">${logo.shapes.map((s) => node(s, `${key}-`, adapt)).join("")}</svg>`;
}
export const logoDataUri = (logo: EngineLogo, key: string, theme: Theme = "dark") => `data:image/svg+xml;base64,${Buffer.from(logoSvg(logo, key, theme), "utf8").toString("base64")}`;
