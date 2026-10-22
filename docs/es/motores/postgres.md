# PostgreSQL

**Nivel:** 1 · **Versiones probadas en CI:** 17 (probada); 12–16 se espera que funcionen, no están en CI

## Autenticación y transporte
usuario/contraseña, TLS (archivo de CA o almacén del sistema), túnel SSH

## Capacidades
Todo el conjunto SQL: cola de ediciones, diseñador de esquemas, ER, comparación, importar/exportar, copias de seguridad (pg_dump), administración, EXPLAIN (JSON; ANALYZE con confirmación)

## Notas de tipos
int8 → exacto (bigint más allá de 2^53), jsonb → visor JSON, arreglos como arreglos; streaming con pg-cursor

## Modo de solo lectura
En el servidor, `default_transaction_read_only` en las conexiones de solo lectura; `pg_stat_statements` es opcional para las consultas lentas

## Herramientas externas
`pg_dump`, `pg_restore` (se detectan en el PATH, nunca se incluyen; licencia PostgreSQL)

## Licencia del driver
pg (MIT), pg-cursor (MIT)

## Pantalla de tabla (filtro, paginación, menú de columna)
Verificada contra un servidor real en `apps/extension/src/lib/engines.integration.test.mts`: PostgreSQL 17 (filtro, paginación, renombrar/tipo/valor por defecto/NOT NULL/agregar/eliminar columna).

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d <servicio>` y luego `RZ_ENGINES=postgres pnpm test` (los puertos están en `test/compose/docker-compose.yml` y los ayudantes en `packages/test-engines`).

## CockroachDB
El driver de PostgreSQL pasa el kit completo de conformidad (15/15, con cancelación de consultas) contra CockroachDB v24.3.4, un solo nodo, modo inseguro (`RZ_COCKROACH_PORT`, por defecto 26257; `docker compose ... up -d cockroach`). El servidor se reconoce con `version()` y las consultas se cancelan con `CANCEL QUERIES` de la sesión en lugar de `pg_cancel_backend`. Esta suite también corre en CI (trabajo `engines-extra`). No probado: clústeres seguros con certificados de cliente, clústeres de varios nodos, CockroachDB Cloud, reintentos de serialización (40001) más allá de informar el error y DDL propio de Cockroach (el diseñador genera sintaxis de PostgreSQL). Los cambios de esquema tardan segundos en CockroachDB.

## YugabyteDB
El driver de PostgreSQL pasa el kit completo de conformidad (15/15, con cancelación) contra YugabyteDB 2025.2.7 (YSQL, un solo nodo, `yugabyted`; `RZ_YUGABYTE_PORT`, por defecto 15433; `docker compose ... up -d yugabyte`, necesita unos 2 GB de RAM). El servidor se reconoce con `version()` (`-YB-`). Esta suite también corre en CI (trabajo `engines-extra`). No probado: clústeres de varios nodos o geodistribuidos, YugabyteDB Aeon (nube), YCQL (usa el driver de Cassandra bajo tu responsabilidad: sin probar), TLS y errores de reintento de transacción más allá de informarlos. Los cambios de esquema son lentos en YugabyteDB.
