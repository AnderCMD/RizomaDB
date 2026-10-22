# DuckDB

**Nivel:** 2 · **Versiones probadas en CI:** DuckDB 1.5 (probada)

## Autenticación y transporte
ruta de archivo o :memory:

## Capacidades
Conjunto SQL completo. La biblioteca nativa depende de la plataforma. Va incluida en los VSIX por plataforma (darwin-arm64/x64, linux-x64/arm64, win32-x64/arm64; unos 38 MB cada uno) y NO en el VSIX universal, donde el driver informa un error claro. Solo se probó el paquete darwin-arm64 aquí y el de linux-x64 en CI; las demás plataformas las construye el workflow de release, que nunca se ha ejecutado, así que no están probadas

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
