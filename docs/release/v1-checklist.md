# Lista de aceptación v1.0 — estado real (2026-10-21)

**Veredicto: v1.0 NO está lista.** Nada se ha publicado en Marketplace, Open VSX ni npm.

Leyenda: ✅ cumplido y verificado · 🟡 parcial · ❌ no hecho

| Criterio | Estado | Evidencia / límite |
|---|---|---|
| Tier 1 (PG, MySQL/MariaDB, SQLite, SQL Server, Oracle, MongoDB, Redis/Valkey) con pruebas contra motor real | ✅ | Kit de conformidad + pruebas por motor (contenedores Docker), también en CI |
| Tier 2 completo | 🟡 | Probados contra motor real: ClickHouse, Elasticsearch/OpenSearch, DuckDB, Neo4j 5.26, DynamoDB Local 2.5.2, InfluxDB 2.7 y 3 Core, Cassandra 5.0 y ScyllaDB 6.2, Firestore (emulador), Trino 470, y por protocolo CockroachDB 24.3, YugabyteDB 2025.2 y TiDB 8.5. Pendiente: Redshift (requiere cuenta AWS). AWS y Google Cloud reales NO probados. Ver docs/engines |
| HydraDB | 🟡 | Driver experimental sobre la API HTTP; 16 pruebas contra la imagen oficial. No lista etiquetas ni propiedades (limitación del motor); no corre en CI |
| Cero telemetría | ✅ | Prueba de activación sin sockets |
| Secretos solo en SecretStorage | ✅ | Pruebas de depuración de secretos y auto-auditoría |
| Política/auditoría en un único punto | ✅ | `guardConnection`, `policy-paths.test.ts`; los entornos propios son una capa más que solo añade restricción |
| Accesibilidad WCAG 2.2 AA | 🟡 | axe: 0 violaciones en tema claro y oscuro en rejilla (con pestañas, panel de registro y menús), conexión nueva y guardadas, configuración, historial, guía, ER, plan, diseñador y métricas; SIN revisión manual con lector de pantalla ni recorrido de teclado completo |
| UI es/en | ✅ | Prueba contra deriva de textos; idioma de la extensión independiente del de VS Code; auditoría por script de textos fijos. Los mensajes del servidor de la base de datos salen como los escribe el servidor |
| Probado en un VS Code real | 🟡 | `pnpm --filter rizomadb test:e2e`: VS Code 1.142 activa la extensión, registra los 57 comandos, las lentes de ejecutar aparecen en SQL y Mongo y las pantallas de configuración, conexión, guía e historial se abren como pestañas. Filtro de tabla, paginación y edición de columnas probados contra PostgreSQL, MySQL, MongoDB, Elasticsearch y Neo4j reales (`engines.integration.test.ts`). Sin recorrido manual de la interfaz |
| Prueba de resistencia 8 h | ✅ | `pnpm soak` 480 min contra PostgreSQL: 24 659 932 iteraciones, heap 10,8 MB, sin crecimiento sostenido (0,00 MB/min) |
| CI y release ejecutados en GitHub | 🟡 | CI en verde en `dev` y `main` (pruebas con motores reales como servicios, licencias, páginas de referencia al día, sitio, CodeQL, gitleaks). cockroach, yugabyte, firestore, influxdb3 y hydradb no corren en CI. El flujo de release NO se ha ejecutado |
| Tamaño del VSIX / arranque | 🟡 | 3,3 MB (presupuesto 8 MB), comprobado en pruebas; sin medida de arranque en VS Code real |
| Licencias y SBOM | ✅ | `pnpm audit:licenses`, `pnpm sbom:generate`; los logos de motores vienen de conjuntos CC0/MIT y su uso está documentado (docs/legal/brand-logos.md) — conviene una revisión legal antes de publicar |
| Proxy HTTP/SOCKS | 🟡 | HTTP CONNECT y SOCKS5 (con usuario/contraseña, DNS en el proxy) hacia el servidor de base de datos, probados contra proxies de prueba escritos en el repo, NO contra Squid/Dante/etc. No cubre el salto SSH ni las llamadas de IA |
| VSIX por plataforma (DuckDB) | ❌ | Módulo nativo fuera del VSIX |
| Sitio de documentación es/en | ✅ | Desplegado en GitHub Pages desde `main` (https://andercmd.github.io/RizomaDB/); guías de uso y referencias generadas en ambos idiomas; páginas técnicas (motores, empresa, seguridad) solo en inglés; sin revisión visual completa |
| Guía y recorrido para nuevos usuarios | 🟡 | Guía interactiva dentro de la extensión y recorrido de bienvenida de VS Code; sin pruebas con usuarios reales |
| Firma de artefactos | ❌ | Prevista atestación de procedencia de GitHub en el flujo de release (no ejecutado) |
| Publicación | ❌ | Requiere confirmación explícita de la persona responsable |
