# Neo4j

**Nivel:** 2 · **Versiones probadas:** Neo4j 5.26 Community (probada). Se espera que funcionen otras 5.x y Enterprise/Aura, pero **no están probadas**; la 4.x no es compatible (no tiene Query API).

## Autenticación y transporte
Autenticación básica sobre la Query API HTTP (puerto 7474, o 7473 con TLS). El protocolo Bolt **no** se usa, así que no hay funciones exclusivas de Bolt (enrutamiento, marcadores entre sesiones). Usa el puerto HTTP en el formulario de conexión.

## Capacidades
Editor de Cypher (`.cypher`/`.cyp`, ejecuta la sentencia terminada en `;` bajo el cursor), parámetros posicionales enlazados como `$p1`, `$p2`…, transacciones explícitas (confirmar/revertir), etiquetas como «tablas» con los tipos de propiedades de `db.schema.nodeTypeProperties()`, índices de `SHOW INDEXES`. No se edita en la rejilla.

## Notas de tipos
Los enteros conservan la precisión completa de 64 bits (JSON tipado); los nodos, relaciones, rutas, listas y mapas se muestran como JSON; las fechas, duraciones y puntos llegan como texto formateado por el servidor.

## Límites (con honestidad)
- El servidor devuelve los resultados en una sola respuesta, sin streaming: usa `LIMIT`. `maxRows` trunca en el cliente después de la descarga.
- Cancelar aborta la petición HTTP; el servidor puede seguir ejecutando la sentencia hasta que note que se cerró la conexión.
- No hay visor de planes `EXPLAIN`.

## Modo de solo lectura
En el cliente: un clasificador de Cypher que rechaza todo por defecto (`assessCypher`) rechaza cualquier cosa que no reconozca como lectura, incluidos procedimientos desconocidos, `PROFILE`, `LOAD CSV` y peticiones con varias sentencias. Para una garantía en el servidor usa un rol de solo lectura de Neo4j.

## Herramientas externas
ninguna

## Licencia del driver
ninguna (construido sobre node:http)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d neo4j` y luego `pnpm --filter @rizomadb/driver-neo4j test` (puerto HTTP 17474, se cambia con `RZ_NEO4J_PORT`; las credenciales de prueba están en el archivo compose y en la prueba).
