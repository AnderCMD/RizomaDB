# Estado del proyecto RizomaDB
Fecha de la última actualización: 2026-10-20
Fase actual: 1 (cimientos) — en curso. Fase 1B (logotipo) completa.
Hecho:
- Monorepo pnpm+Turbo; `driver-api` con kit de conformidad; drivers SQLite y PostgreSQL pasan el kit (12 y 13 pruebas; PG contra contenedor real, BD nueva por prueba); `core` (perfiles zod, secretos separados, redacción, política prod/solo lectura) con 5 pruebas.
- Marca: `pnpm build:brand` genera SVG/PNG, hoja de legibilidad y verifica contrastes; README con logo.
Pendiente Fase 1 (priorizado):
1. `apps/extension`: activación, gestor de conexiones (formulario desde connectionSchema), explorador, editor SQL con ejecución/cancelación, historial, rejilla simple en webview con streaming.
2. Ejecutar drivers en workers aislados (SQLite no puede cancelar sin worker).
3. CI (GitHub Actions): lint, typecheck, tests, Postgres como servicio, test de cero sockets y de no-secretos en logs.
4. ESLint/Prettier; `icon`/`galleryBanner` en package.json de la extensión; NOTICE, SECURITY.md, CONTRIBUTING.
5. Verificar versión de Electron/Node de VS Code mínimo (ADR 0009) y que `node:sqlite` exista allí.
Riesgos: node:sqlite en el Node embebido de VS Code sin verificar; Docker Desktop debe estar encendido para pruebas PG.
Cómo retomar: `pnpm install && docker compose -f test/compose/docker-compose.yml up -d && pnpm test` (contenedor PG en puerto 54329).
Últimas pruebas: 30/30 verdes (2026-10-20).
