<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo-horizontal-dark.svg">
    <img src="assets/brand/logo-horizontal-light.svg" alt="RizomaDB" width="420">
  </picture>
</p>

**Todas tus bases de datos, un solo lugar. Gratis.** · *All your databases, one place. Free.*

Un cliente de bases de datos multimotor para VS Code (y VSCodium, Cursor, Windsurf): Apache-2.0, sin telemetría, sin cuentas, sin funciones bloqueadas. [Read in English](README.md) · [Sitio de documentación](https://andercmd.github.io/RizomaDB/es/)

> **Estado: pre-lanzamiento.** Aún no se publica nada en el Marketplace, Open VSX ni npm, y la v1.0 **no** está lista: mira la [lista de aceptación](docs/release/v1-checklist.md), que es honesta. La extensión compila, se instala y pasa sus pruebas contra motores reales, pero nadie ha hecho una revisión completa con lector de pantalla.

## Qué hace
- **Conecta** con 24 motores desde una pantalla de logos, con el host, puerto y usuario habituales ya rellenados; entornos (`dev`, `staging`, `prod` o los tuyos) con protección; túneles SSH y proxies HTTP/SOCKS5; secretos solo en el almacén de secretos de VS Code. Las conexiones se agrupan por tipo en el árbol, con la activa y su base de datos en la barra de estado.
- **Consulta** en el lenguaje de cada motor, con un botón Ejecutar sobre cada sentencia, Ejecutar todo, Explicar, parámetros, una pantalla de historial con buscador y notebooks.
- **Explora y edita** en una rejilla hecha para ello: ordenar, filtrar (en las filas o en la base de datos), cambiar anchos, ocultar, panel de registro, copiar/guardar como CSV/TSV/JSON/Markdown, paginación con *Cargar más*, una línea de consulta editable y **edición de celdas en el sitio** con cambios pendientes que revisas y aplicas en una transacción. Renombra, cambia el tipo o elimina una columna desde su menú.
- **Diseña y mueve datos**: diseñador de tablas, diagramas ER, comparación y documentación de esquemas, importar/exportar, copia y restauración, comparación y sincronización de datos y generación de datos de prueba.
- **Gobierna**: políticas en capas donde gana la más estricta, un único punto de política y auditoría para toda escritura, enmascarado de columnas, catálogos compartidos sin secretos.
- **Extras opcionales**: un asistente de IA (apagado por defecto, solo con el esquema) y un servidor MCP de solo lectura con restricciones.
- **Español, inglés, portugués (Brasil) y francés** (los dos últimos con ayuda de IA, sin revisión nativa todavía), intercambiables dentro de la extensión, y una **guía** interactiva que te lleva de la mano.

## Motores
Probados contra servidores reales: PostgreSQL (y CockroachDB, YugabyteDB), MySQL/MariaDB (y TiDB), SQL Server, Oracle, SQLite, MongoDB, Redis/Valkey, ClickHouse, Elasticsearch/OpenSearch, DuckDB, Neo4j, DynamoDB (Local), InfluxDB 2 y 3, Cassandra/ScyllaDB, Firestore (emulador), Trino y **HydraDB (experimental)**. Lo que admite cada uno está en la [matriz de capacidades](docs/es/referencia/matriz-de-motores.md); los límites están en la página de cada motor en [docs/es/motores](docs/es/motores/README.md). Sin probar: servicios reales de AWS o Google Cloud, Redshift.

## Instalar
```bash
pnpm install
pnpm --filter rizomadb package
code --install-extension apps/extension/rizomadb-0.0.1.vsix
```
Luego haz clic en el icono de RizomaDB, o ejecuta **RizomaDB: Abrir la guía**. Recorrido completo: [Primeros pasos](docs/es/guias/primeros-pasos.md).

## Documentación
[Primeros pasos](docs/es/guias/primeros-pasos.md) · [Conexiones](docs/es/guias/conexiones.md) · [El editor de consultas](docs/es/guias/editor-de-consultas.md) · [La rejilla de resultados](docs/es/guias/rejilla-de-resultados.md) · [Edición de datos](docs/es/guias/edicion-de-datos.md) · [Idioma y ajustes](docs/es/guias/idioma-y-ajustes.md) · [Solución de problemas](docs/es/guias/solucion-de-problemas.md) · Referencia de [ajustes](docs/es/referencia/ajustes.md) y de [comandos](docs/es/referencia/comandos.md) · [Políticas](docs/es/empresa/politicas.md) · [Modelo de amenazas](docs/security/threat-model.md) · [CI/CD](docs/es/ci-cd.md) · [Guía de diseño](docs/design/design-guide.md) (en inglés) · [AGENTS.md](AGENTS.md)

## Desarrollo
```bash
pnpm install
docker compose -f test/compose/docker-compose.yml up -d postgres   # o el motor que quieras probar
pnpm lint && pnpm build && pnpm typecheck && pnpm test
node scripts/gen-reference.mjs        # regenera las páginas de referencia de ajustes, comandos y motores
```
`dev` es la rama de integración y `main` es lo que se despliega (el sitio de documentación); el CI corre en ambas. Mira [CONTRIBUTING.md](CONTRIBUTING.md), [docs/ci-cd.md](docs/ci-cd.md), los registros de decisión en [docs/adr](docs/adr) y el diario en [docs/ai/STATE.md](docs/ai/STATE.md).

## Licencia
Apache-2.0. Licencias de terceros: [docs/legal/third-party-licenses.md](docs/legal/third-party-licenses.md). Los logos de los motores se usan solo para identificarlos y pertenecen a sus dueños ([detalle](docs/legal/brand-logos.md)).
