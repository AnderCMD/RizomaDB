import { defineConfig } from "vitepress";

const engines = ["postgres", "mysql", "sqlite", "mssql", "oracle", "mongodb", "redis", "clickhouse", "elasticsearch", "duckdb", "neo4j", "hydradb", "dynamodb", "firestore", "influxdb", "influxdb3", "cassandra", "trino"];
const engineName: Record<string, string> = { postgres: "PostgreSQL", mysql: "MySQL / MariaDB", sqlite: "SQLite", mssql: "SQL Server", oracle: "Oracle", mongodb: "MongoDB", redis: "Redis / Valkey", clickhouse: "ClickHouse", elasticsearch: "Elasticsearch / OpenSearch", duckdb: "DuckDB", neo4j: "Neo4j", hydradb: "HydraDB (experimental)", dynamodb: "DynamoDB", firestore: "Firestore", influxdb: "InfluxDB 2", influxdb3: "InfluxDB 3", cassandra: "Cassandra / ScyllaDB", trino: "Trino" };

const enSidebar = [
  { text: "Start", items: [{ text: "Getting started", link: "/en/guides/getting-started" }, { text: "Migrating to RizomaDB", link: "/en/guides/migration" }, { text: "Troubleshooting", link: "/en/guides/troubleshooting" }] },
  { text: "Using RizomaDB", items: [
    { text: "Connections", link: "/en/guides/connections" }, { text: "The query editor", link: "/en/guides/query-editor" }, { text: "The results grid", link: "/en/guides/results-grid" }, { text: "Using the keyboard", link: "/en/guides/keyboard" }, { text: "Help test RizomaDB", link: "/en/guides/help-test" },
    { text: "Editing data", link: "/en/guides/editing-data" }, { text: "Language and settings", link: "/en/guides/language-and-settings" } ] },
  { text: "Reference", items: [{ text: "Settings", link: "/en/reference/settings" }, { text: "Commands", link: "/en/reference/commands" }, { text: "Engine capability matrix", link: "/en/reference/engine-matrix" }] },
  { text: "Engines", collapsed: true, items: [{ text: "Support overview", link: "/en/engines/README" }, ...engines.map((e) => ({ text: engineName[e]!, link: `/en/engines/${e}` }))] },
  { text: "Enterprise", items: [
    { text: "Policy", link: "/en/enterprise/policy" }, { text: "Audit", link: "/en/enterprise/audit" },
    { text: "Deployment", link: "/en/enterprise/deployment" }, { text: "Compliance", link: "/en/enterprise/compliance" } ] },
  { text: "Security", items: [{ text: "Threat model", link: "/en/security/threat-model" }, { text: "Dependency policy", link: "/en/security/dependency-policy" }] },
  { text: "Project", items: [{ text: "v1.0 acceptance checklist", link: "/en/release/v1-checklist" }, { text: "Honest comparison", link: "/en/market/honest-comparison" }, { text: "Writing a driver", link: "/en/drivers/authoring" }, { text: "Design guide", link: "/en/design/design-guide" }, { text: "CI/CD", link: "/en/ci-cd" }, { text: "Third-party licenses", link: "/en/legal/third-party-licenses" }] },
];
const esSidebar = [
  { text: "Inicio", items: [{ text: "Resumen", link: "/es/" }, { text: "Primeros pasos", link: "/es/guias/primeros-pasos" }, { text: "Migrar a RizomaDB", link: "/es/guias/migracion" }, { text: "Solución de problemas", link: "/es/guias/solucion-de-problemas" }] },
  { text: "Usar RizomaDB", items: [
    { text: "Conexiones", link: "/es/guias/conexiones" }, { text: "El editor de consultas", link: "/es/guias/editor-de-consultas" }, { text: "La rejilla de resultados", link: "/es/guias/rejilla-de-resultados" }, { text: "Usar el teclado", link: "/es/guias/teclado" }, { text: "Ayuda a probar RizomaDB", link: "/es/guias/ayuda-a-probar" },
    { text: "Edición de datos", link: "/es/guias/edicion-de-datos" }, { text: "Idioma y ajustes", link: "/es/guias/idioma-y-ajustes" } ] },
  { text: "Referencia", items: [{ text: "Ajustes", link: "/es/referencia/ajustes" }, { text: "Comandos", link: "/es/referencia/comandos" }, { text: "Matriz de capacidades", link: "/es/referencia/matriz-de-motores" }] },
  { text: "Motores", collapsed: true, items: [{ text: "Resumen de compatibilidad", link: "/es/motores/README" }, ...engines.map((e) => ({ text: engineName[e]!, link: `/es/motores/${e}` }))] },
  { text: "Empresa", items: [
    { text: "Políticas", link: "/es/empresa/politicas" }, { text: "Auditoría", link: "/es/empresa/auditoria" },
    { text: "Despliegue", link: "/es/empresa/despliegue" }, { text: "Cumplimiento", link: "/es/empresa/cumplimiento" } ] },
  { text: "Seguridad", items: [{ text: "Modelo de amenazas", link: "/es/seguridad/modelo-de-amenazas" }, { text: "Política de dependencias", link: "/es/seguridad/politica-de-dependencias" }] },
  { text: "Proyecto", items: [{ text: "Lista de aceptación v1.0", link: "/es/release/lista-de-aceptacion-v1" }, { text: "Comparación honesta", link: "/es/mercado/comparacion-honesta" }, { text: "Escribir un driver", link: "/es/drivers/crear-un-driver" }, { text: "Guía de diseño", link: "/es/design/guia-de-diseno" }, { text: "CI/CD", link: "/es/ci-cd" }, { text: "Licencias de terceros", link: "/es/legal/licencias-de-terceros" }] },
];

export default defineConfig({
  title: "RizomaDB",
  description: "Free, open-source, no-telemetry multi-engine database client for VS Code",
  srcDir: "content",
  cleanUrls: true,
  // GitHub Pages serves a project site under /<repo>/; the Pages workflow sets SITE_BASE, local builds stay at "/".
  base: process.env.SITE_BASE ?? "/",
  head: [["link", { rel: "icon", href: `${process.env.SITE_BASE ?? "/"}favicon.svg` }]],
  // The repo docs link to source files and to each other with repo-relative paths.
  ignoreDeadLinks: true,
  themeConfig: {
    logo: "/logo.svg",
    socialLinks: [{ icon: "github", link: "https://github.com/AnderCMD/RizomaDB" }],
    search: { provider: "local" },
  },
  locales: {
    root: { label: "English", lang: "en", link: "/en/", themeConfig: { sidebar: enSidebar, nav: [{ text: "Guide", link: "/en/guides/getting-started" }, { text: "Reference", link: "/en/reference/settings" }, { text: "Engines", link: "/en/reference/engine-matrix" }] } },
    es: { label: "Español", lang: "es", link: "/es/", themeConfig: { sidebar: esSidebar, nav: [{ text: "Guía", link: "/es/guias/primeros-pasos" }, { text: "Referencia", link: "/es/referencia/ajustes" }, { text: "Motores", link: "/es/referencia/matriz-de-motores" }] } },
  },
});
