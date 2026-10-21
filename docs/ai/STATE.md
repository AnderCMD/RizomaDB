# Estado del proyecto RizomaDB
Fecha de la última actualización: 2026-10-20
Fase actual: 3 completada en lo esencial (ver límites); trabajando hacia Fase 4+. Fase 1B (logotipo) completa. Repo público: https://github.com/AnderCMD/RizomaDB (origin/main).
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

## Avance posterior (2026-10-20)
- Fase 2: drivers MySQL/MariaDB, SQL Server, Oracle (thin) pasan el kit en motores reales; cola de edición (op-log, concurrencia optimista, transacción) verificada en los 5; SSH con huellas estrictas y salto por bastión (servidor SSH en proceso en pruebas); exportación en streaming (5 M filas, memoria plana; cifrado AES-GCM, gzip, enmascarado). Faltan: proxy HTTP/SOCKS, CA personalizada, import de ~/.pgpass.
- Fase 3: `@rizomadb/sql` (tokenizador+separador por dialecto con fuzzing, completado, diagnósticos, parámetros, formato, planes EXPLAIN en 5 motores), proveedores en la extensión, notebooks `.sqlnb`, visor de plan. LSP separado y refactors NO hechos (ADR 0011).
- Fase 4: `@rizomadb/schema-tools` (modelo neutro, DDL por dialecto, diff/migraciones con orden de dependencias y avisos destructivos/manuales, ER en Mermaid/PlantUML/SVG, documentación MD/HTML, Flyway/Liquibase). Puerta de salida CUMPLIDA: round-trip diseñar → DDL → aplicar → introspección idéntica, y migración de ida y vuelta, verificado en SQLite, PostgreSQL 17, MySQL 8.4, SQL Server 2022 y Oracle Free 23. Extensión: diseñador de tablas, visor ER (zoom, exportar SVG/PNG/Mermaid/PlantUML), comparar esquemas (conexión o instantánea JSON), docs, sugerencia de índices FK. Límites: sin renombrado de columnas (drop+add), SQLite no altera columnas (paso manual), cambios de PK y defaults de SQL Server manuales, sin comentarios de columna, sin comparar contra archivo DDL (solo instantánea JSON), sin identity en introspección.
