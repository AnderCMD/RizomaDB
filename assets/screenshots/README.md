# Screenshots

[Español](README.es.md)

The images used by the Marketplace page (`apps/extension/README.md`). They are renders of the real webview screens of the extension (built from the same code) with **sample data** and VS Code's Dark+ and Light+ colour variables, taken in a browser. They are not captures of a VS Code window.

To retake the grid and connection images in one go: `pnpm build && node scripts/take-screenshots.mjs` (needs Google Chrome). The other images are retaken by hand as follows.

To retake them: `pnpm build`, `node test/a11y/prepare.mjs`, `node scripts/make-screenshot-data.mjs`, then open `http://localhost:8766/` pages (`connect.html`, `grid.html`, `er.html`, `plan.html`, `settings.html`, `history-showcase.html`) and load the matching `showcase-*.js` script (`grid.html#pending` shows pending changes).
