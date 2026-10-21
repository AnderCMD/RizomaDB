# Design guide

How RizomaDB screens look and behave. It describes what the code does today; when you change a screen, change this page too. For agents: this is the checklist to follow before adding UI.

## Principles
1. **Minimal and calm.** Few colours, generous spacing, rounded corners, no decoration that carries no information.
2. **Icons first, with a label.** Controls are icons; every icon has an accessible name and a tooltip on hover and keyboard focus. Text buttons are for the one primary action of a screen.
3. **The user's theme is the palette.** Colours come from VS Code theme variables (`--vscode-*`), so light, dark and high-contrast work without extra code.
4. **Everything is a screen.** Connections, settings, history, the guide and results are full webview screens, not stacks of quick-picks. Quick-picks and input boxes are for one-off questions only.
5. **Say what happened, in the user's language.** Statuses and errors are plain sentences, translated, never colour-only.
6. **Safe by default.** Anything that writes shows the exact statement and asks, in proportion to the environment's risk.

## Tokens (`apps/extension/src/ui/webview/webview.css`)
| Token | Meaning | Value |
|---|---|---|
| `--rz-radius` | base corner radius | 8px; cards 12–18px, chips and fields 999px, buttons 6–8px |
| `--rz-border` | hairlines | `--vscode-panel-border` |
| `--rz-surface` | cards, bars, headers | `--vscode-editorWidget-background` |
| `--rz-muted` | secondary text | `--vscode-descriptionForeground` |
| focus | any focusable element | `2px solid --vscode-focusBorder`, offset 1–2px; never removed |

Spacing is multiples of 2: bars use 6–8px vertical and 12–14px horizontal padding; cards 18–24px; grids 10–22px gaps. Type is the editor/UI font of VS Code; titles are weight 600–700; code uses `--vscode-editor-font-family`.

## Building blocks (`src/ui/webview/ui.ts`)
| Piece | Use |
|---|---|
| `el(tag, attrs, text)` | Build DOM safely (no `innerHTML`) |
| `icon(name)` / `ICONS` | Own line icons on a 24px grid, `currentColor`; add new ones to `icons.ts` |
| `iconButton(icon, label, onClick, {text, primary, danger, pressed})` | The only way to make a button. Label is the tooltip; with visible text the text is the accessible name |
| `openMenu(anchor, items)` | Popup menu: arrows, Home/End, Enter, Esc; focus returns to the opener |
| `enableTips()` | Tooltips that stay on screen and close with Esc (WCAG 1.4.13) |
| `engineLogo(engine, size)` | Brand mark without a tile; solid colours adapt to light/dark; falls back to a monogram |
| `.chip`, `.tb` (toolbar), `.field-icon`, `.card2`, `.tab`, `.toast`, `.dialog` | Shared CSS classes |

## Layout patterns
- **Screen**: top bar (title, status chip, tools), content in a centred column (max 820–1100px) or masonry of cards (settings).
- **Results**: header → tabs (pills) → query line → filter bar → toolbar → edit bar → grid → footer. Bars wrap instead of overflowing.
- **Cards**: engine tiles in an auto-fill grid (min 190px); connection cards with a logo, badges and actions; setting cards with a head, a 2px accent rule and a reset button.
- **Tabs** are rounded pills, `role=tablist`, arrow keys move between them.
- **Page scroll is off** inside results; only the grid scrolls.

## Colour and state
- Selected / active: accent border or tint of `--vscode-focusBorder` plus a text or icon cue (● Active), never colour alone.
- Environment chips: `prod` red border, `staging` amber border, text always says the name.
- Pending change: yellow-ish underline on the cell; deleted row struck through; inserted row tinted.
- Booleans ✓/✗ with colour; NULL and DEFAULT italic and muted but at least 4.5:1.
- Destructive actions use the error foreground and are confirmed.

## Logos
Engine marks come from CC0/MIT icon sets via `scripts/gen-logos.mjs`, drawn **without a tile**, sized 16px in trees and tabs and 40px on cards. They identify the product; do not recolour them beyond the light/dark adaptation, do not use them in any way that implies endorsement. See `docs/legal/brand-logos.md`.

## Accessibility (required)
- WCAG 2.2 AA: contrast ≥ 4.5:1 for text, 3:1 for UI; targets reachable by keyboard in a logical order; `prefers-reduced-motion` disables transitions.
- Landmarks: exactly one `main` per page; toolbars have `role=toolbar` and a label; grids use `role=grid` with `aria-rowcount/colcount`; sort state in `aria-sort`; live changes announced in a polite `aria-live` region.
- Icon-only controls must have `aria-label`. Placeholders are not labels.
- Verify with axe in both themes (`test/a11y`), and say plainly that a screen-reader pass is still pending.

## Writing
- Sentence case, no trailing full stop on labels, one idea per sentence. Say what a control does ("Run this statement"), not what it is.
- Numbers use the locale; times show units ("12 ms").
- Every string has an English source and a Spanish translation; keep placeholders (`{0}`) intact.
- Be honest in limits: say "not supported" or "experimental" rather than hiding it.

## Adding a screen: checklist
1. Webview script in `src/ui/webview/<name>.ts` (+ entry in `esbuild.mjs`), host in `src/ui/<name>Panel.ts` with CSP, nonce and `localResourceRoots`.
2. Message schemas in `src/<name>Messages.ts`, validated on both ends.
3. Use `iconButton`/`openMenu`/tokens above; no new colours.
4. Strings in `webviewStrings.ts` and the Spanish bundle; command in `package.json` + both nls files.
5. Harness page in `test/a11y`, axe clean in both themes, screenshot checked.
6. Document it in the user guides (en and es) and regenerate references.
