# SQLite

**Nivel:** 1 · **Versiones probadas en CI:** SQLite incluido en el runtime de Node (`node:sqlite`)

## Autenticación y transporte
ruta de archivo

## Capacidades
Todo salvo las herramientas de administración; el ALTER de columnas exige reconstruir la tabla (se marca como paso manual)

## Notas de tipos
INTEGER exacto (bigint más allá de 2^53)

## Modo de solo lectura
`PRAGMA query_only`

## Herramientas externas
la orden `VACUUM INTO` incorporada para las copias

## Licencia del driver
node:sqlite (sin dependencias); NOTA: su disponibilidad dentro del Node embebido de VS Code no está verificada

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d <servicio>` y luego `RZ_ENGINES=sqlite pnpm test` (los puertos están en `test/compose/docker-compose.yml` y los ayudantes en `packages/test-engines`).
