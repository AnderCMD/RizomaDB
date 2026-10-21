# Lista de aceptación v1.0 — estado real (2026-10-20)

**Veredicto: v1.0 NO está lista.** Nada se ha publicado en Marketplace, Open VSX ni npm.

Leyenda: ✅ cumplido y verificado · 🟡 parcial · ❌ no hecho

| Criterio | Estado | Evidencia / límite |
|---|---|---|
| Tier 1 (PG, MySQL/MariaDB, SQLite, SQL Server, Oracle, MongoDB, Redis/Valkey) con pruebas contra motor real | ✅ | Kit de conformidad + pruebas por motor (contenedores Docker) |
| Tier 2 completo | 🟡 | ClickHouse, Elasticsearch/OpenSearch, DuckDB, CockroachDB-por-PG: ver docs/engines. Neo4j 5.26 añadido (HTTP Query API, 14 pruebas contra motor real). DynamoDB Local 2.5.2 añadido (PartiQL + SigV4, 12 pruebas; AWS real NO probado). InfluxDB 2.7 añadido (Flux, 10 pruebas). Cassandra 5.0 añadido (10 pruebas). Firestore (emulador) añadido (14 pruebas; Google Cloud real NO probado). CockroachDB 24.3.4 probado con el kit completo (15/15). TiDB 8.5.1 probado con el kit completo (15/15; solo lectura aplicada en el cliente). Tier 2 pendiente: Trino 470 añadido (kit de conformidad + 4 pruebas propias). Pendiente: InfluxDB 3, ScyllaDB probado, Redshift, YugabyteDB probado, Trino, Redshift probado |
| Cero telemetría | ✅ | Prueba de activación sin sockets |
| Secretos solo en SecretStorage | ✅ | Pruebas de depuración de secretos y auto-auditoría |
| Política/auditoría en un único punto | ✅ | `guardConnection`, `policy-paths.test.ts` |
| Accesibilidad WCAG 2.2 AA | 🟡 | axe: 0 violaciones en 5 vistas; SIN revisión manual con lector de pantalla |
| UI es/en | ✅ | Prueba contra deriva de textos |
| Probado en un VS Code real | 🟡 | `pnpm --filter rizomadb test:e2e`: VS Code 1.142 (Node 24.21, Electron 43.7) activa la extensión, registra los 52 comandos y `node:sqlite` existe. Sin recorrido manual de la interfaz |
| Prueba de resistencia 8 h | ❌ | `pnpm soak`: solo 2 min ejecutados, sin crecimiento sostenido tras corregir dos fugas |
| CI y release ejecutados en GitHub | ❌ | Flujos escritos, nunca ejecutados |
| Tamaño del VSIX / arranque | 🟡 | Comprobación de tamaño en pruebas; sin medida de arranque en VS Code real |
| Licencias y SBOM | ✅ | `pnpm audit:licenses`, `pnpm sbom:generate` |
| Proxy HTTP/SOCKS | 🟡 | HTTP CONNECT y SOCKS5 (con usuario/contraseña, DNS en el proxy) hacia el servidor de base de datos, probados contra proxies de prueba escritos en el repo, NO contra Squid/Dante/etc. No cubre el salto SSH ni las llamadas de IA |
| VSIX por plataforma (DuckDB) | ❌ | Módulo nativo fuera del VSIX |
| Sitio de documentación es/en | 🟡 | `site/` (VitePress) compila en es/en (`pnpm --filter @rizomadb/site build`); NO desplegado ni revisado visualmente; páginas técnicas solo en inglés |
| Firma de artefactos | ❌ | Prevista atestación de procedencia de GitHub |
| Publicación | ❌ | Requiere confirmación explícita de la persona responsable |
