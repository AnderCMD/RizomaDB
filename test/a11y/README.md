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

This is automated checking only. A screen-reader pass (NVDA/VoiceOver/JAWS) and keyboard walkthrough are **not done** and are required before a 1.0.
