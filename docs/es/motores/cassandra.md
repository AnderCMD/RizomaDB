# Apache Cassandra / ScyllaDB

**Nivel:** 2 · **Versiones probadas:** Apache Cassandra 5.0 (probada). ScyllaDB 6.2.3 (un solo nodo, modo desarrollador) pasa las mismas 10 pruebas (`RZ_CASSANDRA_PORT=19043 RZ_CASSANDRA_EXPECT=ScyllaDB`); el driver la detecta mediante `system.versions` y oculta las vistas materializadas `<índice>_index` que Scylla crea para los índices secundarios. Los clústeres de varios nodos, Scylla Cloud, Alternator (API de DynamoDB) y las funciones propias de Scylla **no** están probados.

## Autenticación y transporte
Usuario/contraseña (PasswordAuthenticator) y TLS opcional, mediante el `cassandra-driver` con licencia Apache-2.0. Se exige el centro de datos local. Kerberos, los certificados de cliente y los secure bundles de Astra **no** son compatibles.

## Capacidades
Editor CQL (se ejecuta en el modo del editor SQL), parámetros preparados (`?`), paginación con un tamaño de lectura acotado, keyspaces como esquemas, tablas, vistas, claves de partición/clustering e índices secundarios en el explorador. No se edita en la rejilla.

## Notas de tipos
`bigint` conserva los 64 bits; `decimal` y `varint` son texto exacto; las colecciones, tuplas y UDT son JSON; `uuid`, `inet`, `date`, `time` y `duration` son texto; `timestamp` es `Date`.

## Límites (con honestidad)
- El nivel de consistencia es el predeterminado del driver (LOCAL_ONE); aún no se puede cambiar.
- Sin ayudas para batches ni LWT, sin tracing y sin gestión de vistas materializadas.
- Un resultado vacío solo anuncia los nombres de columna cuando el servidor los envía (los tipos pueden ser `unknown`).
- Cancelar deja de leer y cierra el flujo; el coordinador puede terminar la petición.

## Modo de solo lectura
En el cliente: en una conexión de solo lectura solo se ejecutan `SELECT`, `USE`, `DESCRIBE` y `LIST` (rechaza todo por defecto). Para una garantía en el servidor usa un rol limitado a SELECT.

## Herramientas externas
ninguna

## Licencia del driver
Apache-2.0 (`cassandra-driver` 4.10.0)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d cassandra` (o `scylla`) (tarda cerca de un minuto en aceptar conexiones) y luego `pnpm --filter @rizomadb/driver-cassandra test` (puerto 19042, centro de datos `datacenter1`; el puerto se cambia con `RZ_CASSANDRA_PORT`).
