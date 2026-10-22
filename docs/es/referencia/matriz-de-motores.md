<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Matriz de capacidades por motor

Qué admite cada motor, leído de las capacidades que declaran los drivers y de las reglas de la extensión. Un guion significa *no soportado*; nunca es una promesa de que se añadirá. Qué motores se prueban contra un servidor real está en la página de cada motor.

| Motor | Familia | Lenguaje de consulta | Editar filas en la rejilla | Cancelar | Solo lectura impuesto por | Cuadro de filtro de tabla | Edición de columnas | Plan de ejecución | Herramientas de administración |
|---|---|---|---|---|---|---|---|---|---|
| PostgreSQL | relacional | sql | por clave primaria | sí | el servidor | WHERE / ORDER BY | sí | sí | sí |
| MySQL / MariaDB | relacional | sql | por clave primaria | sí | el servidor | WHERE / ORDER BY | sí | sí | sí |
| SQLite | relacional | sql | por clave primaria | — | el servidor | WHERE / ORDER BY | sí | sí | — |
| SQL Server | relacional | sql | por clave primaria | sí | RizomaDB (cliente) | WHERE / ORDER BY | sí | sí | sí |
| Oracle Database | relacional | sql | por clave primaria | sí | RizomaDB (cliente) | WHERE / ORDER BY | sí | sí | sí |
| ClickHouse | relacional | sql | — | sí | el servidor | WHERE / ORDER BY | — | sí | — |
| DuckDB | relacional | sql | por clave primaria | sí | RizomaDB (cliente) | WHERE / ORDER BY | — | sí | — |
| Trino | relacional | sql | — | sí | RizomaDB (cliente) | WHERE / ORDER BY | — | sí | — |
| MongoDB | documentos | mongo | por id de documento | sí | RizomaDB (cliente) | filtro / orden (JSON) | — | sí | — |
| Redis / Valkey | clave-valor | redis | por clave | sí | RizomaDB (cliente) | — | — | — | — |
| Elasticsearch / OpenSearch | búsqueda | json | — | sí | RizomaDB (cliente) | texto de búsqueda / orden | — | sí | — |
| Neo4j | grafos | cypher | — | sí | RizomaDB (cliente) | condición / ORDER BY | — | — | — |
| HydraDB (experimental) | grafos | cypher | — | sí | RizomaDB (cliente) | — | — | — | — |
| Amazon DynamoDB | clave-valor | sql | — | sí | RizomaDB (cliente) | — | — | — | — |
| Google Cloud Firestore | documentos | json | — | sí | RizomaDB (cliente) | — | — | — | — |
| InfluxDB 2.x | series temporales | flux | — | sí | RizomaDB (cliente) | — | — | — | — |
| InfluxDB 3 | series temporales | sql | — | sí | el servidor | — | — | sí | — |
| Apache Cassandra / ScyllaDB | columna ancha | cql | — | sí | RizomaDB (cliente) | — | — | — | — |

## Notas

- **Cuadro de filtro de tabla**: la barra bajo la línea de consulta al abrir una tabla; cambia la sentencia en la base de datos, así que la paginación y la edición siguen funcionando.
- **Edición de columnas**: renombrar, cambiar tipo, NOT NULL, valor por defecto, agregar y eliminar desde el menú de la columna; muestran el DDL exacto y piden confirmación.
- **Solo lectura impuesto por el servidor** significa que la propia conexión rechaza las escrituras; por RizomaDB (cliente) significa que lo hace un clasificador de sentencias que deniega por defecto, así que para una garantía firme usa además un rol de base de datos de solo lectura.

*Generado por `scripts/gen-reference.mjs` a partir del manifiesto de la extensión; no se edita a mano.*
