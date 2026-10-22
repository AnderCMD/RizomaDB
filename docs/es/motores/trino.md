<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Trino

**Nivel:** 2 · **Versiones probadas:** Trino 470, un solo nodo, catálogo `memory` (probada). Starburst, Athena (basada en Trino pero otro servicio), Presto y los clústeres protegidos (OAuth, Kerberos, certificados de cliente) **no** están probados.

## Autenticación y transporte
Nombre de usuario (`X-Trino-User`) sobre HTTP o HTTPS; contraseña opcional (HTTP basic, solo aceptada sobre TLS). OAuth2, Kerberos, JWT y los certificados de cliente **no** son compatibles.

## Capacidades
Editor SQL (dialecto ANSI), parámetros `?` (se envían como sentencia `PREPARE` + `EXECUTE ... USING` con literales escapados), streaming de páginas de resultados, selección de catálogo y esquema, esquemas, tablas, vistas y columnas en el explorador (desde `information_schema` del catálogo configurado), `EXPLAIN` en texto. No se edita en la rejilla.

## Notas de tipos
`bigint` sigue exacto (requiere un runtime con acceso al texto fuente en `JSON.parse`: VS Code 1.100+ lo cumple); `decimal` es texto; los arreglos, mapas y filas son JSON; `varbinary` son bytes; las fechas y marcas de tiempo llegan como el texto del servidor.

## Límites (con honestidad)
- Solo se explora el catálogo configurado; las consultas entre catálogos funcionan escribiendo `catalogo.esquema.tabla`.
- Trino no tiene claves primarias ni foráneas: el explorador no muestra ninguna y las herramientas de diseño y comparación de esquemas no son compatibles con Trino.
- Sin transacciones ni indicador de progreso de la consulta; la consulta se cancela con `DELETE` sobre la URI de la sentencia.
- Las sentencias preparadas son por petición; una lista de parámetros muy grande se envía como literales.

## Modo de solo lectura
En el cliente: en una conexión de solo lectura solo pasan `SELECT`, `WITH`, `VALUES`, `SHOW`, `DESCRIBE` y `EXPLAIN` (no `EXPLAIN ANALYZE` de una escritura); todo lo demás, incluida la entrada con varias sentencias, se rechaza. Para una garantía en el servidor usa las reglas de control de acceso de Trino.

## Herramientas externas
ninguna

## Licencia del driver
ninguna (construido sobre node:http)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d trino` (tarda cerca de un minuto en arrancar) y luego `pnpm --filter @rizomadb/driver-trino test` (puerto 18081; se cambia con `RZ_TRINO_PORT`).
