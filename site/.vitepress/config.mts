import { defineConfig } from "vitepress";

const enSidebar = [
  { text: "Start", items: [{ text: "Overview", link: "/en/" }, { text: "Migrating to RizomaDB", link: "/en/guides/migration" }] },
  { text: "Engines", items: [{ text: "Support matrix", link: "/en/engines/README" }] },
  { text: "Enterprise", items: [
    { text: "Policy", link: "/en/enterprise/policy" }, { text: "Audit", link: "/en/enterprise/audit" },
    { text: "Deployment", link: "/en/enterprise/deployment" }, { text: "Compliance", link: "/en/enterprise/compliance" } ] },
  { text: "Security", items: [{ text: "Threat model", link: "/en/security/threat-model" }, { text: "Dependency policy", link: "/en/security/dependency-policy" }] },
  { text: "Project", items: [{ text: "Honest comparison", link: "/en/market/honest-comparison" }, { text: "Writing a driver", link: "/en/drivers/authoring" }] },
];
const esSidebar = [
  { text: "Inicio", items: [{ text: "Resumen", link: "/es/" }] },
  { text: "Proyecto", items: [{ text: "Lista de aceptación v1.0", link: "/es/release/v1-checklist" }] },
  { text: "Decisiones (ADR)", items: [
    { text: "Nombre y marca", link: "/es/adr/0001-nombre-y-riesgo-de-marca" }, { text: "Stack y versiones", link: "/es/adr/0002-stack-y-versiones" },
    { text: "Política y conexión protegida", link: "/es/adr/0013-politica-y-conexion-protegida" } ] },
];

export default defineConfig({
  title: "RizomaDB",
  description: "Free, open-source, no-telemetry multi-engine database client for VS Code",
  srcDir: "content",
  cleanUrls: true,
  // The repo docs link to source files and to each other with repo-relative paths.
  ignoreDeadLinks: true,
  locales: {
    root: { label: "English", lang: "en", link: "/en/", themeConfig: { sidebar: enSidebar, nav: [{ text: "Docs", link: "/en/" }] } },
    es: { label: "Español", lang: "es", link: "/es/", themeConfig: { sidebar: esSidebar, nav: [{ text: "Documentación", link: "/es/" }] } },
  },
});
