# Accessibility check (axe-core)

Each webview is rendered with sample data and VS Code's *Dark+* and *Light+* colour variables, then checked with axe-core against WCAG 2.0/2.1/2.2 A and AA plus best-practice rules.

1. `pnpm build`
2. `node test/a11y/prepare.mjs`
3. Open `http://localhost:8766/<page>.html`, load `axe.min.js` and run:
```js
for (const theme of ["theme-dark.css", "theme-light.css"]) {
  document.getElementById("theme").href = theme;
  const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa","best-practice"] } });
  console.log(theme, r.violations);
}
```
Result on 2026-10-21 after fixes: **0 violations** on grid (with pending edits), plan tree, ER diagram, table designer and metrics. First run found real issues (opacity-based low contrast, missing landmark/heading, ER accessible names), now fixed.

Keyboard audit: load `keyboard.js` (served next to the pages), press Tab once with a real key so the page is in keyboard mode, then run `rzKeyboardAudit()`; it must return no problems. Result on 2026-10-22: 0 problems on all screens in both themes (it found the search boxes' weak focus ring, now fixed). See [docs/guides/keyboard.md](../../docs/guides/keyboard.md).

This is automated checking only. The project owner also did a manual screen-reader pass on macOS, Windows and Linux with no problems found; it is not repeated automatically, so redo it after big UI changes.
