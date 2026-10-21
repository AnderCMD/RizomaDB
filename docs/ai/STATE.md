# Estado del proyecto RizomaDB
Fecha de la última actualización: 2026-10-20
Fase actual: 1 (cimientos) — en curso. Fase 1B (logotipo) completa. Repo público: https://github.com/AnderCMD/RizomaDB (origin/main).
Hecho:
- Monorepo pnpm+Turbo; `driver-api` con kit de conformidad; drivers SQLite y PostgreSQL pasan el kit (12 y 13 pruebas; PG contra contenedor real, BD nueva por prueba); `core` (perfiles zod, secretos separados, redacción, política prod/solo lectura) con 5 pruebas.
- Marca: `pnpm build:brand` genera SVG/PNG, hoja de legibilidad y verifica contrastes; README con logo.
- Extensión (`apps/extension`): asistente de conexión generado desde connectionSchema, explorador, ejecución/cancelación (barra de estado + botón), historial JSONL redactado, rejilla ARIA virtualizada en webview (1 M filas: 16 filas en DOM en el arnés del navegador), política prod/solo lectura en un único camino (`runStatement`), VSIX de 194 KB empaquetado en pruebas (no publicado). 13 pruebas + smoke de activación con stub de vscode.
Pendiente Fase 1 (priorizado):
1. NO probado en un VS Code real (solo stub y arnés de navegador): ejecutar `code --extensionDevelopmentPath=apps/extension` y revisar a mano; añadir @vscode/test-electron.
2. Rejilla en vanilla TS (no React; ver ADR 0010 pendiente). Ejecutar drivers en workers aislados (SQLite no puede cancelar sin worker).
3. CI (GitHub Actions): lint, typecheck, tests, Postgres como servicio, test de cero sockets y de no-secretos en logs.
4. ESLint/Prettier; `icon`/`galleryBanner` en package.json de la extensión; NOTICE, SECURITY.md, CONTRIBUTING.
5. Verificar versión de Electron/Node de VS Code mínimo (ADR 0009) y que `node:sqlite` exista allí.
Riesgos: node:sqlite en el Node embebido de VS Code sin verificar; Docker Desktop debe estar encendido para pruebas PG.
Cómo retomar: `pnpm install && docker compose -f test/compose/docker-compose.yml up -d && pnpm test` (contenedor PG en puerto 54329).
Últimas pruebas: 43/43 verdes (2026-10-20).
