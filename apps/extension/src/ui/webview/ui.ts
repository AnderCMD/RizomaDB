import { ICONS, type IconName } from "./icons.js";

import { adaptHex } from "../../logoColor.js";

const NS = "http://www.w3.org/2000/svg";
const SVG_NS = NS;
export type LogoShapeT = { t: string; a: Record<string, string>; c?: LogoShapeT[] | undefined };
export type LogoInfo = { key: string; color: string; fg: string; mark: string; logo?: { bg: string; vb: string; shapes: LogoShapeT[]; wordmark?: boolean | undefined } | undefined };

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

export function icon(name: IconName, size = 16): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: String(size), height: String(size), fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" })) svg.setAttribute(k, v);
  for (const d of ICONS[name]) { const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); svg.append(p); }
  return svg;
}

export interface IconButtonOpts { pressed?: boolean; primary?: boolean; danger?: boolean; hidden?: boolean; id?: string; text?: string }
/** Icon-only button: the label is both the accessible name and the hover/focus tooltip. */
export function iconButton(name: IconName, label: string, onClick?: (ev: MouseEvent) => void, o: IconButtonOpts = {}) {
  // With visible text the accessible name is that text (WCAG 2.5.3); the longer label becomes the tooltip.
  const b = el("button", { type: "button", class: `ib${o.primary ? " primary" : ""}${o.danger ? " danger" : ""}${o.text ? " with-text" : ""}`, "aria-label": o.text ?? label });
  if (!o.text || o.text !== label) b.setAttribute("data-tip", label);
  if (o.id) b.id = o.id;
  if (o.pressed !== undefined) b.setAttribute("aria-pressed", String(o.pressed));
  if (o.hidden) b.hidden = true;
  b.append(icon(name));
  if (o.text) b.append(el("span", { class: "ib-text" }, o.text));
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

/** Keeps tooltips inside the view and lets Escape dismiss them (WCAG 1.4.13). */
export function enableTips() {
  const place = (t: EventTarget | null) => {
    const b = (t as HTMLElement | null)?.closest?.<HTMLElement>("[data-tip]"); if (!b) return;
    const r = b.getBoundingClientRect();
    b.classList.toggle("tip-start", r.left + r.width / 2 < 90);
    b.classList.toggle("tip-end", r.left + r.width / 2 > window.innerWidth - 90);
    document.body.classList.remove("tips-off");
  };
  document.addEventListener("pointerover", (e) => place(e.target));
  document.addEventListener("focusin", (e) => place(e.target));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.add("tips-off"); }, true);
}

export interface MenuItem { label: string; icon?: IconName; run?: () => void; checked?: boolean; disabled?: boolean; separator?: boolean; danger?: boolean }
let closeMenu: (() => void) | undefined;

/** Popup menu next to an anchor: arrow keys, Home/End, Enter, Escape; focus returns to the opener. */
export function openMenu(anchor: HTMLElement | { x: number; y: number }, items: MenuItem[]) {
  closeMenu?.();
  const opener = document.activeElement as HTMLElement | null;
  const menu = el("div", { class: "menu", role: "menu" });
  const buttons: HTMLButtonElement[] = [];
  for (const it of items) {
    if (it.separator) { menu.append(el("div", { class: "menu-sep", role: "separator" })); continue; }
    const b = el("button", { type: "button", class: `menu-item${it.danger ? " danger" : ""}`, role: it.checked !== undefined ? "menuitemcheckbox" : "menuitem", tabindex: "-1" });
    if (it.checked !== undefined) b.setAttribute("aria-checked", String(it.checked));
    if (it.disabled) b.disabled = true;
    const lead = el("span", { class: "menu-lead" });
    if (it.checked) lead.append(icon("check", 14)); else if (it.icon) lead.append(icon(it.icon, 14));
    b.append(lead, el("span", {}, it.label));
    b.addEventListener("click", () => { close(false); it.run?.(); });
    buttons.push(b); menu.append(b);
  }
  (document.getElementById("app") ?? document.body).append(menu);
  const r = anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : new DOMRect(anchor.x, anchor.y, 0, 0);
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - w - 4))}px`;
  menu.style.top = `${Math.max(4, r.bottom + h + 8 > window.innerHeight ? Math.max(4, r.top - h - 4) : r.bottom + 4)}px`;
  const enabled = () => buttons.filter((b) => !b.disabled);
  const focusAt = (i: number) => { const l = enabled(); l[(i + l.length) % l.length]?.focus(); };
  const onKey = (e: KeyboardEvent) => {
    const l = enabled(), i = l.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") focusAt(i + 1); else if (e.key === "ArrowUp") focusAt(i < 0 ? -1 : i - 1);
    else if (e.key === "Home") focusAt(0); else if (e.key === "End") focusAt(-1);
    else if (e.key === "Escape" || e.key === "Tab") { close(true); } else return;
    e.preventDefault(); e.stopPropagation();
  };
  const onDown = (e: Event) => { if (!menu.contains(e.target as Node)) close(false); };
  function close(restore: boolean) {
    menu.remove(); document.removeEventListener("keydown", onKey, true); document.removeEventListener("pointerdown", onDown, true); window.removeEventListener("blur", onBlur);
    closeMenu = undefined; if (restore) opener?.focus();
  }
  const onBlur = () => close(false);
  document.addEventListener("keydown", onKey, true); document.addEventListener("pointerdown", onDown, true); window.addEventListener("blur", onBlur);
  closeMenu = () => close(false);
  focusAt(0);
}

const TAGS = new Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "g", "defs", "linearGradient", "radialGradient", "stop"]);
const ATTRS = new Set(["d", "fill", "fill-rule", "clip-rule", "opacity", "fill-opacity", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "transform", "x", "y", "width", "height", "rx", "ry", "cx", "cy", "r", "fx", "fy", "points", "id", "offset", "stop-color", "stop-opacity", "x1", "x2", "y1", "y2", "gradientUnits", "gradientTransform"]);

/** Builds an allow-listed shape tree with DOM calls only; ids are prefixed so gradients of different logos never clash. */
function shape(s: LogoShapeT, prefix: string, keepColors = true): SVGElement | undefined {
  if (!TAGS.has(s.t)) return undefined;
  const e = document.createElementNS(SVG_NS, s.t);
  for (const [k, v] of Object.entries(s.a)) {
    if (!ATTRS.has(k)) continue;
    e.setAttribute(k, k === "id" ? prefix + v : v.replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${prefix}${id})`));
  }
  const solid = s.a["fill"];
  if (!keepColors && solid && /^#[0-9a-f]{6}$/i.test(solid)) { e.setAttribute("class", "lg"); e.style.setProperty("--lf", adaptHex(solid, "light")); e.style.setProperty("--df", adaptHex(solid, "dark")); }
  for (const c of s.c ?? []) { const k = shape(c, prefix, keepColors); if (k) e.append(k); }
  return e;
}

/** The engine's brand mark on a neutral tile, or an original monogram when none is available; decorative because the name is always next to it. */
export function engineLogo(e: LogoInfo, size: number) {
  const svg = document.createElementNS(SVG_NS, "svg");
  const wide = e.logo?.wordmark === true, w = wide ? 120 : 48;
  svg.setAttribute("viewBox", `0 0 ${w} 48`); svg.setAttribute("width", String(wide ? size * 2.5 : size)); svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false"); svg.setAttribute("class", "logo");
  const rect = document.createElementNS(SVG_NS, "rect");
  for (const [k, v] of Object.entries({ width: String(w), height: "48", rx: "10", fill: e.logo?.bg ?? e.color })) rect.setAttribute(k, v);
  if (e.logo) {
    // The mark itself, no tile: solid brand colours get a light-theme and a dark-theme value (set through CSSOM, which the CSP allows).
    const logoSvgEl = document.createElementNS(SVG_NS, "svg");
    logoSvgEl.setAttribute("viewBox", e.logo.vb); logoSvgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    logoSvgEl.setAttribute("width", String(wide ? size * 4 : size)); logoSvgEl.setAttribute("height", String(size));
    logoSvgEl.setAttribute("aria-hidden", "true"); logoSvgEl.setAttribute("focusable", "false"); logoSvgEl.setAttribute("class", "logo bare");
    const gradient = JSON.stringify(e.logo.shapes).includes("Gradient");
    for (const sh of e.logo.shapes) { const k = shape(sh, `${e.key}-`, gradient); if (k) logoSvgEl.append(k); }
    return logoSvgEl;
  }
  const text = document.createElementNS(SVG_NS, "text");
  for (const [k, v] of Object.entries({ x: "24", y: "31", "text-anchor": "middle", "font-size": "21", "font-weight": "700", "font-family": "system-ui, sans-serif", fill: e.fg })) text.setAttribute(k, v);
  text.textContent = e.mark;
  svg.append(rect, text);
  return svg;
}

