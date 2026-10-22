# InfluxDB 3 (Core / Enterprise)

**Nivel:** 2 · **Versiones probadas:** InfluxDB 3 Core 3.12.1, un solo nodo, almacén de objetos en archivos, iniciado con `--without-auth` (probada). Enterprise, Cloud Dedicated/Serverless y los servidores con autenticación usan la misma API HTTP y un token Bearer, pero **no están probados**.

## Autenticación y transporte
Token de API opcional (`Authorization: Bearer …`) sobre HTTP o HTTPS. El nombre de la base de datos forma parte de la conexión.

## Capacidades
Editor SQL (dialecto DataFusion; se aplican las ayudas ANSI), parámetros posicionales (`$p1`, `$p2`…), streaming en JSON lines, tablas y columnas en el explorador (desde `information_schema`), `EXPLAIN` en texto. InfluxQL y la API de escritura (line protocol) no se usan.

## Notas de tipos
El servidor no envía los tipos del resultado: se infieren de los valores (entero o decimal lo decide el literal JSON; las marcas de tiempo llegan como texto ISO y solo pasan a fechas si llevan sufijo de zona horaria). Los enteros de 64 bits siguen exactos (requiere un runtime con acceso al texto fuente en `JSON.parse`). La columna `time` se muestra primero. Las filas con columnas distintas se unen sobre las primeras 2000 filas.

## Límites (con honestidad)
- De solo lectura por construcción: el endpoint SQL rechaza `INSERT`/`DELETE`/DDL y el driver nunca llama al endpoint de escritura. Escribir datos, la retención, los triggers y el motor de procesamiento quedan fuera del alcance.
- Una base de datos por conexión; no hay selector de base de datos.
- Sin visor de planes más allá del `EXPLAIN` en texto.

## Modo de solo lectura
En el servidor para la ruta SQL (el endpoint no puede modificar datos); además se pueden restringir los tokens.

## Herramientas externas
ninguna

## Licencia del driver
ninguna (construido sobre node:http)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d influxdb3` y luego `pnpm --filter @rizomadb/driver-influxdb3 test` (puerto 18181; se cambia con `RZ_INFLUXDB3_PORT`). Esta suite corre en CI en el trabajo `engines-extra`.
