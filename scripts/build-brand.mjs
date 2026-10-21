// Generates all brand assets from code. Run: pnpm build:brand
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import opentype from "opentype.js";
import { Resvg } from "@resvg/resvg-js";
import { optimize } from "svgo";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "assets/brand");
mkdirSync(out, { recursive: true });

const C = { navy: "#0F172A", mint: "#34D399", white: "#FFFFFF", amber: "#FBBF24" };
const TITLE = "Logotipo de RizomaDB";
const DESC = "Un cilindro de base de datos del que brotan raíces conectadas a tres nodos: un rizoma que une muchas bases de datos.";

// --- contrast check (WCAG) ---
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export const pairs = [
  ["mint on navy (graphic)", C.mint, C.navy, 3], ["amber on navy (graphic)", C.amber, C.navy, 3],
  ["white on navy (text)", C.white, C.navy, 4.5], ["navy on white (text)", C.navy, C.white, 4.5],
];
let failed = false;
const table = pairs.map(([n, f, b, min]) => {
  const r = ratio(f, b); const ok = r >= min; if (!ok) failed = true;
  return `| ${n} | ${f} | ${b} | ${r.toFixed(2)}:1 | ${min}:1 | ${ok ? "✔" : "✘"} |`;
});
if (failed) { console.error("Brand contrast check FAILED\n" + table.join("\n")); process.exit(1); }

// --- mark (viewBox 0 0 128 128); thick strokes so it survives 16 px ---
const glyph = (m, a) => `
  <ellipse cx="64" cy="30" rx="28" ry="11" fill="none" stroke="${m}" stroke-width="9"/>
  <path d="M36 46C36 58 92 58 92 46" fill="none" stroke="${m}" stroke-width="9" stroke-linecap="round"/>
  <path d="M64 56V76M64 76C64 90 38 88 35 103M64 76C64 90 90 88 93 103M64 76V105" fill="none" stroke="${m}" stroke-width="9" stroke-linecap="round"/>
  <circle cx="35" cy="105" r="10" fill="${m}"/><circle cx="93" cy="105" r="10" fill="${m}"/><circle cx="64" cy="109" r="10" fill="${a}"/>`;
const svg = (w, h, vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="${vb}" width="${w}" height="${h}" aria-labelledby="t d"><title id="t">${TITLE}</title><desc id="d">${DESC}</desc>${body}</svg>`;
const tile = (c) => `<rect width="128" height="128" rx="28" fill="${c}"/>`;

const markTile = svg(128, 128, "0 0 128 128", tile(C.navy) + glyph(C.mint, C.amber));
const markMono = svg(128, 128, "0 0 128 128", glyph("#000000", "#000000"));

// --- wordmark: text converted to outlines (no font dependency) ---
const font = opentype.parse(new Uint8Array(readFileSync(join(dirname(require.resolve("@fontsource/inter/package.json")), "files/inter-latin-700-normal.woff"))).buffer);
const fontSize = 64;
const textPath = () => {
  // Per-glyph layout (no GSUB/GPOS) keeps the output deterministic.
  let x = 0; const ds = []; let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
  const scale = fontSize / font.unitsPerEm;
  for (const ch of "RizomaDB") {
    const g = font.charToGlyph(ch);
    const p = g.getPath(x, 0, fontSize); const bb = p.getBoundingBox();
    if (p.commands.length) { x1 = Math.min(x1, bb.x1); x2 = Math.max(x2, bb.x2); y1 = Math.min(y1, bb.y1); y2 = Math.max(y2, bb.y2); }
    ds.push(p.toPathData(2)); x += g.advanceWidth * scale;
  }
  return { d: ds.join(""), w: x2 - x1, x1, y1, y2 };
};
const t = textPath();
const gap = 28, h = 128, textY = 64 + (-(t.y1 + t.y2) / 2);
const W = Math.ceil(128 + gap + t.w + 8);
const horizontal = (textColor) => svg(W, h, `0 0 ${W} ${h}`,
  tile(C.navy) + glyph(C.mint, C.amber) +
  `<path transform="translate(${128 + gap - t.x1} ${textY.toFixed(2)})" d="${t.d}" fill="${textColor}"/>`);

const files = {
  "logo-mark.svg": markTile, "logo-mark-mono.svg": markMono,
  "logo-horizontal-light.svg": horizontal(C.navy), "logo-horizontal-dark.svg": horizontal(C.white),
  "favicon.svg": markTile,
};
const svgoCfg = { multipass: true, plugins: ["preset-default"] };
for (const [name, s] of Object.entries(files)) {
  let o = optimize(s, svgoCfg).data;
  if (!o.includes('role="img"')) o = o.replace("<svg ", '<svg role="img" ');
  writeFileSync(join(out, name), o);
}

const png = (svgStr, width) => new Resvg(svgStr, { fitTo: { mode: "width", value: width } }).render().asPng();
writeFileSync(join(out, "icon-128.png"), png(markTile, 128));
writeFileSync(join(out, "icon-256.png"), png(markTile, 256));

// social preview 1280x640: navy background, horizontal logo centered
const lw = 900, scale = lw / W, lh = h * scale;
const social = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640"><rect width="1280" height="640" fill="${C.navy}"/>
<g transform="translate(${(1280 - lw) / 2} ${(640 - lh) / 2 - 40}) scale(${scale})">${horizontal(C.white).replace(/^<svg[^>]*>|<\/svg>$|<title.*?<\/title>|<desc.*?<\/desc>/g, "")}</g>
<rect x="580" y="${(640 + lh) / 2 + 20}" width="120" height="6" rx="3" fill="${C.amber}"/></svg>`;
writeFileSync(join(out, "social-preview-1280x640.png"), png(social, 1280));

// legibility sheet (not published): 16/32/64/128 on light and dark
const sizes = [16, 32, 64, 128];
const row = (bg, y) => `<rect y="${y}" width="${sizes.reduce((a, s) => a + s + 40, 40)}" height="190" fill="${bg}"/>` +
  sizes.map((s, i) => { const x = 40 + sizes.slice(0, i).reduce((a, q) => a + q + 40, 0);
    return `<svg x="${x}" y="${y + 30}" width="${s}" height="${s}" viewBox="0 0 128 128">${tile(C.navy)}${glyph(C.mint, C.amber)}</svg>`; }).join("");
const sw = sizes.reduce((a, s) => a + s + 40, 40);
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="380" viewBox="0 0 ${sw} 380">${row("#FFFFFF", 0)}${row("#1E1E1E", 190)}</svg>`;
mkdirSync(join(root, "assets/brand/_proof"), { recursive: true });
writeFileSync(join(root, "assets/brand/_proof/legibility-sheet.png"), png(sheet, sw));
writeFileSync(join(root, "assets/brand/_contrast.md"),
  `| Par | Primer plano | Fondo | Ratio | Mínimo | OK |\n|---|---|---|---|---|---|\n${table.join("\n")}\n`);
console.log("brand assets written\n" + table.join("\n"));
