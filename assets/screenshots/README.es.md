# Capturas

[English](README.md)

Las imágenes que usa la página del Marketplace (`apps/extension/README.md`). Son renders de las pantallas reales (webviews) de la extensión, construidas con el mismo código, con **datos de ejemplo** y las variables de color Dark+ y Light+ de VS Code, tomadas en un navegador. No son capturas de una ventana de VS Code.

Para repetirlas: `pnpm build`, `node test/a11y/prepare.mjs`, `node scripts/make-screenshot-data.mjs`, abre las páginas de `http://localhost:8766/` (`connect.html`, `grid.html`, `er.html`, `plan.html`, `settings.html`, `history-showcase.html`) y carga el script `showcase-*.js` correspondiente (`grid.html#pending` muestra los cambios pendientes).
