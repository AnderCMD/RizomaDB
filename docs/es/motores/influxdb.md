# InfluxDB 2.x

**Nivel:** 2 · **Versiones probadas:** InfluxDB 2.7.12 OSS (probada). InfluxDB 3 (SQL/InfluxQL), InfluxDB 1.x e InfluxDB Cloud **no** son compatibles ni están probadas.

## Autenticación y transporte
Token de API (Authorization: Token …) sobre HTTP o HTTPS, más el nombre de la organización. Crea un token de solo lectura para un uso de solo lectura.

## Capacidades
Editor de Flux (se ejecuta en el modo del editor SQL), streaming de CSV anotado, columnas tipadas (long, double, boolean, dateTime, base64Binary), buckets como «esquemas» y mediciones como «tablas», con las claves de etiquetas y campos en el explorador. No se edita en la rejilla.

## Notas de tipos
Los valores `dateTime` son `Date`; los enteros de 64 bits conservan la precisión. Las series con distintos conjuntos de etiquetas dan columnas distintas: las primeras 2000 filas deciden el conjunto de columnas (los valores ausentes son nulos); las columnas que aparecen más tarde se descartan con un mensaje. Usa `pivot()`/`keep()` para controlar la forma.

## Límites (con honestidad)
- Sin parámetros posicionales (Flux no los tiene): escribe los literales en el script.
- La introspección recorre toda la retención (`start: 0`) y puede ser lenta en buckets grandes.
- Sin escritura desde la rejilla, sin importación de line protocol y sin gestión de tareas ni alertas.
- Sin visor de planes.

## Modo de solo lectura
En el cliente: en una conexión de solo lectura se rechazan los scripts que usan `to()`, tareas o paquetes que salen de InfluxDB (http, sql, mqtt, secrets, endpoints de notificación). Para una garantía en el servidor usa un token de solo lectura.

## Herramientas externas
ninguna

## Licencia del driver
ninguna (construido sobre node:http)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d influxdb` y luego `pnpm --filter @rizomadb/driver-influxdb test` (puerto 18086, se cambia con `RZ_INFLUXDB_PORT`; la organización y el token de prueba están en el archivo compose).
