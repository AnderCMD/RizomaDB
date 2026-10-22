# HydraDB

**Estado:** experimental (se muestra con una insignia Experimental). **Nivel:** 2 · **Versiones probadas:** `ghcr.io/hydra-db/hydradb:latest` (imagen del 2026-09-29, registros de HydraDB 0.1.x, API de consultas HTTP `v1`), un solo nodo, sin cifrar. Otras versiones, clústeres y despliegues con TLS **no están probados**.

HydraDB es una base de datos de grafos sobre almacenamiento de objetos que habla OpenCypher por Bolt y por una API de consultas HTTP ([github.com/hydra-db/hydradb](https://github.com/hydra-db/hydradb), AGPL-3.0). No hay que confundirla con Hydra, el almacén de datos basado en Postgres.

## Autenticación y transporte
Token Bearer sobre la API de consultas HTTP (puerto por defecto 8443). El puerto Bolt **no** se usa. Además de host, puerto y token, el formulario pide el **grafo** (`default`) y el **id de celda** (`cell-0`): HydraDB no puede listar las celdas, y una incorrecta responde con un HTTP 500 opaco (el driver añade una pista). Un encabezado de espacio de nombres es opcional. Los servidores desplegados exigen TLS (`Use TLS`); el HTTP plano es solo para desarrollo local.

## Capacidades
Editor de Cypher, parámetros posicionales enlazados como `$p1`, `$p2`…, resultados en streaming NDJSON (las filas llegan a la rejilla mientras el servidor aún las produce), cancelación (aborta la petición y llama al endpoint de cancelación del servidor), `maxRows`. No se edita en la rejilla. Sin transacciones.

## Notas de tipos
Las celdas las tipa el servidor: `vertex_id` e `integer` conservan los 64 bits completos (los enteros exactos se entrecomillan antes de analizarse); los decimales, booleanos, textos y nulos se asignan directamente; las listas se muestran como JSON; las rutas se muestran como las codifica el servidor.

## Límites (con honestidad)
- **El árbol solo muestra las etiquetas que listas en la conexión** («Labels to show in the tree»). HydraDB no tiene `CALL db.labels()`, así que no se pueden descubrir etiquetas, propiedades ni tipos de relación. Abrir una etiqueta ejecuta `MATCH (n:Label) RETURN n.id AS id`; escribe tu propia consulta para ver otras propiedades.
- HydraDB acepta un **subconjunto** de OpenCypher: no hay `RETURN n`, ni `RETURN *`, ni aritmética en `RETURN`, las escrituras solo como patrones de aristas o lotes `UNWIND`, y más (consulta `USING-HYDRADB.md` del servidor). El driver pasa tu sentencia tal cual y muestra el mensaje del servidor.
- Las comprobaciones de existencia sobre ids sueltos no son fiables por diseño del servidor (un `MATCH` anclado a un id devuelve una fila fantasma): ancla la consulta a una etiqueta.
- Sin visor de `EXPLAIN` ni herramientas de ER o diseño.

## Modo de solo lectura
En el cliente: el clasificador de Cypher que rechaza todo por defecto rechaza cualquier cosa que no reconozca como lectura (`MERGE`, `CREATE`, `SET`, `DELETE`, procedimientos desconocidos, varias sentencias). `algo.SPpaths`, `algo.SSpaths` y `algo.MSpaths` cuentan como lecturas. Para una garantía en el servidor usa un token sin permisos de escritura, si tu despliegue lo permite.

## Herramientas externas
ninguna

## Licencia del driver
ninguna (construido sobre node:http)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d hydradb` y luego `pnpm --filter @rizomadb/driver-hydradb test` (puerto HTTP 18443, se cambia con `RZ_HYDRADB_PORT`; el token de prueba está en `test/compose/hydradb-auth-token`). Esta suite corre en CI en el trabajo `engines-extra`, que levanta el motor desde el archivo compose.
