# Lista de aceptación v1.0 — estado real (2026-10-22)

**Veredicto: v1.0 NO está lista.** Nada se ha publicado en Marketplace, Open VSX ni npm.

Leyenda: ✅ cumplido y verificado · 🟡 parcial · ❌ no hecho

| Criterio | Estado | Evidencia / límite |
|---|---|---|
| Tier 1 (PG, MySQL/MariaDB, SQLite, SQL Server, Oracle, MongoDB, Redis/Valkey) con pruebas contra motor real | ✅ | Kit de conformidad + pruebas por motor (contenedores Docker), también en CI |
| Tier 2 completo | 🟡 | Probados contra motor real: ClickHouse, Elasticsearch/OpenSearch, DuckDB, Neo4j 5.26, DynamoDB Local 2.5.2, InfluxDB 2.7 y 3 Core, Cassandra 5.0 y ScyllaDB 6.2, Firestore (emulador), Trino 470, y por protocolo CockroachDB 24.3, YugabyteDB 2025.2 y TiDB 8.5 (CockroachDB, YugabyteDB, InfluxDB 3, Firestore y HydraDB corren también en CI, trabajo `engines-extra`). Pendiente: Redshift (requiere cuenta AWS). AWS y Google Cloud reales NO probados. Ver docs/engines |
| HydraDB | 🟡 | Driver experimental sobre la API HTTP; 16 pruebas contra la imagen oficial, también en CI (`engines-extra`). No lista etiquetas ni propiedades (limitación del motor) |
| Cero telemetría | ✅ | Prueba de activación sin sockets |
| Secretos solo en SecretStorage | ✅ | Pruebas de depuración de secretos y auto-auditoría |
| Política/auditoría en un único punto | ✅ | `guardConnection`, `policy-paths.test.ts`; los entornos propios son una capa más que solo añade restricción |
| Accesibilidad WCAG 2.2 AA | 🟡 | axe: 0 violaciones en tema claro y oscuro en rejilla (con pestañas, panel de registro y menús), conexión nueva y guardadas, configuración, historial, guía, ER, plan, diseñador y métricas; revisión manual con VoiceOver (macOS, VS Code) hecha por el responsable del proyecto: sin problemas; NO probado con NVDA/JAWS (Windows) ni Orca (Linux) |
| UI es/en/pt-br/fr | 🟡 | Prueba contra deriva de textos; idioma de la extensión independiente del de VS Code; auditoría por script de textos fijos. Español e inglés revisados; el portugués (Brasil) y el francés se escribieron con ayuda de IA y NO los ha revisado ninguna persona nativa. Los mensajes del servidor de la base de datos salen como los escribe el servidor |
| Probado en un VS Code real | 🟡 | `pnpm --filter rizomadb test:e2e`: VS Code 1.142 activa la extensión, registra los 59 comandos, el tiempo de activación se mide (82–100 ms con presupuesto de 3000 ms), los títulos de las pantallas cambian entre en/es/pt/fr, las lentes de ejecutar aparecen en SQL y Mongo y las pantallas de configuración, conexión, guía e historial se abren como pestañas. Filtro de tabla, paginación y edición de columnas probados contra PostgreSQL, MySQL, SQL Server, Oracle, MongoDB, Elasticsearch y Neo4j reales, y filtro y paginación contra ClickHouse (`engines.integration.test.mts`); ese test encontró y se corrigieron tres errores de cancelación tardía (MySQL, PostgreSQL, Oracle) y la falta de DDL real para cambiar un valor por defecto en SQL Server. La edición por pegado, las favoritas, las estadísticas de columna y la edición de valores de Redis tienen pruebas propias (Redis contra un servidor real). Sin recorrido manual de la interfaz |
| Prueba de resistencia 8 h | ✅ | `pnpm soak` 480 min contra PostgreSQL: 24 659 932 iteraciones, heap 10,8 MB, sin crecimiento sostenido (0,00 MB/min) |
| CI y release ejecutados en GitHub | 🟡 | CI en verde en `dev` y `main` (pruebas con motores reales como servicios, licencias, páginas de referencia al día, sitio, CodeQL, gitleaks). cockroach, yugabyte, firestore, influxdb3, hydradb y los proxies reales (Squid, SOCKS5) corren en el trabajo `engines-extra`. Las acciones de GitHub usan versiones sin el aviso de Node 20 (salvo las del flujo de release, que no se ha ejecutado). El flujo de release NO se ha ejecutado |
| Tamaño del VSIX / arranque | 🟡 | 3,35 MB (presupuesto 8 MB), comprobado en pruebas; arranque medido en un VS Code real: 82–100 ms (e2e) |
| Licencias y SBOM | ✅ | `pnpm audit:licenses`, `pnpm sbom:generate`; los logos de motores vienen de conjuntos CC0/MIT y su uso está documentado (docs/legal/brand-logos.md) — conviene una revisión legal antes de publicar |
| Proxy HTTP/SOCKS | 🟡 | HTTP CONNECT y SOCKS5 (con usuario/contraseña, DNS en el proxy) hacia el servidor de base de datos, probados contra proxies de prueba escritos en el repo y, en CI, contra un Squid 6 real (con y sin autenticación) y un servidor SOCKS5 real hacia un PostgreSQL real. NO contra Dante ni otros productos, ni NTLM/Kerberos. No cubre el salto SSH ni las llamadas de IA |
| VSIX por plataforma (DuckDB) | ❌ | Módulo nativo fuera del VSIX |
| Sitio de documentación es/en | ✅ | Desplegado en GitHub Pages desde `main` (https://andercmd.github.io/RizomaDB/); guías de uso y referencias generadas en ambos idiomas; motores, empresa, seguridad, ADR y CI/CD también en español (la comparación honesta y la guía de diseño siguen solo en inglés); sin revisión visual completa |
| Guía y recorrido para nuevos usuarios | 🟡 | Guía interactiva dentro de la extensión y recorrido de bienvenida de VS Code; sin pruebas con usuarios reales |
| Firma de artefactos | ❌ | Prevista atestación de procedencia de GitHub en el flujo de release (no ejecutado) |
| Publicación | ❌ | Requiere confirmación explícita de la persona responsable |
