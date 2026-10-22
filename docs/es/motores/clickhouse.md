# ClickHouse

**Nivel:** 2 · **Versiones probadas en CI:** ClickHouse 24.8 (probada)

## Autenticación y transporte
usuario/contraseña sobre HTTP(S)

## Capacidades
Consultas, explorador, exportación, EXPLAIN (texto). Las filas no se pueden editar (las mutaciones son asíncronas)

## Notas de tipos
Int64/UInt64 exactos; fechas como texto ISO

## Modo de solo lectura
`readonly=2` aplicado por el servidor

## Herramientas externas
ninguna

## Licencia del driver
@clickhouse/client (Apache-2.0)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d <servicio>` y luego `RZ_ENGINES=clickhouse pnpm test` (los puertos están en `test/compose/docker-compose.yml` y los ayudantes en `packages/test-engines`).
