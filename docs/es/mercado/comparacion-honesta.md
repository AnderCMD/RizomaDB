<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Comparación honesta

Basada en una revisión de los listados públicos de la competencia (comprobados el 2026-10-20) y en lo que RizomaDB realmente pasa en sus propias pruebas. «No verificado» significa que no lo confirmamos en una fuente primaria. Actualizada el 2026-10-22.

| | RizomaDB (este repositorio) | DBCode | Database Client | SQLTools |
|---|---|---|---|---|
| Licencia | Apache-2.0, todo el código abierto | Producto propietario | Las versiones nuevas son cerradas | MIT |
| Niveles de pago | Ninguno | Pro/Team | No verificado | Ninguno |
| Telemetría | Ninguna; la comprueba una prueba de cero sockets | Anónima (sigue el ajuste de VS Code) | Anónima, con su propia exclusión voluntaria | No encontrada |
| Madurez | 1.0.0, recién publicado, aún sin pruebas de otras personas | Muy usado | Muy usado | Muy usado |
| Motores con pruebas contra un motor real | 18 drivers que cubren 25 motores: SQLite, PostgreSQL (+CockroachDB, YugabyteDB), MySQL/MariaDB (+TiDB), SQL Server, Oracle, MongoDB, Redis/Valkey, ClickHouse, Elasticsearch/OpenSearch, DuckDB, Neo4j, DynamoDB Local, InfluxDB 2 y 3, Cassandra/ScyllaDB, emulador de Firestore, Trino, HydraDB (experimental) | «90+» según su listado | Ver su listado | Muchos mediante drivers |

## Dónde RizomaDB no es (todavía) competitivo
- **Amplitud**: menos motores que el listado de DBCode; nunca se probaron cuentas reales en la nube (AWS, Google Cloud, Atlas, PostgreSQL/MySQL gestionados); Redshift, Snowflake y BigQuery no están implementados; no existen los motores de Nivel 3 ni un puente JDBC/ODBC.
- **Poca prueba humana hasta ahora**: la prueba de extremo a extremo automática lo activa en un VS Code real y comprueba los comandos y las lentes del editor, las pantallas pasan axe en claro y oscuro, y la persona responsable hizo una revisión manual con lector de pantalla en macOS, Windows y Linux sin encontrar problemas; no hay una auditoría de accesibilidad independiente.
- **Distribución**: en el Marketplace de VS Code y como release de GitHub (sumas de verificación, SBOM, procedencia de compilación); todavía no en Open VSX.
- **DuckDB** necesita un módulo nativo específico de la plataforma: solo se incluye en los VSIX por plataforma, que construye el flujo de release (solo se ejecutaron dos de los seis).
- Comunidad: ninguna todavía.
- Algunas funciones son jóvenes: HydraDB es experimental; la paginación funciona en todos los motores volviendo a ejecutar la consulta y saltando filas, lo que es más lento para páginas muy profundas que un cursor nativo (un ajuste opcional pagina por clave primaria en cinco motores SQL).

## Dónde se diferencia por diseño
Licencia verificable y cero telemetría; un único punto de política y auditoría para toda ruta de escritura; controles empresariales (política en capas, entornos propios con protección, enmascarado, auditoría) sin un nivel de pago; edición en el sitio con cambios pendientes aplicados en una transacción y detección de conflictos; un asistente de IA opcional solo con el esquema y un servidor MCP opcional de solo lectura con restricciones; y una guía interactiva más una interfaz en inglés y español, intercambiables dentro de la extensión.
