# MySQL / MariaDB

**Nivel:** 1 · **Versiones probadas en CI:** MySQL 8.4 y MariaDB 11 (probadas)

## Autenticación y transporte
usuario/contraseña, TLS, túnel SSH

## Capacidades
Igual que PostgreSQL; los bloqueos de administración usan las vistas de MySQL 8 (la vista de bloqueos de MariaDB no está implementada)

## Notas de tipos
BIGINT exacto, DECIMAL como texto, JSON como JSON, BIT/BLOB como bytes

## Modo de solo lectura
Modo de transacción `READ ONLY` de sesión en las conexiones de solo lectura

## Herramientas externas
`mysqldump`, `mysql` (se detectan en el PATH)

## Licencia del driver
mysql2 (MIT)

## Pantalla de tabla (filtro, paginación, menú de columna)
Verificada contra un servidor real en `apps/extension/src/lib/engines.integration.test.mts`: MySQL 8.4 (filtro, paginación, renombrar/tipo/valor por defecto/NOT NULL/agregar/eliminar columna).

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d <servicio>` y luego `RZ_ENGINES=mysql pnpm test` (los puertos están en `test/compose/docker-compose.yml` y los ayudantes en `packages/test-engines`).

## TiDB
El driver de MySQL pasa el kit completo de conformidad (15/15) contra TiDB v8.5.1 (un solo nodo, `pingcap/tidb`, almacenamiento unistore; `RZ_TIDB_PORT`, por defecto 14000). TiDB solo implementa `SET ... READ ONLY` como operación vacía, así que para TiDB el driver **no** confía en ello: las conexiones de solo lectura se aplican en el driver con una comprobación que rechaza todo por defecto (se permiten lecturas, `SHOW`, `EXPLAIN`, `WITH ... SELECT`; se rechazan el resto, la entrada con varias sentencias, `FOR UPDATE` e `INTO OUTFILE`). Es una garantía del lado del cliente; para una garantía en el servidor usa un usuario de TiDB con permisos solo de SELECT. No probado: clústeres con TiKV, TiDB Cloud, TLS, reglas de colocación y DDL propio de TiDB en el diseñador.
