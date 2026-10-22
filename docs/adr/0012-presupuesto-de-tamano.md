# ADR 0012 — Presupuesto de tamaño y carga diferida
Estado: aceptada (2026-10-21)
- Presupuesto: VSIX ≤ 8 MB (`scripts/check-vsix-size.mjs`, en CI). Hoy ≈ 1.9 MB sin DuckDB.
- Cada driver tiene `meta.ts` sin la biblioteca cliente; el host de extensiones solo importa metadatos. Las bibliotecas viven en el proceso hijo y se cargan al conectar (`import()` perezoso en `driverWorker.ts`).
- DuckDB (módulo nativo por plataforma) no entra en el VSIX universal; su carga falla con un mensaje claro. Entra en los VSIX por plataforma (`vsce --target`, `scripts/package-platform.mjs`), con un presupuesto propio de 60 MB (medido: 37,9 MB en darwin-arm64). El VSIX universal sigue en 8 MB. Actualizado el 2026-10-22.
