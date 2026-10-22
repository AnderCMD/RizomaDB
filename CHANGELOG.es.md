# Registro de cambios

[English](CHANGELOG.md) · Español

Aquí se listan los cambios notables, del más nuevo al más antiguo. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/). Todavía no se ha publicado nada.

## [Sin publicar] — 0.0.1 (no publicado)

### Añadido
- Un cliente de bases de datos multimotor para VS Code con 24 motores, un editor SQL nativo con botones Ejecutar, una rejilla de resultados editable con cambios pendientes que se aplican en una transacción, un diseñador de tablas, diagramas ER, importación/exportación y herramientas de esquema.
- Gobierno: políticas en capas donde gana la más estricta, un único punto de política y auditoría para toda escritura, enmascarado de columnas, catálogos compartidos sin secretos y archivos de catálogo cifrados.
- Paginación opcional de tablas por clave primaria (SQLite, PostgreSQL, MySQL, SQL Server, Oracle), edición de entradas de streams de Redis, perfiles de AWS para DynamoDB y archivos de credenciales de Google para Firestore.
- Un constructor de consultas sin SQL, un generador de usuarios de solo lectura, favoritos en el historial y exportación/importación de ajustes.
- Paquetes por plataforma que incluyen la biblioteca nativa de DuckDB, y pasos de release para sumas de verificación, un SBOM y procedencia de compilación (aún sin ejecutar).
- Interfaz y documentación en inglés y español.

### Corregido
- Abandonar un resultado grande ya no bloquea la siguiente sentencia en MySQL y SQL Server; una cancelación tardía ya no golpea la siguiente sentencia en MySQL, PostgreSQL y Oracle.
- Varios problemas de enmascarado, de restricciones por defecto de SQL Server y de cancelación en HydraDB encontrados al probar con servidores reales.

### Sin confirmar
- Nunca se han probado cuentas reales en la nube (AWS, Google Cloud, MongoDB Atlas, servicios gestionados de PostgreSQL/MySQL). Redshift, Snowflake y BigQuery no están implementados. Ver [docs/es/release/lista-de-aceptacion-v1.md](docs/es/release/lista-de-aceptacion-v1.md).
