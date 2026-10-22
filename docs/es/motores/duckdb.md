# DuckDB

**Nivel:** 2 · **Versiones probadas en CI:** DuckDB 1.5 (probada)

## Autenticación y transporte
ruta de archivo o :memory:

## Capacidades
Conjunto SQL completo. La biblioteca nativa depende de la plataforma y NO se incluye en el VSIX: el driver informa un error claro hasta que se distribuya una compilación por plataforma

## Notas de tipos
HUGEINT exacto, DECIMAL como texto, LIST/STRUCT como JSON

## Modo de solo lectura
Protección de sentencias en el cliente

## Herramientas externas
ninguna

## Licencia del driver
@duckdb/node-api (MIT)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d <servicio>` y luego `RZ_ENGINES=duckdb pnpm test` (los puertos están en `test/compose/docker-compose.yml` y los ayudantes en `packages/test-engines`).
