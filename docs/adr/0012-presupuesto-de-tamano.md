# ADR 0012 — Presupuesto de tamaño y carga diferida
Estado: aceptada (2026-10-21)
- Presupuesto: VSIX ≤ 8 MB (`scripts/check-vsix-size.mjs`, en CI). Hoy ≈ 1.9 MB sin DuckDB.
- Cada driver tiene `meta.ts` sin la biblioteca cliente; el host de extensiones solo importa metadatos. Las bibliotecas viven en el proceso hijo y se cargan al conectar (`import()` perezoso en `driverWorker.ts`).
- DuckDB (módulo nativo por plataforma) no entra en el VSIX; su carga falla con un mensaje claro. Entrarlo exige VSIX por plataforma (`vsce --target`).
