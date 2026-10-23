<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-horizontal-dark.svg">
    <img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-horizontal-light.svg" alt="RizomaDB" width="320">
  </picture>
</p>

# Registro de cambios

[English](CHANGELOG.md) · Español

Aquí se listan los cambios notables, del más nuevo al más antiguo. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/). Todavía no se ha publicado nada.

## [Sin publicar]

### Corregido
- Los archivos de política y de conexiones compartidas del workspace se leen con el servicio de archivos de VS Code en lugar del de Node, así que una carpeta en una unidad de red o de sincronización en la nube que deja de responder ya no puede ocupar los hilos de archivos del host de extensiones ni hacer que VS Code lo marque como sin respuesta.
- El arranque ya no espera a los archivos de política y de conexiones compartidas: los comandos y pantallas de la extensión están listos al instante (las escrituras quedan bloqueadas hasta leer la política), un archivo en una carpeta no disponible se abandona a los 8 s, y la salida «RizomaDB policy» indica cuánto tardó cada paso. Las conexiones del árbol ya no se vuelven a expandir (y por tanto conectar) solas al reiniciar VS Code.

### Cambiado
- Documentación y sitio: la portada tiene ahora una galería de capturas (rejilla de resultados, cambios pendientes, formulario JDBC, conexiones guardadas, diagrama ER, planes, historial, tema claro); la página de solución de problemas cubre servidores Oracle antiguos, el error del service worker de VS Code y las bases enormes; las capturas se vuelven a tomar con el encabezado compacto (`scripts/take-screenshots.mjs`).

## [1.2.2] — 2026-10-23

### Corregido
- Cambiar a otra pestaña del editor mientras creas o editas una conexión (o un diseño de tabla, los ajustes, el historial o la guía) ya no devuelve esa pantalla a su primera página: conserva lo que habías escrito.
- Las bases de datos muy grandes ya no congelan la extensión: un nodo lista como máximo 2.000 tablas (el resto se alcanza con **Abrir datos de la tabla**, que ahora funciona desde la paleta de comandos y busca entre todas las tablas), y el autocompletado lee solo los nombres de tablas, no todas las columnas, cuando un esquema tiene más de 1.500 tablas.
- VS Code ya no se conecta al iniciar a las bases de los editores restaurados solo para subrayar errores, y un servidor que nunca responde se abandona a los 45 s (20 s para la conexión de red de Oracle) en lugar de dejar la extensión esperando para siempre.

### Cambiado
- **Un encabezado de resultados más compacto**: el título y las pestañas de la tabla comparten una fila, la línea de la consulta es más delgada, las herramientas de búsqueda y los botones de edición comparten una fila, y el filtro de la base de datos (condición y orden) queda plegado tras un botón hasta que lo necesites. Un filtro activo lo mantiene abierto. Los resultados empiezan aproximadamente a la mitad de altura que antes.
- El selector de conexión marca la que está en uso, las conectadas y las de solo lectura, y funciona sin un editor abierto.

## [1.2.1] — 2026-10-22

### Cambiado
- **La paginación por clave primaria ahora está activada por defecto** (`rizomadb.query.keysetPaging`): «Cargar más» en una tabla grande ya no lee y descarta todas las filas mostradas. Las tablas se abren ordenadas por su clave; pon la opción en `false` para el orden natural del motor.

### Corregido
- Servidores Oracle con muchos esquemas: leer las columnas de un esquema ya no lanza una consulta al diccionario por cada columna, y el autocompletado carga solo tu esquema y unos pocos más en lugar de hasta 25.

## [1.2.0] — 2026-10-22

### Añadido
- **Chincheta** en la barra de resultados: conserva una pestaña de resultados y la siguiente consulta se abre en otra.
- **Editar una conexión guardada** (lápiz en su tarjeta), con su contraseña y sus ajustes de túnel o proxy.
- Un **ojo para mostrar u ocultar** en cada campo de contraseña.
- Una conexión `prod` se puede alternar entre solo lectura y editable (con confirmación); las políticas que prohíben escribir siguen mandando.

### Corregido
- Una URL JDBC con escapes `%` rotos ya no provoca un error inesperado.
- Los servidores Oracle anteriores a 12.1 ahora reciben un mensaje claro en lugar de NJS-138.
- Arranque lento con conexiones abiertas: el árbol ya no reconecta los nodos restaurados al iniciar, se redibuja una vez en lugar de una por conexión, recuerda las respuestas de cada conexión, y el historial se recorta 30 s después del inicio sin analizar cada entrada.

## [1.1.0] — 2026-10-22

### Añadido
- **Pegar una URL JDBC** en el formulario Nueva conexión para rellenar los campos: Oracle (nombre de servicio, SID, `usuario/contraseña@…`, `DESCRIPTION`), PostgreSQL/CockroachDB/YugabyteDB, MySQL/MariaDB/TiDB, SQL Server, SQLite, DuckDB, ClickHouse, Trino, Cassandra, Elasticsearch/OpenSearch, Redis/Valkey, Neo4j y MongoDB. Las contraseñas de la URL van solo al campo de contraseña.
- Oracle puede conectar con un **SID** (bases antiguas), no solo con nombre de servicio.
- Al importar conexiones se entienden las URL `jdbc:` (también las de archivos de DBeaver).

### Notas
- Las URL Oracle OCI (thick), los alias TNS, TCPS y la seguridad integrada de SQL Server se rechazan con una explicación. Conectar desde una URL se probó contra servidores reales de PostgreSQL, MySQL, SQL Server y Oracle.

## [1.0.2] — 2026-10-22

### Corregido
- Se quitaron dos insignias del Marketplace que shields.io ya no sirve.

## [1.0.1] — 2026-10-22

### Cambiado
- La página del Marketplace se reescribió con capturas de las pantallas principales, una tabla de motores, los pasos para empezar y los límites conocidos.

### Corregido
- El sitio de documentación ahora sirve su logotipo, favicon e imágenes para compartir.
- El número de motores es 25 (las notas de la 1.0.0 decían 24).

## [1.0.0] — 2026-10-22

Primera versión.

### Añadido
- Un cliente de bases de datos multimotor para VS Code con 25 motores, un editor SQL nativo con botones Ejecutar, una rejilla de resultados editable con cambios pendientes que se aplican en una transacción, un diseñador de tablas, diagramas ER, importación/exportación y herramientas de esquema.
- Gobierno: políticas en capas donde gana la más estricta, un único punto de política y auditoría para toda escritura, enmascarado de columnas, catálogos compartidos sin secretos y archivos de catálogo cifrados.
- Paginación opcional de tablas por clave primaria (SQLite, PostgreSQL, MySQL, SQL Server, Oracle), edición de entradas de streams de Redis, perfiles de AWS para DynamoDB y archivos de credenciales de Google para Firestore.
- Un constructor de consultas sin SQL, un generador de usuarios de solo lectura, favoritos en el historial y exportación/importación de ajustes.
- Paquetes por plataforma que incluyen la biblioteca nativa de DuckDB, y pasos de release para sumas de verificación, un SBOM y procedencia de compilación (aún sin ejecutar).
- Interfaz y documentación en inglés y español.

### Corregido
- Abandonar un resultado grande ya no bloquea la siguiente sentencia en MySQL y SQL Server; una cancelación tardía ya no golpea la siguiente sentencia en MySQL, PostgreSQL y Oracle.
- Varios problemas de enmascarado, de restricciones por defecto de SQL Server y de cancelación en HydraDB encontrados al probar con servidores reales.

### Límites conocidos
- Nunca se han probado cuentas reales en la nube (AWS, Google Cloud, MongoDB Atlas, servicios gestionados de PostgreSQL/MySQL). Redshift, Snowflake y BigQuery no están implementados. El paquete está en el Marketplace de VS Code y adjunto a este release; todavía no está en Open VSX. Ver [docs/es/release/lista-de-aceptacion-v1.md](docs/es/release/lista-de-aceptacion-v1.md).
