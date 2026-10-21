import { ICONS, type IconName } from "./webview/icons.js";

const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
export const iconSvg = (name: IconName, size = 16) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name].map((d) => `<path d="${d}"/>`).join("")}</svg>`;

/** Static-HTML twin of the webview's iconButton: icon-only buttons carry their label as name and tooltip; with text the text is the name. */
export function iconBtn(id: string, name: IconName, label: string, o: { text?: string; primary?: boolean } = {}) {
  const tip = !o.text || o.text !== label ? ` data-tip="${esc(label)}"` : "";
  return `<button type="button" id="${id}" class="ib${o.primary ? " primary" : ""}${o.text ? " with-text" : ""}" aria-label="${esc(o.text ?? label)}"${tip}>${iconSvg(name)}${o.text ? `<span class="ib-text">${esc(o.text)}</span>` : ""}</button>`;
}
